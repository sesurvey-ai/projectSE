# SE SURVEY — Project Progress

**อัพเดทล่าสุด:** 31 มีนาคม 2026 (v1.5.21)

---

## ภาพรวมความคืบหน้า

| Phase | รายการงาน | สถานะ | ความคืบหน้า |
|:---:|---|:---:|:---:|
| 1 | Project Setup & DB Design | ✅ เสร็จแล้ว | 100% |
| 2 | Authentication & User Roles | ✅ เสร็จแล้ว | 100% |
| 3 | Backend API Development | ✅ เสร็จเกือบครบ | 98% |
| 4 | Flutter Mobile App | ✅ เสร็จส่วนใหญ่ | 95% |
| 5+6 | Unified Web (Next.js) + Admin Panel | ✅ เสร็จเกือบครบ | 99% |
| 7 | Integration & Testing | 🔄 ดำเนินการ | 60% |
| 8 | Deployment & Go-live | 🔄 เริ่มบางส่วน | 15% |

**ความคืบหน้ารวม: ~88%**

---

## Phase 1: Project Setup & DB Design ✅ 100%

- [x] สร้าง Git Repository และโครงสร้างโปรเจค (backend, web, mobile)
- [x] ออกแบบฐานข้อมูล PostgreSQL 6 ตาราง (users, surveyor_locations, cases, survey_reports, survey_photos, reviews)
- [x] สร้าง Migration SQL พร้อม indexes และ enums
- [x] ตั้งค่า Supabase project และเชื่อมต่อฐานข้อมูล
- [x] Seed data สำหรับ test users (survey01, callcenter01, checker01)
- [x] ตั้งค่า Firebase project สำหรับ Push Notification (FCM) — เชื่อมต่อจริงแล้ว (project: se-project-c25bb)
- [x] ตั้งค่า Google Maps API Key (placeholder ใน .env)

---

## Phase 2: Authentication & User Roles ✅ 100%

- [x] Login API ด้วย JWT (username/password → token)
- [x] Bcrypt password hashing
- [x] Role-based middleware: `admin`, `surveyor`, `callcenter`, `checker`
- [x] GET `/api/users/me` — ดึงข้อมูล user ปัจจุบัน
- [x] PUT `/api/users/me/fcm-token` — อัพเดท FCM token
- [x] Seed data ทดสอบ (admin01, survey01, callcenter01, checker01)

---

## Phase 3: Backend API Development ✅ 98%

### REST API Endpoints

| Endpoint | Method | Role | สถานะ |
|---|---|---|:---:|
| `/api/auth/login` | POST | Public | ✅ |
| `/api/users/me` | GET | All | ✅ |
| `/api/users/me/fcm-token` | PUT | All | ✅ |
| `/api/cases` | POST | callcenter | ✅ |
| `/api/cases/my` | GET | surveyor | ✅ |
| `/api/cases/review` | GET | checker | ✅ |
| `/api/cases/:id` | GET | callcenter, checker | ✅ |
| `/api/cases/:id/detail` | GET | checker | ✅ |
| `/api/cases/:id/assign` | POST | callcenter | ✅ |
| `/api/cases/:id/survey` | POST | surveyor | ✅ |
| `/api/cases/:id/review` | POST | checker | ✅ |
| `/api/locations/respond` | POST | surveyor | ✅ |
| `/api/locations/latest` | GET | callcenter | ✅ |
| `/api/upload` | POST | surveyor | ✅ |
| `/api/admin/dashboard` | GET | admin | ✅ |
| `/api/admin/users` | GET/POST | admin | ✅ |
| `/api/admin/users/:id` | GET/PUT/DELETE | admin | ✅ |
| `/api/admin/cases` | GET | admin | ✅ |
| `/api/admin/cases/:id` | GET/PUT/DELETE | admin | ✅ |
| `/api/admin/reviews` | GET | admin | ✅ |
| `/api/admin/reviews/:id` | PUT/DELETE | admin | ✅ |

### Real-time & Notification

- [x] Socket.io On-Demand Location (request_location → location_response → broadcast)
- [x] FCM push notification service (sendNotification + sendSilentPush)
- [x] FCM เรียกอัตโนมัติเมื่อ assign case
- [x] Socket.io `case_assigned` event — ส่ง real-time notification ไปยัง mobile เมื่อมอบหมายงาน
- [x] Export `getIO()` จาก socket server สำหรับใช้ใน services อื่น
- [x] ~~FCM silent push fallback เมื่อ Socket disconnect~~ ✅ FCM ทำงานคู่กับ Socket.io แล้ว

### File Upload

- [x] Multer config (JPEG, PNG, WebP)
- [x] จำกัดขนาด 10MB, สูงสุด 5 รูปต่อครั้ง
- [x] Static file serving ที่ `/uploads`

### สิ่งที่ยังขาด (Backend)

