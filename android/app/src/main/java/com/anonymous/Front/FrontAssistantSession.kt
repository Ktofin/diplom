package com.anonymous.Front

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.service.voice.VoiceInteractionSession
import android.util.Log

class FrontAssistantSession(context: Context) : VoiceInteractionSession(context) {
    
    companion object {
        private const val TAG = "FrontAssistantSession"
        private const val LAUNCH_DELAY_MS = 500L
        private const val RETRY_DELAY_MS = 400L
    }

    private fun markAssistantLaunchPending() {
        context
            .getSharedPreferences(MainActivity.ASSISTANT_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(MainActivity.KEY_ASSISTANT_PENDING, true)
            .putLong(MainActivity.KEY_ASSISTANT_PENDING_SINCE, System.currentTimeMillis())
            .apply()
        Log.d(TAG, "markAssistantLaunchPending")
    }

    private fun tryLaunchActivity() {
        val intent = Intent(context, AssistantActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra(AssistantActivity.EXTRA_FROM_VOICE_ASSISTANT, true)
        }
        
        try {
            context.startActivity(intent)
            Log.d(TAG, "Activity started via context.startActivity")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start activity", e)
        }
    }

    override fun onShow(args: Bundle?, flags: Int) {
        super.onShow(args, flags)
        Log.d(TAG, "onShow called, scheduling launch")
        
        markAssistantLaunchPending()
        
        // Первая попытка запуска
        Handler(Looper.getMainLooper()).postDelayed({
            tryLaunchActivity()
            
            // Повторная попытка на всякий случай
            Handler(Looper.getMainLooper()).postDelayed({
                Log.d(TAG, "Retry launch attempt")
                tryLaunchActivity()
            }, RETRY_DELAY_MS)
            
            // Скрываем сессию после попыток
            Handler(Looper.getMainLooper()).postDelayed({
                hide()
                Log.d(TAG, "Session hidden")
            }, RETRY_DELAY_MS + 200)
            
        }, LAUNCH_DELAY_MS)
    }
}