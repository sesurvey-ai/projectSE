-- 042: กันหัวหน้า 2 คนบันทึกทับกันเงียบ ๆ
--
-- ปัญหา: หน้าตรวจเคสสร้างตอนที่มีหัวหน้าตรวจคนเดียว การบันทึกจึงเป็น "เขียนทับเสมอ"
-- พอมีหัวหน้าหลายคนเปิดคิวเดียวกัน (แผนคือ 8 คน) สองคนเปิดเคสเดียวกันได้
-- คนที่กดบันทึกทีหลังจะทับงานของคนแรก **ทั้งหน้า** โดยไม่มีอะไรฟ้อง — ทั้งสองคน
-- เห็นข้อความ "บันทึกสำเร็จ" เหมือนกัน แล้วข้อมูลของคนแรกหายไปเฉย ๆ
-- (ไม่ใช่แค่ช่องที่แก้ชนกัน — ฟอร์มส่งทุกช่องไปพร้อมกัน ค่าที่คนแรกพิมพ์จึงถูก
--  ค่าเก่าที่ค้างอยู่ในจอของคนที่สองทับหมด)
--
-- วิธีแก้: เลขรุ่นของข้อมูล (rev) — ตอนเปิดเคสหน้าเว็บจำ rev ไว้ ตอนกดบันทึกส่งกลับมาด้วย
-- ถ้า rev ในฐานข้อมูลเดินไปแล้ว = มีคนบันทึกคั่น → ตอบ 409 ไม่เขียนอะไรเลย
-- แล้วบอกไปว่าใครบันทึกและเมื่อไหร่
--
-- ทำไมใช้ trigger ไม่ใช่บวกเลขในโค้ด:
--   survey_reports ถูกเขียนจากหลายทาง (แอปมือถือส่งงาน · ผู้ตรวจแก้บนเว็บ · นำเข้า XML ·
--   แอดมินแก้ตัวระบุเคส) ถ้าไปบวกทีละที่ วันหลังใครเพิ่มทางใหม่แล้วลืม = การกันทับ
--   จะเงียบเป็นรูโหว่โดยไม่มี error ให้เห็น · ให้ฐานข้อมูลบวกให้เองครอบคลุมทุกทางแน่นอน
--
-- ⚠️ รันด้วยมือบน production ตาม convention เดิม
-- ⚠️ ต้องรัน migration นี้ **ก่อน** deploy โค้ดชุดใหม่ (เป็นการเพิ่มคอลัมน์ล้วน ๆ
--    โค้ดรุ่นเดิมไม่รู้จัก rev ก็ยังทำงานได้ตามปกติ)

ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS rev        INT NOT NULL DEFAULT 1;
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NULL;
-- ใครบันทึกล่าสุด — ใช้ในข้อความ "คนอื่นบันทึกไปแล้ว" ให้รู้ว่าต้องไปคุยกับใคร
-- (ไม่ใช่ประวัติการแก้ครบ ๆ ซึ่งเป็นงานแยก — อันนี้เก็บแค่คนล่าสุดพอให้ข้อความมีประโยชน์)
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS updated_by INT NULL REFERENCES users(id);

CREATE OR REPLACE FUNCTION survey_reports_bump_rev() RETURNS trigger AS $$
BEGIN
  -- ปล่อยผ่านถ้าผู้เรียกตั้ง rev มาเอง (ยังไม่มีใครทำ เผื่อไว้ให้ backfill/ซ่อมข้อมูลได้)
  IF NEW.rev = OLD.rev THEN
    NEW.rev := OLD.rev + 1;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_survey_reports_rev ON survey_reports;
CREATE TRIGGER trg_survey_reports_rev
  BEFORE UPDATE ON survey_reports
  FOR EACH ROW EXECUTE FUNCTION survey_reports_bump_rev();
