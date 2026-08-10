-- เลขเซอร์เวย์ (SETP-xxx) ห้ามซ้ำข้ามเคส — เป็นเลขอ้างอิงเบิกเงิน
--
-- เดิมบังคับที่โค้ดอย่างเดียว (assertSurveyJobNoUnique) และเรียกแค่ 3 ที่
-- (create / submit / import XML) — **ไม่เรียกตอน PUT** จึงแก้ให้ซ้ำได้
-- ซ้ำร้าย เป็น check-then-insert ไม่มี constraint รองรับ = 2 คำขอพร้อมกันลอดได้
--
-- ⚠️ รันด้วยมือบน production ตาม convention เดิม (ไม่มีตัวรันอัตโนมัติ)
-- ตรวจก่อนรัน 2026-08-11: survey_reports 7 แถว ไม่มีค่าซ้ำ สร้าง index ผ่านแน่

-- ── 1) กันซ้ำ "ในคอลัมน์เดียวกัน ข้ามแถว" ───────────────────────────────────
-- ต้องเป็น partial: ค่า '' (ไม่ใช่ NULL) หลุดเข้ามาได้จาก submit เพราะ bindVal
-- ไม่แปลง ''→NULL ต่างจาก create()/updateReport() — UNIQUE ธรรมดาจะทำให้เคสที่
-- ปล่อยเลขว่างใบที่สองชนกันเอง
CREATE UNIQUE INDEX IF NOT EXISTS ux_survey_reports_job_no
  ON survey_reports (survey_job_no)
  WHERE COALESCE(survey_job_no, '') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS ux_survey_reports_job_no_2
  ON survey_reports (survey_job_no_2)
  WHERE COALESCE(survey_job_no_2, '') <> '';

-- ── 2) กันซ้ำ "ในแถวเดียวกัน" (งานครั้งที่ 2 ใช้เลขเดียวกับครั้งแรกไม่ได้) ──
ALTER TABLE survey_reports
  DROP CONSTRAINT IF EXISTS ck_survey_reports_job_no_distinct;
ALTER TABLE survey_reports
  ADD CONSTRAINT ck_survey_reports_job_no_distinct
  CHECK (
    COALESCE(survey_job_no, '') = ''
    OR COALESCE(survey_job_no_2, '') = ''
    OR survey_job_no IS DISTINCT FROM survey_job_no_2
  );

-- ── 3) กันซ้ำ "ข้ามคอลัมน์" ────────────────────────────────────────────────
-- กติกาที่โค้ดบังคับอยู่คือ survey_job_no ของเคส A ห้ามชน survey_job_no_2 ของเคส B
-- (case.service.ts: WHERE survey_job_no = $1 OR survey_job_no_2 = $1)
-- UNIQUE ต่อคอลัมน์ครอบไม่ถึง → ใช้ตารางทะเบียนเลข + trigger sync
-- เลือกวิธีนี้แทนการ normalize เป็นตารางลูก เพราะไม่ต้องแตะ query ที่อ่าน
-- survey_job_no ตรง ๆ (integration.routes, xmlExport, list, dashboard ฯลฯ)
CREATE TABLE IF NOT EXISTS survey_job_no_registry (
  job_no     VARCHAR(100) PRIMARY KEY,
  report_id  INTEGER NOT NULL REFERENCES survey_reports(id) ON DELETE CASCADE,
  col        SMALLINT NOT NULL CHECK (col IN (1, 2))
);

CREATE INDEX IF NOT EXISTS ix_survey_job_no_registry_report
  ON survey_job_no_registry (report_id);

CREATE OR REPLACE FUNCTION sync_survey_job_no_registry() RETURNS TRIGGER AS $$
BEGIN
  -- ลบของเดิมของ report นี้ก่อนเสมอ แล้วใส่ใหม่ = idempotent ทั้ง INSERT และ UPDATE
  DELETE FROM survey_job_no_registry WHERE report_id = NEW.id;

  IF COALESCE(NEW.survey_job_no, '') <> '' THEN
    INSERT INTO survey_job_no_registry (job_no, report_id, col)
      VALUES (btrim(NEW.survey_job_no), NEW.id, 1);
  END IF;

  IF COALESCE(NEW.survey_job_no_2, '') <> '' THEN
    INSERT INTO survey_job_no_registry (job_no, report_id, col)
      VALUES (btrim(NEW.survey_job_no_2), NEW.id, 2);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_survey_job_no_registry ON survey_reports;
CREATE TRIGGER trg_sync_survey_job_no_registry
  AFTER INSERT OR UPDATE OF survey_job_no, survey_job_no_2 ON survey_reports
  FOR EACH ROW EXECUTE FUNCTION sync_survey_job_no_registry();

-- เติมทะเบียนจากข้อมูลที่มีอยู่ (ครั้งเดียวตอนรัน migration)
INSERT INTO survey_job_no_registry (job_no, report_id, col)
  SELECT btrim(survey_job_no), id, 1 FROM survey_reports
   WHERE COALESCE(survey_job_no, '') <> ''
  ON CONFLICT (job_no) DO NOTHING;

INSERT INTO survey_job_no_registry (job_no, report_id, col)
  SELECT btrim(survey_job_no_2), id, 2 FROM survey_reports
   WHERE COALESCE(survey_job_no_2, '') <> ''
  ON CONFLICT (job_no) DO NOTHING;
