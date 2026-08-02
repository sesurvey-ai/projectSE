# รีวิวแอพมือถือ (Flutter) — 2026-07-15

ตรวจ 8 มุมมอง (state/logic ฟอร์มสำรวจ, services/sync, notifications+native Kotlin, screens, editors/widgets, performance, architecture) ทุก finding ผ่านการ verify ซ้ำแบบ adversarial กับโค้ดจริง — จาก 61 ข้อ ยืนยันจริง 53 ข้อ หักล้างทิ้ง 8 ข้อ

`flutter analyze`: ไม่มี error มีแค่ lint 14 รายการ (unused methods ใน case_detail_screen, `use_build_context_synchronously` 1 จุด, deprecated `withOpacity`)

---

## 🔴 HIGH (8 ประเด็น — ควรแก้ก่อน go-live)

### H1. ท่อรูปถ่าย: โฟลเดอร์รูปผูกกับ claim_no ที่แก้ไขได้ → รูปหายเงียบตอน submit
- `mobile/lib/screens/survey_form_screen.dart:1100` + `mobile/lib/services/api_service.dart:80-89` + `backend/src/services/case.service.ts:500-507`
- `_getCaseFolder()` ตั้งชื่อโฟลเดอร์รูปในเครื่องจาก **ค่าปัจจุบัน** ของช่องเลขที่เคลม/เลขเรื่องเซอร์เวย์ ณ ตอนถ่าย; ตอน submit ฝั่งแอพอัปโหลดเฉพาะโฟลเดอร์ที่คำนวณจากค่า **ณ ตอน submit** — ถ้าค่าเปลี่ยนระหว่างทาง (เปิดฟอร์มตอนออฟไลน์แล้ว claim_no ว่าง / เซอร์เวย์แก้เลขเคลมที่ OCR อ่านผิด / callcenter แก้ใน DB) รูปที่ถ่ายไว้ก่อนหน้าจะ**ไม่ถูกอัปโหลดเลย โดยไม่มี error** และเคสถูกปิดเป็น surveyed ส่งซ้ำไม่ได้
- ฝั่ง backend ซ้ำเติม: `submitSurvey` DELETE `survey_photos` ทั้งหมดแล้ว re-link จากโฟลเดอร์ที่ตั้งชื่อตาม claim_no **ใน payload ของ client** ขณะที่ตอน upload เก็บไฟล์ under claim_no **จาก DB** — สอง key คนละแหล่ง ถ้าไม่ตรงกัน ได้รายงานที่ไม่มีรูปแม้แต่ใบเดียว แต่ transaction COMMIT สำเร็จ
- **แนวแก้:** ผูกโฟลเดอร์กับ `case_id` (immutable) ตัวเดียวทั้ง client และ server แทน claim_no/survey_job_no

### H2. Autosave ไม่ครอบคลุม input ที่ไม่ใช่ช่องพิมพ์ — แอพโดน kill = ตัวเลือกหาย
- `survey_form_screen.dart` — chips ประเภทเคลม (2914), chips ระดับความเสียหาย (2427), เพศ (3445), dropdown ทุกตัว (คำนำหน้า/ประเภทรถ/EV/ฝ่ายผิด/จังหวัด/อำเภอ/ยี่ห้อ/สี ฯลฯ), checkbox เคลมคู่กรณี (3015), สวิตช์ พรบ./แจ้งความ (2436, 2605), ปุ่มตกลงของ date picker พ.ศ. (556-570), `_TimeField._sync` (3842)
- ทั้งหมด `setState` เฉย ๆ ไม่เรียก `_autosave()` — จะถูกเซฟก็ต่อเมื่อพิมพ์ข้อความ/เปลี่ยนหน้า/ปิดหน้าแบบปกติ ถ้าโดน kill ระหว่างอยู่บนหน้าเดิม (สถานการณ์ที่โค้ดเองคอมเมนต์ว่าเสี่ยง: "กล้อง/OCR กินแรม — เสี่ยงโดน kill") ตัวเลือกทั้งหมดตั้งแต่ text-edit ล่าสุดหายหมด — หน้า 1 กับหน้า 5 เป็น chips/dropdown/สวิตช์แทบทั้งหน้า
- หลักฐานว่าเป็นการหลงลืมไม่ใช่ design: สวิตช์ใบขับขี่ (2566) กับ `_toggleOptional` (2001) เรียก autosave อยู่แล้ว
- **แนวแก้:** เรียก `_scheduleAutosave()` ในทุก mutation + เพิ่ม `WidgetsBindingObserver` เซฟตอน `AppLifecycleState.paused` (ไฟล์นี้ยังไม่มี lifecycle observer เลย)

