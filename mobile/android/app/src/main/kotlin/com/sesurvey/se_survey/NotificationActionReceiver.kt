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
            /**
             * สลับปิด/เปิดเสียง — **ไม่ปิด notification** งานยังไม่ถูกรับ
             *
             * ⛔ ต้องโพสต์แจ้งเตือนใหม่ด้วย ไม่ใช่แค่หยุดเสียง — ไม่งั้นไอคอนเหมือนเดิม
             *    ช่างไม่รู้ว่ากดติดไหม แล้วเปิดเสียงกลับก็ไม่ได้ (user แจ้ง 01/09/69)
             */
            val nextMuted = intent.getBooleanExtra("next_muted", true)
            if (nextMuted) NotificationHelper.stopAlarm() else NotificationHelper.startAlarm(context)
            NotificationHelper.showNotificationBar(
                context,
                id = notificationId,
                title = intent.getStringExtra("title") ?: "งานสำรวจใหม่",
                caseId = caseId,
                incidentLocation = intent.getStringExtra("incident_location") ?: "",
                claimNo = intent.getStringExtra("claim_no") ?: "",
                insuranceCompany = intent.getStringExtra("insurance_company") ?: "",
                // ⛔ ห้ามพ่วง fullScreenIntent ตอนโพสต์ทับ — จอดับอยู่ระบบจะเด้งหน้าเต็มจอ
                //    ขึ้นมาใหม่ทั้งที่ช่างเพิ่งกดแค่ปิดเสียง
                withFullScreen = false,
                muted = nextMuted,
            )
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
