package com.anonymous.Front

import android.content.Context
import org.json.JSONObject
import java.io.File

data class AssistantStoredSession(
  val token: String,
  val userName: String?,
)

data class AssistantStoredPreferences(
  val modelKey: String,
)

object AssistantSessionStore {
  private const val SESSION_FILE_NAME = "live2d-session.json"
  private const val PREFERENCES_FILE_NAME = "live2d-preferences.json"

  fun load(context: Context): AssistantStoredSession? {
    return try {
      val sessionFile = File(context.filesDir, SESSION_FILE_NAME)
      if (!sessionFile.exists()) {
        return null
      }

      val payload = JSONObject(sessionFile.readText(Charsets.UTF_8))
      val token = payload.optString("token").trim()
      if (token.isEmpty()) {
        return null
      }

      AssistantStoredSession(
        token = token,
        userName = payload.optString("name").trim().ifEmpty { null },
      )
    } catch (_: Throwable) {
      null
    }
  }

  fun loadPreferences(context: Context): AssistantStoredPreferences? {
    return try {
      val preferencesFile = File(context.filesDir, PREFERENCES_FILE_NAME)
      if (!preferencesFile.exists()) {
        return null
      }

      val payload = JSONObject(preferencesFile.readText(Charsets.UTF_8))
      val modelKey = payload.optString("modelKey").trim().ifEmpty { "model" }
      AssistantStoredPreferences(modelKey = modelKey)
    } catch (_: Throwable) {
      null
    }
  }
}
