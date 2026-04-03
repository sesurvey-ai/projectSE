package com.sesurvey.se_survey

import android.app.ActivityManager
import android.app.KeyguardManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.util.Log
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat

object NotificationHelper {

    private const val CHANNEL_ID = "incoming_call_channel_v5"
    private var mediaPlayer: MediaPlayer? = null

    // ── สถานะหน้าจอ ──────────────────────────────────────────────
    enum class ScreenState {
        SCREEN_OFF,      // จอปิด (ดับ)
        SCREEN_LOCKED,   // จอล็อค
        HOME_SCREEN,     // หน้า Home (launcher)
        APP_FOREGROUND,  // เปิดแอป SE Survey อยู่
        OTHER_APP        // เปิดแอปอื่น
    }

    fun getScreenState(context: Context): ScreenState {
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val km = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager

        // 1. จอปิด
        if (!pm.isInteractive) return ScreenState.SCREEN_OFF

        // 2. จอล็อค
        if (km.isKeyguardLocked) return ScreenState.SCREEN_LOCKED

        // 3. แอปเราอยู่ foreground
        if (MainActivity.isAppInForeground) return ScreenState.APP_FOREGROUND

        // 4. หน้า Home หรือแอปอื่น?
        if (isOnHomeScreen(context)) return ScreenState.HOME_SCREEN

        // 5. แอปอื่น
        return ScreenState.OTHER_APP
    }

    @Suppress("DEPRECATION")
    private fun isOnHomeScreen(context: Context): Boolean {
        try {
            val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val tasks = am.getRunningTasks(1)
            if (tasks.isNotEmpty()) {
                val topPackage = tasks[0].topActivity?.packageName ?: return false

                // เทียบกับ launcher packages ที่ติดตั้งอยู่
                val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
                val launchers = context.packageManager.queryIntentActivities(launcherIntent, PackageManager.MATCH_DEFAULT_ONLY)
                for (info in launchers) {
                    if (info.activityInfo.packageName == topPackage) {
                        return true
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("NotifHelper", "isOnHomeScreen error: $e")
        }
        return false
    }

    // ── แสดง notification ตามเงื่อนไข ─────────────────────────────
    fun showIncomingNotification(context: Context, id: Int, title: String, caseId: Int,
                                    customerName: String = "", address: String = "") {

        val state = getScreenState(context)
        Log.d("NotifHelper", "Screen state: $state")

        ensureChannel(context)

        when (state) {
            // Fullscreen: จอปิด, จอล็อค, หน้า Home
            ScreenState.SCREEN_OFF,
            ScreenState.SCREEN_LOCKED,
            ScreenState.HOME_SCREEN -> {
                showFullscreen(context, id, caseId, customerName, address)
            }
            // Notification Bar: เปิดแอป SE Survey, เปิดแอปอื่น
            ScreenState.APP_FOREGROUND,
            ScreenState.OTHER_APP -> {
                showNotificationBar(context, id, title, caseId, customerName, address)
            }
        }

        // เล่นเสียง alarm ทุกกรณี
        startAlarm(context)
    }

    // ── Fullscreen Activity ───────────────────────────────────────
    private fun showFullscreen(context: Context, id: Int, caseId: Int,
                                customerName: String, address: String) {
        val intent = Intent(context, IncomingCallActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("case_id", caseId)
            putExtra("notification_id", id)
            putExtra("customer_name", customerName)
            putExtra("address", address)
        }
        context.startActivity(intent)
        Log.d("NotifHelper", "Fullscreen launched: caseId=$caseId")
    }

    // ── Notification Bar ──────────────────────────────────────────
    private fun showNotificationBar(context: Context, id: Int, title: String,
                                     caseId: Int, customerName: String, address: String) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

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

        // Tap intent → open app
        val tapIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("notification_action", "tap")
            putExtra("case_id", caseId)
        }
        val tapPi = PendingIntent.getActivity(
            context, id * 2 + 2, tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

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
            .setContentIntent(tapPi)
            .build()

        nm.notify(id, notification)
        Log.d("NotifHelper", "Notification bar shown: caseId=$caseId")
    }

    // ── Notification Channel ──────────────────────────────────────
    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            listOf(
                "incoming_call_channel", "incoming_call_channel_v1",
                "incoming_call_channel_v2", "incoming_call_channel_v3",
                "incoming_call_channel_v4", "urgent_alarm_v7",
            ).forEach {
                try { nm.deleteNotificationChannel(it) } catch (_: Exception) {}
            }

            val channel = NotificationChannel(
                CHANNEL_ID, "งานสำรวจเข้ามา", NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "แจ้งเตือนงานสำรวจใหม่"
                setSound(null, null)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500, 200, 500)
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                setBypassDnd(true)
            }
            nm.createNotificationChannel(channel)
        }
    }

    // ── Alarm ─────────────────────────────────────────────────────
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
