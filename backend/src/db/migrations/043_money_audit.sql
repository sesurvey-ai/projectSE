-- 043: ประวัติการแก้ยอดเงิน
--
-- ปัญหา: ตอนนี้รู้แค่ "ใครบันทึกเคสล่าสุด" (migration 042) แต่ไม่รู้ว่าแก้ช่องไหนเป็นอะไร
-- ยอดเงินคือของที่ผิดแล้วเจ็บที่สุด — ไหลไปทั้งใบเบิกเงินพนักงานและใบเรียกเก็บบริษัทประกัน
--
-- ที่ต้องการจริง ๆ ไม่ใช่ "จับคนโกง" แต่คือ **แยกให้ออกว่า "คนแก้" หรือ "บั๊กกลืนข้อมูล"**
-- เดือน ส.ค. 69 เดือนเดียวมีบั๊กที่ยอดเงินหายเงียบ ๆ อย่างน้อย 2 ตัว (22311fb, c827596)
-- กว่าจะรู้ต้องมีคนบังเอิญสังเกต · ถ้ามีประวัติจะเห็นทันทีว่า 600 → (ว่าง) โดยไม่มีใครกดอะไร
--
-- ⛔ เก็บเฉพาะ 2 ตารางเงิน ไม่ใช่ทุกช่องของเคส (user เคาะ 23/08/69) —
--    ได้ ~80% ของประโยชน์ด้วยแรง 1 ใน 4 และไม่ต้องแบกภาระป้ายชื่อ 112 ช่องที่ต้องคอยตามแก้
--
-- ⚠️ รันด้วยมือบน production ตาม convention เดิม
-- ⚠️ เก็บย้อนหลังไม่ได้ — เริ่มนับจากวันที่เปิดใช้

CREATE TABLE IF NOT EXISTS money_audit (
  id          BIGSERIAL PRIMARY KEY,
  case_id     INT  NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  -- 'pay' = ยอดจ่ายพนักงาน (survey_pay) · 'expense' = ยอดเรียกเก็บประกัน (survey_expenses)
  kind        TEXT NOT NULL CHECK (kind IN ('pay', 'expense')),
  field       TEXT NOT NULL,
  old_value   TEXT NULL,          -- NULL = ไม่เคยมีค่า (ต่างจาก '' ที่แปลว่าถูกล้าง)
  new_value   TEXT NULL,
  changed_by  INT  NULL REFERENCES users(id),   -- NULL = ระบบ/นำเข้าอัตโนมัติ ไม่ใช่คนกด
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- อ่านเสมอด้วย "ประวัติของเคสนี้ ใหม่→เก่า"
CREATE INDEX IF NOT EXISTS ix_money_audit_case ON money_audit (case_id, changed_at DESC);
-- ไว้ล้างของเก่าเป็นรอบ ๆ (ดูหมายเหตุข้างล่าง)
CREATE INDEX IF NOT EXISTS ix_money_audit_at ON money_audit (changed_at);

-- ลบเคส = ลบประวัติตามไปด้วย (ON DELETE CASCADE ข้างบน) — ไม่เก็บประวัติของเคสที่ไม่มีแล้ว
--
-- 🧹 การล้างของเก่า: ยังไม่ตั้งอัตโนมัติ ถ้าโตเกินไปให้รันมือ
--    DELETE FROM money_audit WHERE changed_at < now() - interval '2 years';
--    (2 ปี = เท่ากับที่ EMCS ล้าง draft ของตัวเอง)
