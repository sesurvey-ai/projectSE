-- Add accident detail fields to survey_reports

-- ข้อมูลอุบัติเหตุ
ALTER TABLE survey_reports ADD COLUMN acc_date VARCHAR(20);
ALTER TABLE survey_reports ADD COLUMN acc_time VARCHAR(10);
ALTER TABLE survey_reports ADD COLUMN acc_place VARCHAR(200);
ALTER TABLE survey_reports ADD COLUMN acc_province VARCHAR(50);
ALTER TABLE survey_reports ADD COLUMN acc_district VARCHAR(50);
ALTER TABLE survey_reports ADD COLUMN acc_cause VARCHAR(100);
ALTER TABLE survey_reports ADD COLUMN acc_damage_type VARCHAR(100);
ALTER TABLE survey_reports ADD COLUMN acc_detail TEXT;
ALTER TABLE survey_reports ADD COLUMN acc_fault VARCHAR(50);

-- ข้อมูลการสำรวจ
ALTER TABLE survey_reports ADD COLUMN acc_reporter VARCHAR(100);
ALTER TABLE survey_reports ADD COLUMN acc_surveyor VARCHAR(100);
ALTER TABLE survey_reports ADD COLUMN acc_customer_report_date VARCHAR(30);
ALTER TABLE survey_reports ADD COLUMN acc_insurance_notify_date VARCHAR(30);
ALTER TABLE survey_reports ADD COLUMN acc_survey_arrive_date VARCHAR(30);
ALTER TABLE survey_reports ADD COLUMN acc_survey_complete_date VARCHAR(30);

-- คู่กรณี
ALTER TABLE survey_reports ADD COLUMN acc_claim_opponent TEXT;
ALTER TABLE survey_reports ADD COLUMN acc_claim_amount DECIMAL(12,2);

-- ตำรวจ
ALTER TABLE survey_reports ADD COLUMN acc_police_name VARCHAR(100);
ALTER TABLE survey_reports ADD COLUMN acc_police_station VARCHAR(100);
ALTER TABLE survey_reports ADD COLUMN acc_police_comment TEXT;
ALTER TABLE survey_reports ADD COLUMN acc_alcohol_test VARCHAR(100);

-- ติดตามงาน
ALTER TABLE survey_reports ADD COLUMN acc_followup VARCHAR(20);
ALTER TABLE survey_reports ADD COLUMN acc_followup_detail TEXT;
