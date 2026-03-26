# SE SURVEY

## Work Plan & Technical Specification

**แผนการทำงานและขั้นตอนการทำงาน**

*Survey Employee Management System*

Mobile App • Unified Web (Call Center + Inspector)

**Version 1.2 | March 2026**

> ⚡ **Updated:** On-Demand Location (replaced auto GPS every 1 min)
>
> ⚡ **Updated v1.2:** รวม Call Center Web + Inspector Web เป็น app เดียว (Unified Web) — Login หน้าเดียว แยกหน้าตาม role

---

## ภาพรวมระบบ (System Overview)

ระบบ SE SURVEY ประกอบด้วย 2 ส่วนหลัก ทำงานร่วมกันผ่าน Backend API เดียวกัน:

1. **Flutter Mobile App** — แอปพนักงานสำรวจ: รับแจ้งเตือน, ถ่ายรูป, บันทึกข้อมูล, ส่ง GPS เมื่อถูกเรียก
2. **Next.js Unified Web** — เว็บรวม Login เดียว แยกหน้าตาม role:
   - **Call Center** (`/callcenter`) — รับแจ้ง: ดูตำแหน่งพนักงานบนแผนที่, รับข้อมูลลูกค้า, ส่งงานไปยังมือถือ, กดเรียกพิกัดพนักงาน
   - **Inspector** (`/inspector`) — ตรวจงาน: ตรวจสอบรายงาน, ดูรูปถ่าย, กรอกค่าบริการ

---

## เทคโนโลยีที่เลือกใช้ (Technology Stack)

| Component | Technology | Purpose |
|---|---|---|
| **Mobile App** | Flutter + Dart | Cross-platform mobile (iOS/Android), GPS |
| **Web Frontend** | Next.js 14 (React) | Unified web app (Login → role-based routing), SSR + SPA |
| **Backend API** | Node.js + Express | REST API, WebSocket, business logic |
| **Database** | PostgreSQL (Supabase) | Users, cases, vehicle data, service fees |
| **Real-time** | Socket.io | On-demand GPS request, live updates |
| **Push Notification** | Firebase Cloud Messaging | Send alerts to mobile from web |
| **File Storage** | Node.js File Server (Multer) | Upload/store photos from survey |
| **Maps** | Google Maps API | Display pins, geocoding locations |
| **Authentication** | JWT (JSON Web Token) | Login, role-based access control |
| **Deployment** | Dokploy (Hostinger VPS) | CI/CD, auto SSL |

---

## แผนการทำงานแบ่งเฟส (Development Phases)

ระยะเวลาทั้งหมดประมาณ **34 วันทำการ** (สามารถปรับได้ตามความซับซ้อน):

| Phase | Task | Duration | Deliverable | Status |
|:---:|---|---|---|---|
| 1 | Project Setup & DB Design | 3 days | DB Schema, Project repos | Pending |
| 2 | Authentication & User Roles | 3 days | Login API, JWT, Role guard | Pending |
| 3 | Backend API Development | 5 days | REST endpoints, Socket.io | Pending |
| 4 | Flutter Mobile App | 6 days | APK for testing | Pending |
| 5+6 | Unified Web (Next.js) — Call Center + Inspector | 7 days | Web app deployed | Pending |
| 7 | Integration & Testing | 5 days | Full system tested | Pending |
| 8 | Deployment & Go-live | 3 days | Production release | Pending |

### Phase 1: Project Setup & Database Design (3 วัน)

- สร้าง Git Repository และโครงสร้างโปรเจค (backend, web, mobile)
- ออกแบบฐานข้อมูล PostgreSQL (tables, relations, indexes)
- ตั้งค่า Supabase project และเชื่อมต่อฐานข้อมูล
- ตั้งค่า Firebase project สำหรับ Push Notification (FCM)
- ตั้งค่า Google Maps API Key

### Phase 2: Authentication & User Roles (3 วัน)

- สร้างระบบ Login API ด้วย JWT (username/password → token)
- สร้าง Role-based middleware: `surveyor`, `callcenter`, `checker`
- สร้างข้อมูล seed สำหรับทดสอบ (`survey01`, `callcenter01`, `checker01`)

### Phase 3: Backend API Development (5 วัน)

