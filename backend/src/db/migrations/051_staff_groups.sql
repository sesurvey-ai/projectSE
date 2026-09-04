-- ทีมของหัวหน้าผู้ตรวจ (หัวหน้า ↔ ช่าง/บริษัท OSS ในสังกัด) — user สั่ง 04/09/69
--
-- ที่มา: se-billing/mapping_supervisor_staff_.json (หัวหน้า 10 คน · สมาชิก 181 รายการ เก็บเป็นข้อความ
-- "SEC343 นาย มี วงษ์สุวรรณ" หรือชื่อบริษัท OSS) — นำเข้าด้วย scripts/import_staff_groups.js
--
-- ใช้ทำอะไร: หน้า "งานรอตรวจ (ISURVEY)" ของหัวหน้าโชว์เฉพาะงานของลูกทีมตัวเอง · หัวหน้าดูรายชื่อทีมได้
-- (อ่านอย่างเดียว) · แอดมินแก้ได้ที่ /admin/staff-groups
--
-- staff_groups.checker_id = บัญชีผู้ตรวจของหัวหน้าคนนั้น (NULL = ยังไม่มีบัญชี — เก็บชื่อไว้ก่อน ผูกทีหลัง)
-- members.staff_code      = รหัสช่าง (SE/SEC…) ที่แยกจากข้อความ · NULL = บริษัท OSS (จับคู่ด้วยชื่อ)
-- members.surveyor_id     = ทะเบียนพนักงานที่จับคู่ได้ด้วยรหัส (ไว้ลิงก์/แสดงชื่อปัจจุบัน) · NULL = ไม่พบในทะเบียน
CREATE TABLE IF NOT EXISTS staff_groups (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  checker_id  INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_group_members (
  id           SERIAL PRIMARY KEY,
  group_id     INTEGER NOT NULL REFERENCES staff_groups(id) ON DELETE CASCADE,
  staff_name   TEXT NOT NULL,
  staff_code   TEXT,
  surveyor_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, staff_name)
);
CREATE INDEX IF NOT EXISTS idx_staff_group_members_code ON staff_group_members (upper(staff_code));
