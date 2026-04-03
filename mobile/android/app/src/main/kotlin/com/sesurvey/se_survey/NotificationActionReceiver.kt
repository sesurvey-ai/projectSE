package com.sesurvey.se_survey

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class NotificationActionReceiver : BroadcastReceiver() {
    companion object {
        const val ACTION_ACCEPT = "com.sesurvey.se_survey.ACTION_ACCEPT"
        const val ACTION_DECLINE = "com.sesurvey.se_survey.ACTION_DECLINE"
        const val ACTION_MUTE = "com.sesurvey.se_survey.ACTION_MUTE"
        const val EXTRA_NOTIFICATION_ID = "notification_id"
        const val EXTRA_CASE_ID = "case_id"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, 0)
        val caseId = intent.getIntExtra(EXTRA_CASE_ID, 0)
        val action = intent.action

        Log.d("NotifAction", "Received action=$action caseId=$caseId notifId=$notificationId")

        if (action == ACTION_MUTE) {
            // ปิดเสียงอย่างเดียว — ไม่ปิด notification
            NotificationHelper.stopAlarm()
            return
        }

        // Cancel notification + stop alarm
        NotificationHelper.cancelNotification(context, notificationId)

        // Send result back to Flutter via MainActivity
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        launchIntent?.apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra("notification_action", if (action == ACTION_ACCEPT) "accept" else "decline")
            putExtra("case_id", caseId)
        }
        context.startActivity(launchIntent)
    }
}
