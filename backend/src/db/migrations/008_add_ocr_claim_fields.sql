-- Add OCR claim fields from Taiboon insurance form
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS acc_insurance_notify_time VARCHAR(10);
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS receiver_name VARCHAR(100);
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS surveyor_name VARCHAR(100);
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS surveyor_phone VARCHAR(20);
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS counterparty_plate VARCHAR(20);
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS counterparty_brand VARCHAR(100);
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS counterparty_insurance VARCHAR(200);
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS counterparty_detail TEXT;
