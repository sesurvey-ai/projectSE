-- ท่อ se-survey → se-billing (/captures) — user สั่งต่อ 03/09/69
--
-- เดิม captures บน billing.sesurvey.cloud มาจากทางเดียว: Chrome extension ตอนหัวหน้ากรอก
-- ค่าบริการบนหน้า ISURVEY — งานที่ตรวจบน se-survey ไม่เคยไปโผล่ที่นั่นเลย
--
-- billing_capture_id = id แถวใน captures ของ se-billing (ไว้ถอน/แทนที่ตอนปลดล็อก-อนุมัติใหม่
--                      ไม่งั้นอนุมัติซ้ำ = แถวซ้ำในบัญชี เพราะ se-billing ไม่กันซ้ำด้วยเลขเคลม)
-- billing_sent_at    = ส่งสำเร็จเมื่อไหร่ · TIMESTAMPTZ (prod เป็น UTC เครื่องพัฒนาเวลาไทย)
-- billing_error      = ส่งครั้งล่าสุดพังเพราะอะไร (null = ไม่พัง) หน้าตรวจโชว์ + ปุ่มส่งซ้ำ
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS billing_capture_id INTEGER,
  ADD COLUMN IF NOT EXISTS billing_sent_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_error      TEXT;
