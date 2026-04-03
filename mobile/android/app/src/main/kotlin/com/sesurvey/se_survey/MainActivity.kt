package com.sesurvey.se_survey

import android.content.Context
import android.content.Intent
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {

    companion object {
        var isAppInForeground = false

        private const val PREFS = "notif_state"

        fun setWasOnHomeScreen(context: Context, value: Boolean) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putBoolean("was_on_home", value).apply()
        }

        fun getWasOnHomeScreen(context: Context): Boolean {
            return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getBoolean("was_on_home", false)
        }
    }

    private val CHANNEL = "com.sesurvey.se_survey/notification"
    private var methodChannel: MethodChannel? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        methodChannel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
        methodChannel?.setMethodCallHandler { call, result ->
            when (call.method) {
                "showIncomingNotification" -> {
                    val id = call.argument<Int>("id") ?: 0
                    val title = call.argument<String>("title") ?: ""
                    val caseId = call.argument<Int>("caseId") ?: 0
                    val customerName = call.argument<String>("customerName") ?: ""
                    val address = call.argument<String>("address") ?: ""
                    NotificationHelper.showIncomingNotification(this, id, title, caseId, customerName, address)
                    result.success(true)
                }
                "cancelNotification" -> {
                    val id = call.argument<Int>("id") ?: 0
                    NotificationHelper.cancelNotification(this, id)
                    result.success(true)
                }
                else -> result.notImplemented()
            }
        }
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        // เรียกเมื่อกดปุ่ม Home
        setWasOnHomeScreen(this, true)
    }

    override fun onResume() {
        super.onResume()
        isAppInForeground = true
        setWasOnHomeScreen(this, false)
        handleNotificationAction(intent)
    }

    override fun onPause() {
        super.onPause()
        isAppInForeground = false
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleNotificationAction(intent)
    }

    private fun handleNotificationAction(intent: Intent?) {
        val action = intent?.getStringExtra("notification_action") ?: return
        val caseId = intent.getIntExtra("case_id", 0)

        intent.removeExtra("notification_action")
        intent.removeExtra("case_id")

        methodChannel?.invokeMethod("onNotificationAction", mapOf(
            "action" to action,
            "caseId" to caseId
        ))
    }
}
