-- Migration 020: เพิ่มคอลัมน์ survey_reports ที่ code อ้างถึงแต่ migration ไม่เคยสร้าง
-- Run this in Supabase SQL Editor (ไม่มี auto-runner — ต้องรันมือบน production)
--
-- ที่มา / WHY:
--   backend/src/services/case.service.ts (createCase / submitSurvey / updateSurvey) เขียนลง
--   คอลัมน์ 22 ตัวด้านล่าง ผ่าน INSERT/UPDATE ที่ "ไม่กรอง" ตาม information_schema
--   (ต่างจาก updateReport ที่กรอง). คอลัมน์เหล่านี้ "ไม่มีใน migration 001–019" —
--   เคยถูก ALTER เข้า DB เดิม (Supabase Cloud) ด้วยมือ แล้วหายตอน rebuild schema จาก
--   migration ตอนย้ายมา self-hosted Supabase บน VPS. ผลคือ DB ใดที่สร้างจาก migration ล้วน
--   (dev/staging/prod-rebuild) จะ throw `column "survey_company" does not exist` ทุกครั้งที่
--   submit งานสำรวจ. db_export.json (snapshot DB เก่า) ยืนยันว่าคอลัมน์เหล่านี้เคยมีจริง+มีข้อมูล.
--
-- ชนิดข้อมูล: อ้างอิงจากค่าตัวอย่างจริงใน db_export.json + ชนิดของคอลัมน์พี่น้องใน schema ปัจจุบัน
--   (เช่น driver_name=VARCHAR(200), acc_claim_amount=NUMERIC, acc_surveyor=VARCHAR(100),
--    notes/driver_address=TEXT)
--
-- idempotent: ใช้ ADD COLUMN IF NOT EXISTS — ปลอดภัยถ้า prod จริงมีคอลัมน์อยู่แล้ว (เป็น no-op)
-- ⚠️ ก่อนรันบน prod: ตรวจ schema จริงของ production ก่อน (backend/.env ในเครื่อง dev ชี้ DB ทดสอบ
--    ไม่ใช่ prod — credential prod อยู่ใน Dokploy) เผื่อ prod จริงยังเป็น DB เก่าที่มีคอลัมน์อยู่แล้ว

-- บริษัทผู้สำรวจ (survey company)
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS survey_company         VARCHAR(200);
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS survey_company_address TEXT;
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS survey_company_phone   VARCHAR(50);

-- เคลม / ประกัน
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS insurance_branch       VARCHAR(100);
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS car_lost               BOOLEAN;

-- ผู้ขับขี่ (แยกชื่อ-นามสกุล + จังหวัด/อำเภอ + ใบสั่ง)
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS driver_first_name      VARCHAR(100);
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS driver_last_name       VARCHAR(100);
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS driver_province        VARCHAR(100);
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS driver_district        VARCHAR(100);
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS driver_ticket          VARCHAR(100);

-- ผู้สำรวจ / คู่กรณี (สาขา, เบอร์, ยอดเรียกร้องรวม, ฝ่ายประมาทคู่กรณี)
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS acc_surveyor_branch    VARCHAR(100);
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS acc_surveyor_phone     VARCHAR(50);
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS acc_claim_total_amount NUMERIC;
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS acc_fault_opponent_no  VARCHAR(50);

-- ตำรวจ (วันที่, ประจำวันข้อที่) + แอลกอฮอล์ผล + ติดตามงาน (ครั้งที่/วันที่)
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS acc_police_date        VARCHAR(50);
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS acc_police_book_no     VARCHAR(100);
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS acc_alcohol_result     VARCHAR(100);
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS acc_followup_count     VARCHAR(20);
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS acc_followup_date      VARCHAR(50);

-- ผล/ความเห็น (ผลการดำเนินงาน, ความเห็นผู้ตรวจสอบ, ความเห็นเซอร์เวย์)
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS survey_result          TEXT;
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS review_comment         TEXT;
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS surveyor_comment       TEXT;
