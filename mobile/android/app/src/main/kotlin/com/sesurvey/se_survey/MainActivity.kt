package com.sesurvey.se_survey

import android.content.Intent
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {

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
                    NotificationHelper.showIncomingNotification(this, id, title, caseId)
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

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleNotificationAction(intent)
    }

    override fun onResume() {
        super.onResume()
        handleNotificationAction(intent)
    }

    private fun handleNotificationAction(intent: Intent?) {
        val action = intent?.getStringExtra("notification_action") ?: return
        val caseId = intent.getIntExtra("case_id", 0)

        // Clear the extras so we don't re-process
        intent.removeExtra("notification_action")
        intent.removeExtra("case_id")

        methodChannel?.invokeMethod("onNotificationAction", mapOf(
            "action" to action,
            "caseId" to caseId
        ))
    }
}
