-- แจ้งเตือนงานใหม่: บันทึกว่า "ส่งเมื่อไหร่" และ "เครื่องช่างตอบรับเมื่อไหร่"
--
-- ⛔ ปัญหาที่แก้: FCM ตอบ success = Google รับเรื่องไว้ ไม่ได้แปลว่าเครื่องได้รับ
--    ถ้า push หายกลางทาง (เครื่องหลับลึก / แบตเตอรี่ปิดแอป / ไม่มีเน็ต) ไม่มีใครรู้เลย
--    ทั้งช่างและคนจ่ายงาน กว่าจะรู้คือลูกค้าโทรมาถามว่าทำไมไม่มีคนมา
--
-- push_sent_at      = เวลาที่เซิร์ฟเวอร์ยิง FCM ออกไปสำเร็จ (null = ไม่ได้ส่ง/ส่งไม่ออก)
-- push_delivered_at = เวลาที่เครื่องช่างยืนยันกลับมาว่าได้รับแล้ว (null = ยังไม่ถึง)
--
-- TIMESTAMPTZ ไม่ใช่ TIMESTAMP — prod เป็น UTC เครื่องพัฒนาเป็นเวลาไทย
-- node-postgres อ่าน TIMESTAMP เป็นเวลาท้องถิ่นของ process → เพี้ยน 7 ชม.
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS push_sent_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS push_delivered_at TIMESTAMPTZ;

-- หน้าจ่ายงานถามว่า "งานที่จ่ายไปแล้วอันไหนยังไม่ถึงเครื่อง" — เจาะเฉพาะแถวที่ค้างจริง
CREATE INDEX IF NOT EXISTS idx_cases_push_undelivered
  ON cases (assigned_to, push_sent_at)
  WHERE push_delivered_at IS NULL AND push_sent_at IS NOT NULL;
