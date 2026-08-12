-- ยอดเงินของ "นอกพื้นที่" / "นอกเวลา" — เดิมเก็บแค่ติ๊กว่ามีหรือไม่มี
--
-- บั๊กที่เจอตอนทำ Excel เบิกเงิน: ติ๊กนอกพื้นที่แล้ว**ยอดที่ระบบแนะนำไม่ขยับเลย**
-- เพราะโค้ดไปอ่าน `out_of_area_amt` ซึ่งไม่มีคอลัมน์นี้อยู่จริง → ได้ 0 เสมอ
--
-- และยอดสองตัวนี้ต้องแยกออกมาให้เห็นในใบเบิกเงินด้วย (ระบบเดิมมีคอลัมน์ของมันเอง)
-- รวมอยู่ในค่าบริการก้อนเดียวแล้วคนตรวจสอบยอดแยกไม่ออกว่าจ่ายค่าอะไรไปเท่าไหร่
--
-- ค่าตั้งต้นอยู่ใน billing_settings.modifier_fees (นอกพื้นที่ 50 · นอกเวลา 100)
-- แต่ **แก้เป็นเลขอื่นได้รายงาน** — ระบบเดิมก็ทำแบบนั้น (เคยเจอใส่ 80 แทน 50)
--
-- ⚠️ ต้องรันด้วยมือบน production

ALTER TABLE survey_pay ADD COLUMN IF NOT EXISTS out_of_area_amt  DECIMAL(10,2);
ALTER TABLE survey_pay ADD COLUMN IF NOT EXISTS out_of_hours_amt DECIMAL(10,2);

COMMENT ON COLUMN survey_pay.out_of_area_amt  IS 'ยอดค่านอกพื้นที่ (รวมอยู่ใน total แล้ว)';
COMMENT ON COLUMN survey_pay.out_of_hours_amt IS 'ยอดค่านอกเวลา (รวมอยู่ใน total แล้ว)';
