-- 057: "รายการตรวจสอบ" ของหัวหน้า (ชุดเดียวกับ ISURVEY แท็บ 1) — user ขอ 08/09/69
--
-- หัวหน้าติ๊กบนหน้าเคส (หมวดใต้ทรัพย์สินเสียหาย เหนือรูปหลักฐาน):
--   claimform (เอกสารเคลมฟอร์ม/บันทึกถ้อยคำลูกค้า) Y=มี N=ไม่มี · chassis (เลขตัวถัง) Y=ตรง N=ไม่ตรง ·
--   driver_license (ใบขับขี่รถประกัน) Y/N · document (สำเนาใบรับรองความเสียหาย/บัตรติดต่อ) D=ใบรับรองความเสียหาย C=บัตรติดต่อ N=ไม่ออกเอกสาร ·
--   other (ข้อความ) · image_photo_id (รูปที่วาดตอนอนุมัติ — อยู่ในหมวด "รูปรถประกัน" ไหลเข้า EMCS ทางท่อรูป)
-- รหัสตรงกับ inputValue ของ ISURVEY (tabsummary.js) จึงส่งกลับตอนปิดงานได้ตรง ๆ (chk_claimform/chk_chassisNo/chk_drvLic/chk_prtDoc/chk_other)
--
-- รันบน prod ด้วยมือ
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS checklist JSONB;
COMMENT ON COLUMN survey_reports.checklist IS 'รายการตรวจสอบของหัวหน้า {claimform,chassis,driver_license,document,other,image_photo_id} รหัสเดียวกับ ISURVEY chk_*';
