-- Migration 026: เก็บเจตนา toggle "มี/ไม่มี" ของหมวด คู่กรณี/ผู้บาดเจ็บ/ทรัพย์สิน
-- Run this in Supabase SQL Editor (ไม่มี auto-runner — ต้องรันมือบน production เหมือน 020/024/025)
--
-- ที่มา / WHY:
--   ฟอร์มมือถือส่ง has_opponents/has_injured/has_property มาแล้ว (survey_form_screen collect)
--   แต่ submitSurvey whitelist เดิมไม่มี 3 คีย์นี้ → server ทิ้ง → พอส่งเสร็จ (ลบ draft) แล้วเปิดเคสใหม่
--   toggle ที่เปิด "มี" แต่ยังไม่กรอกรายการ จะกลายเป็น "ไม่มี" (เพราะ derive จาก array ว่าง)
--   → เพิ่มคอลัมน์ให้ round-trip ได้ (รองรับ workflow เปิด "มี" ก่อน ถ่ายรูป/กรอกทีหลัง)
--
-- ⚠️ ลำดับ deploy: รัน migration นี้บน prod "ก่อน" backend redeploy ที่อ้างคอลัมน์เหล่านี้
--    (ไม่งั้น INSERT/UPDATE survey_reports จะ error เพราะคอลัมน์ยังไม่มี)
--
-- idempotent + backward compatible: ADD COLUMN IF NOT EXISTS, nullable → ฟอร์มเดิมยังทำงานปกติ

ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS has_opponents BOOLEAN;  -- เปิด "มี" คู่กรณี
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS has_injured   BOOLEAN;  -- เปิด "มี" ผู้บาดเจ็บ
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS has_property  BOOLEAN;  -- เปิด "มี" ทรัพย์สินเสียหาย
