package com.anonymous.Front

import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.File
import java.io.InputStream
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

object AssistantApiClient {
  private const val CONNECT_TIMEOUT_MS = 15_000
  private const val READ_TIMEOUT_MS = 120_000
  private const val DEFAULT_CHAT_TITLE = "Quick Assistant"

  fun askQuestion(sessionToken: String, prompt: String, assistantKey: String): String {
    val chatId = createChat(sessionToken, assistantKey)
    return sendChat(sessionToken, chatId, prompt, assistantKey = assistantKey)
  }

  fun askQuestionWithImage(
    sessionToken: String,
    prompt: String,
    imageBytes: ByteArray,
    mimeType: String,
    assistantKey: String,
  ): String {
    val chatId = createChat(sessionToken, assistantKey)
    return sendChat(
      sessionToken = sessionToken,
      chatId = chatId,
      prompt = prompt,
      imageBase64 = Base64.encodeToString(imageBytes, Base64.NO_WRAP),
      imageMimeType = mimeType,
      assistantKey = assistantKey,
    )
  }

  fun transcribeAudio(sessionToken: String, audioFile: File): String {
    val response =
      postMultipart(
        path = "/api/stt/transcribe",
        sessionToken = sessionToken,
        file = audioFile,
        fieldName = "audio",
        fileName = "assistant-recording.m4a",
        mimeType = "audio/mp4",
      )

    val transcript = response.optString("text").trim()
    if (transcript.isEmpty()) {
      throw IllegalStateException("Speech recognition returned an empty result.")
    }
    return transcript
  }

  fun synthesizeSpeech(text: String, speaker: String): AssistantTtsResult {
    val response =
      postJson(
        path = "/api/tts/synthesize",
        sessionToken = "",
        payload =
          JSONObject().apply {
            put("text", text)
            put("speaker", speaker)
          },
      )

    val audioBase64 = response.optString("audio_base64").trim()
    if (audioBase64.isEmpty()) {
      throw IllegalStateException("Speech synthesis returned empty audio.")
    }

    return AssistantTtsResult(
      text = response.optString("text").trim().ifEmpty { text },
      speaker = response.optString("speaker").trim().ifEmpty { speaker },
      mimeType = response.optString("mime_type").trim().ifEmpty { "audio/wav" },
      audioBytes = Base64.decode(audioBase64, Base64.DEFAULT),
    )
  }

  private fun createChat(sessionToken: String, assistantKey: String): String {
    val response =
      postJson(
        path = "/api/chats",
        sessionToken = sessionToken,
        payload =
          JSONObject().apply {
            put("assistant_key", assistantKey)
            put("title", DEFAULT_CHAT_TITLE)
          },
      )

    val chatId = response.optString("id").trim()
    if (chatId.isEmpty()) {
      throw IllegalStateException("Server did not return a chat id.")
    }
    return chatId
  }

  private fun sendChat(
    sessionToken: String,
    chatId: String,
    prompt: String,
    imageBase64: String? = null,
    imageMimeType: String? = null,
    assistantKey: String,
  ): String {
    val response =
      postJson(
        path = "/api/ai/chat",
        sessionToken = sessionToken,
        payload =
          JSONObject().apply {
            put(
              "messages",
              JSONArray().put(
                JSONObject().apply {
                  put("role", "user")
                  put("content", prompt)
                  put(
                    "images",
                    if (!imageBase64.isNullOrBlank()) {
                      JSONArray().put(imageBase64)
                    } else {
                      JSONArray()
                    }
                  )
                  put("image_mime_type", imageMimeType ?: JSONObject.NULL)
                }
              )
            )
            put("model", JSONObject.NULL)
            put("assistant_key", assistantKey)
            put("chat_id", chatId)
          },
      )

    val assistantText = response.optJSONObject("message")?.optString("content")?.trim().orEmpty()
    if (assistantText.isEmpty()) {
      throw IllegalStateException("Assistant returned an empty answer.")
    }
    return assistantText
  }

  private fun postJson(path: String, sessionToken: String, payload: JSONObject): JSONObject {
    val connection = openConnection(path, sessionToken)
    connection.requestMethod = "POST"
    connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
    connection.doOutput = true

    OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { writer ->
      writer.write(payload.toString())
    }

    return readJsonResponse(connection)
  }

  private fun postMultipart(
    path: String,
    sessionToken: String,
    file: File,
    fieldName: String,
    fileName: String,
    mimeType: String,
  ): JSONObject {
    val boundary = "Boundary-${UUID.randomUUID()}"
    val connection = openConnection(path, sessionToken)
    connection.requestMethod = "POST"
    connection.doOutput = true
    connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")

    connection.outputStream.use { output ->
      output.write("--$boundary\r\n".toByteArray(Charsets.UTF_8))
      output.write(
        "Content-Disposition: form-data; name=\"$fieldName\"; filename=\"$fileName\"\r\n".toByteArray(
          Charsets.UTF_8
        )
      )
      output.write("Content-Type: $mimeType\r\n\r\n".toByteArray(Charsets.UTF_8))
      file.inputStream().use { input ->
        input.copyTo(output)
      }
      output.write("\r\n--$boundary--\r\n".toByteArray(Charsets.UTF_8))
      output.flush()
    }

    return readJsonResponse(connection)
  }

  private fun openConnection(path: String, sessionToken: String): HttpURLConnection {
    val baseUrl = BuildConfig.API_BASE_URL.trimEnd('/')
    val connection = URL("$baseUrl$path").openConnection() as HttpURLConnection
    connection.connectTimeout = CONNECT_TIMEOUT_MS
    connection.readTimeout = READ_TIMEOUT_MS
    connection.setRequestProperty("Accept", "application/json")
    if (sessionToken.isNotBlank()) {
      connection.setRequestProperty("Authorization", "Bearer $sessionToken")
    }
    return connection
  }

  private fun readJsonResponse(connection: HttpURLConnection): JSONObject {
    return try {
      val statusCode = connection.responseCode
      val body = readBody(if (statusCode in 200..299) connection.inputStream else connection.errorStream)
      val payload = body.takeIf { it.isNotBlank() }?.let { raw ->
        runCatching { JSONObject(raw) }.getOrNull()
      }

      if (statusCode !in 200..299) {
        throw IllegalStateException(extractErrorMessage(statusCode, payload, body))
      }

      payload ?: JSONObject()
    } finally {
      connection.disconnect()
    }
  }

  private fun readBody(stream: InputStream?): String {
    if (stream == null) return ""
    return BufferedReader(InputStreamReader(stream, Charsets.UTF_8)).use(BufferedReader::readText)
  }

  private fun extractErrorMessage(statusCode: Int, payload: JSONObject?, rawBody: String): String {
    val detail = payload?.opt("detail")
    if (detail is JSONArray) {
      val parts = buildList {
        for (index in 0 until detail.length()) {
          val entry = detail.optJSONObject(index)
          val message = entry?.optString("msg")?.trim().orEmpty()
          if (message.isNotEmpty()) {
            add(message)
          }
        }
      }
      if (parts.isNotEmpty()) {
        return parts.joinToString("; ")
      }
    }

    val message = payload?.optString("detail")?.trim().orEmpty()
    return message.ifEmpty {
      rawBody.trim().ifEmpty { "Request failed: $statusCode" }
    }
  }
}

data class AssistantTtsResult(
  val text: String,
  val speaker: String,
  val mimeType: String,
  val audioBytes: ByteArray,
)
