-- Expand survey_reports with insurance, vehicle, driver, and damage fields

-- ข้อมูลประกัน/เคลม
ALTER TABLE survey_reports ADD COLUMN claim_type VARCHAR(20);
ALTER TABLE survey_reports ADD COLUMN insurance_company VARCHAR(200);
ALTER TABLE survey_reports ADD COLUMN policy_no VARCHAR(50);
ALTER TABLE survey_reports ADD COLUMN claim_no VARCHAR(50);

-- ข้อมูลรถ (เพิ่มเติม)
ALTER TABLE survey_reports ADD COLUMN car_brand VARCHAR(100);
ALTER TABLE survey_reports ADD COLUMN car_type VARCHAR(50);
ALTER TABLE survey_reports ADD COLUMN car_province VARCHAR(100);
ALTER TABLE survey_reports ADD COLUMN chassis_no VARCHAR(50);
ALTER TABLE survey_reports ADD COLUMN engine_no VARCHAR(50);
ALTER TABLE survey_reports ADD COLUMN mileage INTEGER;

-- ข้อมูลผู้ขับขี่
ALTER TABLE survey_reports ADD COLUMN driver_name VARCHAR(200);
ALTER TABLE survey_reports ADD COLUMN driver_age INTEGER;
ALTER TABLE survey_reports ADD COLUMN driver_phone VARCHAR(20);
ALTER TABLE survey_reports ADD COLUMN driver_id_card VARCHAR(20);
ALTER TABLE survey_reports ADD COLUMN driver_license_no VARCHAR(30);
ALTER TABLE survey_reports ADD COLUMN driver_relation VARCHAR(100);

-- ข้อมูลความเสียหาย
ALTER TABLE survey_reports ADD COLUMN damage_description TEXT;
ALTER TABLE survey_reports ADD COLUMN estimated_cost DECIMAL(12,2);
