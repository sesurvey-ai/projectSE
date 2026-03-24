-- เพิ่มเบอร์โทรผู้แจ้ง
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS reporter_phone VARCHAR(20);
