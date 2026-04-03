# Prompt: สร้างระบบแจ้งเตือนแบบดังไม่หยุด (Insistent Notification) สำหรับ Flutter App

## บริบทของโปรเจกต์

ฉันกำลังพัฒนาแอป **SE SURVEY** ซึ่งเป็นระบบจัดการงานสำรวจประกันภัย/อุบัติเหตุ พัฒนาด้วย **Flutter** สำหรับ Surveyor ใช้งานในภาคสนาม โดยมี Backend เป็น **Node.js/Express** และใช้ **FCM (Firebase Cloud Messaging)** สำหรับ Push Notification

## สิ่งที่ต้องการ

สร้างระบบแจ้งเตือนแบบ **ดังตลอดเวลาจนกว่าผู้ใช้จะกดรับ** (เหมือนสายเรียกเข้าหรือนาฬิกาปลุก) เมื่อมีงานสำรวจใหม่เข้ามา โดยมีรายละเอียดดังนี้:

### พฤติกรรมที่ต้องการ (Android)

1. **เสียงดังวนซ้ำไม่หยุด** — ใช้ `FLAG_INSISTENT` (flag ค่า 4) ทำให้เสียง notification ดังวนซ้ำจนกว่าผู้ใช้จะโต้ตอบ
2. **เด้งเต็มจอ (Full-Screen Intent)** — แม้จอล็อคหรือจอดับ ให้แสดงหน้าจอรับงานขึ้นมาเต็มจอ
3. **ปัดทิ้งไม่ได้ (Ongoing)** — ผู้ใช้ต้องกดปุ่ม "รับงาน" หรือ "ปฏิเสธ" เท่านั้น
4. **สั่น (Vibration)** — สั่นต่อเนื่องพร้อมเสียง
5. **เมื่อกดรับงาน** — ยกเลิก notification, หยุดเสียง, นำทางไปหน้ารายละเอียดงาน
6. **เมื่อกดปฏิเสธ** — ยกเลิก notification, หยุดเสียง, กลับหน้าเดิม

### สิ่งที่ต้องสร้าง

1. **Notification Service** (`lib/services/notification_service.dart`)
   - ตั้งค่า `flutter_local_notifications`
   - สร้าง Notification Channel ชื่อ `urgent_survey_channel` ที่มี:
     - `importance: Importance.max`
     - `priority: Priority.high`
     - custom sound จากไฟล์ `alarm_loop` ใน `res/raw/`
     - `fullScreenIntent: true`
     - `ongoing: true`
     - `autoCancel: false`
     - `additionalFlags: Int32List.fromList(<int>[4])` สำหรับ FLAG_INSISTENT
   - ฟังก์ชัน `showUrgentNotification({required int id, required String title, required String body, String? payload})`
   - ฟังก์ชัน `cancelNotification(int id)`
   - จัดการ callback เมื่อผู้ใช้กด notification (onDidReceiveNotificationResponse)

2. **Full-Screen Incoming Page** (`lib/pages/incoming_survey_page.dart`)
   - หน้าจอเต็มจอแสดงเมื่อมีงานเข้า (เหมือนหน้ารับสายเรียกเข้า)
   - แสดงข้อมูล: ชื่องาน, ที่อยู่, ระยะทาง (ถ้ามี)
   - ปุ่ม "รับงาน" (สีเขียว) → ยกเลิก notification + นำทางไปหน้างาน
   - ปุ่ม "ปฏิเสธ" (สีแดง) → ยกเลิก notification + กลับหน้าเดิม
   - มี animation เพื่อดึงดูดความสนใจ (เช่น ปุ่มกระพริบ หรือ ripple effect)

3. **FCM Integration** (`lib/services/fcm_service.dart`)
   - รับ FCM push notification จาก backend
   - เมื่อรับ data message ที่มี `type: "new_survey"` → trigger `showUrgentNotification()`
   - ทำงานได้ทั้ง foreground, background, และ terminated state

4. **AndroidManifest.xml** — เพิ่ม permissions ที่จำเป็น:
   ```xml
   <uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />
   <uses-permission android:name="android.permission.VIBRATE" />
   <uses-permission android:name="android.permission.WAKE_LOCK" />
   <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
   <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
   ```

5. **Activity สำหรับ Full-Screen Intent** — เพิ่มใน AndroidManifest.xml:
   ```xml
   <activity
       android:name=".IncomingSurveyActivity"
       android:showOnLockScreen="true"
       android:turnScreenOn="true"
       android:showWhenLocked="true" />
   ```

### Packages ที่ใช้

- `flutter_local_notifications` — แสดง local notification
- `firebase_messaging` — รับ FCM push
- `firebase_core` — Firebase initialization

### โครงสร้าง payload จาก Backend (FCM Data Message)

```json
{
  "to": "<device_fcm_token>",
  "data": {
    "type": "new_survey",
    "survey_id": "12345",
    "title": "งานสำรวจอุบัติเหตุ",
    "address": "123 ถ.สุขุมวิท กรุงเทพฯ",
    "distance_km": "5.2",
    "created_at": "2026-04-02T10:30:00Z"
  }
}
```

> **หมายเหตุ:** ใช้ **Data Message** ไม่ใช่ Notification Message เพราะเราต้องการควบคุมพฤติกรรมการแจ้งเตือนเองทั้งหมด ไม่ให้ FCM จัดการให้

### ไฟล์เสียง

- วางไฟล์เสียง `alarm_loop.mp3` ไว้ที่ `android/app/src/main/res/raw/alarm_loop.mp3`
- ไม่จำเป็นต้องเป็นไฟล์ยาว เพราะ `FLAG_INSISTENT` จะวนซ้ำให้อัตโนมัติ
- แนะนำความยาวประมาณ 3-5 วินาที

### ข้อควรระวัง

- Android 11+ ต้องขอ permission `USE_FULL_SCREEN_INTENT` (เฉพาะบาง use case)
- Android 13+ ต้องขอ runtime permission `POST_NOTIFICATIONS`
- ทดสอบบน Android เวอร์ชันต่าง ๆ เพราะ OEM บางยี่ห้อ (Xiaomi, Oppo, Vivo) มีการจัดการ notification ที่แตกต่าง
- iOS ไม่รองรับ FLAG_INSISTENT โดยตรง — ต้องใช้ Critical Alert (ต้องขอ entitlement จาก Apple) หรือ VoIP Push แทน

### ตัวอย่าง Flow

```
Backend ส่ง FCM data message (type: "new_survey")
        ↓
App รับผ่าน onMessage / onBackgroundMessage
        ↓
Trigger showUrgentNotification()
  - เสียงดังวนซ้ำ (FLAG_INSISTENT)
  - จอเด้งขึ้นมา (Full-Screen Intent)
  - แสดง IncomingSurveyPage
        ↓
ผู้ใช้กด "รับงาน"                    ผู้ใช้กด "ปฏิเสธ"
  → cancel notification               → cancel notification
  → หยุดเสียง                          → หยุดเสียง
  → นำทางไปหน้างาน                    → กลับหน้าเดิม
  → อัปเดตสถานะงานใน DB               → อัปเดตสถานะงานใน DB
```