- [x] ~~Pagination (limit/offset) สำหรับ list endpoints~~ ✅ มีใน Admin API แล้ว
- [x] ~~Case status filtering endpoint~~ ✅ มีใน Admin API แล้ว
- [x] ~~Case update endpoint (แก้ไขเคสหลังสร้าง)~~ ✅ มีใน Admin API แล้ว
- [ ] Review rejection flow (ตอนนี้ review สถานะ approved อย่างเดียว)
- [ ] Rate limiting middleware

---

## Phase 4: Flutter Mobile App ✅ 95%

### หน้าจอ (Screens)

- [x] Login Screen — username/password + validation + error display
- [x] Case List Screen — แสดงรายการงาน + pull-to-refresh + empty state
- [x] Case Detail Screen — แสดงรายละเอียดเคส + status badge + ปุ่มเริ่มสำรวจ
- [x] Survey Form Screen — กรอกข้อมูลรถ + ถ่ายรูป + ส่งข้อมูล

### Services

- [x] API Service (Dio + JWT interceptor + timeout 30s)
- [x] Auth Service (login, logout, token storage ด้วย SharedPreferences)
- [x] Socket Service (on-demand GPS: listen `request_location` → ส่ง GPS กลับ + listen `case_assigned` → แสดง notification)
- [x] Location Service (Geolocator: high accuracy, permission handling)
- [x] FCM Service (Firebase Messaging จริง + background handler + foreground listener + token refresh)

### State Management

- [x] AuthProvider (user, token, auth state)
- [x] CaseProvider (cases list, survey submission)
- [x] Go Router navigation with auth guards

### สิ่งที่ยังขาด (Mobile)

- [x] ~~**Firebase.initializeApp()**~~ — เปิดใช้งานจริงแล้วใน main.dart
- [x] ~~**google-services.json** (Android)~~ — download จาก Firebase Console แล้ว
- [x] ~~**GoogleService-Info.plist** (iOS)~~ — download จาก Firebase Console แล้ว
- [x] ~~Platform permissions ใน AndroidManifest.xml~~ — เพิ่ม ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION, CAMERA, POST_NOTIFICATIONS, WAKE_LOCK + FCM notification channel
- [ ] Platform permissions ใน Info.plist (iOS — camera, location)
- [ ] Network error handling / retry logic สำหรับ upload ที่ล้มเหลว
- [ ] Offline caching

---

## Phase 5+6: Unified Web (Next.js) ✅ 99%

### Authentication & Routing

- [x] Login page (`/login`) — username/password form
- [x] AuthProvider — React Context + token persistence (localStorage)
- [x] Role-based redirect (admin → `/admin`, callcenter → `/callcenter`, checker → `/inspector`)
- [x] API interceptor (Axios + Bearer token + auto-logout on 401)
- [x] Protected layouts สำหรับ admin, callcenter และ inspector

### Call Center (`/callcenter`)

- [x] Dashboard — welcome + link สร้างเคสใหม่
- [x] สร้างเคสใหม่ (`/cases/new`) — form: ชื่อลูกค้า + สถานที่เกิดเหตุ
- [x] มอบหมายงาน (`/cases/[id]/assign`) — แผนที่ + เลือก surveyor
- [x] ปุ่ม "เรียกพิกัด" → Socket.io request → แสดง surveyor บนแผนที่
- [x] คำนวณระยะทาง (Haversine) + เรียงลำดับ 5 คนใกล้สุด
- [x] SocketProvider — เชื่อมต่อ Socket.io + track connection status

### Inspector (`/inspector`)

- [x] Dashboard — แสดงรายการเคสรอตรวจ (CaseList component)
- [x] รายละเอียดเคส (`/cases/[id]`) — ออกแบบใหม่ทั้งหมดให้ตรงกับฟอร์มประกันภัยต้นฉบับ
- [x] ทุก section แปลงเป็น input fields (text inputs, dropdowns, radio buttons, checkboxes, textareas)
- [x] Dropdown options ครบ: จังหวัด (79), เขต/อำเภอ (50 กทม.), ยี่ห้อรถ (71), สีรถ (55), ประเภท EV (5), สาเหตุอุบัติเหตุ (55+), ประเภทความเสียหาย (21)
- [x] PhotoGallery — horizontal scroll + lightbox พร้อม prev/next navigation และ thumbnail strip
- [x] Review section 3 คอลัมน์ (ผลการดำเนินงาน, ความเห็นผู้ตรวจสอบ, ความเห็นเซอร์เวย์)
- [x] Expense table (ค่าใช้จ่าย) 8 รายการ — เชื่อมกับตาราง survey_expenses ใหม่
- [x] ReviewForm — ความคิดเห็น + ค่าบริการเสนอ + ค่าบริการอนุมัติ

### Admin Panel (`/admin`) — เพิ่มใหม่ 21 มี.ค. 2026

