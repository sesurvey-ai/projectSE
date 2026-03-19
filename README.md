# SE SURVEY — Survey Employee Management System

ระบบจัดการพนักงานสำรวจ ประกอบด้วย 3 ส่วนหลัก ทำงานร่วมกันผ่าน Backend API เดียวกัน

---

## ภาพรวมระบบ

| Component | Technology | Port | Description |
|---|---|---|---|
| **Backend API** | Node.js + Express + Socket.io | 3001 | REST API, WebSocket, FCM |
| **Web App** | Next.js 14 (React) | 3000 | เว็บรวม — Login เดียว แยกหน้าตาม role (callcenter / checker) |
| **Mobile App** | Flutter (Dart) | — | แอปพนักงานสำรวจ — รับงาน, ถ่ายรูป, ส่ง GPS |
| **Database** | PostgreSQL (Supabase) | — | ฐานข้อมูลหลัก |

## โครงสร้างโปรเจค

```
projectSE/
├── backend/              # Node.js + Express API
│   └── src/
│       ├── config/       # env, database, firebase, multer
│       ├── middleware/   # auth (JWT), role guard, validation
│       ├── routes/       # auth, users, cases, locations, upload
│       ├── controllers/  # request/response handling
│       ├── services/     # business logic + DB queries
│       ├── socket/       # Socket.io (on-demand GPS)
│       └── db/           # SQL migrations + seed data
├── packages/shared/      # Shared TypeScript types & constants
├── web/                  # Next.js 14 — Unified Web (Login → role-based routing)
│   └── src/app/
│       ├── login/        # หน้า Login (ใช้ร่วมกัน)
│       ├── callcenter/   # หน้า Call Center (role: callcenter)
│       └── inspector/    # หน้า Inspector (role: checker)
├── mobile/               # Flutter — Surveyor App
└── docker-compose.yml    # Docker deployment
```

---

## สิ่งที่ต้องทำก่อนรันจริง

### 1. สร้าง Supabase Project

