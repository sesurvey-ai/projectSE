-- Leave requests (ใบลา) + Attendance (บันทึกเวลาเข้า/ออกงาน)
-- พนักงานยื่นใบลา / ลงเวลาเข้า-ออก จากแอปมือถือ; admin/callcenter ดูรายงาน + อนุมัติใบลา
-- เวลาเก็บเป็นเวลาท้องถิ่นไทย (Asia/Bangkok) เพื่อให้ "วันนี้" และเวลาแสดงผลตรงกับผู้ใช้

-- ── ใบลา ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_requests (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type   VARCHAR(16) NOT NULL
                 CHECK (leave_type IN ('sick','personal','vacation','other')),
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  reason       TEXT,
  status       VARCHAR(16) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected')),
  reviewed_by  INT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at  TIMESTAMP,
  review_note  TEXT,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS leave_user_idx   ON leave_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS leave_status_idx ON leave_requests (status, created_at DESC);

-- ── บันทึกเวลาเข้า/ออกงาน ──────────────────────────────
-- 1 แถวต่อพนักงานต่อวัน; เข้างาน = insert, ออกงาน = update แถวเดิม
CREATE TABLE IF NOT EXISTS attendance_records (
  id            SERIAL PRIMARY KEY,
  user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_date     DATE NOT NULL,
  check_in_at   TIMESTAMP,
  check_in_lat  DOUBLE PRECISION,
  check_in_lng  DOUBLE PRECISION,
  check_out_at  TIMESTAMP,
  check_out_lat DOUBLE PRECISION,
  check_out_lng DOUBLE PRECISION,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, work_date)
);

CREATE INDEX IF NOT EXISTS attendance_user_date_idx ON attendance_records (user_id, work_date DESC);
CREATE INDEX IF NOT EXISTS attendance_date_idx      ON attendance_records (work_date DESC);