- [x] Admin Layout + Auth Guard (เฉพาะ role admin)
- [x] Dashboard — สถิติรวม (จำนวนผู้ใช้/เคส/รีวิว แยกตามสถานะ) + Quick Actions
- [x] จัดการผู้ใช้ (`/admin/users`) — รายการ + ค้นหา + กรองตาม role + pagination
- [x] เพิ่มผู้ใช้ (`/admin/users/new`) — สร้างบัญชีใหม่ + เลือก role
- [x] แก้ไขผู้ใช้ (`/admin/users/[id]/edit`) — แก้ชื่อ, role, รหัสผ่าน, เปิด/ปิดใช้งาน
- [x] ปิดใช้งานผู้ใช้ (soft delete) — ป้องกันลบตัวเอง
- [x] จัดการเคส (`/admin/cases`) — รายการ + ค้นหา + กรองตามสถานะ + pagination
- [x] แก้ไขเคส (`/admin/cases/[id]/edit`) — แก้ชื่อลูกค้า, สถานที่, สถานะ, ช่างสำรวจ
- [x] ลบเคส — ลบ record (cascade) + ลบไฟล์รูปภาพบน disk
- [x] จัดการรีวิว (`/admin/reviews`) — รายการ + กรองตามสถานะ + pagination
- [x] แก้ไขรีวิว (`/admin/reviews/[id]/edit`) — แก้ความคิดเห็น, ค่าบริการ, สถานะ
- [x] ลบรีวิว — ลบ record + เปลี่ยนสถานะเคสกลับเป็น surveyed

### Layout & UI

- [x] Header — user info + role badge + logout
- [x] Sidebar — role-aware navigation
- [x] Tailwind CSS + responsive design
- [x] Thai localization ทั่วทั้งแอป
- [x] Status badges สีตาม status

### สิ่งที่ยังขาด (Web)

- [x] ~~ใช้ Leaflet/OpenStreetMap แทน Google Maps~~ — ตัดสินใจใช้ Leaflet ต่อ (ฟรี, ครบฟีเจอร์ที่ต้องการ)
- [x] ~~Pagination สำหรับรายการเคส~~ ✅ มีใน Admin Panel แล้ว
- [x] ~~Search / Filter ในหน้า dashboard~~ ✅ มีใน Admin Panel แล้ว
- [ ] Error pages (error.tsx, not-found.tsx)
- [ ] Toast notifications (ตอนนี้ใช้ inline messages)

---

## Phase 7: Integration & Testing 🔄 60%

- [x] ทดสอบ Login ทุก role: callcenter01 ✅, checker01 ✅, survey01 ⚠️ (web ไม่รองรับ surveyor — ถูกต้องตาม design)
- [x] ทดสอบ On-Demand GPS: Call Center กดเรียก → มือถือตอบกลับ → แสดง marker + ชื่อบนแผนที่ ✅
- [x] ทดสอบ Case Assign + Socket Notification: มอบหมายงาน → mobile ได้รับ local notification + case list refresh ✅
- [x] ทดสอบ Push Notification (FCM) บน Emulator ✅ — แจ้งเตือนได้ทั้ง foreground และ background (หน้าจอดับ)
- [x] ทดสอบ End-to-End (API): pending → assigned → surveyed → reviewed ✅ — ผ่านครบทุก status transition
- [ ] ทดสอบ End-to-End (UI): ทดสอบผ่าน mobile + web จริง
- [ ] ทดสอบ File Upload จาก mobile → backend → แสดงใน web
- [ ] ทดสอบ Push Notification (FCM) บนอุปกรณ์จริง
- [ ] แก้ Bug และปรับปรุงประสิทธิภาพ

### Bug ที่พบและแก้ไขแล้ว (20 มี.ค. 2026)

| Bug | ไฟล์ | สาเหตุ | วิธีแก้ |
|---|---|---|---|
| Android ไม่มี location permission | `AndroidManifest.xml` | ไม่มี `uses-permission` | เพิ่ม ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION, CAMERA |
| `s.latitude.toFixed is not a function` | `assign/page.tsx:148` | PostgreSQL DECIMAL ส่งเป็น string | ใช้ `Number()` wrap ก่อน `.toFixed()` |
| Web ไม่แสดงพิกัด surveyor | `assign/page.tsx:68` | haversineDistance รับ string แทน number | ใช้ `Number()` wrap coordinates |
| Surveyor login บนเว็บวนลูป | `auth.ts` + `login/page.tsx` | `getDashboardPath` ไม่มี case surveyor | ✅ แก้แล้ว — return null + แสดง error + auto logout |

### สิ่งที่เพิ่มใหม่ (20 มี.ค. 2026)

- Socket.io `case_assigned` event: Backend emit → Mobile receive + show local notification
- Socket debug logs ใน mobile สำหรับ troubleshooting
- Android platform permissions (location, camera)

### Firebase Setup สำเร็จ (20 มี.ค. 2026 — 21:30)