### H3. Location responder (Kotlin) ยิง token ไปหา IP dev ที่ hardcode ไว้ — ใช้บน prod ไม่ได้เลย
- `mobile/android/.../LocationHelper.kt:146` — `getBaseUrl()` อ่าน SharedPreferences key `flutter.api_base_url` ซึ่ง**ไม่มีโค้ดฝั่ง Flutter เขียนค่านี้เลย** (ApiConfig เก็บ baseUrl ใน memory เท่านั้น) → บนเครื่องจริง fallback เป็น `http://192.168.1.135:3001` เสมอ
- ผล: ฟีเจอร์แผนที่สด "พนักงานทั้งหมด" ของ admin **ตายสนิทบน production** — ทุก request_location push ล้มเหลวเงียบ ๆ (ดี ที่ Android block cleartext HTTP โดย default เลย token ไม่รั่วออก LAN จริง แต่ฟีเจอร์ก็ไม่ทำงาน)
- **แนวแก้:** ให้ Flutter เขียน `api_base_url` ลง SharedPreferences ตอน ApiConfig resolve เสร็จ (หรือส่งผ่าน MethodChannel)

### H4. FCM token rotation ไม่ถึง backend + ส่ง token ไม่มี retry — เซอร์เวย์หยุดได้งานเงียบ ๆ
- `MyFirebaseMessagingService.kt:61` — `onNewToken()` แค่ log (แถม log ค่า token เต็ม ๆ) ไม่ POST ไป backend; ฝั่ง Dart `_sendTokenToServer` (`fcm_service.dart:136-142`) กลืน error ไม่ retry
- เคสหลักที่เจอจริง: login บนเน็ตห่วย → ส่ง token fail เงียบ → ทั้ง session ไม่ได้รับงานใหม่/request_location เลย จนกว่าจะเปิดแอพใหม่
- **แนวแก้:** retry ใน `_sendTokenToServer` (หรือ enqueue เข้า WorkManager) + ให้ `onNewToken` ฝั่ง native POST เองด้วย

### H5. งานเข้าตอนแอพอยู่ background: พึ่ง `startActivity` ตรง ๆ ซึ่ง Android 10+ block — เหลือแต่เสียงปลุกแต่ไม่มีอะไรบนจอ
- `NotificationHelper.kt:106` — ทุก state ยกเว้น foreground เรียก `showFullscreen()` = bare `startActivity()` จาก FCM service; ทุกวันนี้รอดเพราะแอพถือ SYSTEM_ALERT_WINDOW (ที่ขอไว้เพื่อ overlay ที่เลิกใช้แล้ว) ถ้า user ปิด permission นี้ → ไม่มี fullscreen, ไม่มี notification bar (posted เฉพาะ branch foreground), มีแต่เสียง alarm วนโดยกด รับ/ปฏิเสธ/ปิดเสียง ไม่ได้
- **แนวแก้:** ใช้ notification + `setFullScreenIntent()` (ต้องมี `USE_FULL_SCREEN_INTENT`) เป็นทางหลัก ให้ระบบจัดการเอง แล้ว fallback เป็น heads-up notification เสมอ

### H6. อัปโหลดรูปไม่มี `sendTimeout` + ยัดทั้งโฟลเดอร์ใน POST เดียว — จอหมุนค้างกลางสนาม
- `api_service.dart:16` — ตั้งแค่ connect/receiveTimeout; ของ Dio `receiveTimeout` เริ่มนับ**หลัง** ส่ง body เสร็จ → เน็ตสะดุดกลางอัปโหลด = ค้างยาว (จน OS ตัด TCP เอง 10-30 นาที) และ `DioExceptionType.sendTimeout` ที่ `case_provider.dart:134` ดักไว้เพื่อเข้าคิวออฟไลน์ **ไม่มีวัน fire** = dead code
- `api_service.dart:91` — `uploadCaseFolder` รวมทุกไฟล์เป็น multipart เดียว (หลายสิบ MB สำหรับเคสรูปเยอะ) เน็ตหลุดที่ 95% = เริ่มใหม่หมดทุกครั้งที่ retry
- **แนวแก้:** ตั้ง `sendTimeout` + อัปโหลดทีละไฟล์/ทีละก้อน ข้ามไฟล์ที่ server มีแล้ว

