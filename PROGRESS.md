# SE SURVEY — Project Progress

**อัพเดทล่าสุด:** 20 มีนาคม 2026

---

## ภาพรวมความคืบหน้า

| Phase | รายการงาน | สถานะ | ความคืบหน้า |
|:---:|---|:---:|:---:|
| 1 | Project Setup & DB Design | ✅ เสร็จแล้ว | 100% |
| 2 | Authentication & User Roles | ✅ เสร็จแล้ว | 100% |
| 3 | Backend API Development | ✅ เสร็จเกือบครบ | 95% |
| 4 | Flutter Mobile App | ✅ เสร็จส่วนใหญ่ | 85% |
| 5+6 | Unified Web (Next.js) | ✅ เสร็จส่วนใหญ่ | 90% |
| 7 | Integration & Testing | ❌ ยังไม่ได้เริ่ม | 0% |
| 8 | Deployment & Go-live | ❌ ยังไม่ได้เริ่ม | 0% |

**ความคืบหน้ารวม: ~70%**

---

## Phase 1: Project Setup & DB Design ✅ 100%

- [x] สร้าง Git Repository และโครงสร้างโปรเจค (backend, web, mobile)
- [x] ออกแบบฐานข้อมูล PostgreSQL 6 ตาราง (users, surveyor_locations, cases, survey_reports, survey_photos, reviews)
- [x] สร้าง Migration SQL พร้อม indexes และ enums
- [x] ตั้งค่า Supabase project และเชื่อมต่อฐานข้อมูล
- [x] Seed data สำหรับ test users (survey01, callcenter01, checker01)
- [ ] ตั้งค่า Firebase project สำหรับ Push Notification (FCM) — scaffold แล้ว แต่ยังไม่ได้เชื่อมจริง
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

## Phase 3: Backend API Development ✅ 95%

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

## Phase 4: Flutter Mobile App ✅ 85%

### หน้าจอ (Screens)

- [x] Login Screen — username/password + validation + error display
- [x] Case List Screen — แสดงรายการงาน + pull-to-refresh + empty state
- [x] Case Detail Screen — แสดงรายละเอียดเคส + status badge + ปุ่มเริ่มสำรวจ
- [x] Survey Form Screen — กรอกข้อมูลรถ + ถ่ายรูป + ส่งข้อมูล

### Services

- [x] API Service (Dio + JWT interceptor + timeout 30s)
- [x] Auth Service (login, logout, token storage ด้วย SharedPreferences)
- [x] Socket Service (on-demand GPS: listen `request_location` → ส่ง GPS กลับ)
- [x] Location Service (Geolocator: high accuracy, permission handling)
- [x] FCM Service (local notifications setup, token refresh listener)

### State Management

- [x] AuthProvider (user, token, auth state)
- [x] CaseProvider (cases list, survey submission)
- [x] Go Router navigation with auth guards

### สิ่งที่ยังขาด (Mobile)

- [ ] **Firebase.initializeApp()** — ถูก comment ไว้ใน main.dart, push notification ยังไม่ทำงานจริง
- [ ] **google-services.json** (Android) — ยังไม่มี
- [ ] **GoogleService-Info.plist** (iOS) — ยังไม่มี
- [ ] Platform permissions ใน AndroidManifest.xml / Info.plist (camera, location)
- [ ] Network error handling / retry logic สำหรับ upload ที่ล้มเหลว
- [ ] Offline caching

---

## Phase 5+6: Unified Web (Next.js) ✅ 90%

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

- [ ] ใช้ Leaflet/OpenStreetMap แทน Google Maps (workplan ระบุ Google Maps)
- [ ] Error pages (error.tsx, not-found.tsx)
- [ ] Pagination สำหรับรายการเคส
- [ ] Search / Filter ในหน้า dashboard
- [ ] Toast notifications (ตอนนี้ใช้ inline messages)

---

## Phase 7: Integration & Testing ❌ 0%

- [ ] ทดสอบ End-to-End: login → เรียกพิกัด → รับงาน → สำรวจ → ตรวจงาน
- [ ] ทดสอบ Push Notification บน Emulator และอุปกรณ์จริง
- [ ] ทดสอบ On-Demand GPS: Call Center กดเรียก → มือถือตอบกลับ → แสดงบนแผนที่
- [ ] ทดสอบ File Upload จาก mobile → backend → แสดงใน web
- [ ] แก้ Bug และปรับปรุงประสิทธิภาพ

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
1. ตั้งค่า Firebase จริง — สร้าง project, ใส่ google-services.json, enable FCM
2. Uncomment `Firebase.initializeApp()` ใน mobile/main.dart
3. เพิ่ม platform permissions (camera, location) ใน Android/iOS config
4. ทดสอบ flow ทั้งระบบ end-to-end
5. Deploy ขึ้น Coolify (เมื่อ test ผ่าน)

### สำคัญกลาง
6. ตัดสินใจเรื่อง Maps: ใช้ Google Maps ตาม workplan หรือ Leaflet ที่มีอยู่
7. เพิ่ม pagination + search/filter ใน web
8. เพิ่ม error pages (404, error boundary)
9. เพิ่ม FCM fallback เมื่อ Socket disconnect
10. เพิ่ม review rejection flow

### สำคัญต่ำ
11. Rate limiting middleware
12. Network retry logic ใน mobile
13. Offline caching
14. Audit logging

---

## Technology Stack (ใช้จริง)

| Component | Technology | สถานะ |
|---|---|:---:|
| Mobile App | Flutter + Dart | ✅ |
| Web Frontend | Next.js 14 (React) | ✅ |
| Backend API | Node.js + Express + TypeScript | ✅ |
| Database | PostgreSQL (Supabase) | ✅ |
| Real-time | Socket.io | ✅ |
| Push Notification | Firebase Cloud Messaging | ⚠️ ยังไม่ได้เชื่อมจริง |
| File Storage | Multer (local disk) | ✅ |
| Maps | Leaflet / OpenStreetMap (แทน Google Maps) | ✅ |
| Authentication | JWT | ✅ |
| Deployment | Docker + Coolify (Hostinger VPS) | ⏳ รอ deploy |
