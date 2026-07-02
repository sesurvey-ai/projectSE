-- เลขเรื่องเซอร์เวย์ "งานที่ 2" (survey รอง) — บางใบรับแจ้งเคลมมี 2 เลขเซอร์เวย์ (งาน1 + งาน2)
-- survey_job_no = งาน1 (หลัก, เลขน้อยกว่า), survey_job_no_2 = งาน2 (รอง)
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS survey_job_no_2 VARCHAR(100);