### H7. การ์ดเคสโชว์เวลา UTC — ช้ากว่าเวลาไทย 7 ชั่วโมง
- `mobile/lib/widgets/case_card.dart:46` — `DateTime.parse()` ของ string ที่ลงท้าย Z ได้ UTC แล้ว `_formatDate` พิมพ์ hour/minute โดยไม่ `.toLocal()` → เคสสร้าง 14:30 โชว์ 07:30 ทุกใบ แถมปีเป็น ค.ศ. ขณะที่ทั้งแอพใช้ พ.ศ.
- **แนวแก้ (บรรทัดเดียว):** `DateTime.parse(dateStr).toLocal()` + แปลงปี +543

### H8. Login ล้มเหลวทุกแบบขึ้น "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
- `auth_provider.dart:117` — catch-all แล้วตั้ง error เดียว; timeout/DNS/500 ก็ขึ้นข้อความนี้ → user พิมพ์รหัสใหม่ ยิงซ้ำ แล้วโดน rate-limit login (merged ใน main แล้ว: `auth.routes.ts:23`) ทั้งที่ปัญหาคือเน็ต
- **แนวแก้:** แยกเคส `e.response == null` → "เชื่อมต่อไม่ได้ ตรวจสอบสัญญาณ"

---

## 🟡 MEDIUM (26 ข้อ — ตามกลุ่ม)

### ความถูกต้องข้อมูลฟอร์ม
1. **ค่าตัวเลขที่ลบทิ้งกลับมาเอง** — `_collectFormData` เขียน null สำหรับช่องตัวเลขว่าง (ไมล์/อายุ/ค่าซ่อม ฯลฯ, :1660) แต่ตอน restore ข้าม null (`if (val != null)`, :754) → ค่าเก่าจาก server คืนชีพหลังรีสตาร์ทแล้วถูก submit
2. **โหลด draft ต่อคิวหลัง fetch server** (:681) — เน็ตช้า ฟอร์มเปิดว่างเปล่าทั้งที่มี draft ในเครื่อง, user พิมพ์ไป, fetch มาถึงทีหลังทับหมด
3. **`_TimeField` ไม่ resync จาก controller เป้าหมาย** (:3842) — เวลา prefill จาก server (timeline auto-fill) มาช้ากว่าเปิดหน้า 5 = ช่องโชว์ว่างทั้งที่มีค่า, แก้ครึ่งเดียวได้ค่าพิการแบบ `"10:"`
4. **วันที่จาก OCR ไม่ validate era** (:638) — ใบขับขี่ฝั่งอังกฤษพิมพ์ ค.ศ., เขียนลง controller ตรง ๆ → ปี ค.ศ. ทำ wheel ปี พ.ศ. เพี้ยน (initialItem ติดลบ/ล้อว่าง — ดู `form_kit.dart:104-111` ด้วย, ข้อ 12)
5. **kill ระหว่างรอ OCR = รูปสแกน orphan** (:197) — ลบรูปสแกนเก่า+เพิ่มรูปใหม่เข้า state ก่อน await OCR โดยไม่ autosave; ตายตรงนั้น draft ชี้ไฟล์ที่ลบไปแล้ว ไฟล์ใหม่ไม่อยู่ใน draft (และถ้า OCR ว่าง/throw ก็ return ก่อนถึง autosave เช่นกัน)
6. **คู่กรณี: เปลี่ยนบริษัทประกันเป็น "ไม่มีบริษัทประกันภัย" แล้วเลขกรมธรรม์/เลขเคลมเก่ายังถูกเซฟ** (`opponent_editor.dart:67`) — แค่ซ่อนช่อง ไม่เคลียร์ controller; กระทบ XML export ด้วย (`HAVE_INSURANCE` คำนวณจาก `c.insurer ? '1' : ''` = ได้ 1 ทั้งที่ไม่มีประกัน)

