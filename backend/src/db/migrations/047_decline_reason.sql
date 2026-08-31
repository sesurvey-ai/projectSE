-- เหตุผลที่ช่างปฏิเสธงาน — user สั่ง 31/08/69 พร้อมหน้าจอแจ้งเตือนแบบใหม่
--
-- ⛔ เดิมปฏิเสธแล้ว **ไม่เหลืออะไรเลยว่าใครปฏิเสธและเพราะอะไร**: declineCase เคลียร์
--    assigned_to เป็น NULL ด้วย → ผู้จ่ายงานเห็นแค่สถานะ 'declined' ลอย ๆ ต้องโทรถามเอง
--    ว่าใครไม่รับและทำไม (แล้วก็เสี่ยงจ่ายให้คนเดิมซ้ำโดยไม่รู้ตัว)
--
-- declined_reason = เหตุผลที่ช่างเลือกบนแอป (4 ข้อ) — null = APK เก่าที่ยังไม่มีให้เลือก
-- declined_by     = ใครปฏิเสธ (ต้องเก็บแยก เพราะ assigned_to ถูกล้างทิ้งตอนปฏิเสธ)
-- declined_at     = เมื่อไหร่ · TIMESTAMPTZ ไม่ใช่ TIMESTAMP (prod เป็น UTC เครื่องพัฒนาเวลาไทย)
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS declined_reason TEXT,
  ADD COLUMN IF NOT EXISTS declined_by     INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS declined_at     TIMESTAMPTZ;
