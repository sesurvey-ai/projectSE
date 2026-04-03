package com.sesurvey.se_survey

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.util.Log
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat

object NotificationHelper {

    private const val CHANNEL_ID = "incoming_call_channel_v4"
    private var mediaPlayer: MediaPlayer? = null

    fun showIncomingNotification(context: Context, id: Int, title: String, caseId: Int) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Create notification channel (ไม่ใส่เสียงใน channel — เล่นเสียงเองผ่าน MediaPlayer)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            listOf(
                "incoming_call_channel", "incoming_call_channel_v1",
                "incoming_call_channel_v2", "incoming_call_channel_v3",
                "urgent_alarm_v7",
            ).forEach {
                try { nm.deleteNotificationChannel(it) } catch (_: Exception) {}
            }

            val channel = NotificationChannel(
                CHANNEL_ID,
                "งานสำรวจเข้ามา",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "แจ้งเตือนงานสำรวจใหม่แบบสายเรียกเข้า"
                setSound(null, null) // ปิดเสียง channel — ใช้ MediaPlayer แทน
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500, 200, 500)
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                setBypassDnd(true)
            }
            nm.createNotificationChannel(channel)
        }

        // Custom layout
        val customView = RemoteViews(context.packageName, R.layout.notification_incoming)
        customView.setTextViewText(R.id.notification_title, title)

        // Decline button
        val declineIntent = Intent(context, NotificationActionReceiver::class.java).apply {
            action = NotificationActionReceiver.ACTION_DECLINE
            putExtra(NotificationActionReceiver.EXTRA_NOTIFICATION_ID, id)
            putExtra(NotificationActionReceiver.EXTRA_CASE_ID, caseId)
        }
        val declinePi = PendingIntent.getBroadcast(
            context, id * 2, declineIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        customView.setOnClickPendingIntent(R.id.btn_decline, declinePi)

        // Accept button
        val acceptIntent = Intent(context, NotificationActionReceiver::class.java).apply {
            action = NotificationActionReceiver.ACTION_ACCEPT
            putExtra(NotificationActionReceiver.EXTRA_NOTIFICATION_ID, id)
            putExtra(NotificationActionReceiver.EXTRA_CASE_ID, caseId)
        }
        val acceptPi = PendingIntent.getBroadcast(
            context, id * 2 + 1, acceptIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        customView.setOnClickPendingIntent(R.id.btn_accept, acceptPi)

        // Full screen intent → open app
        val fullScreenIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("notification_action", "tap")
            putExtra("case_id", caseId)
        }
        val fullScreenPi = PendingIntent.getActivity(
            context, id * 2 + 2, fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Build notification (ไม่ใส่ setSound — ใช้ MediaPlayer แทน)
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setCustomContentView(customView)
            .setCustomBigContentView(customView)
            .setCustomHeadsUpContentView(customView)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(false)
            .setOngoing(true)
            .setVibrate(longArrayOf(0, 500, 200, 500, 200, 500))
            .setFullScreenIntent(fullScreenPi, true)
            .setContentIntent(fullScreenPi)
            .build()

        nm.notify(id, notification)

        // เล่นเสียง alarm ผ่าน MediaPlayer (ดังได้ทุกสถานะ)
        startAlarm(context)
    }

    fun startAlarm(context: Context) {
        if (mediaPlayer?.isPlaying == true) return
        try {
            stopAlarm()
            val soundUri = Uri.parse("android.resource://${context.packageName}/raw/alarm_loop")
            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                setDataSource(context, soundUri)
                isLooping = true
                prepare()
                start()
            }
            Log.d("NotifHelper", "Alarm started")
        } catch (e: Exception) {
            Log.e("NotifHelper", "Alarm start error: $e")
        }
    }

    fun stopAlarm() {
        try {
            mediaPlayer?.let {
                if (it.isPlaying) it.stop()
                it.release()
            }
            mediaPlayer = null
            Log.d("NotifHelper", "Alarm stopped")
        } catch (e: Exception) {
            Log.e("NotifHelper", "Alarm stop error: $e")
        }
    }

    fun cancelNotification(context: Context, id: Int) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(id)
        stopAlarm()
    }
}
