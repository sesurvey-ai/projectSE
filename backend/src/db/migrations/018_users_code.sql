-- รหัส SE (เลขประจำตัวพนักงาน) บน users — ผูกบัญชีแอปกับชื่อในตารางจัดเวร
-- ให้บอร์ด "เวลาเข้างานพนักงาน" จับคู่ "ใครลงเวลา" (user_id) กับ "เวร/จุด" (รหัส SE ในตาราง) ได้
ALTER TABLE users ADD COLUMN IF NOT EXISTS code VARCHAR(16);
CREATE INDEX IF NOT EXISTS users_code_idx ON users(code);
