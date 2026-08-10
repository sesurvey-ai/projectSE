-- แยก "นำเข้า EMCS แล้ว" ออกจาก "ส่งงานให้ประกันแล้ว"
--
-- ปัญหาเดิม: มีแค่ emcs_imported_at ซึ่ง mark ทันทีที่ draft ถูกสร้าง (แม้บอทพัง
-- กลางทางก็ mark เพื่อกันสร้างเรื่องซ้ำ) แต่บอท **ห้ามกดปุ่ม "ส่งงานใหม่" เด็ดขาด**
-- → ป้ายเขียว "✓ นำเข้า EMCS แล้ว" บนเว็บขึ้นทั้งที่บริษัทประกันยังไม่ได้รับงาน
-- และไม่มีใครนับได้ว่ามี draft ค้างรอคนกดส่งอยู่กี่ใบ
--
-- เก็บ "ข้อความสถานะดิบ" ด้วย ไม่ใช่แค่ boolean — เพราะ EMCS มีสถานะมากกว่า
-- draft/ส่งแล้ว การเดาว่า "ไม่ใช่ draft = ส่งแล้ว" กว้างเกินจริง (ดู SUBMITTED_STATUSES
-- ฝั่ง se-autokey ที่เปลี่ยนเป็น whitelist แล้ว)
--
-- ⚠️ รันด้วยมือบน production ตาม convention เดิม

ALTER TABLE cases ADD COLUMN IF NOT EXISTS emcs_submitted_at TIMESTAMP NULL;
-- ข้อความสถานะที่อ่านได้จากหน้ารายการ EMCS ตรง ๆ (เช่น 'รายงานสร้างใหม่')
ALTER TABLE cases ADD COLUMN IF NOT EXISTS emcs_status_text VARCHAR(100) NULL;
-- เวลาที่ไปอ่านสถานะครั้งล่าสุด — ไว้บอกว่าข้อมูลสดแค่ไหน (ไม่มี poller อัตโนมัติ)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS emcs_status_checked_at TIMESTAMP NULL;

-- หา "draft ค้าง" ได้เร็ว (นำเข้าแล้วแต่ยังไม่ส่ง)
CREATE INDEX IF NOT EXISTS ix_cases_emcs_pending
  ON cases (emcs_imported_at)
  WHERE emcs_imported_at IS NOT NULL AND emcs_submitted_at IS NULL;
