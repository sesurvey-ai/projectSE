-- ตารางเรทค่าตอบแทนผู้สำรวจ + เรทเรียกเก็บประกัน (ย้ายมาจาก se-billing)
--
-- ที่มา: se-billing เก็บเรทไว้ใน SQLite ของตัวเอง (billing.sesurvey.cloud) และ
-- คำนวณด้วย Chrome extension บนหน้า ISURVEY — เส้นทางใหม่ (se-survey → EMCS)
-- ไม่ผ่าน ISURVEY จึงไม่มีใครคิดเรทให้ และไม่มีที่บันทึกยอดจ่ายพนักงานเลย
--
-- ⚠️ **จงใจก๊อปมาเป็นชุดที่ 2 ไม่ได้ต่อสายกับ se-billing** (กติกา user 2026-08-12)
--    se-billing + extension + ISURVEY ทำงานต่อไปโดยไม่ถูกแตะแม้แต่บรรทัดเดียว
--    วันเลิกใช้ ISURVEY = ปิด se-billing ทิ้งได้ทันที ไม่ต้องย้ายอะไร
--    เรทแทบไม่เคยเปลี่ยน → ความเสี่ยง 2 ชุดไม่ตรงกันต่ำ และมีสคริปต์เทียบ (อ่านอย่างเดียว) กันไว้
--
-- ⚠️ ต้องรันด้วยมือบน production (ไม่มีตัวรันอัตโนมัติ)
--    ข้อมูลเรทจริงนำเข้าด้วย backend/src/db/seeds/billing_rates.sql แยกอีกไฟล์

-- ── เรทรายอำเภอ (ตัวหลัก 337 แถว) ──
-- amphur_id = รหัสอำเภอมาตรฐานไทย 4 หลัก (1001 = เขตพระนคร) ไม่ใช่ ID เฉพาะของ ISURVEY
-- sur_* = จ่ายผู้สำรวจ · ins_* = เรียกเก็บบริษัทประกัน (คนละฝั่งเงินกัน อย่าสลับ)
-- *_by_team = JSON {"ชื่อทีม": เรท} — ใช้เมื่ออำเภอนั้นจ่ายไม่เท่ากันตามทีมที่ไปทำ
--             NULL = ใช้ค่า flat ในคอลัมน์เดี่ยวแทน
CREATE TABLE IF NOT EXISTS billing_amphur_rates (
  amphur_id          VARCHAR(8) PRIMARY KEY,
  sur_invest         INTEGER,
  ins_invest_12      INTEGER,
  ins_invest_34      INTEGER,
  ins_trans          INTEGER,
  ins_photo_12       INTEGER,
  sur_invest_by_team JSONB,
  ins_trans_by_team  JSONB,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── เรทรายจังหวัด (ใช้เมื่ออำเภอนั้นไม่มีในตารางบน) ──
CREATE TABLE IF NOT EXISTS billing_province_rates (
  province_id VARCHAR(4) PRIMARY KEY,
  sur_invest  INTEGER NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,   -- รวม enabled_provinces เดิมมาไว้คอลัมน์เดียว
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ตำบลที่จ่ายไม่เท่าอำเภอแม่ (ปัจจุบันมี 2 ตำบล: บ่อวิน · พลูตาหลวง) ──
CREATE TABLE IF NOT EXISTS billing_tumbon_rates (
  tumbon_id          VARCHAR(8) PRIMARY KEY,
  label              VARCHAR(100) NOT NULL,
  parent_amphur      VARCHAR(8) NOT NULL,
  ins_invest_12      INTEGER,
  ins_invest_34      INTEGER,
  ins_trans          INTEGER,
  ins_photo_12       INTEGER,
  sur_invest_by_team JSONB,
  ins_trans_by_team  JSONB,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── รหัสผู้สำรวจ → ทีม (คีย์ที่ทำให้เรทรายทีมทำงาน) ──
-- ⚠️ ผู้สำรวจที่ไม่มีในตารางนี้จะหาเรทรายทีมไม่เจอ — ปัจจุบันมีแค่ 13 รหัส
--    ทั้งที่ระบบมีผู้สำรวจ 140+ คน (ช่องโหว่ที่มีอยู่ก่อนแล้ว ไม่ได้เกิดจากการย้าย)
CREATE TABLE IF NOT EXISTS billing_surveyor_teams (
  sec_code VARCHAR(20) PRIMARY KEY,
  team     VARCHAR(60) NOT NULL
);

-- ── ค่าคงที่/เรทที่เดิม hardcode อยู่ในโค้ด extension ──
-- เดิมแก้ทีต้อง rebuild extension แล้วแจกใหม่ทุกเครื่อง — ย้ายมาเป็นข้อมูลให้แก้ผ่านหน้าเว็บได้
-- value เป็น JSONB เพราะแต่ละคีย์โครงไม่เหมือนกัน (ดู seed ประกอบ)
CREATE TABLE IF NOT EXISTS billing_settings (
  key        VARCHAR(60) PRIMARY KEY,
  value      JSONB NOT NULL,
  note       TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ยอดที่คิดจริงต่องาน (ฝั่งจ่ายพนักงาน) ──
-- แยกจาก survey_expenses ที่เป็นฝั่งเรียกเก็บประกัน — เงินคนละฝั่ง อย่ารวมตาราง
-- เก็บ snapshot ของเรท+ตัวปรับที่ใช้ตอนคิด เพื่อให้ย้อนดูได้ว่ายอดนี้มาจากอะไร
-- (ตารางเรทไม่เก็บประวัติตามที่ user เลือก — snapshot ตรงนี้จึงเป็นหลักฐานเดียว)
CREATE TABLE IF NOT EXISTS survey_pay (
  case_id       INTEGER PRIMARY KEY REFERENCES cases(id) ON DELETE CASCADE,
  service_fee   DECIMAL(10,2),
  travel_fee    DECIMAL(10,2),
  photo_fee     DECIMAL(10,2),
  phone_fee     DECIMAL(10,2),
  bail_fee      DECIMAL(10,2),
  claim_fee     DECIMAL(10,2),
  daily_fee     DECIMAL(10,2),
  other_fee     DECIMAL(10,2),          -- ช่องหักเงิน ติดลบเสมอ
  other_reason  TEXT,
  out_of_area   BOOLEAN NOT NULL DEFAULT FALSE,
  out_of_hours  BOOLEAN NOT NULL DEFAULT FALSE,
  special_tumbon BOOLEAN NOT NULL DEFAULT FALSE,
  daily_check   VARCHAR(10),            -- ถูก / ผิด / รอผล / NULL
  total         DECIMAL(10,2),
  rate_snapshot JSONB,                  -- เรทกับคีย์ที่ใช้ตอนคิด (อำเภอ/ทีม/ค่าที่ดึงได้)
  priced_by     INTEGER REFERENCES users(id),
  priced_at     TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_pay_priced_at ON survey_pay(priced_at);
