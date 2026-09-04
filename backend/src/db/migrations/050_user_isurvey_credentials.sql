-- บัญชี ISURVEY รายคน สำหรับให้เซิร์ฟเวอร์ดึงงาน "รอตรวจข้อมูล" เข้าเว็บ se-survey — user ตัดสิน 04/09/69
--
-- ทุกคนมีบัญชี ISURVEY ของตัวเองอยู่แล้ว → กรอกไว้ที่หน้าตั้งค่าบนเว็บ แล้วตอนกด "ดึงงาน"
-- เซิร์ฟเวอร์ใช้บัญชีของ **คนที่กด** (แต่ละคนเห็นงานของตัวเอง ไม่เตะกันเพราะ ISURVEY จำกัด 1 การใช้งาน/บัญชี)
--
-- password_enc = base64( iv 12 ไบต์ | auth tag 16 ไบต์ | ciphertext ) AES-256-GCM ด้วย CRED_KEY ใน env ของ backend
--                ไม่มี CRED_KEY = ถอดไม่ได้ (เปลี่ยน key แล้วต้องให้ทุกคนกรอกใหม่)
-- last_ok_at / last_error = ผลล็อกอินครั้งล่าสุด (ไว้โชว์ว่าบัญชีใช้ได้ไหม โดยไม่ต้องลองใหม่ทุกครั้ง)
-- display_name = ชื่อที่ ISURVEY ตอบกลับหลังล็อกอิน
CREATE TABLE IF NOT EXISTS user_isurvey_credentials (
  user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  username      TEXT NOT NULL,
  password_enc  TEXT NOT NULL,
  display_name  TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_ok_at    TIMESTAMPTZ,
  last_error    TEXT
);
