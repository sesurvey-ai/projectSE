package com.sesurvey.se_survey

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MyFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val data = remoteMessage.data
        Log.d("FCM-Native", "Message received: type=${data["type"]}")

        if (data["type"] == "new_survey") {
            val caseIdStr = data["case_id"] ?: ""
            val caseId = caseIdStr.toIntOrNull() ?: (System.currentTimeMillis() / 1000).toInt()
            val customerName = data["customer_name"] ?: data["title"] ?: "งานสำรวจใหม่"
            val title = if (customerName.startsWith("งาน")) customerName else "งานสำรวจใหม่: $customerName"

            NotificationHelper.showIncomingNotification(
                context = this,
                id = caseId,
                title = title,
                caseId = caseId,
            )
            Log.d("FCM-Native", "Incoming notification shown for caseId=$caseId")
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("FCM-Native", "New token: $token")
        // Flutter side handles token registration via firebase_messaging plugin
    }
}