- สร้าง REST API ทั้งหมด (cases, locations, upload, review)
- ⚡ ตั้งค่า Socket.io สำหรับ **On-Demand Location Request** (Call Center กดเรียกพิกัด → มือถือส่งคืน)
- เชื่อมต่อ Firebase Cloud Messaging สำหรับส่งแจ้งเตือนไปยังมือถือ
- ตั้งค่า File upload endpoint พร้อมจัดเก็บรูปถ่าย

### Phase 4: Flutter Mobile App (6 วัน) — ปรับจาก 7 วัน

- หน้า Login: กรอก username/password และเก็บ JWT token
- ⚡ ไม่ต้องมี Background Service ส่ง GPS ทุก 1 นาทีแล้ว → เปลี่ยนเป็น listen Socket.io event `request_location`
- ⚡ เมื่อได้รับ event → ดึง GPS ปัจจุบัน แล้วส่งกลับทันที
- FCM Integration: รับแจ้งเตือนแม้แอปอยู่ background
- หน้ารายการงาน: แสดงเฉพาะงานของตัวเอง
- หน้าแบบฟอร์มสำรวจ: กรอกรุ่นรถ, สี, ทะเบียน, ถ่ายรูป
- ทดสอบบน Emulator (Android) และ iOS Simulator

### Phase 5+6: Unified Web — Next.js (7 วัน) — รวม Call Center + Inspector

> ⚡ **v1.2:** รวมเป็น app เดียว — Login หน้าเดียว ระบบ redirect ตาม role อัตโนมัติ

**หน้า Login (ใช้ร่วมกัน):**
- Login ที่ `/login` → ระบบตรวจ role → redirect ไป `/callcenter` หรือ `/inspector`

**Call Center (`/callcenter/*`) — สำหรับ role: callcenter:**
- หน้าหลัก: Dashboard + สร้างเคสใหม่
- หน้าที่ 1 — กรอกรายละเอียด: ชื่อ-นามสกุลผู้เกิดเหตุ, สถานที่เกิดเหตุ
- ⚡ หน้าที่ 2 — เพิ่มปุ่ม **"เรียกพิกัด"** บนแผนที่ → รอรับพิกัดแล้วแสดงหมุดพนักงานบน Google Maps
- Socket.io: รับพิกัดที่ส่งกลับมาและอัพเดตแผนที่ทันที

**Inspector (`/inspector/*`) — สำหรับ role: checker:**
- หน้ารายการงาน: แสดงรายการงานทั้งหมด
- หน้ารายละเอียดงาน: ข้อมูลสำรวจ, รูปถ่าย, รายละเอียดรถยนต์
- หน้าค่าบริการ: ช่องเสนอ + ช่องอนุมัติ + ปุ่มอนุมัติ

### Phase 7: Integration & Testing (5 วัน)

- ทดสอบ End-to-End: ตั้งแต่ login → เรียกพิกัด → รับงาน → สำรวจ → ตรวจงาน
- ทดสอบ Push Notification บน Emulator และอุปกรณ์จริง
- ⚡ ทดสอบ On-Demand GPS: Call Center กดเรียก → มือถือตอบกลับ → แสดงบนแผนที่
- แก้ Bug และปรับปรุงประสิทธิภาพ

### Phase 8: Deployment & Go-live (3 วัน)

- Deploy Backend + Unified Web ผ่าน Dokploy บน Hostinger VPS
- ตั้งค่า SSL Certificate และ Domain
- ทดสอบบน Production environment
- Build Flutter APK/IPA สำหรับแจกจ่าย

---

## ออกแบบฐานข้อมูล (Database Design)

ระบบใช้ PostgreSQL ผ่าน Supabase โดยมีตารางหลัก 6 ตาราง:

### Table: `users`

| Column | Type | Nullable | Description |
|---|---|---|---|
| id | SERIAL PK | NO | Auto-increment primary key |
| username | VARCHAR(50) | NO | Login username |
| password_hash | VARCHAR(255) | NO | Bcrypt hashed password |
| first_name | VARCHAR(100) | NO | First name |
| last_name | VARCHAR(100) | NO | Last name |
| role | ENUM | NO | `surveyor` / `callcenter` / `checker` |
| supervisor_id | INT FK | YES | References `users.id` (for checker) |
| is_active | BOOLEAN | NO | Account active status |
| fcm_token | VARCHAR(500) | YES | Firebase Cloud Messaging token |
| created_at | TIMESTAMP | NO | Record creation time |

