-- Call Consult Logging — บันทึกการโทรปรึกษา พนักงาน(surveyor) -> หัวหน้า(supervisor)
-- เพื่อทำรีพอร์ต "หัวหน้ารับสาย/ไม่รับสาย" ลดปัญหาไม่รับสาย (ไม่อัดเสียง)
-- หัวหน้า = users.supervisor_id ของพนักงาน; เบอร์หัวหน้าเก็บใน users.phone

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

CREATE TABLE IF NOT EXISTS call_consult_log (
  id                SERIAL PRIMARY KEY,
  staff_id          INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supervisor_id     INT REFERENCES users(id) ON DELETE SET NULL,
  supervisor_number VARCHAR(20) NOT NULL,        -- normalize แล้ว
  started_at        TIMESTAMP NOT NULL,
  duration_sec      INT NOT NULL DEFAULT 0,
  status            VARCHAR(16) NOT NULL
                      CHECK (status IN ('answered','no_answer','missed','rejected')),
  device_call_id    VARCHAR(64) NOT NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, device_call_id)
);

CREATE INDEX IF NOT EXISTS ccl_sup_started_idx   ON call_consult_log (supervisor_id, started_at);
CREATE INDEX IF NOT EXISTS ccl_staff_started_idx ON call_consult_log (staff_id, started_at);
