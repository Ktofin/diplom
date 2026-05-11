package com.anonymous.Front

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.WindowManager

import com.facebook.react.ReactInstanceEventListener
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  companion object {
    const val ASSISTANT_PREFS = "front_assistant_prefs"
    const val KEY_ASSISTANT_PENDING = "assistant_pending_launch"
    const val KEY_ASSISTANT_PENDING_SINCE = "assistant_pending_since"
    private const val ASSISTANT_PENDING_WINDOW_MS = 10_000L
    private const val TAG = "FrontAssistantMain"
  }

  private fun consumePendingAssistantLaunch(): Boolean {
    return try {
      val prefs = getSharedPreferences(ASSISTANT_PREFS, MODE_PRIVATE)
      val pending = prefs.getBoolean(KEY_ASSISTANT_PENDING, false)
      val pendingSince = prefs.getLong(KEY_ASSISTANT_PENDING_SINCE, 0L)
      if (!pending) {
        return false
      }

      prefs
        .edit()
        .putBoolean(KEY_ASSISTANT_PENDING, false)
        .remove(KEY_ASSISTANT_PENDING_SINCE)
        .apply()

      val ageMs =
        if (pendingSince > 0L) {
          System.currentTimeMillis() - pendingSince
        } else {
          -1L
        }
      val fresh = pendingSince <= 0L || (ageMs in 0..ASSISTANT_PENDING_WINDOW_MS)
      Log.d(TAG, "consumePendingAssistantLaunch pending=true fresh=$fresh ageMs=$ageMs")
      fresh
    } catch (_: Throwable) {
      false
    }
  }

  private fun isAssistantIntent(intent: Intent?): Boolean {
    if (intent == null) return false
    if (intent.getBooleanExtra("assistant_mode", false)) return true
    if (intent.hasCategory(Intent.CATEGORY_VOICE)) return true

    val data = intent.data ?: return false
    return data.host == "assistant" || data.path == "/assistant" || data.getQueryParameter("mode") == "assistant"
  }

  private fun normalizeAssistantIntent(intent: Intent?) {
    if (intent == null) return
    val hasPendingLaunch = consumePendingAssistantLaunch()
    Log.d(
      TAG,
      "normalizeAssistantIntent hasPendingLaunch=$hasPendingLaunch action=${intent.action} categories=${intent.categories} data=${intent.data}"
    )

    if (hasPendingLaunch && !intent.getBooleanExtra("assistant_mode", false)) {
      intent.putExtra("assistant_mode", true)
    }

    if (intent.getBooleanExtra("assistant_mode", false)) {
      if (intent.data == null) {
        intent.action = Intent.ACTION_VIEW
        intent.data = Uri.parse("exp+front://assistant?mode=assistant")
      }
      return
    }

    val data = intent.data
    if (intent.hasCategory(Intent.CATEGORY_VOICE)) {
      intent.putExtra("assistant_mode", true)
      if (data == null) {
        intent.action = Intent.ACTION_VIEW
        intent.data = Uri.parse("exp+front://assistant?mode=assistant")
      }
      return
    }

    if (data != null) {
      val isAssistant =
        data.host == "assistant" ||
          data.path == "/assistant" ||
          data.getQueryParameter("mode") == "assistant"

      if (isAssistant) {
        intent.putExtra("assistant_mode", true)
      }
    }
  }

  private fun sendAssistantModeEvent(isAssistant: Boolean) {
    try {
      val reactContext = (application as MainApplication).reactNativeHost.reactInstanceManager.currentReactContext
      if (reactContext == null || !reactContext.hasActiveCatalystInstance()) {
        Log.w(TAG, "ReactContext not ready, skip event")
        return
      }

      Log.d(TAG, "sendAssistantModeEvent assistant_mode=$isAssistant")
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(
          "onAssistantModeChanged",
          Arguments.createMap().apply {
            putBoolean("assistant_mode", isAssistant)
          }
        )
    } catch (error: Throwable) {
      Log.e(TAG, "Failed to send assistant mode event", error)
    }
  }

  private fun emitAssistantModeWhenReady(isAssistant: Boolean) {
    val manager = (application as MainApplication).reactNativeHost.reactInstanceManager
    val reactContext = manager.currentReactContext

    if (reactContext != null && reactContext.hasActiveCatalystInstance()) {
      sendAssistantModeEvent(isAssistant)
      return
    }

    Log.d(TAG, "ReactContext not ready, wait for init")
    val listener = object : ReactInstanceEventListener {
      override fun onReactContextInitialized(context: ReactContext) {
        Log.d(TAG, "ReactContext initialized callback")
        runOnUiThread { sendAssistantModeEvent(isAssistant) }
        manager.removeReactInstanceEventListener(this)
      }
    }
    manager.addReactInstanceEventListener(listener)
    if (!manager.hasStartedCreatingInitialContext()) {
      manager.createReactContextInBackground()
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    normalizeAssistantIntent(intent)
    super.onCreate(savedInstanceState)
    Log.d(TAG, "onCreate intent=$intent data=${intent?.data}")
    val isAssistant = isAssistantIntent(intent)
    Log.d(TAG, "onCreate assistant=$isAssistant voiceRoot=${runCatching { isVoiceInteractionRoot }.getOrDefault(false)}")
    if (isAssistant) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        setShowWhenLocked(true)
        setTurnScreenOn(true)
      }
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
      )
      emitAssistantModeWhenReady(true)
    }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    Log.d(TAG, "onNewIntent intent=$intent data=${intent.data}")
    normalizeAssistantIntent(intent)
    setIntent(intent)
    val isAssistant = isAssistantIntent(intent)
    Log.d(TAG, "onNewIntent assistant=$isAssistant voiceRoot=${runCatching { isVoiceInteractionRoot }.getOrDefault(false)}")
    emitAssistantModeWhenReady(isAssistant)
  }

  override fun onResume() {
    super.onResume()
    if (isAssistantIntent(intent)) {
      Log.d(TAG, "onResume assistant mode")
    }
  }

  override fun onPause() {
    super.onPause()
    if (isAssistantIntent(intent)) {
      Log.d(TAG, "onPause assistant mode")
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){
            override fun getLaunchOptions(): Bundle {
              return Bundle().apply {
                putBoolean("assistant_mode", isAssistantIntent(intent))
              }
            }
          })
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
