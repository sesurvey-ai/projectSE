-- ตารางเวรราย "เดือน/ศูนย์" แบบเก็บกริดทั้งก้อน (JSONB) — สำหรับหน้าจัดเวร duty-demo2
-- ต่างจาก duty_slots (016) ที่หมุนเวรอัตโนมัติ: ตารางนี้เก็บ "ตามที่เห็นบนจอจริง"
-- รองรับรูปแบบเวรที่ไม่สม่ำเสมอจากไฟล์ Excel จริง (คนเข้ากลางเดือน/สลับเวรไม่เป็นจังหวะ)
-- 1 แถว = 1 ศูนย์ ต่อ 1 เดือน (center_id + year + month ห้ามซ้ำ)

CREATE TABLE IF NOT EXISTS duty_schedules (
  id          SERIAL PRIMARY KEY,
  center_id   VARCHAR(40) NOT NULL,                 -- id ศูนย์ฝั่ง frontend เช่น 'ladprao','rama2'
  year        SMALLINT NOT NULL,                    -- ค.ศ. เช่น 2026
  month       SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  data        JSONB NOT NULL,                       -- { staff:[{id,code,name}], schedule:{staffId:{day:shiftKey}} }
  updated_by  INT REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT duty_schedules_uniq UNIQUE (center_id, year, month)
);

CREATE INDEX IF NOT EXISTS duty_schedules_ym ON duty_schedules(year, month);
