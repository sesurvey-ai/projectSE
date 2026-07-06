# Gap Analysis + แผน Implement — prototype "กรอกรายละเอียดอุบัติเหตุ" v1.43 → แอปจริง

> เทียบ 3 ฝั่ง: **prototype v1.43** (design spec) ↔ **ฟอร์ม Flutter ปัจจุบัน** (`survey_form_screen.dart`) ↔ **DB/API จริง** (`survey_reports` + `POST /api/cases/:id/survey`)
> วันที่: 2026-07-06

---

## สรุปผู้บริหาร (TL;DR)

- **ฟิลด์เดี่ยว (single-value) ~90 ช่องของ 6 หมวด มีคอลัมน์ใน `survey_reports` รองรับแล้วเกือบครบ** (migration 020+024) → หมวด 1 (เคลม), 2 (รถ), 3 (ผู้ขับ), 5 (เหตุการณ์+ตำรวจ+ติดตาม) map เข้า DB เดิมได้แทบ 1:1 **ไม่ต้อง migration ใหม่**
- **งานหนักจริงมี 3 ก้อน:**
  1. **โครงสร้าง 1:N ที่ DB ยังไม่มี** — คู่กรณีหลายคัน (≤20), ผู้บาดเจ็บ, ทรัพย์สิน, แผนภาพความเสียหายแยกรายคัน ปัจจุบันเก็บได้แค่ *คู่กรณีเดียว* (`acc_claim_opponent` + `counterparty_*`), ผู้บาดเจ็บ/ทรัพย์สิน **ไม่มีที่เก็บเลย**
  2. **เปลี่ยน UX** จากฟอร์มยาวหน้าเดียว → hub-and-spoke 6 หมวด + shell ถาวร (เขียน UI ใหม่)
  3. **ระบบ capture** — OCR ต่อฟิลด์, GPS, damage diagram SVG, offline-sync queue, validation engine, SLA — ปัจจุบันเป็น stub/ไม่มี
- **ปุ่มสแกน OCR ในฟอร์มปัจจุบันเป็น stub เปล่า** (`onPressed: () {}`) — endpoint `/api/ocr/claim` มีแล้วแต่ยังไม่ต่อ; และ OCR ที่มีอ่านได้แค่ **ใบเคลม** ยังไม่มี OCR ทะเบียน/บัตร ปชช./ใบขับขี่/VIN (prototype วางปุ่มพวกนี้ไว้)
- **draft ปัจจุบัน = SharedPreferences ในเครื่องเท่านั้น** ไม่ sync server → prototype ต้องการ autosave + offline queue

---

## 1. Gap Analysis

### 1A. โครงสร้างข้อมูล 1:N (ก้อนที่ยากสุด)

| ความสามารถใน prototype | ฟอร์มปัจจุบัน | DB ปัจจุบัน | Gap |
|---|---|---|---|
| **คู่กรณี ≤20 คัน** — แต่ละคันมี editor เต็ม (เจ้าของ/รถ/ผู้ขับ+CID checksum/ประกัน/แผนภาพความเสียหาย/KFK) | text ช่องเดียว `_accClaimOpponentCtl` | `acc_claim_opponent` TEXT + `counterparty_plate/brand/insurance/detail` = **1 คันเท่านั้น** | ต้องเก็บเป็น array + UI editor รายคัน |
| **ผู้บาดเจ็บ** (list, editor เต็ม 16 ฟิลด์) | ❌ ไม่มี | ❌ ไม่มีคอลัมน์/ตาราง | เพิ่มที่เก็บ + UI ใหม่ทั้งหมด |
| **ทรัพย์สินเสียหาย** (list, editor 7 ฟิลด์) | ❌ ไม่มี | ❌ ไม่มี | เพิ่มที่เก็บ + UI ใหม่ |
| **แผนภาพความเสียหาย** (SVG 21 ชิ้น, ข้าง L/R/A + ระดับ L/M/H/X, แยกรถประกัน+รายคู่กรณี) | มี `_damageItems[]` (part/pos/level) แต่ sync เป็น**ข้อความ**ลง `damage_description` | เก็บเป็น TEXT (`damage_description`) | client มี array อยู่แล้ว แค่ persist เป็น structured + ทำ widget SVG |
| **รูปภาพแยกหมวด + เกณฑ์จำนวนขั้นต่ำ** (รถประกัน8/คู่กรณี6/ทรัพย์สิน3/ผู้บาดเจ็บ2×n/เอกสาร2/แผนที่1) | grid รูปแบน ไม่มีหมวด | `survey_photos(file_path)` แบน | เพิ่ม `category` + logic เกณฑ์ |

### 1B. ฟิลด์เดี่ยว — ส่วนใหญ่ "มีแล้ว" ✅

