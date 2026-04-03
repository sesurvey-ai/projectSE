package com.sesurvey.se_survey

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
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
                    val body = call.argument<String>("body") ?: ""
                    val caseId = call.argument<Int>("caseId") ?: 0
                    showIncomingNotification(id, title, body, caseId)
                    result.success(true)
                }
                "cancelNotification" -> {
                    val id = call.argument<Int>("id") ?: 0
                    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                    nm.cancel(id)
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

    private fun showIncomingNotification(id: Int, title: String, body: String, caseId: Int) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Create notification channel
        val channelId = "incoming_call_channel_v2"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Delete old channels
            listOf("incoming_call_channel", "incoming_call_channel_v1", "urgent_alarm_v7").forEach {
                try { nm.deleteNotificationChannel(it) } catch (_: Exception) {}
            }

            val soundUri: Uri = Uri.parse("android.resource://${packageName}/raw/alarm_loop")
            val audioAttr = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()

            val channel = NotificationChannel(
                channelId,
                "งานสำรวจเข้ามา",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "แจ้งเตือนงานสำรวจใหม่แบบสายเรียกเข้า"
                setSound(soundUri, audioAttr)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500, 200, 500)
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                setBypassDnd(true)
            }
            nm.createNotificationChannel(channel)
        }

        // Create custom RemoteViews layout
        val customView = RemoteViews(packageName, R.layout.notification_incoming)
        customView.setTextViewText(R.id.notification_title, title)

        // Decline button PendingIntent
        val declineIntent = Intent(this, NotificationActionReceiver::class.java).apply {
            action = NotificationActionReceiver.ACTION_DECLINE
            putExtra(NotificationActionReceiver.EXTRA_NOTIFICATION_ID, id)
            putExtra(NotificationActionReceiver.EXTRA_CASE_ID, caseId)
        }
        val declinePi = PendingIntent.getBroadcast(
            this, id * 2, declineIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        customView.setOnClickPendingIntent(R.id.btn_decline, declinePi)

        // Accept button PendingIntent
        val acceptIntent = Intent(this, NotificationActionReceiver::class.java).apply {
            action = NotificationActionReceiver.ACTION_ACCEPT
            putExtra(NotificationActionReceiver.EXTRA_NOTIFICATION_ID, id)
            putExtra(NotificationActionReceiver.EXTRA_CASE_ID, caseId)
        }
        val acceptPi = PendingIntent.getBroadcast(
            this, id * 2 + 1, acceptIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        customView.setOnClickPendingIntent(R.id.btn_accept, acceptPi)

        // Full screen intent (to show on lock screen)
        val fullScreenIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("notification_action", "tap")
            putExtra("case_id", caseId)
        }
        val fullScreenPi = PendingIntent.getActivity(
            this, id * 2 + 2, fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Build notification with custom layout
        val soundUri: Uri = Uri.parse("android.resource://${packageName}/raw/alarm_loop")
        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setCustomContentView(customView)
            .setCustomBigContentView(customView)
            .setCustomHeadsUpContentView(customView)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(false)
            .setOngoing(true)
            .setSound(soundUri)
            .setVibrate(longArrayOf(0, 500, 200, 500, 200, 500))
            .setFullScreenIntent(fullScreenPi, true)
            .setContentIntent(fullScreenPi)
            .build()

        // FLAG_INSISTENT — sound loops until user interacts
        notification.flags = notification.flags or 0x00000004

        nm.notify(id, notification)
    }
}