### ความทนทานภาคสนาม / config
7. **multer จำกัด 100 ไฟล์** (`case.routes.ts:223`) ขณะที่แอพไม่จำกัดจำนวนรูป — เคสใหญ่ submit ไม่ได้เลย (ตายทั้งสองทาง: 500 ไม่เข้าคิว หรือ connectionError วนคิวไม่จบ)
8. **base URL dev ยัง active ใน release build** (`api_config.dart:36`) — ขึ้นกับ `--dart-define=FORCE_PROD=true` ตอน build ไม่ใช่ `kReleaseMode`; ลืม flag เดียว APK ชี้ 10.0.2.2
9. **race คิวออฟไลน์** (`survey_queue.dart:70-74`) — flush (WorkManager isolate) กับ enqueue (UI isolate) read-modify-write key เดียวกันไม่มี lock; enqueue เบียดเข้า gap ระหว่าง reload กับ setString = งานหายเงียบ
10. **fetch รายละเอียดเคสล้มเหลว = จอว่างไร้ error/retry + ขึ้น prompt ยืนยันถึงที่เกิดเหตุซ้ำ** (`case_detail_screen.dart:64`) — โชคดี backend upsert เลยไม่เกิด record ซ้ำ แต่ UX หลอกผู้ใช้
11. **ลางานไม่เช็คช่วงวันซ้อนทับ** ทั้ง client และ server (`leave_screen.dart:176`)
12. **หน้าลงเวลา โหลดสถานะ fail เงียบ** → โชว์สถานะเช็คอินผิด (`attendance_screen.dart:65`)
13. **Logout ค้างได้เป็นนาที** (`home_screen.dart:54` + `auth_provider.dart:124`) — await 4+ network calls ต่อกัน timeout ตัวละ 30s ไม่มี spinner
14. **Consult sync อัปโหลด call history ย้อนหลัง 365 วันซ้ำทุก 15 นาที** (`consult_sync.dart:48`) — ไม่มี watermark เพิ่มทีละส่วน

### Native / notifications
15. **งานที่สองทับงานแรกใน fullscreen activity** (`IncomingCallActivity.kt:80`) — singleTop + `onNewIntent` rebind → alert ของงานแรกหายไปเลยไม่มี notification เหลือ
16. **request_location เสี่ยงหายใน Doze** (`MyFirebaseMessagingService.kt:46`) — block 8s รอ GPS แล้ว POST บน thread fire-and-forget ไม่มี wakelock/retry — process โดน freeze ก่อน POST เสร็จได้

### กล้อง
17. **`_setup()` ซ้อนกัน leak CameraController** (`camera_capture_screen.dart:44`) — กล้องค้าง lock จนกว่าจะฆ่าแอพ
18. **Preview สลับ width/height แบบ hardcode portrait** (:197) — แอพไม่ lock orientation, ถ่ายแนวนอน (ถ่ายรถ!) preview หมุนเพี้ยน
19. **รูปสำรวจไม่บีบอัด/ย่อเลย** (:26) — เก็บ+โชว์+อัปโหลด raw JPEG จากกล้อง

### Performance (เครื่องกลาง-ล่างกระตุก)
20. **กริดรูป decode ทุกใบที่ resolution เต็มกล้อง** ใน shrinkWrap grid ที่ไม่ lazy (`survey_form_screen.dart:3735`) — ไม่ใส่ `cacheWidth`
21. **ทุก keystroke ในช่องชิ้นส่วนเสียหาย = setState ทั้งจอ + jsonEncode ทั้งฟอร์ม + เขียน SharedPreferences** (:3624)
22. **`_downloadCaseImages` สะสม bytes ใน `List<int>` ธรรมดา** (`case_detail_screen.dart:90`) — memory ชั่วคราว ~8 เท่าต่อรูป บน UI isolate
23. **รูป network ไม่ใส่ `cacheWidth`** — thumbnail 44px หน้าลงเวลา decode ที่ resolution เต็ม (`attendance_screen.dart:130`)

---

## 🟢 LOW (16 ข้อ — เก็บกวาดได้เรื่อย ๆ)

