-- สถานะ "นำเข้า EMCS แล้ว" ของเคส — กัน import เลขเคลมเดิมซ้ำ (EMCS จะสร้างเรื่องซ้ำ)
-- SE-AutoKey แจ้งกลับผ่าน POST /api/integrations/cases/:id/emcs-imported ทันทีที่ import สำเร็จ
-- ⚠️ รันบน prod ด้วยมือ (ตาม convention เดิม)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS emcs_imported_at TIMESTAMP NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS emcs_esurvey_no VARCHAR(50) NULL;
