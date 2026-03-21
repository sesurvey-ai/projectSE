-- Add remaining fields from insurance survey form

-- ข้อมูลเคลม (เพิ่ม)
ALTER TABLE survey_reports ADD COLUMN damage_level VARCHAR(10);
ALTER TABLE survey_reports ADD COLUMN survey_job_no VARCHAR(30);
ALTER TABLE survey_reports ADD COLUMN claim_ref_no VARCHAR(50);

-- ข้อมูลกรมธรรม์
ALTER TABLE survey_reports ADD COLUMN prb_number VARCHAR(30);
ALTER TABLE survey_reports ADD COLUMN driver_by_policy VARCHAR(200);
ALTER TABLE survey_reports ADD COLUMN policy_start VARCHAR(20);
ALTER TABLE survey_reports ADD COLUMN policy_end VARCHAR(20);
ALTER TABLE survey_reports ADD COLUMN assured_name VARCHAR(200);
ALTER TABLE survey_reports ADD COLUMN policy_type VARCHAR(20);
ALTER TABLE survey_reports ADD COLUMN assured_email VARCHAR(100);
ALTER TABLE survey_reports ADD COLUMN risk_code VARCHAR(10);
ALTER TABLE survey_reports ADD COLUMN deductible DECIMAL(10,2);

-- ข้อมูลรถ (เพิ่ม)
ALTER TABLE survey_reports ADD COLUMN car_reg_year VARCHAR(10);
ALTER TABLE survey_reports ADD COLUMN ev_type VARCHAR(10);
ALTER TABLE survey_reports ADD COLUMN model_no VARCHAR(50);

-- ข้อมูลผู้ขับขี่ (เพิ่ม)
ALTER TABLE survey_reports ADD COLUMN driver_gender VARCHAR(5);
ALTER TABLE survey_reports ADD COLUMN driver_title VARCHAR(20);
ALTER TABLE survey_reports ADD COLUMN driver_birthdate VARCHAR(20);
ALTER TABLE survey_reports ADD COLUMN driver_address TEXT;
ALTER TABLE survey_reports ADD COLUMN driver_license_type VARCHAR(100);
ALTER TABLE survey_reports ADD COLUMN driver_license_place VARCHAR(50);
ALTER TABLE survey_reports ADD COLUMN driver_license_start VARCHAR(20);
ALTER TABLE survey_reports ADD COLUMN driver_license_end VARCHAR(20);