- `setState` หลัง `await` ไม่เช็ค `mounted` หลายจุด (`survey_form_screen.dart:2015`, `case_detail_screen.dart:56`)
- ไฟล์ temp กล้อง (XFile ใน cache) copy แล้วไม่ลบ — cache โตไม่จำกัด (`survey_form_screen.dart:193`)
- **Overlay (`overlay_survey.dart:67`) เป็น dead code**: ปุ่มรับ=ปฏิเสธ (แค่ปิด), หยุดเสียง alarm ไม่ได้ และ prompt ขอ SYSTEM_ALERT_WINDOW ตอนเปิดแอพมีไว้เพื่อ code ตายนี้เท่านั้น (แต่ระวัง: fullscreen H5 ตอนนี้พลอยอาศัย permission นี้อยู่ — แก้ H5 ก่อนค่อยถอด)
- Case list โหลดซ้ำ 2 รอบทุกครั้งที่เปิด (initState + didChangeDependencies, `case_list_screen.dart:25`)
- `DamagePartList` ยุบไม่อยู่ — key ผูกกับ `_expanded` ทำ ExpansionTile ถูกสร้างใหม่เป็น expanded ทุก rebuild (`car_damage_diagram.dart:134`)
- แตะแผนภาพรถแล้วปิด sheet โดยไม่เลือกระดับ = ได้รายการเสียหายผี level ว่างติดไปกับ save (`car_damage_diagram.dart:22`)
- `onNotificationTapWithCaseId` ไม่เคยถูก assign — แตะ notification ไม่นำทางไปเคส (dead code, `fcm_service.dart:20`)
- `handleSessionExpired` ไม่เคลียร์ FCM token / ไม่ cancel consult-sync ต่างจาก `logout()` (`auth_provider.dart:149`)
- Cold-start: router redirect ก่อน restore token เสร็จ — แฟลช /login และทิ้ง destination (`app_router.dart:24`)
- ช่องตำรวจโชว์เป็น required เมื่อเปิดสวิตช์แจ้งความ แต่ submit gate บังคับเฉพาะ fault='รอสรุปผลคดี' (`survey_form_screen.dart:2187`)
- OCR บัตร ปชช. เคลียร์เขต/อำเภอที่เลือกไว้ ถ้าข้อความ scan ไม่ match dropdown (:251)
- ทุก retry ของคิว re-upload โฟลเดอร์รูปทั้งชุดก่อน POST (`api_service.dart:72`)
- การ์ดวันนี้หน้าลงเวลาใช้ timezone เครื่อง ไม่ใช่ Asia/Bangkok (`attendance_screen.dart:335`)
- `File.statSync()` sync ทุก tile ทุก rebuild ในหน้ารูป (`survey_form_screen.dart:1417`)

---

## ข้อที่ตรวจแล้ว "ไม่จริง" (refuted — ไม่ต้องแก้)

- คิว JSON พัง = คิวพังถาวร → มี recovery อยู่แล้ว
- คิวลบงานเงียบเมื่อ 400/422/403 → มีแจ้งเตือน/พฤติกรรมถูกต้อง
- ลบ notification channel ทุกครั้งที่เปิดแอพ → ไม่จริง
- Notification action หายตอน cold start → มีกลไกรอ handler แล้ว
- ปุ่มเริ่มสำรวจ dead-end เมื่อ storage denied → ไม่จริง
- setState ทั้ง State ทุก keystroke ช่องเลขเคลม → scope จำกัดกว่าที่อ้าง
- แถวเคสพัง 1 แถวทำลิสต์พังทั้งหมด → parsing ปลอดภัยแล้ว
- `int.parse(:id)` throw ตอน build → route ป้องกันแล้ว

## ลำดับแนะนำ

1. **H1 (ท่อรูป claim_no)** — data loss เงียบ กระทบเคสจริงที่เริ่มเทสแล้ว
2. **H2 (autosave non-text)** — data loss ต่อเนื่องจาก 11 fix ที่เพิ่งทำ
3. **H3+H4** — ฟีเจอร์ push/แผนที่ตายบน prod
4. **H7+H8** — แก้ง่าย เห็นผลทันที (บรรทัดเดียว + if เดียว)
5. **H5, H6** และ medium กลุ่มความทนทานภาคสนาม ก่อนแจก APK รอบใหม่ (สอดคล้องกับ branch `/uploads` auth ที่รอ APK ใหม่อยู่แล้ว)
