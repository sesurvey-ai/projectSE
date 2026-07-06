-- Migration 025: รองรับข้อมูล 1:N ของ prototype "กรอกรายละเอียดอุบัติเหตุ" v1.43 (Phase 0)
-- Run this in Supabase SQL Editor (ไม่มี auto-runner — ต้องรันมือบน production เหมือน 020/024)
--
-- ที่มา / WHY:
--   Redesign หน้ากรอกรายละเอียดอุบัติเหตุ (Hub 6 หมวด) ต้องเก็บข้อมูลที่เดิมมีได้แค่ค่าเดียว
--   ให้เป็น "หลายรายการ":
--     - คู่กรณี (opposing parties) ≤20 คัน   — เดิมมีแค่ acc_claim_opponent TEXT + counterparty_* (1 คัน)
--     - ผู้บาดเจ็บ (injured persons)          — เดิม "ไม่มีที่เก็บเลย"
--     - ทรัพย์สินเสียหาย (damaged property)   — เดิม "ไม่มีที่เก็บเลย"
--     - แผนภาพความเสียหายรถประกัน (parts)     — เดิม sync เป็นข้อความลง damage_description
--   ตัดสินใจ (user 2026-07-06): เก็บเป็น JSONB array บน survey_reports (ไม่ทำตารางลูก) เพราะ
--   workflow เคสยังไม่ได้ใช้จริง (prod cases=0) → ลงเร็ว/เสี่ยงต่ำ, ภายหลัง normalize เป็นตารางได้
--
--   + EV extras (เลขแบต/วันเริ่มใช้แบต/เลขชาร์จ) — หมวด 2 ใน prototype มี แต่ DB ไม่มีคอลัมน์
--   + customer_reported_at TIMESTAMP — ฐานเวลาจริงของ SLA 24 ชม. (acc_customer_report_date เป็น
--     VARCHAR วันที่ล้วน ไม่มีเวลา → นับถอยหลังไม่ได้)
--   + survey_photos.category — รูปภาพแยกหมวด (รถประกัน/คู่กรณี/ทรัพย์สิน/ผู้บาดเจ็บ/เอกสาร/แผนที่)
--
-- idempotent: ADD COLUMN IF NOT EXISTS — ปลอดภัยถ้ามีคอลัมน์อยู่แล้ว (no-op)
-- backward compatible: ทุกคอลัมน์ nullable/มี default → ฟอร์มเดิมที่ไม่ส่งค่าเหล่านี้ยังทำงานปกติ

-- ── ข้อมูล 1:N (JSONB array) ──────────────────────────────────────────────
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS opposing_parties  JSONB DEFAULT '[]'::jsonb;  -- คู่กรณีหลายคัน
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS injured_persons   JSONB DEFAULT '[]'::jsonb;  -- ผู้บาดเจ็บ
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS damaged_property  JSONB DEFAULT '[]'::jsonb;  -- ทรัพย์สินเสียหาย
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS insured_damage    JSONB DEFAULT '[]'::jsonb;  -- แผนภาพความเสียหายรถประกัน (part/side/level)

-- ── EV extras (หมวด 2 รถประกัน) ───────────────────────────────────────────
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS ev_battery_no     VARCHAR(100);  -- หมายเลขแบตเตอรี่
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS ev_battery_start  VARCHAR(50);   -- วันเริ่มใช้งานแบตเตอรี่
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS ev_charger_no     VARCHAR(100);  -- หมายเลขเครื่องชาร์จ

-- ── ฐานเวลา SLA จริง (มีเวลา ต่างจาก acc_customer_report_date ที่เป็นวันที่ล้วน) ──
ALTER TABLE survey_reports ADD COLUMN IF NOT EXISTS customer_reported_at TIMESTAMP;  -- เวลาลูกค้าแจ้งประกัน (ตั้งต้นนับ SLA 24 ชม.)

-- ── รูปภาพแยกหมวด ─────────────────────────────────────────────────────────
ALTER TABLE survey_photos  ADD COLUMN IF NOT EXISTS category VARCHAR(50);  -- รถประกัน/คู่กรณี/ทรัพย์สิน/ผู้บาดเจ็บ/เอกสาร/แผนที่
