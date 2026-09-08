-- 055: เขียนกลับ ISURVEY หลังอนุมัติ — ระบบกด "ยืนยันการตรวจสอบ" (ปิดงาน → จบงาน) แทนหัวหน้า (user เคาะ 08/09/69)
--
-- เคสที่ดึงจาก ISURVEY (source isurvey_live) พออนุมัติบนเว็บแล้ว งานต้นทางค้าง "รอตรวจข้อมูล" ต้องไปปิดมืออีกที
-- ตอนนี้ backend ส่งบัญชี ISURVEY ของหัวหน้าที่อนุมัติไปให้ service ดึงงาน (pull_service /close) ยิงคำสั่งเดียวกับปุ่มบนหน้าเว็บ
-- (ความเห็นหัวหน้า + ตารางค่าสำรวจ 2 ฝั่ง + "ปิดการตรวจสอบ") แล้วจดผลไว้ที่นี่ — ดู memory isurvey-writeback-plan
--
-- isurvey_close_dry_at  = โหมดทดลอง: ประกอบคำสั่งแล้วแต่ยังไม่ยิง (ENV ISURVEY_CLOSE_LIVE ยังไม่เปิด)
-- isurvey_closed_at     = ยิงจริงสำเร็จ ISURVEY ตอบ "ทำการเปลี่ยนเรียบร้อยแล้ว" และอ่านกลับเป็น "จบงาน"
-- isurvey_close_payload = ฟอร์ม 87 ช่องที่ส่ง (ไว้ตรวจย้อนหลัง)
--
-- รันบน prod ด้วยมือ
ALTER TABLE cases ADD COLUMN IF NOT EXISTS isurvey_closed_at TIMESTAMPTZ;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS isurvey_close_by INTEGER REFERENCES users(id);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS isurvey_close_error TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS isurvey_close_dry_at TIMESTAMPTZ;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS isurvey_close_payload JSONB;
COMMENT ON COLUMN cases.isurvey_closed_at IS 'ปิดงานบน ISURVEY (ยืนยันการตรวจสอบ → จบงาน) สำเร็จเมื่อ — null = ยังไม่ปิด/ยังทดลอง';
