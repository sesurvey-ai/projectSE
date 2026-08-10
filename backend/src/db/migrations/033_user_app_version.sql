-- เก็บเวอร์ชันแอปที่ผู้ใช้แต่ละคนใช้อยู่ — **ไม่ได้ใช้บล็อก** แค่ทำให้มองเห็น
--
-- APK แจกด้วยมือ (ไม่มี Play Store) จึงไม่มีใครรู้ว่าเครื่องไหนอยู่เวอร์ชันไหน
-- แล้วของที่เปลี่ยนฝั่งเซิร์ฟเวอร์ทำให้แอปเก่าพังเงียบ — วันที่ตรวจ (2026-08-11)
-- log prod มี GET /uploads/att_*.jpg ตอบ 401 จำนวน 191 ครั้ง สำเร็จ 0 ครั้ง
-- เพราะเครื่องพนักงานยังเป็น APK เก่าที่ไม่แนบ token
--
-- ⚠️ รันด้วยมือบน production ตาม convention เดิม
ALTER TABLE users ADD COLUMN IF NOT EXISTS app_version VARCHAR(30) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS app_version_at TIMESTAMP NULL;
