package com.sesurvey.se_survey

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView

class IncomingCallActivity : Activity() {

    private var caseId: Int = 0
    private var notificationId: Int = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // แสดงบน lock screen + เปิดจอ
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            km.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        setContentView(R.layout.activity_incoming_call)

        // รับข้อมูลจาก Intent
        caseId = intent.getIntExtra("case_id", 0)
        notificationId = intent.getIntExtra("notification_id", 0)
        val customerName = intent.getStringExtra("customer_name") ?: ""
        val address = intent.getStringExtra("address") ?: ""

        // ตั้งค่า UI
        findViewById<TextView>(R.id.txt_customer).text = customerName
        findViewById<TextView>(R.id.txt_address).text = address

        // ปุ่มปฏิเสธ
        findViewById<Button>(R.id.btn_decline).setOnClickListener {
            handleAction("decline")
        }

        // ปุ่มรับงาน
        findViewById<Button>(R.id.btn_accept).setOnClickListener {
            handleAction("accept")
        }

        Log.d("IncomingCall", "Activity created: caseId=$caseId customer=$customerName")
    }

    private fun handleAction(action: String) {
        // หยุดเสียง + ปิด notification
        NotificationHelper.cancelNotification(this, notificationId)

        // เปิดแอปหลักพร้อมส่ง action กลับ Flutter
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        launchIntent?.apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra("notification_action", action)
            putExtra("case_id", caseId)
        }
        startActivity(launchIntent)
        finish()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        // ไม่ให้กด back ปิดได้ — ต้องกดปุ่มรับ/ปฏิเสธ
    }
}
