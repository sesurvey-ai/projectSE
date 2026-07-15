package com.sesurvey.se_survey

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView

class IncomingCallActivity : Activity() {

    private var caseId: Int = 0
    private var notificationId: Int = 0
    private var incidentLocation: String = ""
    private var claimNo: String = ""
    private var insuranceCompany: String = ""
    private var actionTaken = false // กดรับ/ปฏิเสธแล้วหรือยัง — กันโพสต์ bar หลังจบงาน

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

        bindData(intent)

        // ปุ่มรับงาน
        findViewById<Button>(R.id.btn_accept).setOnClickListener {
            handleAction("accept")
        }

        Log.d("IncomingCall", "Activity created: caseId=$caseId claim=$claimNo")
    }

    // อ่านข้อมูลจาก intent → ตั้งค่า UI (ใช้ทั้ง onCreate และ onNewIntent ตอนแตะ notification เปิดกลับ)
    private fun bindData(source: Intent) {
        caseId = source.getIntExtra("case_id", caseId)
        notificationId = source.getIntExtra("notification_id", notificationId)
        incidentLocation = source.getStringExtra("incident_location") ?: incidentLocation
        claimNo = source.getStringExtra("claim_no") ?: claimNo
        insuranceCompany = source.getStringExtra("insurance_company") ?: insuranceCompany

        // การ์ด: สถานที่เกิดเหตุ อย่างเดียว (ว่าง = "ไม่ระบุสถานที่")
        findViewById<TextView>(R.id.txt_incident).text = if (incidentLocation.isNotBlank()) incidentLocation else "ไม่ระบุสถานที่"
        // ชื่อย่อบริษัทประกัน (ใต้โลโก้)
        val shortName = NotificationHelper.shortInsurer(insuranceCompany)
        findViewById<TextView>(R.id.txt_insurance_name).text = if (shortName.isNotBlank()) shortName else "-"

        // โลโก้บริษัทประกัน — ตอนนี้มี TPB; บริษัทที่ไม่มีโลโก้ = ซ่อน (เหลือชื่อย่อบอก identity)
        val logoView = findViewById<ImageView>(R.id.img_logo)
        if (insuranceCompany.contains("ไทยไพบูลย์") || insuranceCompany.contains("TPB", ignoreCase = true)) {
            logoView.setImageResource(R.drawable.logo_tpb)
            logoView.visibility = View.VISIBLE
        } else {
            logoView.visibility = View.GONE
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // งานใหม่ (คนละเคส) เข้ามาทับหน้าเต็มจอของงานแรกที่ยังไม่ได้กดรับ — ถ้าไม่ทำอะไร
        // งานแรกจะหายเงียบ (ไม่มีทั้งจอและ bar เพราะ onResume ของมันเคย cancel bar ไปแล้ว)
        // → โพสต์ notification bar ของงานแรกคืนก่อนสลับข้อมูลเป็นงานใหม่
        val newCaseId = intent.getIntExtra("case_id", caseId)
        if (newCaseId != caseId && caseId != 0 && !actionTaken) {
            NotificationHelper.showFallbackNotification(this, notificationId, "งานสำรวจใหม่", caseId, incidentLocation, claimNo, insuranceCompany)
        }
        setIntent(intent)
        bindData(intent)
    }

    override fun onResume() {
        super.onResume()
        // หน้าเต็มจอกำลังแสดง → ซ่อน notification bar (กันซ้อน) — ไม่หยุดเสียง
        NotificationHelper.cancelBarOnly(this, notificationId)
    }

    override fun onStop() {
        super.onStop()
        // หน้าเต็มจอหลุดไปพื้นหลัง (กด Home/Recent) โดยยังไม่กดรับ → โชว์ notification bar ให้กดรับได้
        if (!isFinishing && !actionTaken) {
            NotificationHelper.showFallbackNotification(this, notificationId, "งานสำรวจใหม่", caseId, incidentLocation, claimNo, insuranceCompany)
        }
    }

    private fun handleAction(action: String) {
        actionTaken = true
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
