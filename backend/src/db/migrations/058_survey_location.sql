-- 058: สถานที่ออกตรวจสอบ (ISURVEY แท็บ 2 survey_place / survey_provinceID / survey_amphurID / survey_tumbonID) — user ขอ 09/09/69
--
-- ISURVEY แยก "สถานที่ออกตรวจสอบ + จังหวัด/เขต-อำเภอ/ตำบล ที่ตรวจสอบ" ออกจากสถานที่เกิดเหตุ (เคลม 2026013072661:
-- เกิดเหตุ กทม./สวนหลวง แต่ช่างออกตรวจที่ ชลบุรี/บางละมุง) และเรทค่าบริการต้องคิดจาก "ที่ออกตรวจ" — ชุดเดียวกับที่
-- extension se-billing ใช้หาเรทบน ISURVEY (tab1_survey_provinceID/amphurID/tumbonID)
-- · ตัวดึงงาน (isurvey_to_sesurvey.py) เขียนคอลัมน์นี้ให้เอง (import ดูชื่อคอลัมน์จริงจาก information_schema)
-- · หน้าเคสแสดง/แก้ได้ใต้สถานที่เกิดเหตุ · ว่าง = คิดเรทจากสถานที่เกิดเหตุ (งานมือถือ/XML) · ⛔ ไม่เข้า XML/EMCS
--
-- รันบน prod ด้วยมือ
ALTER TABLE survey_reports
  ADD COLUMN IF NOT EXISTS survey_place TEXT,
  ADD COLUMN IF NOT EXISTS survey_province TEXT,
  ADD COLUMN IF NOT EXISTS survey_district TEXT,
  ADD COLUMN IF NOT EXISTS survey_subdistrict TEXT;
COMMENT ON COLUMN survey_reports.survey_place IS 'สถานที่ออกตรวจสอบ (ISURVEY แท็บ 2 survey_place) — แสดง/แก้บนหน้าเคส ไม่เข้า EMCS';
COMMENT ON COLUMN survey_reports.survey_province IS 'จังหวัดที่ตรวจสอบ — ใช้หาเรทค่าบริการก่อนสถานที่เกิดเหตุ';
COMMENT ON COLUMN survey_reports.survey_district IS 'เขต/อำเภอที่ตรวจสอบ — ใช้หาเรทค่าบริการก่อนสถานที่เกิดเหตุ';
COMMENT ON COLUMN survey_reports.survey_subdistrict IS 'ตำบลที่ตรวจสอบ (ชื่อล้วน เช่น บ่อวิน) — เรทตำบลพิเศษ';