### Table: `surveyor_locations`

| Column | Type | Nullable | Description |
|---|---|---|---|
| id | SERIAL PK | NO | Auto-increment primary key |
| user_id | INT FK | NO | References `users.id` |
| latitude | DECIMAL(10,7) | NO | GPS latitude |
| longitude | DECIMAL(10,7) | NO | GPS longitude |
| recorded_at | TIMESTAMP | NO | Time of GPS record |
| request_id | VARCHAR(100) | YES | Tracks which request triggered this |

### Table: `cases`

| Column | Type | Nullable | Description |
|---|---|---|---|
| id | SERIAL PK | NO | Auto-increment primary key |
| customer_name | VARCHAR(200) | NO | Customer full name |
| incident_location | VARCHAR(500) | NO | Incident address/description |
| incident_lat | DECIMAL(10,7) | YES | Incident latitude (geocoded) |
| incident_lng | DECIMAL(10,7) | YES | Incident longitude (geocoded) |
| assigned_to | INT FK | YES | Surveyor `user_id` |
| created_by | INT FK | NO | Call center `user_id` |
| status | ENUM | NO | `pending` / `assigned` / `surveyed` / `reviewed` |
| created_at | TIMESTAMP | NO | Case creation time |

### Table: `survey_reports`

| Column | Type | Nullable | Description |
|---|---|---|---|
| id | SERIAL PK | NO | Auto-increment primary key |
| case_id | INT FK | NO | References `cases.id` |
| car_model | VARCHAR(200) | YES | Vehicle model |
| car_color | VARCHAR(50) | YES | Vehicle color |
| license_plate | VARCHAR(20) | YES | License plate number |
| notes | TEXT | YES | Additional notes |
| created_at | TIMESTAMP | NO | Report creation time |

### Table: `survey_photos`

| Column | Type | Nullable | Description |
|---|---|---|---|
| id | SERIAL PK | NO | Auto-increment primary key |
| report_id | INT FK | NO | References `survey_reports.id` |
| file_path | VARCHAR(500) | NO | Path on file server |
| uploaded_at | TIMESTAMP | NO | Upload time |

### Table: `reviews`

| Column | Type | Nullable | Description |
|---|---|---|---|
| id | SERIAL PK | NO | Auto-increment primary key |
| case_id | INT FK | NO | References `cases.id` |
| checker_id | INT FK | NO | References `users.id` (checker) |
| comment | TEXT | YES | Checker comment |
| proposed_fee | DECIMAL(10,2) | YES | Proposed service fee |
| approved_fee | DECIMAL(10,2) | YES | Approved service fee |
| status | ENUM | NO | `pending` / `approved` |
| reviewed_at | TIMESTAMP | YES | Review timestamp |

---

## API Endpoints

Backend ใช้ Node.js + Express โดย endpoint หลักมีดังนี้:

| Method | Endpoint | Auth Role | Description |
|---|---|---|---|
| **POST** | `/api/auth/login` | Public | Login and receive JWT token |
| **GET** | `/api/users/me` | All roles | Get current user profile |
| **POST** | `/api/locations/request` | Callcenter | Request GPS from surveyors via Socket.io |
| **POST** | `/api/locations/respond` | Surveyor | Respond with current GPS coordinates |
| **GET** | `/api/locations/latest` | Callcenter | Get cached latest locations |
| **POST** | `/api/cases` | Callcenter | Create new case (incident report) |
| **GET** | `/api/cases/my` | Surveyor | Get cases assigned to me |
| **POST** | `/api/cases/:id/assign` | Callcenter | Assign case to surveyor + push notify |
| **POST** | `/api/cases/:id/survey` | Surveyor | Submit survey report + photos |
| **GET** | `/api/cases/review` | Checker | Get all cases for review (status: surveyed/reviewed) |
| **GET** | `/api/cases/:id/detail` | Checker | Get full case detail + photos |
| **POST** | `/api/cases/:id/review` | Checker | Submit review + service fee |
| **POST** | `/api/upload` | Surveyor | Upload photo files |

---

## ระบบเรียกพิกัดแบบ On-Demand (New)

แทนที่แอปจะส่งพิกัดทุก 1 นาทีตลอดเวลา เปลี่ยนเป็น Call Center กดเรียกเฉพาะเมื่อต้องการ:

### Socket.io Events

