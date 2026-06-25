-- Migration 023: เบอร์หัวหน้า call-consult = "whitelist รวม" (ไม่ผูกกับ users.supervisor_id)
-- ทุก surveyor เห็นหัวหน้าชุดเดียวกัน · 1 หัวหน้ามีได้หลายเบอร์ (ส่วนตัว/ออฟฟิศ)
-- รัน manual ใน Supabase SQL Editor (ไม่มี auto-runner). ของเดิม (6 แถวใน call_consult_log) เก็บไว้ ไม่ลบ.

-- หัวหน้า (รายชื่อ — ไม่ใช่ user ล็อกอิน)
CREATE TABLE IF NOT EXISTS consult_supervisors (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Bangkok')
);

-- เบอร์ของหัวหน้า (หลายเบอร์/คน) — number normalize แล้ว (เลขล้วน) + unique กันซ้ำข้ามคน
CREATE TABLE IF NOT EXISTS consult_supervisor_numbers (
  id            SERIAL PRIMARY KEY,
  supervisor_id INT NOT NULL REFERENCES consult_supervisors(id) ON DELETE CASCADE,
  number        VARCHAR(20) NOT NULL,
  label         VARCHAR(20),                 -- 'ส่วนตัว' | 'ออฟฟิศ'
  UNIQUE (number)
);
CREATE INDEX IF NOT EXISTS csn_sup_idx ON consult_supervisor_numbers (supervisor_id);

-- id หัวหน้าเริ่มที่ 101 → ไม่ชนกับ supervisor_id เดิมใน call_consult_log (ที่อ้าง users.id เก่า เช่น 2)
ALTER SEQUENCE consult_supervisors_id_seq RESTART WITH 101;

-- call_consult_log.supervisor_id: เลิกอ้าง users → อ้าง consult_supervisors
-- ใช้ NOT VALID เพื่อ "ไม่ตรวจแถวเดิม" (6 แถว test ที่ supervisor_id=2 จะคงอยู่ ไม่ถูกแตะ) แต่บังคับแถวใหม่
ALTER TABLE call_consult_log DROP CONSTRAINT IF EXISTS call_consult_log_supervisor_id_fkey;
ALTER TABLE call_consult_log
  ADD CONSTRAINT call_consult_log_supervisor_fk
  FOREIGN KEY (supervisor_id) REFERENCES consult_supervisors(id) ON DELETE SET NULL NOT VALID;
