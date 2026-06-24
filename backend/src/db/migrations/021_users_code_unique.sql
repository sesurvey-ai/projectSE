-- Migration 021: บังคับ "1 คน 1 รหัส SE" — UNIQUE บน users.code
-- Run this in Supabase SQL Editor (ไม่มี auto-runner)
--
-- ที่มา / WHY:
--   รหัส SE เป็นของเฉพาะคน (1:1 — user ยืนยัน 2026-06-24). บอร์ดเข้างานจับคู่ attendance↔เวร
--   ด้วย onlyDigits(code) ซึ่งจะถูกต้องก็ต่อเมื่อ code ไม่ซ้ำกันจริง. constraint นี้บังคับ invariant
--   ที่ระดับ DB → กัน 2 บัญชีใช้ code เดียวกัน (จะทำให้ attendance/จำนวนงานปนกัน) ตั้งแต่ต้นทาง.
--   (หมายเหตุ: เหตุการณ์ "SE436 ซ้ำ" เป็น entry ซ้ำใน "ไฟล์เวร" คนเดียวกัน ไม่ใช่ 2 บัญชี — กันด้วย
--    guard ใน _update_roster_db.js + banner บนบอร์ดแล้ว. migration นี้กัน "ระดับบัญชี users" อีกชั้น)
--
-- ปลอดภัย / idempotent: ใช้ CREATE UNIQUE INDEX IF NOT EXISTS, partial WHERE code IS NOT NULL
--   → อนุญาต code = NULL หลายตัว (บัญชี test/seed: survey01/02, callcenter01, checker01, admin01
--     ไม่มี SE code โดยถูกต้อง). ตาราง users เล็ก (~87 แถว) → สร้าง index เร็ว ล็อกชั่วครู่
-- ✅ ตรวจกับ prod แล้ว (2026-06-24): 0 exact-dup, 82 codes รูปแบบ SE<digits> สม่ำเสมอ, 0 digit-collision

CREATE UNIQUE INDEX IF NOT EXISTS users_code_unique ON users (code) WHERE code IS NOT NULL;
