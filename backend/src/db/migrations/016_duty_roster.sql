-- ============================================
-- Migration 016: Duty roster (ตารางเวรประจำจุด) — SE-AIOI
-- จุด (stations) + เวร (shifts, 5 คงที่) + สล๊อตเวร (duty_slots) + อาสา (volunteers)
-- ใช้ร่วมกับ attendance_records + leave_requests เดิม (ลา/เวลาเข้างาน มาจากตารางเดิม)
-- ============================================

-- ── เวร (อ้างอิง, 5 เวร เวลาคงที่) ─────────────────────────
CREATE TABLE IF NOT EXISTS shifts (
  key         VARCHAR(16) PRIMARY KEY,           -- shift1|shift2|shift3|fix1|fix2
  label       VARCHAR(40) NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  is_fix      BOOLEAN NOT NULL DEFAULT false,
  sort_order  INT NOT NULL
);

INSERT INTO shifts (key, label, start_time, end_time, is_fix, sort_order) VALUES
  ('shift1', 'เวร 1', '07:00', '15:00', false, 1),
  ('shift2', 'เวร 2', '15:00', '23:00', false, 2),
  ('shift3', 'เวร 3', '23:00', '07:00', false, 3),
  ('fix1',   'Fix 1', '07:00', '16:00', true,  4),
  ('fix2',   'Fix 2', '14:00', '23:00', true,  5)
ON CONFLICT (key) DO NOTHING;

-- ── จุดประจำ ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stations (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  region      VARCHAR(8) NOT NULL CHECK (region IN ('bkk','upc')),  -- กรุงเทพฯ-ปริมณฑล | ต่างจังหวัด
  sort_order  INT NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX IF NOT EXISTS stations_name_uniq ON stations(name);

-- ── สล๊อตเวรประจำจุด ──────────────────────────────────────
--   kind='rotate' → เวร1/2/3 หมุนอัตโนมัติทุกเดือน
--                   shift ของเดือน M = [shift1,shift2,shift3][(rotate_offset + เดือนนับจาก anchor) % 3]
--   kind='fix'    → เวรคงที่ (fixed_shift = fix1|fix2) — admin กำหนดเอง ไม่หมุน
--   user_id       → คนที่อยู่สล๊อตนี้ (เปลี่ยนคน = แก้ค่านี้ ตามแนวคิด "สล๊อต")
--   weekly_off    → วันหยุดประจำสัปดาห์ของคนในสล๊อต (0=อาทิตย์ .. 6=เสาร์)
CREATE TABLE IF NOT EXISTS duty_slots (
  id            SERIAL PRIMARY KEY,
  station_id    INT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  kind          VARCHAR(8) NOT NULL CHECK (kind IN ('rotate','fix')),
  rotate_offset SMALLINT,                              -- 0..2 (เฉพาะ kind='rotate')
  fixed_shift   VARCHAR(16) REFERENCES shifts(key),    -- fix1|fix2 (เฉพาะ kind='fix')
  user_id       INT REFERENCES users(id) ON DELETE SET NULL,
  weekly_off    SMALLINT,                              -- 0=อา..6=ส
  note          TEXT,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT duty_slots_kind_chk CHECK (
    (kind = 'rotate' AND rotate_offset IS NOT NULL) OR
    (kind = 'fix'    AND fixed_shift   IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_duty_slots_station ON duty_slots(station_id);
CREATE INDEX IF NOT EXISTS idx_duty_slots_user ON duty_slots(user_id) WHERE user_id IS NOT NULL;

-- ── อาสา (แจ้งจากหน้าลงเวลาเข้างาน → ขึ้นทันที ที่จุดตัวเอง) ──
CREATE TABLE IF NOT EXISTS volunteers (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_date   DATE NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  station_id  INT REFERENCES stations(id),     -- snapshot จุดตัวเองตอนแจ้ง
  note        TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_volunteers_date ON volunteers(work_date);
CREATE INDEX IF NOT EXISTS idx_volunteers_user_date ON volunteers(user_id, work_date);

-- ── seed รายชื่อจุด (จากตารางต้นฉบับ — admin แก้ไข/เพิ่มได้ภายหลัง) ──
INSERT INTO stations (name, region, sort_order) VALUES
  ('คลองจั่น–พหลฯ', 'bkk', 1),
  ('ดินแดง–บางจาก', 'bkk', 2),
  ('ดินแดง–พระราม 9', 'bkk', 3),
  ('ธนบุรี', 'bkk', 4),
  ('นนทบุรี', 'bkk', 5),
  ('นนทบุรี (บางบัวทอง)', 'bkk', 6),
  ('นนทบุรี-บางใหญ่', 'bkk', 7),
  ('นนทบุรี-ปากเกร็ด', 'bkk', 8),
  ('บางเขน', 'bkk', 9),
  ('บางแค', 'bkk', 10),
  ('บางนา–พระโขนง', 'bkk', 11),
  ('ปทุมธานี', 'bkk', 12),
  ('ประชาราษฎร์ 72', 'bkk', 13),
  ('ปากเกร็ด', 'bkk', 14),
  ('ปากเกร็ด นนทบุรี', 'bkk', 15),
  ('พระราม 2', 'bkk', 16),
  ('พระราม 9', 'bkk', 17),
  ('ภาษีเจริญ', 'bkk', 18),
  ('รังสิต ปทุมธานี', 'bkk', 19),
  ('รัชาวดี', 'bkk', 20),
  ('รามอินทรา', 'bkk', 21),
  ('ลาดพร้าว', 'bkk', 22),
  ('สมุทรปราการ', 'bkk', 23),
  ('สาทร', 'bkk', 24),
  ('สายไหม', 'bkk', 25),
  ('อ่อนนุช', 'bkk', 26),
  ('กระบี่', 'upc', 27),
  ('กาญจนบุรี', 'upc', 28),
  ('จันทบุรี', 'upc', 29),
  ('ฉะเชิงเทรา', 'upc', 30),
  ('ชุมพร', 'upc', 31),
  ('เชียงใหม่', 'upc', 32),
  ('นครปฐม', 'upc', 33),
  ('นครราชสีมา', 'upc', 34),
  ('นครศรีธรรมราช', 'upc', 35),
  ('บางละมุง', 'upc', 36),
  ('บ้านโป่ง ราชบุรี', 'upc', 37),
  ('ปลวกแดง ระยอง', 'upc', 38),
  ('พิษณุโลก', 'upc', 39),
  ('ภูเก็ต', 'upc', 40),
  ('เมืองขอนแก่น', 'upc', 41),
  ('เมืองชลบุรี', 'upc', 42),
  ('เมืองนครปฐม', 'upc', 43),
  ('เมืองนครสวรรค์', 'upc', 44),
  ('เมืองระยอง', 'upc', 45),
  ('เมืองราชบุรี', 'upc', 46),
  ('ลพบุรี', 'upc', 47),
  ('ศรีราชา', 'upc', 48),
  ('สระบุรี', 'upc', 49),
  ('อยุธยา', 'upc', 50),
  ('อุบลราชธานี', 'upc', 51)
ON CONFLICT (name) DO NOTHING;
