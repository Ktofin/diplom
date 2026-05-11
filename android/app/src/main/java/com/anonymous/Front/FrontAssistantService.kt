package com.anonymous.Front

import android.service.voice.VoiceInteractionService
import android.util.Log

class FrontAssistantService : VoiceInteractionService() {
  companion object {
    private const val TAG = "FrontAssistantService"
  }

  override fun onReady() {
    super.onReady()
    Log.d(TAG, "onReady")
  }
}