| รายการ | ไฟล์ | สถานะ |
|---|---|:---:|
| Firebase Project (se-project-c25bb) | Firebase Console | ✅ |
| Android App + google-services.json | `mobile/android/app/google-services.json` | ✅ |
| iOS App + GoogleService-Info.plist | `mobile/ios/Runner/GoogleService-Info.plist` | ✅ |
| Backend Service Account Key | `backend/.env` (FIREBASE_*) | ✅ |
| Google Services Gradle Plugin | `settings.gradle.kts` + `app/build.gradle.kts` | ✅ |
| Firebase.initializeApp() | `mobile/lib/main.dart` | ✅ |
| FirebaseMessaging.instance (จริง) | `mobile/lib/services/fcm_service.dart` | ✅ |
| FCM Notification Channel + Permissions | `AndroidManifest.xml` | ✅ |
| ทดสอบ FCM foreground | ส่ง notification ขณะแอปเปิด | ✅ |
| ทดสอบ FCM background | ส่ง notification ขณะหน้าจอดับ | ✅ |

### E2E Test ผ่าน + Bug Fix (20 มี.ค. 2026 — 22:00)

- ทดสอบ E2E ผ่าน API ครบทุก step: สร้างเคส → มอบหมาย → สำรวจ → ตรวจงาน → อนุมัติ ✅
- แก้ Bug surveyor login วนลูปบนเว็บ: `getDashboardPath()` return null สำหรับ surveyor + แสดง error message + auto logout ✅

### ขยายแบบฟอร์มสำรวจ + หน้าแสดงผล (21 มี.ค. 2026)

**Database:** ขยาย survey_reports จาก 7 คอลัมน์ เป็น 78 คอลัมน์ (5 migrations)

**ฟิลด์ที่เพิ่ม:**
- ข้อมูลบริษัทผู้จัดเรื่อง (3 ฟิลด์): บริษัท, ที่อยู่, เบอร์โทร/Fax
- ข้อมูลเคลม (6 ฟิลด์): ประเภทเคลม, ระดับเสียหาย, รถหาย, บริษัทประกัน+สาขา, เลขเซอร์เวย์, เลขรับแจ้ง, เลขเคลม
- ข้อมูลกรมธรรม์ (10 ฟิลด์): พรบ., กรมธรรม์, ผู้ขับตามกรมธรรม์, วันเริ่ม/สิ้นสุด, ผู้เอาประกัน, ประเภท, อีเมล, รหัสภัย, ค่าเสียหายส่วนแรก
- ข้อมูลรถยนต์ (6 ฟิลด์เพิ่ม): ยี่ห้อ, ประเภท, จังหวัด, ปีจดทะเบียน, EV, Model, ตัวถัง, เครื่อง, กม.
- ข้อมูลผู้ขับขี่ (16 ฟิลด์): เพศ, คำนำหน้า, ชื่อ, อายุ, วันเกิด, โทร, ที่อยู่, บัตร ปชช., ใบขับขี่, ประเภท, ออกให้ที่/วันที่, ความสัมพันธ์
- ความเสียหาย (2 ฟิลด์): รายละเอียด, ค่าเสียหายประมาณ
- อุบัติเหตุ (9 ฟิลด์): วันที่, เวลา, สถานที่, จังหวัด, เขต, ลักษณะ, รายละเอียด, ฝ่ายประมาท
- การสำรวจ (8 ฟิลด์): ผู้แจ้ง, ผู้สำรวจ+สาขา+โทร, วันที่ลูกค้าแจ้ง, วัน บ.ประกันแจ้ง, วันถึงที่เกิดเหตุ, วันสำรวจเสร็จ
- คู่กรณี (3 ฟิลด์): การเรียกร้อง, จำนวนเงิน, จำนวนเรียกร้องทั้งหมด
- ตำรวจ (5 ฟิลด์): ชื่อ, สถานี, ความเห็น, วันที่, ประจำวันข้อที่, แอลกอฮอล์
- ติดตามงาน (4 ฟิลด์): สถานะ, ครั้งที่, รายละเอียด, วันที่นัดหมาย

**Mobile (Flutter):** ฟอร์มสำรวจ 8 sections พร้อม choice chips, checkboxes, dropdowns
**Web (Next.js):** หน้าแสดงผลแบบตารางตรงตามฟอร์มเดิมของบริษัท (header สีน้ำเงิน/ส้ม)
**UI ปรับปรุง:** Sidebar ซ่อน/แสดงได้, AuthProvider non-blocking, axios timeout เพิ่มเป็น 15s

### ปรับปรุงหน้า Case Detail ครั้งใหญ่ (22 มี.ค. 2026)

