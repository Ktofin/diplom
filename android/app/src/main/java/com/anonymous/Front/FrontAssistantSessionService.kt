package com.anonymous.Front

import android.os.Bundle
import android.service.voice.VoiceInteractionSession
import android.service.voice.VoiceInteractionSessionService
import android.util.Log

class FrontAssistantSessionService : VoiceInteractionSessionService() {
  companion object {
    private const val TAG = "FrontAssistantSessionSvc"
    @Volatile
    var currentSession: FrontAssistantSession? = null
  }

  override fun onNewSession(args: Bundle?): VoiceInteractionSession {
    Log.d(TAG, "onNewSession args=$args")
    val session = FrontAssistantSession(this)
    currentSession = session
    return session
  }
}
