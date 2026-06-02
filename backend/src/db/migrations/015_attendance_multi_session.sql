-- ลงเวลาเข้า–ออกได้หลายรอบต่อวัน
-- เดิม: 1 แถว/พนักงาน/วัน (UNIQUE user_id, work_date) → เข้า-ออกได้ครั้งเดียว
-- ใหม่: แต่ละรอบ = 1 แถว (check_in + check_out) → เข้า-ออกได้หลายรอบต่อวัน
--       เงื่อนไข: ต้องไม่มี "รอบที่ยังไม่ลงเวลาออก" (check_out_at IS NULL) ค้างอยู่ ก่อนลงเวลาเข้ารอบใหม่

-- 1) ปลดล็อก 1 แถว/วัน — ให้มีหลายรอบต่อวันได้
ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_user_id_work_date_key;

-- 2) safety net ระดับ DB: ห้ามมี "รอบที่เปิดค้าง" (ยังไม่ออก) เกิน 1 รอบ ต่อพนักงานต่อวัน
--    (ปลอดภัยกับข้อมูลเดิมเสมอ เพราะของเดิมมี ≤1 แถวต่อ (user_id, work_date) อยู่แล้ว)
CREATE UNIQUE INDEX IF NOT EXISTS attendance_one_open_per_user_day_idx
  ON attendance_records (user_id, work_date)
  WHERE check_out_at IS NULL;