**Web — Case Detail Page ออกแบบใหม่ทั้งหมด:**
- ทุก section แปลงจาก read-only เป็น input fields (text inputs, dropdowns, radio buttons, checkboxes, textareas)
- เพิ่ม dropdown options ครบถ้วน:
  - จังหวัด 79 จังหวัด
  - เขต/อำเภอ 50 เขต (กรุงเทพฯ)
  - ยี่ห้อรถยนต์ 71 ยี่ห้อ
  - สีรถ 55 สี
  - ประเภท EV 5 ประเภท
  - สาเหตุอุบัติเหตุ 55+ รายการ
  - ประเภทความเสียหาย 21 รายการ
- Photo Gallery ปรับปรุงเป็น horizontal scroll + lightbox พร้อม prev/next navigation และ thumbnail strip
- Review section 3 คอลัมน์ (ผลการดำเนินงาน, ความเห็นผู้ตรวจสอบ, ความเห็นเซอร์เวย์)
- Expense table (ค่าใช้จ่าย) 8 รายการ: ค่าบริการ, ค่าเดินทาง, ค่ารูปถ่าย, ค่าโทรศัพท์, ค่าประกันตัว, ค่าเรียกร้อง, ค่าคัดประจำวัน, อื่นๆ

**Database:**
- สร้างตาราง `survey_expenses` ใหม่ (15 คอลัมน์) — เก็บข้อมูลค่าใช้จ่ายสำรวจ
- เพิ่มคอลัมน์ใน survey_reports: `driver_first_name`, `driver_last_name`, `driver_province`, `driver_district`, `acc_alcohol_result`

**Bug Fixes:**
- แก้ CORS สำหรับแสดงรูปภาพ — เพิ่ม `crossOriginResourcePolicy: 'cross-origin'` ใน Helmet config
- แก้ photo URL path handling ให้แสดงรูปได้ถูกต้อง

### เพิ่มระบบแก้ไข/บันทึกข้อมูล (23 มี.ค. 2026)

**ฟีเจอร์ Edit Mode:**
- [x] ปุ่ม "แก้ไข" — เปิด edit mode ให้แก้ไขทุก input field ในหน้า Case Detail
- [x] ปุ่ม "บันทึก" — บันทึกข้อมูลที่แก้ไขลง Database ผ่าน API
- [x] ปุ่ม "ยกเลิก" — ยกเลิกการแก้ไข กลับเป็น read-only
- [x] พื้นหลัง input เปลี่ยนจากเทาเป็นขาวเมื่อ edit mode เปิด
- [x] แสดงข้อความ "บันทึกสำเร็จ" / "เกิดข้อผิดพลาด" หลังกดบันทึก

**Backend API ใหม่:**
- [x] `PUT /api/cases/:id/report` — endpoint สำหรับ checker อัพเดท survey report
- [x] รวม field เวลา (hour+minute) เป็น format เดียวก่อนบันทึก
- [x] บันทึกข้อมูลค่าใช้จ่ายลงตาราง `survey_expenses`
- [x] ตรวจสอบ column name กับ DB schema ป้องกัน SQL injection

**Database เพิ่มเติม:**
- เพิ่มคอลัมน์: `survey_result`, `driver_ticket`, `review_comment`, `surveyor_comment`
- เพิ่ม `name` attribute ครบ 100 ช่อง สำหรับ FormData collection

**UI ปรับปรุง:**
- [x] เปลี่ยนสี header gradient เป็น `#0174BE` → `#4988C4`
- [x] Photo lightbox เพิ่ม Zoom in/out (50%-300%) + ปุ่มรีเซ็ต
- [x] เปลี่ยน label ปุ่ม "อนุมัติ" เป็น "บันทึก"

---

### ปรับปรุง Survey Form + Driver Section ครั้งใหญ่ (23 มี.ค. 2026 — v1.5.8 ถึง v1.5.11)

**Web — ข้อมูลผู้ขับขี่ปรับ layout:**
- [x] จัดแถวใหม่: ชื่อ/นามสกุล แยกคอลัมน์จากเพศ/คำนำหน้า
- [x] วันเกิด + อายุ อยู่คอลัมน์เดียวกัน, ความสัมพันธ์ย้ายมาแทนที่
- [x] Dropdown ความสัมพันธ์ขยายเป็น 40 ตัวเลือก (สามี, ภรรยา, บุตร, ญาติ ฯลฯ)
- [x] เพิ่ม BANGKOK_DISTRICT_OPTIONS (50 เขต) ใน dropdown เขต/อำเภอผู้ขับขี่
- [x] แก้ dropdown คำนำหน้าให้ขยายตามเนื้อหา (w-auto)
- [x] เพิ่ม "ครั้งที่" dropdown ในแถบค่าใช้จ่าย
- [x] เพิ่ม `min-w-[1024px]` ทุก layout (callcenter, admin, inspector) ป้องกัน layout พัง
- [x] Flex-wrap สำหรับชื่อ/นามสกุลเมื่อจอแคบ

