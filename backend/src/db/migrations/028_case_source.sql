-- ที่มาของเคส — ใช้ตัดสิน "กติกายอดเงิน" ตอน gen XML ส่งเข้า EMCS
--
--   mobile      (default) = พนักงานกรอกบนแอป se-survey → ยอดเงินยังไม่มีในขั้นนี้
--                           หัวหน้าจะไปกรอกที่หน้า "ค่าใช้จ่าย" ของ EMCS แล้วกดส่งงานเอง
--                           → XML ต้องส่ง 0 ไม่งั้นไปทับของหัวหน้า
--   isurvey_xml = นำเข้าจากไฟล์ XML ของ ISURVEY (ระบบเก่า) ซึ่งหัวหน้ากรอกยอดเงินมาแล้ว
--                           → XML ต้องส่งยอดจริงต่อ ไม่งั้นข้อมูลของหัวหน้าหาย
--
-- ⚠️ รันบน prod ด้วยมือ (ตาม convention เดิม)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'mobile';
