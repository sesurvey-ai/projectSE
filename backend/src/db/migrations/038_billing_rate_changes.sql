-- ประวัติการแก้เรท — ใครแก้ช่องไหน จากเท่าไหร่เป็นเท่าไหร่
--
-- **ไม่ใช่ระบบเวอร์ชันเรท** (user เลือก "ค่าเดียว แก้แล้วทับ" ไว้แล้ว) ตัวคิดเงินยังอ่าน
-- ค่าปัจจุบันค่าเดียวเหมือนเดิม ตารางนี้เป็นแค่สมุดบันทึกให้ย้อนดูได้
--
-- ทำไมต้องมี: เรทคือเงินของพนักงาน แก้ผิดหนึ่งช่อง = จ่ายผิดทั้งอำเภอโดยไม่มีใครรู้
-- เดิมเรทอยู่ใน SQLite ของระบบเก่าที่ไม่มีหน้าแก้ → ไม่ค่อยมีใครแตะ พอเปิดหน้าเว็บให้แก้ได้
-- ความเสี่ยงก็ขยับขึ้นทันที · `updated_at` บอกได้แค่ "เปลี่ยนเมื่อไหร่" ไม่บอกว่าเปลี่ยนจากอะไร
--
-- ⚠️ ต้องรันด้วยมือบน production

CREATE TABLE IF NOT EXISTS billing_rate_changes (
  id         SERIAL PRIMARY KEY,
  scope      VARCHAR(20) NOT NULL,   -- amphur | province | tumbon | team | setting
  ref_id     VARCHAR(60) NOT NULL,   -- รหัสอำเภอ/จังหวัด/ตำบล · รหัส SEC · คีย์ตั้งค่า
  label      VARCHAR(120),           -- ชื่อไทยตอนที่แก้ ไว้อ่านย้อนหลังโดยไม่ต้องเปิดตารางรหัส
  field      VARCHAR(40)  NOT NULL,
  old_value  TEXT,
  new_value  TEXT,
  changed_by INTEGER REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_rate_changes_at
  ON billing_rate_changes (changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_rate_changes_ref
  ON billing_rate_changes (scope, ref_id);
