-- พิกัดตอนช่างกด "ถึงที่เกิดเหตุ" + จังหวัด/อำเภอที่ช่างยืนยัน
--
-- เดิมยืนยันถึงที่เกิดเหตุส่งมาแค่ path รูป — ถ่ายจากที่ไหนก็ได้ ไม่มีอะไรผูกกับสถานที่จริง
--
-- ⛔ **เก็บ 2 ชุด แยกกันโดยตั้งใจ**
--    `arrival_lat/lng`            = พิกัดดิบจาก GPS (หลักฐาน ห้ามแก้)
--    `arrival_province/district`  = สิ่งที่ **คนยืนยัน** บนหน้าจอ (อาจต่างจากที่ GPS เดา)
--    เพราะยืนใกล้เส้นแบ่งจังหวัด/สัญญาณเพี้ยน = พิกัดชี้ผิดจังหวัดได้
--    ถ้าเก็บชุดเดียวแล้วเชื่อ GPS ล้วน ๆ ปัญหา "เลขผิดพื้นที่" จะแค่ย้ายที่เกิด
--    (กติกา "GPS เสนอ คนยืนยัน" — เตรียมไว้ให้เรื่องออกเลขเซอร์เวย์ใช้ต่อ)
--
-- ⛔ TIMESTAMPTZ เหมือน 044 — timestamp ไร้โซนเวลา node-postgres อ่านเป็นเวลาเครื่องที่รัน
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS arrival_lat      NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS arrival_lng      NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS arrival_province TEXT,
  ADD COLUMN IF NOT EXISTS arrival_district TEXT,
  ADD COLUMN IF NOT EXISTS arrival_at       TIMESTAMPTZ;

COMMENT ON COLUMN cases.arrival_lat IS 'พิกัดดิบจาก GPS ตอนกดถึงที่เกิดเหตุ (หลักฐาน)';
COMMENT ON COLUMN cases.arrival_province IS 'จังหวัดที่ผู้สำรวจ "ยืนยัน" บนหน้าจอ — อาจต่างจากที่ GPS เดา';
