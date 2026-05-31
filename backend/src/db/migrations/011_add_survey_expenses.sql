-- survey_expenses: ค่าใช้จ่ายในการสำรวจ (บันทึกโดย checker ตอนตรวจงาน)
-- NOTE: ตารางนี้ถูกอ้างอิงใน case.service.ts (getDetail, updateReport) และ
--   admin.service.ts แต่ไม่เคยถูกสร้างใน migration ใดเลย ทำให้ /cases/:id/detail
--   พังด้วย error "relation survey_expenses does not exist" และฟอร์มสำรวจโหลดว่าง
--   โครงสร้างอ้างอิงจาก db_export.json (ฐานข้อมูล production)
CREATE TABLE IF NOT EXISTS survey_expenses (
    id SERIAL PRIMARY KEY,
    report_id INT NOT NULL REFERENCES survey_reports(id) ON DELETE CASCADE,
    service_fee_count INTEGER,
    service_fee_price DECIMAL(10,2),
    travel_fee_count INTEGER,
    travel_fee_price DECIMAL(10,2),
    photo_fee_count INTEGER,
    photo_fee_price DECIMAL(10,2),
    phone_fee DECIMAL(10,2),
    bail_fee DECIMAL(10,2),
    claim_fee_percent DECIMAL(5,2),
    claim_fee_price DECIMAL(10,2),
    daily_record_fee DECIMAL(10,2),
    other_fee_detail TEXT,
    other_fee_price DECIMAL(10,2),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_expenses_report_id ON survey_expenses(report_id);