| หมวด prototype | สถานะ map เข้า DB เดิม |
|---|---|
| ① เคลม & กรมธรรม์ | ✅ ครบ (`claim_type, claim_ref_no, claim_no, survey_job_no, survey_job_no_2, policy_no, prb_number, policy_start/end, assured_name, policy_type, risk_code, deductible, assured_email, driver_by_policy`) |
| ② รถประกัน | ✅ เกือบครบ — **ขาด: EV extras** (เลขแบต/วันเริ่มใช้แบต/เลขชาร์จ) ไม่มีคอลัมน์ |
| ③ ผู้ขับขี่ | ✅ ครบ (`driver_*` ทั้งชุด + license) |
| ④ ความเสียหาย | ⚠️ มี `damage_description`/`estimated_cost` แต่ prototype เก็บ structured (ดู 1A) |
| ⑤ เหตุการณ์+ตำรวจ+ติดตาม | ✅ เกือบครบ — **ขาด: `acc_damage_type` เป็น multi** (prototype lossType เลือกหลายค่า, DB เป็น VARCHAR เดี่ยว); fault-opponent link มี `acc_fault_opponent_no` รองรับ |
| ผู้บาดเจ็บ/ทรัพย์สิน | ❌ (ดู 1A) |

### 1C. UX / พฤติกรรม

| prototype | ปัจจุบัน | Gap |
|---|---|---|
| Hub 6 การ์ด + full-screen ต่อหมวด, ไม่บังคับลำดับ | single scroll 8 section + progress strip | เขียน navigation shell ใหม่ |
| Insurer **ล็อกจากงานที่ dispatch** | `insurance_company` มาจาก case อยู่แล้ว แต่ไม่ล็อก UI | ทำ lock UI + profile engine |
| **OCR ต่อฟิลด์** (ทะเบียน/บัตร/ใบขับขี่/VIN) | ปุ่ม stub เปล่า | ต่อ endpoint + **สร้าง OCR mode ใหม่** (ตอนนี้มีแต่ใบเคลม) |
| **GPS** ปักหมุด+เติมสถานที่ | ❌ ในฟอร์ม (case มี `incident_lat/lng`) | ใช้ geolocator (มี package แล้ว) เติม `acc_place`+lat/lng |
| **Autosave + offline queue** (sync server) | draft = SharedPreferences local เท่านั้น | ทำ sync layer (มี WorkManager ใช้อยู่แล้วใน call-consult) |
| **Validation 3 ชั้น** + CID checksum + submit gate | ❌ ไม่มี validator | สร้าง engine |
| **SLA ring 24 ชม.** | ❌ | ต้องมี timestamp "ลูกค้าแจ้งประกัน" จริง (ตอนนี้ `acc_customer_report_date` เป็น VARCHAR ไม่มีเวลา) |
| **Dark mode / touch target / มือเดียว** | ธีมสว่างอย่างเดียว | theming |
| Date picker พ.ศ. (wheel) | ✅ มี pattern แล้ว (`_showBuddhistDatePicker`) | reuse |

### 1D. Master data
prototype มี list ครบชุด (คู่กรณี 52 บ., สาเหตุ 79, จังหวัด 81, สี 55, ยี่ห้อ มอไซค์ 85…) — ฟอร์มปัจจุบันมีบางส่วนแล้ว (สาเหตุ 49, ความสัมพันธ์ 35, ใบขับขี่ 21) → ต้อง reconcile ให้เป็นชุดเดียว (ย้ายเป็น constants/หรือ API master-data)

---

## 2. การตัดสินใจสำคัญ (ต้องเคาะก่อน Phase 0)

**จะเก็บข้อมูล 1:N (คู่กรณี/ผู้บาดเจ็บ/ทรัพย์สิน/damage parts) แบบไหน?**

| ตัวเลือก | ข้อดี | ข้อเสีย |
|---|---|---|
| **A. JSONB columns บน `survey_reports`** (แนะนำสำหรับเฟสแรก) `opposing_parties`, `injured_persons`, `damaged_property`, `insured_damage` = JSONB default `'[]'` | migration น้อย (1 ไฟล์), ตรงกับรูป array ของ prototype, ยืดหยุ่นแก้ schema ระหว่างพัฒนา, ส่ง/รับทั้งก้อนง่าย | query/รายงานราย record ยากกว่า, ต้อง validate ใน app |
| **B. ตารางลูกจริง** `survey_opponents`, `survey_injured`, `survey_property`, `survey_damage_parts` (FK → report) | normalize, รายงาน/รีวิวรายคันได้ดี, index ได้ | migration+service เยอะ, join หลายชั้น, งานมากขึ้น |

**คำแนะนำ:** เริ่ม **A (JSONB)** เพราะ workflow เคสยังไม่ได้ใช้จริง (prod cases=0) และ prototype เก็บเป็น array อยู่แล้ว → ลงได้เร็ว/เสี่ยงต่ำ; ถ้าภายหลังต้องการรายงานเชิงลึกค่อย normalize เป็น B (เขียน migration ย้าย JSONB→ตารางได้)

---

## 3. แผน Implement (เป็นเฟส — value ลงทีละก้อน ไม่ big-bang)

> หลักการ: backend พร้อมก่อน/คู่กับ mobile; แต่ละเฟสจบแล้วแอปยัง submit ได้ (backward compatible); **ไม่บล็อก go-live** ของฟีเจอร์ลงเวลา/ลา/บอร์ด

