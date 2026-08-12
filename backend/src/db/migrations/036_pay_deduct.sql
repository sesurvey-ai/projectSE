-- แยก "หักเงิน" ออกจาก "ค่าใช้จ่ายอื่นๆ"
--
-- ระบบเดิมยัดสองเรื่องนี้ไว้ช่องเดียวกัน (ค่าใช้จ่ายอื่นๆ = ติดลบเสมอ = หักเงิน) ไม่ใช่เพราะ
-- มันควรเป็นเรื่องเดียวกัน แต่เพราะส่วนขยายเบราว์เซอร์**แทรกช่องใหม่ลงฟอร์มของระบบเก่าไม่ได้**
-- จึงต้องยืมช่องที่มีอยู่มาใช้ ผลคือ "ค่าใช้จ่ายอื่นๆ" ที่เป็นรายจ่ายจริง (ค่าทางด่วน ฯลฯ)
-- กรอกไม่ได้เลย เพราะจะกลายเป็นหักเงินทันที
--
-- เว็บนี้เราสร้างเอง เพิ่มช่องได้ตามต้องการ → แยกให้ถูกความหมาย
--   other_fee   = รายจ่ายอื่นจริง ๆ (บวก)
--   deduct_fee  = หักเงิน (เก็บเป็นค่าบวก ระบบลบตอนรวมยอด)
--
-- เหตุผลหักเงินมาตรฐาน 2 ข้อยกมาจากระบบเดิม (checkbox ส่งช้า/เอกสารไม่ครบ)
-- + ช่องข้อความเผื่อกรณีอื่น — บังคับให้ระบุเหตุผลถ้ามีการหักเงิน (ตรวจฝั่งหน้าเว็บ)
--
-- ⚠️ ต้องรันด้วยมือบน production

ALTER TABLE survey_pay ADD COLUMN IF NOT EXISTS deduct_fee    DECIMAL(10,2);
ALTER TABLE survey_pay ADD COLUMN IF NOT EXISTS deduct_late   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE survey_pay ADD COLUMN IF NOT EXISTS deduct_docs   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE survey_pay ADD COLUMN IF NOT EXISTS deduct_reason TEXT;

COMMENT ON COLUMN survey_pay.other_fee  IS 'รายจ่ายอื่น ๆ (ค่าบวก) — ไม่ใช่ช่องหักเงินอีกต่อไป';
COMMENT ON COLUMN survey_pay.deduct_fee IS 'หักเงิน เก็บเป็นค่าบวก ระบบลบให้ตอนรวมยอด';
