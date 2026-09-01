package com.sesurvey.se_survey

import android.app.KeyguardManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
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

    /**
     * โลโก้บริษัทประกันจากชื่อในเคส — ไม่มีโลโก้ = null (ซ่อนรูป เหลือชื่อย่อบอกว่าบริษัทไหน)
     *
     * ⛔ ต้องเทียบแบบ "มีคำนี้อยู่ในชื่อ" ห้ามเทียบเป๊ะ — ชื่อที่บันทึกจริงมีหลายแบบปนกัน
     *    ("ไอโออิกรุงเทพประกันภัย" · "บริษัท ไทยไพบูลย์ประกันภัย จำกัด (มหาชน)")
     *    เทียบเป๊ะเมื่อไหร่ = โลโก้หายเงียบโดยไม่มีอะไรฟ้อง
     */
    fun logoFor(insuranceCompany: String): Int? = when {
        insuranceCompany.contains("ไทยไพบูลย์") ||
            insuranceCompany.contains("TPB", ignoreCase = true) -> R.drawable.logo_tpb
        insuranceCompany.contains("ไอโออิ") ||
            insuranceCompany.contains("AIOI", ignoreCase = true) -> R.drawable.logo_aioi
        else -> null
    }

    /**
     * ชื่อภาษาอังกฤษของบริษัทประกัน — **ไม่เก็บในฐานข้อมูล** เทียบจากชื่อไทยเอา (user ตัดสิน 31/08/69)
     *
     * ⛔ ใส่เฉพาะชื่อที่ยืนยันได้จากโลโก้/เอกสารของบริษัทเอง หรือ user ยืนยันมาเอง —
     *    ไม่รู้ = คืน null แล้วซ่อนบรรทัดนั้น · เดาคำแปลไปแปะบนจอที่พนักงานเห็นทุกวัน
     *    แย่กว่าไม่มีบรรทัดนั้นเลย (บริษัทที่ 3 เพิ่มทีหลังก็มาต่อที่นี่จุดเดียว)
     */
    fun insurerEnglish(insuranceCompany: String): String? = when {
        insuranceCompany.contains("ไทยไพบูลย์") ||
            insuranceCompany.contains("TPB", ignoreCase = true) -> "THAIPAIBOON INSURANCE"
        insuranceCompany.contains("ไอโออิ") ||
            insuranceCompany.contains("AIOI", ignoreCase = true) -> "AIOI BANGKOK INSURANCE"
        else -> null
    }

    // ชื่อย่อบริษัทประกัน — ตัด "บริษัท" นำหน้า และ "จำกัด (มหาชน)" ท้าย
    // เช่น "บริษัท ไทยไพบูลย์ประกันภัย จำกัด (มหาชน)" → "ไทยไพบูลย์ประกันภัย"
    fun shortInsurer(name: String): String {
        var s = name.trim()
        s = s.replace(Regex("^บริษัท\\s*"), "")
        s = s.replace(Regex("\\s*จำกัด.*$"), "")
        return s.trim()
    }

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

        // 4. กดปุ่ม Home จากแอปเรา → หน้า Home
        if (MainActivity.getWasOnHomeScreen(context)) return ScreenState.HOME_SCREEN

        // 5. แอปอื่น
        return ScreenState.OTHER_APP
    }

    // ── แสดง notification ตามเงื่อนไข ─────────────────────────────
    fun showIncomingNotification(context: Context, id: Int, title: String, caseId: Int,
                                    incidentLocation: String = "", claimNo: String = "", insuranceCompany: String = "") {

        val state = getScreenState(context)
        Log.d("NotifHelper", "Screen state: $state")

        ensureChannel(context)

        if (state == ScreenState.APP_FOREGROUND) {
            // แอป SE Survey เปิดอยู่ (พนักงานกำลังกรอก/ตรวจข้อมูล) → แจ้งเตือนแบบ notification bar อย่างเดียว
            // ไม่เด้งหน้าเต็มจอทับงานที่ทำค้างอยู่
            showNotificationBar(context, id, title, caseId, incidentLocation, claimNo, insuranceCompany)
        } else {
            // จอปิด/ล็อก/หน้า Home/แอปอื่น:
            // โพสต์ notification (พ่วง fullScreenIntent) "ก่อนเสมอ" — จอปิด/ล็อก: ระบบเปิดหน้าเต็มจอจาก FSI
            // ให้เอง, จอเปิด: heads-up + ปุ่มรับงานค้างเป็นหลักประกัน แล้วค่อยลองเปิดหน้าเต็มจอตรง (UX เดิม)
            // Android 10+ บล็อก startActivity จาก background service ถ้าไม่มี SYSTEM_ALERT_WINDOW —
            // เดิมทางนี้เป็นทางเดียว: ผู้ใช้ปิด permission = ไม่มีอะไรบนจอเลย เหลือแต่เสียง alarm วน
            // (bar ถูกซ่อนเองเมื่อหน้าเต็มจอแสดงสำเร็จ — IncomingCallActivity.onResume → cancelBarOnly)
            showNotificationBar(context, id, title, caseId, incidentLocation, claimNo, insuranceCompany)
            showFullscreen(context, id, caseId, incidentLocation, claimNo, insuranceCompany)
        }

        // เล่นเสียง alarm ทุกกรณี
        startAlarm(context)
    }

    // โพสต์ notification bar (fallback) — เรียกจาก IncomingCallActivity (onStop/onNewIntent)
    // withFullScreen=false: ทางนี้ต้องการแค่ bar — ถ้าพ่วง FSI ตอนจอยังดับ ระบบจะยิงหน้าเต็มจอ
    // ของ "งานเก่า" กลับมาทับงานใหม่ที่เพิ่งเด้ง (ping-pong ระหว่างสองเคส)
    fun showFallbackNotification(context: Context, id: Int, title: String, caseId: Int,
                                 incidentLocation: String, claimNo: String, insuranceCompany: String) {
        ensureChannel(context)
        showNotificationBar(context, id, title, caseId, incidentLocation, claimNo, insuranceCompany, withFullScreen = false)
    }

    // ยกเลิกเฉพาะ notification bar (ไม่หยุดเสียง alarm) — ใช้ตอนหน้าเต็มจอกลับมาแสดง (onResume)
    fun cancelBarOnly(context: Context, id: Int) {
        (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(id)
    }

    // ── Fullscreen Activity ───────────────────────────────────────
    private fun showFullscreen(context: Context, id: Int, caseId: Int,
                                incidentLocation: String, claimNo: String, insuranceCompany: String) {
        val intent = Intent(context, IncomingCallActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("case_id", caseId)
            putExtra("notification_id", id)
            putExtra("incident_location", incidentLocation)
            putExtra("claim_no", claimNo)
            putExtra("insurance_company", insuranceCompany)
        }
        // best-effort: Android 10+ อาจบล็อก background start (ทิ้งเงียบหรือ throw บางรุ่น)
        // — notification + fullScreenIntent ที่โพสต์ไว้ก่อนหน้าเป็นหลักประกันแล้ว
        try {
            context.startActivity(intent)
            Log.d("NotifHelper", "Fullscreen launched: caseId=$caseId")
        } catch (e: Exception) {
            Log.w("NotifHelper", "Fullscreen launch blocked: $e (notification fallback already posted)")
        }
    }

    // ── Notification Bar ──────────────────────────────────────────
    private fun showNotificationBar(context: Context, id: Int, title: String,
                                     caseId: Int, incidentLocation: String, claimNo: String, insuranceCompany: String,
                                     withFullScreen: Boolean = true) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Custom layout
        val customView = RemoteViews(context.packageName, R.layout.notification_incoming)
        customView.setTextViewText(R.id.notification_title, title)
        // บรรทัดรอง: สถานที่เกิดเหตุ · บริษัทประกัน (ตัดเลขเคลม + ใช้ชื่อย่อบริษัท ให้สอดคล้องกับหน้าเต็มจอ)
        val sub = listOf(
            incidentLocation.trim(),
            shortInsurer(insuranceCompany)
        ).filter { it.isNotBlank() }.joinToString("  ·  ")
        customView.setTextViewText(R.id.notification_subtitle, sub)

        // เลขเคลม — เห็นเฉพาะแบบขยาย (แบบย่อสูงจำกัด ใส่ไม่ลง)
        // ⛔ set เฉพาะ customView: compactView ไม่มี id นี้ สั่งไปจะพังตอน apply
        if (claimNo.isNotBlank()) {
            customView.setTextViewText(R.id.notification_claim, "เลขเคลม $claimNo")
            customView.setViewVisibility(R.id.notification_claim, android.view.View.VISIBLE)
        } else {
            customView.setViewVisibility(R.id.notification_claim, android.view.View.GONE)
        }

        // แบบย่อ (collapsed/heads-up): หัวข้อ + ปุ่มรับงานเต็มปุ่ม — heads-up สูงจำกัด เลยตัดรายละเอียดออก
        val compactView = RemoteViews(context.packageName, R.layout.notification_incoming_compact)
        compactView.setTextViewText(R.id.notification_title, title)

        // Accept button — ต้องเป็น activity PendingIntent ตรง ๆ ห้ามผ่าน BroadcastReceiver
        // (Android 12+ บล็อก "notification trampoline": receiver → startActivity ถูกทิ้งเงียบ
        // = ผู้ใช้กดรับงานแล้วเสียงหยุด/noti หาย แต่แอปไม่เปิดและงานไม่ถูกรับจริง)
        // MainActivity.handleNotificationAction อ่าน notification_id แล้ว cancel noti + หยุดเสียงเอง
        val acceptIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("notification_action", "accept")
            putExtra("case_id", caseId)
            putExtra("notification_id", id)
        }
        val acceptPi = PendingIntent.getActivity(
            context, id * 2 + 1, acceptIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        customView.setOnClickPendingIntent(R.id.btn_accept, acceptPi)
        compactView.setOnClickPendingIntent(R.id.btn_accept, acceptPi)

        // ปุ่มปฏิเสธ (แบบขยายเท่านั้น) — **ไม่ปฏิเสธทันที** แต่เปิดหน้าเต็มจอพร้อมแผ่นเลือกเหตุผล
        // ⛔ กติกา "ต้องระบุเหตุผลก่อนปฏิเสธ" ต้องเหมือนกันทุกทางเข้า ไม่งั้นช่างเลี่ยงมาทางแถบ
        //    แล้วผู้จ่ายงานได้เหตุผลเปล่าเหมือนเดิม (ซึ่งคือปัญหาที่เพิ่งแก้ไป)
        // ⛔ ต้องเป็น activity PendingIntent เหมือนปุ่มรับงาน — Android 12+ บล็อก trampoline
        val declineIntent = Intent(context, IncomingCallActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("case_id", caseId)
            putExtra("notification_id", id)
            putExtra("incident_location", incidentLocation)
            putExtra("claim_no", claimNo)
            putExtra("insurance_company", insuranceCompany)
            putExtra("open_decline", true)
        }
        val declinePi = PendingIntent.getActivity(
            context, id * 2 + 4, declineIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        customView.setOnClickPendingIntent(R.id.btn_decline, declinePi)

        // Mute button
        val muteIntent = Intent(context, NotificationActionReceiver::class.java).apply {
            action = NotificationActionReceiver.ACTION_MUTE
            putExtra(NotificationActionReceiver.EXTRA_NOTIFICATION_ID, id)
            putExtra(NotificationActionReceiver.EXTRA_CASE_ID, caseId)
        }
        val mutePi = PendingIntent.getBroadcast(
            context, id * 2 + 3, muteIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        customView.setOnClickPendingIntent(R.id.btn_mute, mutePi)
        compactView.setOnClickPendingIntent(R.id.btn_mute, mutePi)

        // แตะ notification → เปิดหน้าเต็มจอ (การ์ด) กลับมา
        val tapIntent = Intent(context, IncomingCallActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("case_id", caseId)
            putExtra("notification_id", id)
            putExtra("incident_location", incidentLocation)
            putExtra("claim_no", claimNo)
            putExtra("insurance_company", insuranceCompany)
        }
        val tapPi = PendingIntent.getActivity(
            context, id * 2 + 2, tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setCustomContentView(compactView)
            .setCustomBigContentView(customView)
            .setCustomHeadsUpContentView(compactView)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(false)
            .setOngoing(true)
            .setVibrate(longArrayOf(0, 500, 200, 500, 200, 500))
            .setContentIntent(tapPi)
        if (withFullScreen) builder.setFullScreenIntent(tapPi, true)
        val notification = builder.build()

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
    /**
     * เพดานเวลาเสียงเตือน — ครบแล้วเงียบเอง **แต่แจ้งเตือนยังค้างอยู่บนแถบให้กดรับได้**
     *
     * ⛔ เดิมวนไม่มีจุดจบ: ช่างที่ติดประชุม/กำลังขับรถ/วางเครื่องไว้ที่บ้าน ไม่มีทางหยุดเสียง
     *    นอกจากกดรับงานที่ไปไม่ได้ (กด back บนหน้าเต็มจอก็ถูกปิดไว้) — เสียงดังยาวจน
     *    คนรอบข้างรำคาญ แล้วลงเอยด้วยการปิดเสียงแอปทั้งตัว ซึ่งแย่กว่าเดิมมาก
     * ⛔ ห้ามยกเลิก notification ตอนหมดเวลา — งานยังไม่ถูกรับ ต้องเหลือร่องรอยไว้เสมอ
     */
    private const val ALARM_MAX_MS = 60_000L
    private var stopHandler: android.os.Handler? = null
    private var stopRunnable: Runnable? = null

    /** ตั้ง/ต่อเวลานับถอยหลังปิดเสียง — งานใบใหม่เข้ามาระหว่างเสียงดังอยู่ต้องได้เวลาเต็มของมันเอง */
    private fun scheduleAutoStop() {
        cancelAutoStop()
        val h = android.os.Handler(android.os.Looper.getMainLooper())
        val r = Runnable {
            Log.d("NotifHelper", "Alarm auto-stopped after ${ALARM_MAX_MS / 1000}s")
            stopAlarm()
        }
        stopHandler = h
        stopRunnable = r
        h.postDelayed(r, ALARM_MAX_MS)
    }

    private fun cancelAutoStop() {
        stopRunnable?.let { stopHandler?.removeCallbacks(it) }
        stopHandler = null
        stopRunnable = null
    }

    fun startAlarm(context: Context) {
        // ต่อเวลาก่อนเช็ค isPlaying — งานใบที่ 2 เข้ามาตอนใบแรกยังดังอยู่ ต้องไม่โดนตัดกลางคัน
        // ด้วยนาฬิกาของใบแรก (early-return ข้างล่างจะข้ามการตั้งเวลาไปทั้งดุ้น)
        scheduleAutoStop()
        if (mediaPlayer?.isPlaying == true) return
        try {
            stopAlarm()
            scheduleAutoStop()   // stopAlarm ข้างบนล้างนาฬิกาทิ้ง — ตั้งใหม่ให้รอบนี้
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
        cancelAutoStop()   // หยุดเองแล้ว (กดรับ/กดปิดเสียง) → นาฬิกาที่ค้างอยู่ไม่มีงานทำแล้ว
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