### Phase 0 — Foundations (backend, เล็ก, ไม่แตะ UI)
- เคาะ decision ข้อ 2 (แนะนำ JSONB)
- **Migration 025**: เพิ่ม `opposing_parties/injured_persons/damaged_property/insured_damage` JSONB (default `'[]'`), `category VARCHAR` ใน `survey_photos`, (ออปชัน) `ev_battery_no/ev_battery_start/ev_charger_no`, และ `customer_reported_at TIMESTAMP` สำหรับ SLA จริง
- ขยาย zod `submitSurveySchema` + `case.service` ให้อ่าน/เขียนฟิลด์ใหม่ (ยังคง optional)
- **ผลลัพธ์:** ฟอร์มเดิมทำงานเหมือนเดิม, backend รับข้อมูลใหม่ได้แล้ว
- *ขนาด: S*

### Phase 1 — Shell + Hub (mobile, จัดโครงใหม่โดยใช้ฟิลด์เดิม)
- สร้าง **Case Shell** (app bar + chip tabs 5 + bottom bar progress) + **Case Hub** 6 การ์ด → หน้าเต็มต่อหมวด
- ย้ายฟิลด์เดิมเข้า 6 หมวด (หมวด 1/2/3/5 ใช้คอลัมน์เดิม, หมวด 4 ใช้ `_damageItems` เดิม, หมวด 6 ยังเป็นคู่กรณีเดี่ยวไปก่อน)
- Insurer lock + prefill ผู้สำรวจจากโปรไฟล์; submit endpoint เดิม
- **ผลลัพธ์:** ได้ UX ใหม่ครบโครง โดยยังไม่แตะ data model 1:N
- *ขนาด: L*

### Phase 2 — Capture-first tools (mobile)
- **OCR wiring:** ต่อปุ่มสแกน → `/api/ocr/claim` (เติมเลขเคลม/สถานที่); **ประเมิน/สร้าง OCR mode ทะเบียน+บัตร+ใบขับขี่+VIN** (Vision/Gemini ทำได้ แต่เป็นงานใหม่ — อาจเลื่อนบางตัว)
- **GPS** เติมสถานที่เกิดเหตุ + lat/lng
- **Damage diagram SVG** (21 ชิ้น, L/R/A + L/M/H/X) แทน list เดิม → persist `insured_damage` JSONB
- autosave indicator
- *ขนาด: L*

### Phase 3 — Multi-record editors (mobile + web review) — ก้อนหลักของฟีเจอร์
- **คู่กรณี list + editor เต็ม ≤20** (CID checksum, KFK) → `opposing_parties`
- **ผู้บาดเจ็บ** list + editor → `injured_persons`
- **ทรัพย์สิน** list + editor → `damaged_property`
- **อัปเดตหน้ารีวิว/เช็คเกอร์ฝั่งเว็บ** ให้แสดง array พวกนี้ (ไม่งั้นผู้ตรวจไม่เห็นข้อมูล)
- *ขนาด: XL*

### Phase 4 — Validation + Review + submit gate (mobile)
- validation 3 ชั้น (inline / การ์ด Hub / error summary sheet) + required-dot engine + CID checksum
- หน้า **ตรวจสอบ & ส่ง** + gate; ตำรวจบังคับเงื่อนไข (fault=รอสรุปผลคดี หรือ ผู้บาดเจ็บ≥1)
- *ขนาด: M*

### Phase 5 — Offline-first + SLA + polish
- autosave sync server + **offline queue** (reuse WorkManager pattern), SLA ring (ใช้ `customer_reported_at`), dark mode, image gallery หมวด+เกณฑ์จำนวน
- *ขนาด: M–L*

---

## 4. ความเสี่ยง / ข้อควรรู้
- **OCR ทะเบียน/บัตร/ใบขับขี่/VIN ยังไม่มี** — prototype วางปุ่มไว้ครบ แต่ backend อ่านได้แค่ใบเคลม → ต้องตัดสินใจว่าทำเพิ่มหรือเลื่อน (Phase 2)
- **SLA countdown** ต้องมี timestamp "ลูกค้าแจ้งประกัน" ที่มีเวลา — ปัจจุบันเป็น VARCHAR วันที่ล้วน → เพิ่ม `customer_reported_at` (Phase 0)
- **หน้าเว็บรีวิว/เช็คเกอร์ต้องอัปเดตคู่กัน** เมื่อเพิ่ม 1:N (Phase 3) ไม่งั้นข้อมูลใหม่มองไม่เห็นฝั่งตรวจ
- **prod DB แชร์กับ local** — migration 025 ต้องรันบน prod ด้วยตอน deploy (ระวังกับดัก declined migration เดิม)
- ฟีเจอร์นี้เป็นงานใหญ่ (~L×3, XL×1) — **ไม่อยู่ใน go-live priority scope** (ลงเวลา/ลา/บอร์ด) จึงควรทำขนานโดยไม่กระทบ go-live
