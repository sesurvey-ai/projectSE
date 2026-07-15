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
        // การ์ดงานโชว์ 3 รายการ: สถานที่เกิดเหตุ · เลขเคลม · บริษัทประกัน
        val incidentLocation = data["incident_location"] ?: ""
        val claimNo = data["claim_no"] ?: ""
        val insuranceCompany = data["insurance_company"] ?: ""

        NotificationHelper.showIncomingNotification(
            context = this,
            id = caseId,
            title = "งานสำรวจใหม่",
            caseId = caseId,
            incidentLocation = incidentLocation,
            claimNo = claimNo,
            insuranceCompany = insuranceCompany,
        )
        Log.d("FCM-Native", "Incoming notification shown for caseId=$caseId")
    }

    private fun handleRequestLocation(data: Map<String, String>) {
        val requestId = data["request_id"] ?: ""
        Log.d("FCM-Native", "Location request received: request_id=$requestId")

        // จับ GPS สด (ให้แม่นเท่าตอนลงเวลา) — getFreshLocation จะ fallback เป็น last known ให้เองถ้าจับไม่ทัน
        val location = LocationHelper.getFreshLocation(this)
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
        Log.d("FCM-Native", "New token: ${token.take(12)}…") // อย่า log token เต็ม (credential)
        // token หมุนได้ตอนแอปถูก kill (Play Services อัปเดต/restore) — ฝั่ง Dart ไม่มีโอกาสเห็น
        // ถ้าไม่ส่งจาก native เลย server จะ push ไปที่ token ตายจนกว่าผู้ใช้จะเปิดแอปอีกครั้ง
        LocationHelper.postFcmTokenToServer(this, token)
    }
}
