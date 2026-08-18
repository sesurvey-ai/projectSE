-- ตีกลับให้ผู้สำรวจ — หัวหน้าเจอข้อมูลผิดที่ต้องให้คนไปหน้างานแก้เอง
--
-- เดิมมีทางเดียวคือหัวหน้าแก้เองบนเว็บ ซึ่งใช้ไม่ได้กับเรื่องที่ต้องถามคนที่ไปจริง
-- (ทะเบียนผิด · รูปไม่ครบ · เวลาที่จดมาไม่ตรงกับที่เกิดเหตุ)
--
-- ตีกลับ = cases.status กลับเป็น 'assigned' → งานโผล่ในรายการของผู้สำรวจอีกครั้ง
-- แก้ในแอปแล้วส่งใหม่ได้ตามปกติ (submitSurvey บังคับ status='assigned' อยู่แล้ว)
--
-- ทำไมเก็บบน cases ไม่ใช่ reviews:
--   · reviews มีเฉพาะเคสที่เคยกดอนุมัติ — เคสที่ตีกลับก่อนอนุมัติจะไม่มีแถวให้เขียน
--   · getMyCases คืน c.* → เหตุผลติดไปถึงแอปมือถือเองโดยไม่ต้อง join เพิ่ม
--
-- ⚠️ รันด้วยมือบน production ตาม convention เดิม

ALTER TABLE cases ADD COLUMN IF NOT EXISTS sent_back_at     TIMESTAMP NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS sent_back_by     INT NULL REFERENCES users(id);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS sent_back_reason TEXT NULL;

-- นับสะสม ไม่รีเซ็ตตอนส่งงานใหม่ — เคสที่ถูกตีกลับซ้ำ ๆ คือสัญญาณว่าต้องไปคุยกับคน
-- ไม่ใช่ปัญหาของเคสใบเดียว (กติกาเดียวกับ reviews.unlocked_count)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS sent_back_count  INT NOT NULL DEFAULT 0;

-- หน้า "ตรวจสอบ" ต้องเห็นเคสที่ตีกลับไปแล้วด้วย ไม่งั้นหัวหน้าตามงานตัวเองต่อไม่ได้
-- (สถานะกลับไปเป็น assigned = หลุดจากเงื่อนไข status IN ('surveyed','reviewed') เดิม)
CREATE INDEX IF NOT EXISTS ix_cases_sent_back
  ON cases (sent_back_at)
  WHERE sent_back_at IS NOT NULL;
