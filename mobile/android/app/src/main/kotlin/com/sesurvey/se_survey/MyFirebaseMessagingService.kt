package com.sesurvey.se_survey

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MyFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val data = remoteMessage.data
        Log.d("FCM-Native", "Message received: type=${data["type"]}")

        when (data["type"]) {
            "new_survey" -> handleNewSurvey(data)
            "request_location" -> handleRequestLocation(data)
        }
    }

    private fun handleNewSurvey(data: Map<String, String>) {
        val caseIdStr = data["case_id"] ?: ""
        val caseId = caseIdStr.toIntOrNull() ?: (System.currentTimeMillis() / 1000).toInt()
        val customerName = data["customer_name"] ?: data["title"] ?: "งานสำรวจใหม่"
        val address = data["incident_location"] ?: data["address"] ?: ""
        val title = if (customerName.startsWith("งาน")) customerName else "งานสำรวจใหม่: $customerName"

        NotificationHelper.showIncomingNotification(
            context = this,
            id = caseId,
            title = title,
            caseId = caseId,
            customerName = customerName,
            address = address,
        )
        Log.d("FCM-Native", "Incoming notification shown for caseId=$caseId")
    }

    private fun handleRequestLocation(data: Map<String, String>) {
        val requestId = data["request_id"] ?: ""
        Log.d("FCM-Native", "Location request received: request_id=$requestId")

        // อ่าน GPS ล่าสุด
        val location = LocationHelper.getLastKnownLocation(this)
        if (location != null) {
            // ส่ง GPS กลับ server ผ่าน REST API
            LocationHelper.postLocationToServer(
                context = this,
                latitude = location.latitude,
                longitude = location.longitude,
                requestId = requestId,
            )
            Log.d("FCM-Native", "Location sent: ${location.latitude}, ${location.longitude}")
        } else {
            Log.w("FCM-Native", "No location available")
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("FCM-Native", "New token: $token")
    }
}