1. Call Center กดปุ่ม "เรียกพิกัด" → Server emit **`request_location`** ไปยังมือถือทุกเครื่อง
2. มือถือรับ event → ดึง GPS ปัจจุบัน → emit **`location_response`** กลับไป Server
3. Server ส่งต่อให้ Call Center → แสดงหมุดพนักงานบน Google Maps

### Fallback (FCM Silent Push)

หากมือถือ Socket disconnect (ปิดแอปหรือหน้าจอดับ) → Server ส่ง FCM silent push ไปปลุกแอปและดึงพิกัด

### ข้อดี

- ประหยัดแบตเตอรี่มือถือมาก (ไม่ต้องรัน GPS ตลอดเวลา)
- ลดภาระ Server และ Database (ไม่ต้องเก็บพิกัดทุกนาที)
- Code ง่ายขึ้น ตัด `flutter_background_service` ออกได้
- Phase 4 ลดจาก 7 เหลือ 6 วัน (รวมประหยัด 1 วัน)

---

## ขั้นตอนการทำงาน (Workflow)

### Workflow 1: พนักงานสำรวจ (Surveyor)

1. Login ด้วยรหัสพนักงาน (`survey01` / `password01`)
2. ⚡ แอปเชื่อมต่อ Socket.io และ listen event `request_location` (ไม่ส่ง GPS อัตโนมัติ)
3. ⚡ เมื่อ Call Center เรียกพิกัด → แอปดึง GPS และส่งกลับทันที
4. เมื่อมีงานใหม่ → รับ Push Notification (FCM) แม้หน้าจอดับ
5. กดแจ้งเตือน → เข้าหน้ารายละเอียดงาน (ชื่อ สถานที่เกิดเหตุ)
6. กรอกข้อมูลรถยนต์ (รุ่น, สี, ทะเบียน) + ถ่ายรูป
7. กดบันทึก → ข้อมูล + รูปถ่ายถูกส่งไป Backend

### Workflow 2: พนักงานรับแจ้ง (Call Center)

1. Login ที่เว็บ (`callcenter01` / `password01`) → ระบบ redirect ไป `/callcenter`
2. หน้าที่ 1: กรอกข้อมูลผู้เกิดเหตุ (ชื่อ-นามสกุล, สถานที่) → กดถัดไป
3. ⚡ หน้าที่ 2: กดปุ่ม "เรียกพิกัด" → รอรับ GPS จากมือถือ → แสดงหมุดบน Google Maps + รายชื่อเรียงตามความใกล้
4. เลือกพนักงานสำรวจ → กดส่งงาน → Push Notification ไปยังมือถือ

### Workflow 3: เจ้าหน้าที่ตรวจงาน (Inspector/Checker)

1. Login ที่เว็บเดียวกัน (`checker01` / `password01`) → ระบบ redirect ไป `/inspector`
2. ดูรายการงานทั้งหมด
3. เลือกรายการ → ดูรายละเอียดทั้งหมด (ข้อมูลรถ + รูปถ่าย)
4. กรอกความคิดเห็น → กดปุ่มค่าบริการ
5. กรอกจำนวนเงินเสนอ + จำนวนเงินอนุมัติ → กดอนุมัติ

---

## Flutter Packages ที่แนะนำ

> ⚡ ตัดออก: `flutter_background_service` (ไม่ต้องใช้แล้ว)

| Package | Purpose |
|---|---|
| `geolocator` | ดึงพิกัด GPS (latitude, longitude) |
| `firebase_messaging` | รับ Push Notification จาก FCM |
| `socket_io_client` | เชื่อมต่อ Socket.io สำหรับ on-demand location |
| `image_picker` | ถ่ายรูปจากกล้อง |
| `dio` | HTTP client สำหรับเรียก API |
| `flutter_local_notifications` | แสดง local notification |
| `shared_preferences` | เก็บ JWT token และ user data |
| `provider` | State management |
| `go_router` | Navigation & routing |

---

## ความปลอดภัย (Security)

- Password เก็บเป็น **bcrypt hash** (ไม่เก็บ plain text)
- JWT Token มีอายุ (expiry) และต้องแนบทุก API request
- Role-based access control: แต่ละ role เข้าถึงได้เฉพาะหน้าที่ของตัวเอง
- HTTPS (SSL) ผ่าน Dokploy auto-SSL
- File upload จำกัดประเภทไฟล์ และขนาด
