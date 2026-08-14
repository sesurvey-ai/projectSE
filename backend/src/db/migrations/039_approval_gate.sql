-- ประตูอนุมัติ: อนุมัติแล้วล็อก · แอดมินปลดล็อกได้ · ปลดแล้วต้องอนุมัติใหม่
--
-- ปัญหาเดิม: ปุ่ม "อนุมัติ" มีอยู่แล้ว (สร้างแถวใน reviews + cases.status='reviewed')
-- แต่ไม่มีผลกับใครเลย —
--   · บอทหยิบเคสด้วย status IN ('surveyed','reviewed') = อนุมัติหรือไม่ก็เข้า EMCS ได้เท่ากัน
--   · อนุมัติแล้วยังกด "แก้ไขทั้งหมด" + "บันทึก" ได้ ข้อมูลเปลี่ยนหลังอนุมัติโดยไม่มีใครรู้
--   · reviews.case_id เป็น UNIQUE → ถ้าจะอนุมัติซ้ำหลังแก้ INSERT จะชนกัน
--
-- ตั้งแต่ migration นี้: reviews คือ "ใบอนุมัติใบเดียวของเคส" ที่เปลี่ยนสถานะไปมาได้
--   อนุมัติ → status='approved' · ปลดล็อก → status='pending' + cases.status กลับเป็น 'surveyed'
--
-- ⚠️ รันด้วยมือบน production ตาม convention เดิม

-- ใครปลดล็อกครั้งล่าสุด/เมื่อไหร่ — ไว้ตอบว่า "ทำไมเคสนี้ถูกแก้หลังอนุมัติ"
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS unlocked_by INT NULL REFERENCES users(id);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMP NULL;
-- นับสะสม ไม่รีเซ็ต — เคสที่ถูกปลดล็อกหลายรอบคือสัญญาณว่ามีอะไรผิดปกติ
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS unlocked_count INT NOT NULL DEFAULT 0;

-- บอทถามหา "เคสที่อนุมัติแล้วและยังไม่เข้า EMCS" บ่อยที่สุด
CREATE INDEX IF NOT EXISTS ix_cases_approved_pending_emcs
  ON cases (status)
  WHERE status = 'reviewed' AND emcs_imported_at IS NULL;