**Web — ประเภทรถ:**
- [x] เปลี่ยน value เป็นรหัสตัวอักษร (A=เก๋งเอเชีย, E=เก๋งยุโรป, M=รถจักรยานยนต์, T=กระบะ, V=รถตู้, W=รถบรรทุก, O=รถอื่นๆ)

**Mobile — ออกแบบฟอร์มสำรวจใหม่:**
- [x] AppBar gradient สีน้ำเงิน (#0174BE → #4988C4)
- [x] Section headers เป็น gradient สีน้ำเงิน + shadow
- [x] ลบ icon (prefixIcon) ทุกช่อง input — standard field สะอาด
- [x] Standard field: border สม่ำเสมอ, focus สีน้ำเงิน, isDense, contentPadding 12px
- [x] ประเภทเคลม/รถเสียหาย: custom chips ไม่มีเครื่องหมายถูก, ขยายเต็มพื้นที่
- [x] ลบ "รถหาย" checkbox ออก
- [x] ลบส่วน "บริษัทผู้จัดเรื่อง" และ "ข้อมูลลูกค้า" ออก
- [x] เรียง: เลขรับแจ้ง → เลขเคลม → เลขเซอร์เวย์ (คนละบรรทัด)
- [x] ปุ่มส่งข้อมูล gradient + shadow สวยขึ้น

**Mobile — ข้อมูลผู้ขับขี่ (Case Detail):**
- [x] เปลี่ยนจาก label:value เป็น input field (read-only) เหมือนเว็บ
- [x] จัด 2 คอลัมน์: เพศ|คำนำหน้า, ชื่อ|นามสกุล, อายุ|วันเกิด ฯลฯ

**Mobile — ระบบบันทึกร่าง (Draft Save):**
- [x] FloatingActionButton (FAB) มุมขวาล่าง กดบันทึกได้ตลอด
- [x] บันทึกลง SharedPreferences (local) ไม่ต้องใช้ internet
- [x] โหลดข้อมูลร่างอัตโนมัติเมื่อเปิดฟอร์ม
- [x] ลบ draft อัตโนมัติเมื่อส่งข้อมูลสำเร็จ

**Backend — API ใหม่:**
- [x] `PUT /api/cases/:id/survey` — surveyor อัพเดทข้อมูลสำรวจที่มีอยู่แล้ว (ไม่เช็ค status)
- [x] แก้ bug `submitSurvey` ใน api_service.dart ที่ส่งแค่ 4 ฟิลด์ → ส่งทุกฟิลด์

---

### Call Center → Mobile ส่งข้อมูลเบื้องต้น (24 มี.ค. 2026 — v1.5.13 ถึง v1.5.16)

**ฟีเจอร์หลัก: Call Center กรอกข้อมูลจากใบเคลม → สร้างเคส → ข้อมูลแสดงในแอปมือถือช่างสำรวจอัตโนมัติ**

**Backend:**
- [x] ขยาย `POST /api/cases` รับ 35+ field จากใบเคลม (เคลม, รถ, กรมธรรม์, คนขับ, อุบัติเหตุ)
- [x] สร้าง `survey_reports` เบื้องต้นอัตโนมัติเมื่อมีข้อมูลจากใบเคลม (transaction)
- [x] แก้ `submitSurvey` ให้ UPDATE ได้ถ้ามี report อยู่แล้ว (ป้องกัน unique constraint error)
- [x] เพิ่มคอลัมน์ `reporter_phone` ในตาราง survey_reports (migration 006)

**Web — หน้า Call Center สร้างเคส:**
- [x] เพิ่ม dropdown เลือกบริษัทประกันเป็นตัวเลือกหลัก
- [x] ไอโออิ → แสดงตารางข้อมูลเคลมแบบกะทัดรัด (ตามใบเคลมจริง)
- [x] ไทยไพบูลย์ → แสดงฟอร์ม 3 field เดิม (ชื่อ, สถานที่, ปุ่มสร้าง)
- [x] ค่าเริ่มต้น "-- เลือกบริษัทประกัน --" ไม่แสดงฟอร์มจนกว่าจะเลือก
- [x] แยกเบอร์โทรผู้แจ้ง (`reporter_phone`) กับเบอร์โทรผู้ขับขี่ (`driver_phone`)
- [x] ผู้เอาประกัน → ส่งทั้ง `customer_name` (cases) + `assured_name` (survey_reports)
- [x] สถานที่เกิดเหตุ → ส่งทั้ง `incident_location` (cases) + `acc_place` (survey_reports)

**Mobile:**
- [x] เพิ่ม `_loadExistingReport()` — โหลดข้อมูลจาก server ก่อน local draft
- [x] Refactor `_populateForm()` ใช้ร่วมกันระหว่าง server data และ draft data
- [x] ลำดับ: server data → draft data (draft ทับ server ได้)

**Test Data:**
- [x] ไฟล์ทดสอบ JSON จากใบเคลม Aioi Bangkok Insurance (`test_claim_aioi_commuter.json`)
- [x] ไฟล์ seed SQL (`003_seed_test_claim_aioi.sql`)

---

### OCR + ระบบสร้างเคสอัตโนมัติ + ปรับปรุง UI (28 มี.ค. 2026 — v1.5.20)

**OCR & Case Creation Bug Fixes:**
- [x] แก้ error "เกิดข้อผิดพลาด กรุณาลองใหม่" — แสดง error จริงจาก backend แทนข้อความกว้าง
- [x] เพิ่ม 8 OCR fields ที่ขาดใน Zod schema + DB (`acc_insurance_notify_time`, `receiver_name`, `surveyor_name`, `surveyor_phone`, `counterparty_plate/brand/insurance/detail`)
- [x] Migration 008: เพิ่ม 8 columns ใน survey_reports
- [x] Migration 009: ขยาย VARCHAR columns ที่สั้นเกินไป (20→50-100) แก้ "value too long" error
- [x] ขยาย `acc_place`, `notes`, `incident_location` เป็น VARCHAR(255)

**Web — Call Center ปรับปรุง:**
- [x] เรียกพิกัดมือถืออัตโนมัติเมื่อกดสร้างเคส (socket emit `request_location` ก่อน redirect)
- [x] หน้ามอบหมายช่าง auto-request พิกัดเมื่อ socket พร้อม (ไม่ต้องกดปุ่ม)
- [x] จังหวัด/อำเภอ เปลี่ยนจาก input เป็น dropdown (77 จังหวัด + กรองอำเภอตามจังหวัด) ทั้ง 2 ฟอร์ม (ไอโออิ + ไทยไพบูลย์)
- [x] ใช้ข้อมูลจังหวัด/อำเภอจากไฟล์ต้นฉบับตรงเป๊ะ (79 จังหวัด)

**Mobile — Auto-refresh งานใหม่:**
- [x] เมื่อได้รับ `case_assigned` ผ่าน socket → เรียก `fetchMyCases()` อัตโนมัติ (ไม่ต้อง pull-to-refresh)
- [x] เชื่อม AuthProvider → CaseProvider ผ่าน `setOnCaseAssignedRefresh` callback

**Mobile — ข้อมูลผู้ขับขี่ปรับปรุงใหญ่:**
- [x] เปิดทุก field ให้แก้ไขได้ (editable) — input พื้นหลังขาว, dropdown เลือกได้
- [x] เพศ/คำนำหน้า → dropdown select พร้อมตัวเลือกครบ
- [x] ความสัมพันธ์กับเจ้าของรถ → dropdown 39 ตัวเลือก (สามี, ภรรยา, บุตร ฯลฯ)
- [x] จังหวัด/อำเภอ → dropdown กรองอำเภอตามจังหวัด (โหลดจาก assets)
- [x] วันเกิด → custom Buddhist date picker (bottom sheet scroll wheel วัน/เดือน/ปี พ.ศ.)
- [x] เรียง field ใหม่: แถว 1 (เพศ+คำนำหน้า+วันเกิด) → แถว 2 (ชื่อ+นามสกุล) → แถว 3 (อายุ+โทรศัพท์+ความสัมพันธ์)
- [x] ปุ่ม "สแกนบัตรประชาชน" + "สแกนใบขับขี่" (UI พร้อม, รอ logic สแกน)
- [x] ใช้ `Flexible` แทน `SizedBox` — ช่องยืดหยุ่นตามขนาดจอ

**Mobile — แบบฟอร์มสำรวจ:**
- [x] ส่วนกรมธรรม์: ย้ายเลขกรมธรรม์ขึ้นบน + แยกบรรทัดเต็มพื้นที่

**Mobile — Dependencies:**
- [x] เพิ่ม `flutter_localizations` สำหรับ Thai locale
- [x] ตั้ง `locale: th_TH` ใน MaterialApp

### ปรับปรุงแบบฟอร์มสำรวจ + หน้ารายละเอียดงาน (31 มี.ค. 2026 — v1.5.21)

**Mobile — แบบฟอร์มสำรวจ ปรับปรุงครั้งใหญ่:**
- [x] จังหวัดรถ → dropdown 79 จังหวัด (โหลดจาก `thai_provinces.json`)
- [x] ความสัมพันธ์กับเจ้าของรถ → dropdown 39 ตัวเลือก
- [x] ประเภทใบขับขี่ → dropdown 21 ตัวเลือก (ตามต้นฉบับ)
- [x] เพศ → dropdown (เพศ/ชาย/หญิง) สไตล์เดียวกับหน้ารายละเอียด
- [x] วันเกิด → Buddhist Date Picker (scroll wheel วัน/เดือน/ปี พ.ศ.)
- [x] เพิ่มปุ่ม "สแกนบัตรประชาชน" + "สแกนใบขับขี่" (UI พร้อม, รอ logic)
- [x] เพิ่ม จังหวัด/เขต-อำเภอ ผู้ขับขี่ (dropdown กรองตามจังหวัด)
- [x] จัด layout ผู้ขับขี่ใหม่ 9 แถว ตรงกับหน้ารายละเอียดทุก field
- [x] ลักษณะการเกิดเหตุ → dropdown 70+ ตัวเลือก (ตามต้นฉบับ)
- [x] ลักษณะความเสียหาย → dropdown 20 ตัวเลือก (แยกบรรทัดเต็มพื้นที่)
- [x] ส่วนความเสียหาย — ออกแบบใหม่: ExpansionTile พับได้ + ปุ่ม + เพิ่มรายการ
  - ชิ้นส่วน (text input) + ตำแหน่ง (ซ้าย/ขวา/ทั้งหมด) + ระดับ (ต่ำ/กลาง/สูง/สูงมาก)
  - สีปุ่มระดับตามความรุนแรง (เขียว→ส้ม→แดง→ม่วง)
  - auto-fill ข้อมูลลง "รายละเอียดความเสียหาย" + scrollbar เมื่อเกิน
- [x] ปรับขนาดตัวอักษรทุกช่อง → fontSize 13 เท่ากันหมด
- [x] ปรับขนาดช่อง อายุ/โทรศัพท์/ความสัมพันธ์ ให้พอดีกับเนื้อหา

**Web — ปรับปรุง:**
- [x] ประเภทใบขับขี่ → เพิ่มเป็น 21 ตัวเลือก (ตามต้นฉบับ)

**Mobile — หน้ารายละเอียดงาน:**
- [x] นำส่วน "ข้อมูลผู้ขับขี่" และ "ความเสียหาย" ออก (ย้ายไปอยู่ในแบบฟอร์มสำรวจแทน)

---

## Phase 8: Deployment & Go-live 🔄 15%

- [x] Dockerfile สำหรับ backend (multi-stage build พร้อม)
- [x] docker-compose.yml มีแล้ว
- [ ] Deploy Backend + Web ผ่าน Dokploy บน Hostinger VPS
- [ ] ตั้งค่า SSL Certificate และ Domain
- [ ] ทดสอบบน Production environment
- [ ] Build Flutter APK/IPA สำหรับแจกจ่าย

---

## สิ่งที่ต้องทำต่อ (Priority)

### สำคัญสูง
1. ~~ตั้งค่า Firebase จริง~~ ✅ เสร็จแล้ว — FCM ทำงานได้ทั้ง foreground และ background
2. ~~Uncomment `Firebase.initializeApp()`~~ ✅ เปิดใช้งานแล้ว
3. ~~เพิ่ม platform permissions ใน Android config~~ ✅ เสร็จแล้ว (iOS ยังเหลือ Info.plist)
4. ~~ทดสอบ E2E: สำรวจ→ตรวจงาน~~ ✅ ผ่านครบทุก status (pending→assigned→surveyed→reviewed)
5. ~~แก้ surveyor login บนเว็บวนลูป~~ ✅ แสดง error message + auto logout
6. Deploy ขึ้น VPS (รอข้อมูล VPS จากผู้ใช้)
7. Build Flutter APK สำหรับแจกจ่าย

### สำคัญกลาง
8. ทดสอบ E2E ผ่าน UI จริง (mobile + web)
9. ทดสอบ File Upload จาก mobile → backend → แสดงใน web
10. ทดสอบ FCM บนอุปกรณ์จริง
11. ~~ตัดสินใจเรื่อง Maps~~ ✅ ใช้ Leaflet/OpenStreetMap ต่อ (ฟรี, ครบฟีเจอร์)
12. ~~เพิ่ม pagination + search/filter ใน web~~ ✅ มีใน Admin Panel แล้ว
13. เพิ่ม error pages (404, error boundary)
14. ~~เพิ่ม FCM fallback เมื่อ Socket disconnect~~ ✅ FCM ทำงานคู่กับ Socket.io แล้ว
15. เพิ่ม review rejection flow

### สำคัญต่ำ
16. Rate limiting middleware
17. Network retry logic ใน mobile
18. Offline caching
19. Audit logging

---

## Technology Stack (ใช้จริง)

| Component | Technology | สถานะ |
|---|---|:---:|
| Mobile App | Flutter + Dart | ✅ |
| Web Frontend | Next.js 14 (React) | ✅ |
| Backend API | Node.js + Express + TypeScript | ✅ |
| Database | PostgreSQL (Supabase) | ✅ |
| Real-time | Socket.io | ✅ |
| Push Notification | Firebase Cloud Messaging (FCM) + Socket.io + Local Notifications | ✅ |
| File Storage | Multer (local disk) | ✅ |
| Maps | Leaflet / OpenStreetMap (แทน Google Maps) | ✅ |
| Authentication | JWT | ✅ |
| Deployment | Docker + Dokploy (Hostinger VPS) | ⏳ รอ deploy |
