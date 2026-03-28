-- Expand short VARCHAR columns to prevent "value too long" errors from OCR data

-- VARCHAR(20) → VARCHAR(100)
ALTER TABLE survey_reports ALTER COLUMN license_plate TYPE VARCHAR(100);
ALTER TABLE survey_reports ALTER COLUMN counterparty_plate TYPE VARCHAR(100);
ALTER TABLE survey_reports ALTER COLUMN policy_type TYPE VARCHAR(100);
ALTER TABLE survey_reports ALTER COLUMN claim_type TYPE VARCHAR(100);
ALTER TABLE survey_reports ALTER COLUMN acc_followup TYPE VARCHAR(100);

-- VARCHAR(20) → VARCHAR(50)
ALTER TABLE survey_reports ALTER COLUMN driver_phone TYPE VARCHAR(50);
ALTER TABLE survey_reports ALTER COLUMN reporter_phone TYPE VARCHAR(50);
ALTER TABLE survey_reports ALTER COLUMN surveyor_phone TYPE VARCHAR(50);
ALTER TABLE survey_reports ALTER COLUMN acc_surveyor_phone TYPE VARCHAR(50);
ALTER TABLE survey_reports ALTER COLUMN driver_id_card TYPE VARCHAR(50);
ALTER TABLE survey_reports ALTER COLUMN driver_title TYPE VARCHAR(50);
ALTER TABLE survey_reports ALTER COLUMN driver_birthdate TYPE VARCHAR(50);
ALTER TABLE survey_reports ALTER COLUMN driver_license_start TYPE VARCHAR(50);
ALTER TABLE survey_reports ALTER COLUMN driver_license_end TYPE VARCHAR(50);
ALTER TABLE survey_reports ALTER COLUMN acc_date TYPE VARCHAR(50);

-- VARCHAR(10) → VARCHAR(50)
ALTER TABLE survey_reports ALTER COLUMN acc_insurance_notify_time TYPE VARCHAR(50);
ALTER TABLE survey_reports ALTER COLUMN acc_time TYPE VARCHAR(50);
ALTER TABLE survey_reports ALTER COLUMN damage_level TYPE VARCHAR(50);
ALTER TABLE survey_reports ALTER COLUMN car_reg_year TYPE VARCHAR(50);
