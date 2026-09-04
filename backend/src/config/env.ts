import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('15d'),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  TYPHOON_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  GEMINI_VERTEX: z.string().optional(),        // '1' = ใช้ Gemini ผ่าน Vertex AI (Firebase SA) แทน API key
  GEMINI_LOCATION: z.string().optional(),      // region ของ Vertex (default us-central1)
  GEMINI_MODEL: z.string().optional(),         // ชื่อโมเดล (default gemini-3.1-flash-lite)
  PORT: z.coerce.number().default(3001),
  // service token สำหรับเครื่องมือภายใน (se-autokey ดึง XML/รูป) — ไม่ตั้ง = ปิด integration routes
  INTEGRATION_TOKEN: z.string().min(24).optional(),
  // เจ้าของเคสที่ se-autokey สร้างผ่าน integration (cases.created_by เป็น NOT NULL)
  // ไม่ตั้ง = ใช้แอดมิน id น้อยสุดที่ยังเปิดใช้งาน
  INTEGRATION_CREATED_BY: z.coerce.number().int().positive().optional(),
  // ท่อไป se-billing (/captures) — ไม่ตั้ง SEBILLING_URL = ปิดท่อ (เครื่องพัฒนา)
  // SEBILLING_TOKEN = API_TOKEN ของ se-billing server (prod เปิด auth อยู่ — ไม่มี token = 401)
  // ค่าว่าง = ไม่ตั้ง (Dokploy ชอบส่ง KEY= เปล่า ๆ มา ถ้าใช้ .url() ตรง ๆ backend จะตายตั้งแต่ boot)
  SEBILLING_URL: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
  SEBILLING_TOKEN: z.string().optional(),
  // ดึงงาน "รอตรวจข้อมูล" จาก ISURVEY ด้วยบัญชีรายคน (04/09/69) — ผ่าน service pull_service.py ของ se-autokey
  // ไม่ตั้ง URL = ฟีเจอร์ปิด · TOKEN = PULL_SERVICE_TOKEN ของ service · CRED_KEY = กุญแจ AES-256 (hex 64 ตัว)
  // ใช้เข้ารหัสรหัสผ่าน ISURVEY ที่ผู้ใช้ฝากไว้ — เปลี่ยนแล้วทุกคนต้องกรอกใหม่
  ISURVEY_SERVICE_URL: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
  ISURVEY_SERVICE_TOKEN: z.string().optional(),
  CRED_KEY: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  UPLOAD_DIR: z.string().default('./src/uploads'),
  MAX_FILE_SIZE: z.coerce.number().default(10485760),
});

export const env = envSchema.parse(process.env);
