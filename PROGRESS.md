# SE SURVEY — Project Progress

**อัพเดทล่าสุด:** 20 มีนาคม 2026 (22:00)

---

## ภาพรวมความคืบหน้า

| Phase | รายการงาน | สถานะ | ความคืบหน้า |
|:---:|---|:---:|:---:|
| 1 | Project Setup & DB Design | ✅ เสร็จแล้ว | 100% |
| 2 | Authentication & User Roles | ✅ เสร็จแล้ว | 100% |
| 3 | Backend API Development | ✅ เสร็จเกือบครบ | 97% |
| 4 | Flutter Mobile App | ✅ เสร็จส่วนใหญ่ | 95% |
| 5+6 | Unified Web (Next.js) | ✅ เสร็จส่วนใหญ่ | 92% |
| 7 | Integration & Testing | 🔄 ดำเนินการ | 55% |
| 8 | Deployment & Go-live | ❌ ยังไม่ได้เริ่ม | 0% |

**ความคืบหน้ารวม: ~82%**

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
- [x] Role-based middleware: `surveyor`, `callcenter`, `checker`
- [x] GET `/api/users/me` — ดึงข้อมูล user ปัจจุบัน
- [x] PUT `/api/users/me/fcm-token` — อัพเดท FCM token
- [x] Seed data ทดสอบ (survey01, callcenter01, checker01)

---

## Phase 3: Backend API Development ✅ 97%

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

### Real-time & Notification

- [x] Socket.io On-Demand Location (request_location → location_response → broadcast)
- [x] FCM push notification service (sendNotification + sendSilentPush)
- [x] FCM เรียกอัตโนมัติเมื่อ assign case
- [x] Socket.io `case_assigned` event — ส่ง real-time notification ไปยัง mobile เมื่อมอบหมายงาน
- [x] Export `getIO()` จาก socket server สำหรับใช้ใน services อื่น
- [ ] FCM silent push fallback เมื่อ Socket disconnect — มี service แต่ยังไม่ trigger อัตโนมัติ

### File Upload

- [x] Multer config (JPEG, PNG, WebP)
- [x] จำกัดขนาด 10MB, สูงสุด 5 รูปต่อครั้ง
- [x] Static file serving ที่ `/uploads`

### สิ่งที่ยังขาด (Backend)

- [ ] Pagination (limit/offset) สำหรับ list endpoints
- [ ] Case status filtering endpoint
- [ ] Review rejection flow (ตอนนี้ review สถานะ approved อย่างเดียว)
- [ ] Case update endpoint (แก้ไขเคสหลังสร้าง)
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

## Phase 5+6: Unified Web (Next.js) ✅ 92%

### Authentication & Routing

- [x] Login page (`/login`) — username/password form
- [x] AuthProvider — React Context + token persistence (localStorage)
- [x] Role-based redirect (callcenter → `/callcenter`, checker → `/inspector`)
- [x] API interceptor (Axios + Bearer token + auto-logout on 401)
- [x] Protected layouts สำหรับทั้ง callcenter และ inspector

### Call Center (`/callcenter`)

- [x] Dashboard — welcome + link สร้างเคสใหม่
- [x] สร้างเคสใหม่ (`/cases/new`) — form: ชื่อลูกค้า + สถานที่เกิดเหตุ
- [x] มอบหมายงาน (`/cases/[id]/assign`) — แผนที่ + เลือก surveyor
- [x] ปุ่ม "เรียกพิกัด" → Socket.io request → แสดง surveyor บนแผนที่
- [x] คำนวณระยะทาง (Haversine) + เรียงลำดับ 5 คนใกล้สุด
- [x] SocketProvider — เชื่อมต่อ Socket.io + track connection status

### Inspector (`/inspector`)

- [x] Dashboard — แสดงรายการเคสรอตรวจ (CaseList component)
- [x] รายละเอียดเคส (`/cases/[id]`) — ข้อมูลเคส + report + รูปถ่าย
- [x] PhotoGallery — grid view + fullscreen modal
- [x] ReviewForm — ความคิดเห็น + ค่าบริการเสนอ + ค่าบริการอนุมัติ

### Layout & UI

- [x] Header — user info + role badge + logout
- [x] Sidebar — role-aware navigation
- [x] Tailwind CSS + responsive design
- [x] Thai localization ทั่วทั้งแอป
- [x] Status badges สีตาม status

### สิ่งที่ยังขาด (Web)

- [x] ~~ใช้ Leaflet/OpenStreetMap แทน Google Maps~~ — ตัดสินใจใช้ Leaflet ต่อ (ฟรี, ครบฟีเจอร์ที่ต้องการ)
- [ ] Error pages (error.tsx, not-found.tsx)
- [ ] Pagination สำหรับรายการเคส
- [ ] Search / Filter ในหน้า dashboard
- [ ] Toast notifications (ตอนนี้ใช้ inline messages)

---

## Phase 7: Integration & Testing 🔄 55%

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

---

## Phase 8: Deployment & Go-live ❌ 0%

- [x] Dockerfile สำหรับ backend (multi-stage build พร้อม)
- [x] docker-compose.yml มีแล้ว
- [ ] Deploy Backend + Web ผ่าน Coolify บน Hostinger VPS
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
12. เพิ่ม pagination + search/filter ใน web
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
| Deployment | Docker + Coolify (Hostinger VPS) | ⏳ รอ deploy |
