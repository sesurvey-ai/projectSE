-- 052: คิวนำเข้า EMCS สำหรับ "สถานีนำเข้า" (user ตัดสิน 04/09/69)
--
-- เดิมปุ่ม "นำเข้า EMCS" ต้องมีบอทติดตั้งบนเครื่องที่กด (127.0.0.1:8765) และ Chrome ต้องขออนุญาต
-- เครือข่ายภายใน · ตอนนี้กดจากเครื่องไหนก็ได้ → งานเข้าคิว → บอทบน "เครื่องสถานี" (Windows ที่จัดเตรียมไว้)
-- มารับงานทีละเรื่อง (ล็อกอิน EMCS ครั้งเดียวต่อกะ) แล้วรายงานผลกลับ
--
-- สถานะ: queued → running → done | failed · cancelled (ยกเลิกได้เฉพาะตอน queued)
-- 1 เคสมีงาน "ที่ยังไม่จบ" ได้ครั้งละ 1 (partial unique) · งานที่ทำสำเร็จแล้ว mark ที่ cases.emcs_imported_at
-- ตามท่อเดิม (บอทเรียก /api/integrations/cases/:id/emcs-imported) — คิวไม่ทับกติกากันซ้ำ 3 ชั้น
--
-- รันบน prod ด้วยมือ (ไม่มีตัวรันอัตโนมัติ)

CREATE TABLE IF NOT EXISTS emcs_import_jobs (
  id              SERIAL PRIMARY KEY,
  case_id         INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  status          VARCHAR(20) NOT NULL DEFAULT 'queued',
  dry_run         BOOLEAN NOT NULL DEFAULT FALSE,          -- ทดสอบสถานี: ตรวจ XML+รูป ไม่แตะ EMCS
  requested_by    INTEGER REFERENCES users(id),
  requested_at    TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Bangkok'),
  started_at      TIMESTAMP,                               -- สถานีรับงานเมื่อ
  heartbeat_at    TIMESTAMP,                               -- สถานีบอกว่ายังทำอยู่ (ทุก ~1 นาที)
  finished_at     TIMESTAMP,
  station         VARCHAR(80),                             -- ชื่อเครื่องสถานีที่รับงาน
  attempts        INTEGER NOT NULL DEFAULT 0,
  esurvey_no      VARCHAR(50),                             -- เลข e-Survey ของ draft ที่สร้างได้
  error           TEXT,
  log_tail        TEXT,                                    -- log ท้าย ๆ จากบอท (ไว้ดูสาเหตุบนเว็บ)
  screenshot_path VARCHAR(500)                             -- ภาพหน้าจอตอนพัง (ใต้ UPLOAD_DIR)
);

-- 1 เคส = งานค้างได้งานเดียว (กันกดซ้ำเข้าคิว 2 ใบ)
CREATE UNIQUE INDEX IF NOT EXISTS emcs_import_jobs_active_case
  ON emcs_import_jobs (case_id) WHERE status IN ('queued', 'running');
CREATE INDEX IF NOT EXISTS emcs_import_jobs_status_id ON emcs_import_jobs (status, id);
CREATE INDEX IF NOT EXISTS emcs_import_jobs_case ON emcs_import_jobs (case_id, id DESC);
