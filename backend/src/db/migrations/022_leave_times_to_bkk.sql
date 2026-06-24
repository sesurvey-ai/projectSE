-- Migration 022: leave_requests timestamps → เก็บเป็นเวลาไทย (Asia/Bangkok) ตรง ๆ ให้ตรงกับ attendance
-- Run this in Supabase SQL Editor (ไม่มี auto-runner) — รัน "หลัง" deploy โค้ดใหม่ (leave.service อ่านตรง ๆ ไม่แปลง)
--
-- ที่มา: เดิม leave เก็บ created_at/reviewed_at เป็น UTC (NOW()) แล้วแปลง UTC→ไทยตอนอ่าน
--        (ต่างจาก attendance ที่เก็บไทยตรง ๆ). ทำให้ report ที่ดึง raw column 2 ตารางมารวมกันเพี้ยน 7 ชม.
--        → เปลี่ยน leave ให้ "เก็บไทยตรง ๆ + อ่านตรง ๆ" เหมือน attendance (โค้ดแก้ใน leave.service.ts แล้ว)
--
-- ⚠️ ลำดับ: deploy โค้ดใหม่ก่อน แล้วค่อยรันไฟล์นี้ (กันช่วงสั้น ๆ ที่โค้ดเก่าจะ double-convert)

-- 1) แปลงค่าที่มีอยู่จาก UTC → เวลาไทย (one-time)
UPDATE leave_requests SET created_at  = (created_at  AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok' WHERE created_at  IS NOT NULL;
UPDATE leave_requests SET reviewed_at = (reviewed_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok' WHERE reviewed_at IS NOT NULL;

-- 2) default ของ created_at ให้เป็นเวลาไทย (กันกรณี insert ที่ไม่ได้ระบุ created_at)
ALTER TABLE leave_requests ALTER COLUMN created_at SET DEFAULT (NOW() AT TIME ZONE 'Asia/Bangkok');