1. ไปที่ [supabase.com](https://supabase.com) แล้วสร้างโปรเจคใหม่
2. เข้า **SQL Editor** แล้วรัน 2 ไฟล์ตามลำดับ:
   - `backend/src/db/migrations/001_initial_schema.sql` — สร้าง 6 ตาราง + ENUMs + indexes
   - `backend/src/db/seeds/001_seed_users.sql` — สร้าง test users 4 คน
3. ไปที่ **Settings → Database** แล้วคัดลอก **Connection string** (URI format)

### 2. สร้าง Firebase Project

1. ไปที่ [Firebase Console](https://console.firebase.google.com) แล้วสร้างโปรเจคใหม่
2. เปิดใช้งาน **Cloud Messaging (FCM)**
3. ไปที่ **Project Settings → Service accounts** → Generate new private key
4. จดค่า `project_id`, `client_email`, `private_key` จากไฟล์ JSON ที่ดาวน์โหลด
5. **(สำหรับ Flutter)** ไปที่ **Project Settings → General**:
   - เพิ่ม Android app → ดาวน์โหลด `google-services.json` → วางไว้ที่ `mobile/android/app/`
   - เพิ่ม iOS app → ดาวน์โหลด `GoogleService-Info.plist` → วางไว้ที่ `mobile/ios/Runner/`

### 3. สร้าง Google Maps API Key

1. ไปที่ [Google Cloud Console](https://console.cloud.google.com)
2. เปิดใช้งาน APIs:
   - **Maps JavaScript API** (สำหรับ web)
   - **Maps SDK for Android** (สำหรับ mobile)
   - **Maps SDK for iOS** (สำหรับ mobile)
3. สร้าง API Key ที่ **Credentials**
4. **(สำหรับ Flutter Android)** เพิ่ม key ใน `mobile/android/app/src/main/AndroidManifest.xml`:
   ```xml
   <meta-data android:name="com.google.android.geo.API_KEY" android:value="YOUR_KEY"/>
   ```

### 4. ตั้งค่า Environment Variables

#### Backend — สร้างไฟล์ `backend/.env`
```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres
JWT_SECRET=your-secret-key-at-least-32-characters-long
JWT_EXPIRES_IN=24h
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000,http://localhost:3002
UPLOAD_DIR=./src/uploads
MAX_FILE_SIZE=10485760
```

#### Web App — สร้างไฟล์ `web/.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_GOOGLE_MAPS_KEY=your-google-maps-api-key
```

#### Flutter Mobile — แก้ไฟล์ `mobile/lib/config/api_config.dart`
```dart
class ApiConfig {
  // Android Emulator → localhost
  static const String baseUrl = 'http://10.0.2.2:3001';
  static const String socketUrl = 'http://10.0.2.2:3001';

  // iOS Simulator → localhost
  // static const String baseUrl = 'http://localhost:3001';

  // ใช้จริง → ใส่ domain
  // static const String baseUrl = 'https://api.yourdomain.com';
}
```

### 5. Install Dependencies

```bash
# ที่ root ของโปรเจค (ติดตั้ง backend + web apps ทั้งหมด)
npm install

# Flutter
cd mobile && flutter pub get
```

---

## วิธีรัน (Development)

เปิด 4 terminals แยกกัน:

```bash
# Terminal 1 — Backend API (http://localhost:3001)
cd backend
npm run dev

# Terminal 2 — Web App (http://localhost:3000)
cd web
npm run dev

# Terminal 3 — Flutter Mobile App
cd mobile
flutter run
```

### ทดสอบ Backend

```bash
# Health check
curl http://localhost:3001/health

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"callcenter01","password":"password01"}'
```

---

## Test Users

รหัสผ่านทุกคน: `password01`

| Username | Role | ใช้งานที่ |
|---|---|---|
| `survey01` | surveyor | Mobile App |
| `survey02` | surveyor | Mobile App |
| `callcenter01` | callcenter | Web App → /callcenter |
| `checker01` | checker | Web App → /inspector |

---

## Workflow การใช้งาน

```
1. Call Center login ที่ web (http://localhost:3000 → /callcenter)
       │
       ▼
2. สร้างเคสใหม่ (กรอกชื่อลูกค้า + สถานที่)
       │
       ▼
3. กดปุ่ม "เรียกพิกัด" → มือถือ surveyor ส่ง GPS กลับ
       │
       ▼
4. เลือก surveyor → กดมอบหมาย → Push notification ไปที่มือถือ
       │
       ▼
5. Surveyor เปิดแอป → เห็นงานใหม่ → กรอกข้อมูลรถ + ถ่ายรูป → ส่ง
       │
       ▼
6. Checker login ที่ web (http://localhost:3000 → /inspector) → ดูรายงาน + รูปถ่าย
       │
       ▼
7. กรอกค่าบริการ → กดอนุมัติ → เสร็จสิ้น
```

---

## Deployment (Production)

### ใช้ Docker Compose

```bash
# Build และรันทุก service
docker-compose up -d --build

# ดู logs
docker-compose logs -f
```

### ใช้ Coolify (Hostinger VPS)

1. Push code ไป GitHub repository
2. ใน Coolify dashboard สร้าง 3 services:
   - **Backend** — ชี้ไปที่ `backend/Dockerfile`, ตั้งค่า env vars, mount volume สำหรับ uploads
   - **Web App** — ชี้ไปที่ `web/Dockerfile`, port 3000
3. ตั้งค่า domain + SSL (auto จาก Coolify)
4. Build Flutter APK: `cd mobile && flutter build apk --release`

---

## API Endpoints

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Login |
| GET | `/api/users/me` | All | ดูโปรไฟล์ |
| PUT | `/api/users/me/fcm-token` | All | อัพเดท FCM token |
| POST | `/api/cases` | Callcenter | สร้างเคส |
| GET | `/api/cases/my` | Surveyor | ดูงานของฉัน |
| POST | `/api/cases/:id/assign` | Callcenter | มอบหมายงาน |
| POST | `/api/cases/:id/survey` | Surveyor | ส่งรายงานสำรวจ |
| GET | `/api/cases/review` | Checker | ดูเคสรอตรวจ |
| GET | `/api/cases/:id/detail` | Checker | รายละเอียดเคส |
| POST | `/api/cases/:id/review` | Checker | อนุมัติ + ค่าบริการ |
| POST | `/api/upload` | Surveyor | อัพโหลดรูปถ่าย |
| POST | `/api/locations/respond` | Surveyor | ส่งพิกัด GPS |
| GET | `/api/locations/latest` | Callcenter | ดูพิกัดล่าสุด |

### Socket.io Events

| Event | Direction | Description |
|---|---|---|
| `request_location` | Server → Surveyor | Call Center เรียกพิกัด |
| `location_response` | Surveyor → Server | มือถือส่ง GPS กลับ |
| `location_update` | Server → Callcenter | แสดงพิกัดบนแผนที่ |
