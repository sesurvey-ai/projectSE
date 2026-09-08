-- 056: "หมายเหตุ" จากต้นทาง ISURVEY (แท็บ 2 Accident.remark) — user ขอ 08/09/69
--
-- ช่างพิมพ์เรื่องค่าใช้จ่าย/นัดหมายไว้ในช่องหมายเหตุของ ISURVEY (เช่น "ค่าพาหนะ 800 บาท") หัวหน้าต้องเห็นตอนตรวจ
-- แสดงอย่างเดียวใต้ "รายละเอียดการเกิดเหตุ" บนหน้าเคส · ⛔ ไม่ส่งเข้า EMCS/XML (ไม่มีช่องรองรับและ user ไม่ต้องการ)
-- ตัวดึงงานเขียนคอลัมน์นี้ให้เองเมื่อมีคอลัมน์ (import ดูชื่อคอลัมน์จริงจาก information_schema)
--
-- รันบน prod ด้วยมือ
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS source_remark TEXT;
COMMENT ON COLUMN survey_reports.source_remark IS 'หมายเหตุจากต้นทาง (ISURVEY แท็บ 2 remark) — แสดงอย่างเดียว ไม่เข้า EMCS';
