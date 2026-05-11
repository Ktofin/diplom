package com.anonymous.Front

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.animation.OvershootInterpolator
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import androidx.lifecycle.LifecycleOwner
import com.airbnb.lottie.LottieAnimationView
import com.airbnb.lottie.LottieDrawable
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class AssistantActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_FROM_VOICE_ASSISTANT = "from_voice_assistant"
        private const val TAG = "FrontAssistantActivity"
        private const val CAMERA_REQUEST_CODE = 2002
        private const val RECORD_AUDIO_REQUEST_CODE = 2003
        private const val DEFAULT_GREETING = "Привет! Чем могу помочь?"
        private const val LOGIN_REQUIRED = "Сначала войдите в аккаунт в основном приложении."
    }

    private val colorOverlay = Color.parseColor("#80020617")
    private val colorBubble = Color.parseColor("#CC060F1B")
    private val colorButtonBg = Color.parseColor("#E60F172A")
    private val colorBorder = Color.parseColor("#335EEAD4")
    private val colorAccent = Color.parseColor("#14B8A6")
    private val colorText = Color.parseColor("#F3FFFD")
    private val colorHint = Color.parseColor("#6696C6BE")

    private lateinit var rootView: FrameLayout
    private lateinit var greetingText: TextView
    private lateinit var textInputContainer: LinearLayout
    private lateinit var textInputField: EditText
    private lateinit var sendButton: Button
    private lateinit var buttonContainer: LinearLayout
    private lateinit var keyboardButton: ImageButton
    private lateinit var micLottie: LottieAnimationView
    private lateinit var cameraButton: ImageButton
    private lateinit var cameraPreviewContainer: FrameLayout
    private lateinit var cameraCloseButton: ImageButton
    private lateinit var cameraCaptureButton: ImageButton
    private lateinit var cameraSwitchButton: ImageButton
    private lateinit var cameraBusyOverlay: LinearLayout
    private lateinit var cameraBusyText: TextView

    private var isTextInputMode = false
    private var isCameraMode = false
    private var isRecording = false
    private var isBusy = false
    private var pendingMicStart = false
    private var currentRecordingFile: File? = null
    private var currentPlaybackFile: File? = null
    private var mediaRecorder: MediaRecorder? = null
    private var mediaPlayer: MediaPlayer? = null
    private var storedSession: AssistantStoredSession? = null
    private var storedPreferences: AssistantStoredPreferences? = null

    private var currentCameraSelector: CameraSelector = CameraSelector.DEFAULT_BACK_CAMERA
    private lateinit var cameraExecutor: ExecutorService
    private lateinit var apiExecutor: ExecutorService
    private var preview: Preview? = null
    private var imageCapture: ImageCapture? = null
    private var camera: Camera? = null
    private var previewView: PreviewView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d(TAG, "onCreate fromVoiceAssistant=${intent.getBooleanExtra(EXTRA_FROM_VOICE_ASSISTANT, false)}")

        cameraExecutor = Executors.newSingleThreadExecutor()
        apiExecutor = Executors.newSingleThreadExecutor()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
        @Suppress("DEPRECATION")
        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        )

        rootView = FrameLayout(this).apply {
            setBackgroundColor(colorOverlay)
        }

        greetingText = TextView(this).apply {
            text = DEFAULT_GREETING
            textSize = 20f
            setTextColor(colorText)
            gravity = Gravity.CENTER
            background = makeBubbleBackground()
            setPadding(dpToPx(20), dpToPx(16), dpToPx(20), dpToPx(16))
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
            ).apply {
                gravity = Gravity.CENTER
                bottomMargin = dpToPx(280)
            }
            alpha = 0f
        }

        textInputContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            visibility = View.GONE
            gravity = Gravity.CENTER_HORIZONTAL
            alpha = 0f
            setPadding(dpToPx(16), 0, dpToPx(16), dpToPx(16))
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM,
            ).apply {
                bottomMargin = dpToPx(140)
            }
        }

        textInputField = EditText(this).apply {
            hint = "Введите сообщение..."
            textSize = 16f
            setTextColor(colorText)
            setHintTextColor(colorHint)
            background = makeInputFieldBackground()
            setPadding(dpToPx(16), dpToPx(14), dpToPx(16), dpToPx(14))
            layoutParams = LinearLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                dpToPx(120),
            )
            gravity = Gravity.TOP
            maxLines = 4
        }

        sendButton = Button(this).apply {
            text = "Отправить"
            textSize = 14f
            setTextColor(Color.parseColor("#052F2D"))
            background = makeButtonBackground(colorAccent)
            layoutParams = LinearLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                dpToPx(44),
            ).apply {
                topMargin = dpToPx(12)
            }
            setOnClickListener { sendTextMessage() }
        }

        textInputContainer.addView(textInputField)
        textInputContainer.addView(sendButton)

        cameraPreviewContainer = FrameLayout(this).apply {
            visibility = View.GONE
            setBackgroundColor(Color.BLACK)
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
            )
            alpha = 0f
        }

        previewView = PreviewView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
            )
            scaleType = PreviewView.ScaleType.FILL_CENTER
        }
        cameraPreviewContainer.addView(previewView)

        cameraBusyOverlay = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            visibility = View.GONE
            alpha = 0f
            background = GradientDrawable().apply {
                cornerRadius = dpToPx(20).toFloat()
                setColor(Color.parseColor("#B3121C2A"))
                setStroke(dpToPx(1), colorBorder)
            }
            setPadding(dpToPx(24), dpToPx(20), dpToPx(24), dpToPx(20))
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER,
            )
        }

        cameraBusyText = TextView(this).apply {
            text = "Подождите..."
            textSize = 15f
            setTextColor(colorText)
            gravity = Gravity.CENTER
        }

        cameraBusyOverlay.addView(cameraBusyText)
        cameraPreviewContainer.addView(cameraBusyOverlay)

        val cameraControls = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dpToPx(16), dpToPx(8), dpToPx(16), dpToPx(8))
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.TOP,
            )
            background = GradientDrawable().apply {
                cornerRadius = dpToPx(16).toFloat()
                setColor(colorButtonBg)
                setStroke(dpToPx(1), colorBorder)
            }
            elevation = dpToPx(4).toFloat()
        }

        cameraCloseButton = createCameraControlButton(android.R.drawable.ic_menu_close_clear_cancel) {
            toggleCameraMode()
        }
        cameraCaptureButton = createCameraControlButton(android.R.drawable.ic_menu_camera) {
            captureAndSendPhoto()
        }
        cameraSwitchButton = createCameraControlButton(android.R.drawable.ic_menu_rotate) {
            switchCamera()
        }

        cameraControls.addView(cameraCloseButton)
        cameraControls.addView(View(this).apply { layoutParams = LinearLayout.LayoutParams(0, 1, 1f) })
        cameraControls.addView(cameraCaptureButton)
        cameraControls.addView(View(this).apply { layoutParams = LinearLayout.LayoutParams(0, 1, 1f) })
        cameraControls.addView(cameraSwitchButton)
        cameraPreviewContainer.addView(cameraControls)

        buttonContainer = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            alpha = 1f
            setPadding(0, 0, 0, dpToPx(16))
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM,
            )
        }

        keyboardButton = createSideButton(R.drawable.ic_keyboard) {
            toggleTextInputMode()
        }

        micLottie = LottieAnimationView(this).apply {
            setAnimation(R.raw.mic_wave)
            scaleType = ImageView.ScaleType.CENTER_CROP
            repeatCount = LottieDrawable.INFINITE
            repeatMode = LottieDrawable.REVERSE
            layoutParams = LinearLayout.LayoutParams(dpToPx(200), dpToPx(200)).apply {
                setMargins(dpToPx(8), 0, dpToPx(8), 0)
            }
            setOnClickListener {
                animateButton(this)
                handleMicClick()
            }
        }

        cameraButton = createSideButton(android.R.drawable.ic_menu_camera) {
            toggleCameraMode()
        }

        buttonContainer.addView(keyboardButton)
        buttonContainer.addView(micLottie)
        buttonContainer.addView(cameraButton)

        rootView.addView(cameraPreviewContainer)
        rootView.addView(greetingText)
        rootView.addView(textInputContainer)
        rootView.addView(buttonContainer)
        setContentView(rootView)

        ViewCompat.setOnApplyWindowInsetsListener(buttonContainer) { view, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.updatePadding(bottom = systemBars.bottom + dpToPx(16))
            WindowInsetsCompat.CONSUMED
        }

        greetingText.animate().alpha(1f).setDuration(400).start()
        buttonContainer.translationY = dpToPx(100).toFloat()
        buttonContainer.animate()
            .translationY(0f)
            .alpha(1f)
            .setDuration(400)
            .setStartDelay(150)
            .setInterpolator(OvershootInterpolator(0.7f))
            .start()

        storedSession = AssistantSessionStore.load(this)
        storedPreferences = AssistantSessionStore.loadPreferences(this)
        updateSessionState()
    }

    private fun updateSessionState() {
        val session = storedSession
        if (session?.token.isNullOrBlank()) {
            greetingText.text = LOGIN_REQUIRED
            Log.w(TAG, "No stored session found")
            return
        }

        val userName = session?.userName?.takeIf { it.isNotBlank() }
        val modelKey = storedPreferences?.modelKey ?: "model"
        Log.d(TAG, "Stored session loaded modelKey=$modelKey")
        greetingText.text = if (userName != null) {
            "Привет, $userName! Чем могу помочь?"
        } else {
            DEFAULT_GREETING
        }
    }

    private fun handleMicClick() {
        if (isBusy) {
            Toast.makeText(this, "Подождите, запрос ещё обрабатывается", Toast.LENGTH_SHORT).show()
            return
        }
        if (isRecording) {
            stopVoiceRecordingAndSubmit()
        } else {
            startVoiceRecording()
        }
    }

    private fun startVoiceRecording() {
        if (!ensureSession()) return
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingMicStart = true
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), RECORD_AUDIO_REQUEST_CODE)
            return
        }

        runCatching {
            val outputFile = File(cacheDir, "assistant-recording-${System.currentTimeMillis()}.m4a")
            mediaRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(this)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }

            mediaRecorder?.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioEncodingBitRate(128_000)
                setAudioSamplingRate(44_100)
                setOutputFile(outputFile.absolutePath)
                prepare()
                start()
            }

            currentRecordingFile = outputFile
            isRecording = true
            micLottie.playAnimation()
            greetingText.text = "Слушаю... Нажмите ещё раз, чтобы отправить"
            Log.d(TAG, "Voice recording started file=${outputFile.absolutePath}")
        }.onFailure { error ->
            cleanupRecorder()
            Log.e(TAG, "Failed to start voice recording", error)
            Toast.makeText(this, "Не удалось начать запись", Toast.LENGTH_SHORT).show()
        }
    }

    private fun stopVoiceRecordingAndSubmit() {
        val audioFile = currentRecordingFile
        if (audioFile == null) {
            cleanupRecorder()
            return
        }

        try {
            mediaRecorder?.stop()
        } catch (error: Throwable) {
            Log.e(TAG, "Failed to stop recorder", error)
        } finally {
            cleanupRecorder()
        }

        if (!audioFile.exists() || audioFile.length() <= 0L) {
            audioFile.delete()
            Toast.makeText(this, "Запись не получилась", Toast.LENGTH_SHORT).show()
            return
        }

        if (isCameraMode && imageCapture != null) {
            capturePhotoAfterVoice(audioFile)
        } else {
            submitRecordedAudio(audioFile)
        }
    }

    private fun submitRecordedAudio(audioFile: File) {
        val session = storedSession
        if (session == null) {
            audioFile.delete()
            showError(LOGIN_REQUIRED)
            return
        }

        setBusy(true, "Распознаю речь...")
        apiExecutor.execute {
            try {
                val transcript = AssistantApiClient.transcribeAudio(session.token, audioFile)
                Log.d(TAG, "Transcription received length=${transcript.length}")
                runOnUiThread {
                    greetingText.text = "Вы: $transcript\n\nДумаю..."
                }
                val assistantKey = resolveAssistantKey()
                val reply = AssistantApiClient.askQuestion(session.token, transcript, assistantKey)
                Log.d(TAG, "Assistant reply received length=${reply.length} assistantKey=$assistantKey")
                runOnUiThread {
                    deliverAssistantReply(reply)
                }
            } catch (error: Throwable) {
                Log.e(TAG, "Voice request failed", error)
                runOnUiThread {
                    setBusy(false)
                    showError(error.message ?: "Не удалось обработать голосовой запрос")
                }
            } finally {
                audioFile.delete()
            }
        }
    }

    private fun capturePhotoAfterVoice(audioFile: File) {
        val capture = imageCapture
        if (capture == null) {
            Log.w(TAG, "Voice finished but camera is not ready, fallback to voice only")
            submitRecordedAudio(audioFile)
            return
        }

        val outputFile = File(cacheDir, "assistant-voice-photo-${System.currentTimeMillis()}.jpg")
        val outputOptions = ImageCapture.OutputFileOptions.Builder(outputFile).build()
        setBusy(true, "Делаю снимок и готовлю запрос...")
        Log.d(TAG, "Capture photo after voice audio=${audioFile.absolutePath}")
        capture.takePicture(
            outputOptions,
            cameraExecutor,
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
                    Log.d(TAG, "Photo after voice saved path=${outputFile.absolutePath} size=${outputFile.length()}")
                    runOnUiThread {
                        submitRecordedAudioWithPhoto(audioFile, outputFile)
                    }
                }

                override fun onError(exception: ImageCaptureException) {
                    Log.e(TAG, "Photo after voice capture failed, fallback to voice only", exception)
                    runOnUiThread {
                        Toast.makeText(
                            this@AssistantActivity,
                            "Фото не удалось сделать, отправляю только голос",
                            Toast.LENGTH_SHORT,
                        ).show()
                    }
                    runOnUiThread {
                        submitRecordedAudio(audioFile)
                    }
                }
            },
        )
    }

    private fun submitRecordedAudioWithPhoto(audioFile: File, photoFile: File) {
        val session = storedSession
        if (session == null) {
            audioFile.delete()
            photoFile.delete()
            showError(LOGIN_REQUIRED)
            return
        }

        setBusy(true, "Распознаю речь и отправляю фото...")
        apiExecutor.execute {
            try {
                val transcript = AssistantApiClient.transcribeAudio(session.token, audioFile)
                val assistantKey = resolveAssistantKey()
                Log.d(
                    TAG,
                    "Voice+photo request transcriptLength=${transcript.length} photoSize=${photoFile.length()} assistantKey=$assistantKey",
                )
                runOnUiThread {
                    greetingText.text = "Вы: $transcript\n\nОтправляю фото..."
                }
                val reply = AssistantApiClient.askQuestionWithImage(
                    sessionToken = session.token,
                    prompt = transcript,
                    imageBytes = photoFile.readBytes(),
                    mimeType = "image/jpeg",
                    assistantKey = assistantKey,
                )
                Log.d(TAG, "Voice+photo request completed length=${reply.length} assistantKey=$assistantKey")
                runOnUiThread {
                    if (isCameraMode) {
                        toggleCameraMode()
                    }
                    deliverAssistantReply(reply)
                }
            } catch (error: Throwable) {
                Log.e(TAG, "Voice+photo request failed", error)
                runOnUiThread {
                    setBusy(false)
                    showError(error.message ?: "Не удалось отправить голос и фото")
                }
            } finally {
                audioFile.delete()
                photoFile.delete()
            }
        }
    }

    private fun sendTextMessage() {
        val text = textInputField.text?.toString()?.trim().orEmpty()
        if (text.isEmpty()) {
            Toast.makeText(this, "Введите текст", Toast.LENGTH_SHORT).show()
            return
        }
        if (!ensureSession()) return

        textInputField.setText("")
        if (isTextInputMode) {
            toggleTextInputMode()
        }

        greetingText.text = "Вы: $text\n\nДумаю..."
        setBusy(true, "Отправляю запрос...")

        val session = storedSession ?: return
        apiExecutor.execute {
            try {
                val assistantKey = resolveAssistantKey()
                val reply = AssistantApiClient.askQuestion(session.token, text, assistantKey)
                Log.d(TAG, "Text request completed length=${reply.length} assistantKey=$assistantKey")
                runOnUiThread {
                    deliverAssistantReply(reply)
                }
            } catch (error: Throwable) {
                Log.e(TAG, "Text request failed", error)
                runOnUiThread {
                    setBusy(false)
                    showError(error.message ?: "Не удалось отправить сообщение")
                }
            }
        }
    }

    private fun captureAndSendPhoto() {
        if (isBusy) return
        if (!ensureSession()) return

        val capture = imageCapture
        if (capture == null) {
            Toast.makeText(this, "Камера ещё не готова", Toast.LENGTH_SHORT).show()
            return
        }

        val outputFile = File(cacheDir, "assistant-photo-${System.currentTimeMillis()}.jpg")
        val outputOptions = ImageCapture.OutputFileOptions.Builder(outputFile).build()
        setBusy(true, "Делаю снимок...")
        capture.takePicture(
            outputOptions,
            cameraExecutor,
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
                    submitCapturedPhoto(outputFile)
                }

                override fun onError(exception: ImageCaptureException) {
                    Log.e(TAG, "Photo capture failed", exception)
                    runOnUiThread {
                        setBusy(false)
                        showError("Не удалось сделать снимок")
                    }
                }
            },
        )
    }

    private fun submitCapturedPhoto(photoFile: File) {
        val session = storedSession
        if (session == null) {
            photoFile.delete()
            runOnUiThread {
                setBusy(false)
                showError(LOGIN_REQUIRED)
            }
            return
        }

        apiExecutor.execute {
            try {
                val assistantKey = resolveAssistantKey()
                Log.d(TAG, "Submit photo size=${photoFile.length()} assistantKey=$assistantKey path=${photoFile.absolutePath}")
                val reply = AssistantApiClient.askQuestionWithImage(
                    sessionToken = session.token,
                    prompt = "Опиши, что изображено на фото.",
                    imageBytes = photoFile.readBytes(),
                    mimeType = "image/jpeg",
                    assistantKey = assistantKey,
                )
                Log.d(TAG, "Photo request completed length=${reply.length} assistantKey=$assistantKey")
                runOnUiThread {
                    if (isCameraMode) {
                        toggleCameraMode()
                    }
                    deliverAssistantReply(reply)
                }
            } catch (error: Throwable) {
                Log.e(TAG, "Photo request failed", error)
                runOnUiThread {
                    setBusy(false)
                    showError(error.message ?: "Не удалось отправить фото")
                }
            } finally {
                photoFile.delete()
            }
        }
    }

    private fun deliverAssistantReply(reply: String) {
        setBusy(false)
        greetingText.text = reply
        speakAssistantReply(reply)
    }

    private fun speakAssistantReply(reply: String) {
        val speaker = resolveSpeaker()
        setBusy(true, "Озвучиваю ответ...")
        apiExecutor.execute {
            try {
                val result = AssistantApiClient.synthesizeSpeech(reply, speaker)
                val outputFile = File(cacheDir, "assistant-tts-${System.currentTimeMillis()}.wav")
                FileOutputStream(outputFile).use { it.write(result.audioBytes) }
                Log.d(TAG, "TTS ready speaker=${result.speaker} bytes=${result.audioBytes.size}")
                runOnUiThread {
                    playAudioFile(outputFile, reply)
                }
            } catch (error: Throwable) {
                Log.e(TAG, "TTS failed", error)
                runOnUiThread {
                    setBusy(false)
                    greetingText.text = reply
                    Toast.makeText(this, "Не удалось озвучить ответ", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun playAudioFile(file: File, reply: String) {
        stopPlayback(deleteFile = true)
        currentPlaybackFile = file
        greetingText.text = reply

        mediaPlayer = MediaPlayer().apply {
            setDataSource(file.absolutePath)
            setOnPreparedListener {
                setBusy(false)
                start()
            }
            setOnCompletionListener {
                stopPlayback(deleteFile = true)
            }
            setOnErrorListener { _, what, extra ->
                Log.e(TAG, "MediaPlayer error what=$what extra=$extra")
                setBusy(false)
                stopPlayback(deleteFile = true)
                true
            }
            prepareAsync()
        }
    }

    private fun resolveSpeaker(): String {
        return when (storedPreferences?.modelKey ?: "model") {
            "model6" -> "eugene"
            "robot" -> "aidar"
            else -> "kseniya"
        }
    }

    private fun resolveAssistantKey(): String {
        val modelKey = storedPreferences?.modelKey?.trim().orEmpty()
        return when (modelKey) {
            "model6", "robot", "model" -> modelKey
            else -> "model"
        }
    }

    private fun ensureSession(): Boolean {
        if (storedSession?.token.isNullOrBlank()) {
            showError(LOGIN_REQUIRED)
            return false
        }
        return true
    }

    private fun showError(message: String) {
        greetingText.text = message
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }

    private fun setBusy(busy: Boolean, loadingText: String? = null) {
        isBusy = busy
        sendButton.isEnabled = !busy
        keyboardButton.isEnabled = !busy
        micLottie.isEnabled = !busy || isRecording
        cameraButton.isEnabled = !busy
        cameraCaptureButton.isEnabled = !busy
        cameraCloseButton.isEnabled = !busy
        cameraSwitchButton.isEnabled = !busy
        textInputField.isEnabled = !busy
        if (busy && !loadingText.isNullOrBlank()) {
            greetingText.text = loadingText
        }
        if (isCameraMode) {
            if (busy) {
                greetingText.alpha = 1f
                greetingText.bringToFront()
                if (loadingText.isNullOrBlank()) {
                    greetingText.text = "Думаю..."
                }
            } else {
                greetingText.alpha = 0f
            }
        }
        updateCameraBusyOverlay(busy, loadingText)
    }

    private fun updateCameraBusyOverlay(busy: Boolean, loadingText: String?) {
        if (!::cameraBusyOverlay.isInitialized || !::cameraBusyText.isInitialized) {
            return
        }

        val shouldShow = busy && isCameraMode
        if (shouldShow) {
            cameraBusyText.text = loadingText?.ifBlank { null } ?: "Обрабатываю..."
            if (cameraBusyOverlay.visibility != View.VISIBLE) {
                cameraBusyOverlay.visibility = View.VISIBLE
                cameraBusyOverlay.animate().alpha(1f).setDuration(150).start()
            } else {
                cameraBusyOverlay.alpha = 1f
            }
        } else if (cameraBusyOverlay.visibility == View.VISIBLE) {
            cameraBusyOverlay.animate()
                .alpha(0f)
                .setDuration(150)
                .withEndAction { cameraBusyOverlay.visibility = View.GONE }
                .start()
        }
    }

    private fun cleanupRecorder() {
        isRecording = false
        pendingMicStart = false
        try {
            mediaRecorder?.reset()
        } catch (_: Throwable) {
        }
        try {
            mediaRecorder?.release()
        } catch (_: Throwable) {
        }
        mediaRecorder = null
        currentRecordingFile = null
        micLottie.cancelAnimation()
        micLottie.progress = 0f
    }

    private fun stopPlayback(deleteFile: Boolean = false) {
        try {
            mediaPlayer?.stop()
        } catch (_: Throwable) {
        }
        try {
            mediaPlayer?.release()
        } catch (_: Throwable) {
        }
        mediaPlayer = null
        if (deleteFile) {
            currentPlaybackFile?.delete()
        }
        currentPlaybackFile = null
    }

    private fun startCamera() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.CAMERA), CAMERA_REQUEST_CODE)
            return
        }

        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()

            preview = Preview.Builder().build().also {
                it.setSurfaceProvider(previewView?.surfaceProvider)
            }
            imageCapture = ImageCapture.Builder().build()

            try {
                cameraProvider.unbindAll()
                camera = cameraProvider.bindToLifecycle(
                    this as LifecycleOwner,
                    currentCameraSelector,
                    preview,
                    imageCapture,
                )
                Log.d(TAG, "Camera started")
            } catch (error: Exception) {
                Log.e(TAG, "Camera bind failed", error)
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun stopCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            try {
                val cameraProvider = cameraProviderFuture.get()
                cameraProvider.unbindAll()
                Log.d(TAG, "Camera stopped")
            } catch (error: Exception) {
                Log.e(TAG, "Camera unbind failed", error)
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun switchCamera() {
        currentCameraSelector =
            if (currentCameraSelector == CameraSelector.DEFAULT_BACK_CAMERA) {
                CameraSelector.DEFAULT_FRONT_CAMERA
            } else {
                CameraSelector.DEFAULT_BACK_CAMERA
            }
        if (isCameraMode) {
            stopCamera()
            startCamera()
        }
    }

    private fun createCameraControlButton(iconRes: Int, onClick: () -> Unit): ImageButton {
        return ImageButton(this).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(colorButtonBg)
                setStroke(dpToPx(1), colorBorder)
            }
            setImageResource(iconRes)
            setColorFilter(colorText)
            layoutParams = LinearLayout.LayoutParams(dpToPx(44), dpToPx(44))
            scaleType = ImageView.ScaleType.CENTER
            setOnClickListener {
                animateButton(this)
                onClick()
            }
        }
    }

    private fun createSideButton(iconRes: Int, onClick: () -> Unit): ImageButton {
        return ImageButton(this).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(colorButtonBg)
                setStroke(dpToPx(1), colorBorder)
            }
            setImageResource(iconRes)
            setColorFilter(colorText)
            layoutParams = LinearLayout.LayoutParams(dpToPx(52), dpToPx(52))
            scaleType = ImageView.ScaleType.CENTER
            setOnClickListener {
                animateButton(this)
                onClick()
            }
        }
    }

    private fun makeBubbleBackground(): GradientDrawable {
        return GradientDrawable().apply {
            cornerRadius = dpToPx(20).toFloat()
            setColor(colorBubble)
            setStroke(dpToPx(1), colorBorder)
        }
    }

    private fun makeInputFieldBackground(): GradientDrawable {
        return GradientDrawable().apply {
            cornerRadius = dpToPx(16).toFloat()
            setColor(colorButtonBg)
            setStroke(dpToPx(1), colorBorder)
        }
    }

    private fun makeButtonBackground(color: Int): GradientDrawable {
        return GradientDrawable().apply {
            cornerRadius = dpToPx(12).toFloat()
            setColor(color)
        }
    }

    private fun dpToPx(dp: Int): Int = (dp * resources.displayMetrics.density + 0.5f).toInt()

    private fun animateButton(view: View) {
        view.animate()
            .scaleX(0.85f)
            .scaleY(0.85f)
            .setDuration(100)
            .withEndAction {
                view.animate().scaleX(1f).scaleY(1f).setDuration(100).start()
            }
            .start()
    }

    private fun toggleTextInputMode() {
        if (isBusy) return
        if (isCameraMode) toggleCameraMode()
        isTextInputMode = !isTextInputMode
        if (isTextInputMode) {
            textInputContainer.visibility = View.VISIBLE
            textInputContainer.animate()
                .alpha(1f)
                .translationY(0f)
                .setDuration(300)
                .setInterpolator(OvershootInterpolator(0.8f))
                .start()
            greetingText.animate().alpha(0.3f).setDuration(200).start()
            textInputField.postDelayed({
                textInputField.requestFocus()
                val imm = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
                imm.showSoftInput(textInputField, InputMethodManager.SHOW_IMPLICIT)
            }, 300)
        } else {
            textInputContainer.animate()
                .alpha(0f)
                .translationY(dpToPx(50).toFloat())
                .setDuration(200)
                .withEndAction { textInputContainer.visibility = View.GONE }
                .start()
            greetingText.animate().alpha(1f).setDuration(200).start()
            val imm = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
            imm.hideSoftInputFromWindow(textInputField.windowToken, 0)
        }
    }

    private fun toggleCameraMode() {
        if (isBusy) return
        if (isTextInputMode) toggleTextInputMode()
        isCameraMode = !isCameraMode
        if (isCameraMode) {
            cameraPreviewContainer.visibility = View.VISIBLE
            cameraPreviewContainer.animate().alpha(1f).setDuration(300).start()
            buttonContainer.animate().alpha(0.3f).setDuration(200).start()
            greetingText.animate().alpha(0f).setDuration(200).start()
            updateCameraBusyOverlay(isBusy, greetingText.text?.toString())
            startCamera()
        } else {
            cameraPreviewContainer.animate()
                .alpha(0f)
                .setDuration(200)
                .withEndAction { cameraPreviewContainer.visibility = View.GONE }
                .start()
            buttonContainer.animate().alpha(1f).setDuration(200).start()
            greetingText.animate().alpha(1f).setDuration(200).start()
            updateCameraBusyOverlay(false, null)
            stopCamera()
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == CAMERA_REQUEST_CODE) {
            if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
                if (isCameraMode) startCamera() else Toast.makeText(this, "Камера активирована", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "Нужен доступ к камере", Toast.LENGTH_SHORT).show()
            }
            return
        }

        if (requestCode == RECORD_AUDIO_REQUEST_CODE) {
            val granted = grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED
            if (granted && pendingMicStart) {
                pendingMicStart = false
                startVoiceRecording()
            } else if (!granted) {
                pendingMicStart = false
                Toast.makeText(this, "Нужен доступ к микрофону", Toast.LENGTH_SHORT).show()
            }
        }
    }

    @Deprecated("Deprecated in Java")
    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        when {
            isRecording -> stopVoiceRecordingAndSubmit()
            isTextInputMode -> toggleTextInputMode()
            isCameraMode -> toggleCameraMode()
            else -> super.onBackPressed()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        stopCamera()
        stopPlayback(deleteFile = true)
        cleanupRecorder()
        cameraExecutor.shutdown()
        apiExecutor.shutdown()
    }
}
