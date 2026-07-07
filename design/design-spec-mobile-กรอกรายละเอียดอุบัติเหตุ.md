# สเปคออกแบบ: หน้า "กรอกรายละเอียดอุบัติเหตุ" (e-EMCS Mobile)

> คู่กับไฟล์ prototype: `mobile-prototype-กรอกรายละเอียดอุบัติเหตุ.html`
> เอกสารนี้เขียนใหม่ทั้งไฟล์ให้ตรงกับ prototype **v1.43** (สกัดจากไฟล์จริงทุกจุด ไม่ใช่ของเก่า)

**เวอร์ชันเอกสาร:** Sync to Prototype v1.43
**Viewport เป้าหมาย:** 390×844px (มือถือ ใช้มือเดียว) รองรับ 360–430px

---

## สารบัญ

1. แนวคิดหลัก (Design Concept)
2. โครงสร้างหน้าจอทั้งหมด (Screen Map) — 15 หน้าจอ
3. Design Tokens (สี / ฟอนต์ / ขนาด)
4. Component Library
5. สเปครายหน้าจอ — App bar/Shell, Case Hub, หมวด 1–6, คู่กรณี editor, Review
6. หน้าแท็บอื่น — ผู้บาดเจ็บ / ทรัพย์สิน / รูปภาพ / ค่าใช้จ่าย
7. Bottom Sheets (10 ตัว) + OCR overlay
8. แผนภาพความเสียหาย (Damage Diagram)
9. Validation System (3 ชั้น)
10. Master Data (จำนวนสมาชิก + legacy/ย่อ)
11. Insurer Profile Engine
12. State / Offline / Autosave
13. หมายเหตุขอบเขต & สิ่งที่เป็น mock

---

## 1. แนวคิดหลัก (Design Concept)

**"Hub-and-Spoke + Capture-First + Offline-First"**

- เปลี่ยนฟอร์มยาวหน้าเดียวเป็น **Case Hub**: หน้าแม่เป็นเช็คลิสต์การ์ด **6 หมวด** + Timeline Strip ถาวร แตะเข้าไปกรอกทีละหมวดแบบ full-screen — **non-linear ไม่บังคับลำดับ** (งานภาคสนามไม่เป็นเส้นตรง) แต่ระบบไฮไลต์การ์ดถัดไปที่แนะนำให้
- แยกข้อมูล 2 ชั้นตาม workflow จริง: **"ต้องเก็บที่จุดเกิดเหตุ"** (stamp เวลา, GPS, สแกน OCR, ความเสียหาย, ข้อมูลขั้นต่ำคู่กรณี) กับ **"เรียบเรียงทีหลังได้"** (รายงานเต็ม, เลขเคลม, ความเห็นตำรวจ) — สื่อสารผ่านป้าย "เรียบเรียงทีหลังได้" บนฟิลด์ ไม่แยกเป็น 2 โหมดแอป
- **Offline-first + autosave ทุกฟิลด์** ลง local storage ทันที มีคิว sync — ไม่มีปุ่ม "บันทึกร่าง" แยก แสดง "✓ บันทึกแล้ว HH:MM"
- ทุกอย่างเพื่อ **มือเดียว-นิ้วโป้ง-กลางแดด-รีบ**: action หลักครึ่งล่างจอ, ไม่มี native dropdown, touch target ≥48×48dp ห่าง ≥8dp, contrast สูง, dark mode

> **หมายเหตุสำคัญ (ต่างจาก spec เก่า):** ระบบใช้ **6 หมวด** (ไม่ใช่ 8) — "ตำรวจ" และ "การติดตามงาน/นัดหมาย" ถูกยุบเข้าไปอยู่**ท้ายหน้าหมวด 5 (เหตุการณ์ & สถานที่)** ไม่ใช่หมวดแยก หน้า scr-s7/scr-s8 ถูกถอดออกแล้ว ฟีเจอร์ "รถหาย" และ toggle "ซ่อม/เปลี่ยน" ก็ถูกถอดออก และการเพิ่มคู่กรณีไม่มี "quick-add 3 จังหวะ" อีกต่อไป (กดเพิ่มแล้วเข้าฟอร์มเต็มทันที)

---

## 2. โครงสร้างหน้าจอทั้งหมด (Screen Map)

มี **15 หน้าจอจริง** (ยืนยันด้วย id `scr-*`) ครอบด้วย Case Shell ถาวร (App bar + Chip tabs + Bottom bar)

```
[Case Shell] App bar + Chip tabs (5) + Bottom bar + Fixbar (กรอบถาวร)
 └─ scr-hub        Case Hub (แดชบอร์ด: Timeline + Quick Actions + การ์ด 6 หมวด)
     ├─ scr-s1     หมวด 1: เคลม & กรมธรรม์
     ├─ scr-s2     หมวด 2: รถประกัน
     ├─ scr-s3     หมวด 3: ผู้ขับขี่รถประกัน
     ├─ scr-s4     หมวด 4: ความเสียหาย  (แผนภาพรถ SVG)
     ├─ scr-s5     หมวด 5: เหตุการณ์ & สถานที่  (รวม ตำรวจ + การติดตามงาน ท้ายหน้า)
     ├─ scr-s6     หมวด 6: คู่กรณี (list, สูงสุด 20 คัน)
     │    └─ scr-s6edit   Editor คู่กรณีรายคัน (ฟอร์มเต็ม accordion)
     └─ scr-review ตรวจสอบ & ส่งรายงาน
 [แท็บอื่น — ไม่ใช่หมวดใน Hub]
     ├─ scr-inj / scr-inj-edit      ผู้บาดเจ็บ (list + editor)
     ├─ scr-asset / scr-asset-edit  ทรัพย์สินเสียหาย (list + editor)
     ├─ scr-img                     รูปภาพ (gallery)
     └─ scr-ph                      ค่าใช้จ่าย (placeholder — นอกขอบเขต)
```

**ลำดับงานแนะนำ ณ จุดเกิดเหตุ:** กด "ถึงที่เกิดเหตุ" บน Timeline → หมวด 5 (GPS+เวลาเกิดเหตุ) → หมวด 2–3 (สแกนทะเบียน/บัตร) → หมวด 4 (แผนภาพความเสียหาย) → หมวด 6 (เพิ่มคู่กรณีก่อนเขาไป) → ถ่ายรูป (แท็บรูปภาพ) → กด "สำรวจเสร็จ" → หมวด 1 + รายงานเต็ม เรียบเรียงในรถ

---

## 3. Design Tokens (สี / ฟอนต์ / ขนาด)

### สี (Light mode — default, ปรับ contrast สำหรับกลางแดด)

| Token | ค่า | ใช้กับ |
|---|---|---|
| `--primary` | `#1B77E4` | ปุ่มหลัก, ลิงก์, ฟิลด์ focus |
| `--primary-dark` | `#0E3A6E` | Header / App bar (navy เข้ม) |
| `--success` | `#16A34A` | สถานะครบ ✓, validation ผ่าน |
| `--warning` | `#EA8600` | ฟิลด์บังคับที่ขาด (จุด ●), คำเตือน |
| `--danger` | `#DC2626` | Error, SLA ใกล้หมด, ปุ่มยกเลิก |
| `--surface` | `#FFFFFF` | พื้นการ์ด (ขาวจริง ห้ามเทาอ่อนบนขาว) |
| `--bg` | `#F1F5F9` | พื้นหลัง Hub |
| `--text` | `#0F172A` | ตัวอักษรหลัก (contrast ≥7:1) |
| `--text-secondary` | `#475569` | label, คำอธิบาย |
| `--border` | `#CBD5E1` | เส้นขอบ input |

### Dark mode
พื้น `#0F172A`, การ์ด `#1E293B`, ตัวอักษร `#E2E8F0`, primary ปรับเป็น `#5EA1F0`, ลด pure white กันแสบตา (สลับด้วยปุ่ม 🌙 บน dev bar / เมนู ⋮)

### ระดับความเสียหาย L / M / H / X (segmented control สี)
- **L** = เล็กน้อย `#16A34A` เขียว
- **M** = ปานกลาง `#EAB308` เหลือง
- **H** = หนัก `#EA8600` ส้ม
- **X** = เปลี่ยน/พัง `#DC2626` แดง

(ผูกกับตัวแปร CSS `--lvl-L/M/H/X`)

### Typography
- ฟอนต์: Noto Sans Thai (fallback: IBM Plex Sans Thai Looped, sans-serif), line-height ≥1.6 รองรับสระบน-ล่าง
- Input ทุกช่อง ≥16px (กัน iOS auto-zoom), label 14px อยู่เหนือฟิลด์เสมอ
- ตัวเลขสำคัญ (countdown, เงิน, เวลา) ใช้ tabular figures ขนาด 20–28px หนา
- **ฟิลด์บังคับ:** ใช้ class `.req` → CSS `.req::after{content:' ●'; color:var(--warning)}` เติมจุดส้ม ● ท้าย label อัตโนมัติ (จุดขยับตามโปรไฟล์บริษัทประกัน)

### Layout
- ฟอร์ม 1 คอลัมน์เสมอ, padding ข้าง 16px, การ์ด radius 12px, ปุ่มหลักสูง ~52px เต็มความกว้าง
- Error: ขอบแดง + ไอคอน ⚠ + ข้อความใต้ฟิลด์ (ไม่พึ่งสีอย่างเดียว)

---

## 4. Component Library (ใช้ร่วมทุกหน้า)

1. **Searchable Bottom Sheet Picker (`shPick`)** — ใช้แทน dropdown ทุกตัวที่ >7 ตัวเลือก: เปิดจากล่าง, ช่องค้นหาบนสุด, จัดกลุ่มมีหัวข้อ (`.pick-group`), แถว "ใช้บ่อย⭐/พบบ่อย⭐" ปักบน (insurer/province/opoInsurer), แตะเลือกแล้วปิด, มีโหมด `swatch` (สี), `multi` (ลักษณะความเสียหาย — เลือกหลายรายการไม่ปิด sheet), `loc` (drill-down จังหวัด→อำเภอ→ตำบล)
2. **Segmented control (`seg`)** — 2–4 ตัวเลือก label สั้น: **หนัก/เบา** (รถเสียหาย), **ชาย/หญิง** (เพศ), **L/M/H/X** (ระดับความเสียหาย), **ซ้าย/ขวา/ทั้งหมด** (ข้างชิ้นส่วน), ผลตรวจแอลกอฮอล์ 3 ปุ่ม
3. **Chip grid (wrap)** — ตัวเลือกที่ควรเห็นครบ: ประเภทเคลม (4), การติดตามงาน (3), ระดับบาดเจ็บ (6 สี)
   > อัปเดต (แอปจริง): **ประเภทรถ** และ **รถยนต์ไฟฟ้า (EV)** เปลี่ยนจาก chips → **dropdown** (ดูหมวด 2)
4. **Selection dropdown** — ตัวเลือกเชิงกฎหมาย: ฝ่ายประมาท (dropdown 7 ตัวเลือก, picker `fault` → `#vFault`)
5. **Cascading Location Sheet** — จังหวัด→อำเภอ→ตำบล ใน sheet เดียว (drill-down) + ปุ่ม "📍 ใช้ตำแหน่งปัจจุบัน"
6. **Date/Time Sheet พ.ศ. (`shDate`)** — ช่องพิมพ์ วว/ดด/ปปปป (พ.ศ.) + ช่องเวลา (แสดงตาม config), ชิปลัด ⏱ตอนนี้/วันนี้/เมื่อวาน (ซ่อนสำหรับวันเกิด/วันใบขับขี่) — helper: "ตัวจริงเป็น wheel picker พุทธศักราช prototype ใช้ช่องพิมพ์แทน"
7. **Input เฉพาะทาง** — `inputmode=tel/numeric`, auto-format: บัตร ปชช. `x-xxxx-xxxxx-xx-x` (fmtCid + checksum), โทรศัพท์ `xxx-xxx-xxxx` (fmtTel), เงินคั่นหลักพัน (fmtMoney), เลขเคลม mask ตามบริษัท
8. **Progressive disclosure** — ฟิลด์ลูกซ่อนจนตัวแม่เรียก: พรบ.→เลข พรบ., EV→เลขแบต/วันเริ่มใช้/เลขชาร์จ, เรียกร้อง "รับเงินจำนวน"→ยอดเงิน, ฝ่ายประมาท "รถคู่กรณีเป็นฝ่ายผิด"→เลือกคันที่, สวิตช์ตำรวจ→ทั้งชุด, ผลแอลกอฮอล์→ช่องกรอกผล
9. **ปุ่มสแกน OCR** — ปุ่มใหญ่มีไอคอนกล้อง บนสุดของ section ที่รองรับ; จำลองด้วย fullscreen camera overlay (`#ocr`) → กด "ถ่าย" → ฟิลด์ถูกเติม + ไฮไลต์เหลืองวาบ; mode: plate/idcard/idcardOpo/license/licenseOpo/vin/photo/idcardInj
10. **Autosave indicator** — "✓ บันทึกแล้ว HH:MM" (+ dev bar toggle Offline จำลอง)

---

## 5. สเปครายหน้าจอ

### 5.0 Case Shell (กรอบถาวรทุกหน้า)

#### App bar (flex แถวเดียว)
**กลุ่มซ้าย:**
- **เลขเรื่อง (case-id):** ข้อความคงที่ `SV-2569-04512` (hardcode ในมาร์กอัป)
- **ป้าย (badges) 3 ตัว เรียงกัน:**
  1. `#bClaimType` — ป้ายประเภทเคลม (พื้นส้ม `#F59E0B` ตัวหนา) **เริ่มต้นซ่อน** โผล่+เติมข้อความเมื่อเลือกประเภทเคลมในหมวด 1
  2. `#bInsurer` — ป้ายบริษัทประกัน **แสดงเสมอ** (ค่ามาร์กอัปเริ่มต้น "ทิพยประกันภัย" แต่รันไทม์ถูก sync เป็นชื่อย่อบริษัทจริงที่ dispatch มา = "ไอโออิ")
  3. `#bStatus` — ป้ายล็อก `🔒 ตรวจสอบแล้ว` **เริ่มต้นซ่อน** แสดงเมื่อ view-only
- **ตัวคั่นยืด** `.grow` ดันของถัดไปไปขวา

**กลุ่มขวา:**
- **วงแหวน SLA `#slaRing`** (SVG 46×46, 2 ชั้น, arc เขียว `#4ADE80`, `stroke-dasharray=119.4`) กลางวงข้อความ `#slaT` เริ่ม `--:--` + คำว่า "เหลือ"; แตะ → toast "ต้องปิดงานภายใน 24 ชม. นับจากลูกค้าแจ้งประกัน"
- **ปุ่มเมนู `#menuBtn`** `⋮` → เปิด sheet `shMenu`

> **ป้ายเวอร์ชัน v1.43 ไม่ได้อยู่บน App bar** แต่อยู่ที่ **dev bar** ท้ายไฟล์ เป็นปุ่ม `pointer-events:none; opacity:.75` คู่กับปุ่ม dev อื่น (🌙 Dark / 🔒 View-only / 📶 Offline)

#### Chip tabs (`#chiptabs`) — 5 แท็บ
1. **รายละเอียดเหตุ** (`ctab on` แอ็กทีฟเริ่มต้น) → `go('hub')`
2. **ผู้บาดเจ็บ** (`#tabInj`) → `go('inj')`
3. **ทรัพย์สิน** (`#tabAsset`) → `go('asset')`
4. **รูปภาพ** (`#tabImg`) → `go('img')`
5. **ค่าใช้จ่าย** → `go('ph')`

#### Bottom bar (`#bottombar`)
- แถบความคืบหน้า `#bbProg`: "**ครบ N/6 หมวด**" · `#saveInd` "✓ บันทึกแล้ว HH:MM"; progress bar `#pbarFill`
- ปุ่มหลัก `#bbMain` เปลี่ยนตามหน้า (via `updateBB`): hub/review → "ตรวจสอบ & ส่ง"; inj → "+ เพิ่มผู้บาดเจ็บ"; asset → "+ เพิ่มทรัพย์สิน"; img → "📷 ถ่ายรูป"; หน้าหมวด s1–s6 → "← กลับ Hub"
- **Progress logic:** `done` = หมวดที่สถานะ `ok`; `total` = 6 เสมอ (`secVisible()` คืน `true` ทุกหมวด) → แสดง "ครบ N/6 หมวด"

#### Fixbar ลอย (`#fixbar`)
- ข้อความ `#fixbarT` "แก้แล้ว X/N" + ปุ่ม "ปัญหาถัดไป →" → `nextErr()`

#### Read-only mode
ทุกหน้ามีแถบ `ro-banner` "🔒 ดูได้อย่างเดียว" (ยกเว้น scr-ph); element ที่มี class `ro-hide` (ปุ่มแก้ไข/เพิ่ม/สแกน) ถูกซ่อนในโหมด view-only

---

### 5.1 scr-hub — Case Hub

ไม่มี h2 (เป็นแดชบอร์ด) ประกอบด้วย:
- **`ro-banner` ยาว:** "🔒 เคสนี้ตรวจสอบแล้ว — ดูได้อย่างเดียว • ตรวจโดย ศูนย์ควบคุม BVG • หากต้องแก้ไขติดต่อผู้ตรวจงาน"
- **การ์ดไทม์ไลน์งาน** "⏱ ไทม์ไลน์งาน (เคลมสดต้องจบใน 24 ชม.)" — 4 node แตะได้:
  1. ลูกค้าแจ้ง (✓ prefill 18:49)
  2. แจ้งเซอร์เวย์ (✓ prefill 18:49)
  3. ถึงที่เกิดเหตุ (📍 —)
  4. สำรวจเสร็จ (🏁 —)
  - error `#tlErr` "ลำดับเวลาไม่ถูกต้อง"; ปุ่ม stamp (ro-hide): "📍 ถึงที่เกิดเหตุ — บันทึกเวลาตอนนี้", "🏁 สำรวจเสร็จ" (disabled)
- **Quick actions** (`qa ro-hide`) 5 ปุ่ม: 📷 ถ่ายรูป · 🪪 สแกนบัตร/ใบขับขี่ · 🔢 สแกนทะเบียน · ☁️ ดึงข้อมูลประกัน · 📍 ปักหมุด GPS
- **`#hubCards`** — คอนเทนเนอร์การ์ดหมวด **6 ใบเสมอ** (เรนเดอร์ด้วย JS `renderHub`)

**การ์ดหมวด (SECDEF 6 หมวด):** icon + ชื่อ + summary + dot สถานะ; หมวดถัดไปได้ tag "แนะนำถัดไป"

| key | icon | ชื่อ | summary เมื่อมีข้อมูล / เมื่อว่าง |
|---|---|---|---|
| s1 | 📋 | เคลม & กรมธรรม์ | ชื่อบริษัท + ประเภทเคลม / "ยังไม่เลือกบริษัทประกัน" |
| s2 | 🚗 | รถประกัน | ทะเบียน จังหวัด · ยี่ห้อ รุ่น สี / "ทะเบียน ยี่ห้อ รุ่น สี" |
| s3 | 🪪 | ผู้ขับขี่รถประกัน | ชื่อ-สกุล · อายุ / "สแกนบัตรเพื่อเติมอัตโนมัติ" |
| s4 | 🔧 | ความเสียหาย | จำนวนรายการ · ~ค่าซ่อม / "แตะภาพรถเพื่อระบุ" |
| s5 | 📍 | เหตุการณ์ & สถานที่ | วัน-เวลา · สาเหตุ / "วัน-เวลา สถานที่ ลักษณะเหตุ" |
| s6 | 🚙 | คู่กรณี | จำนวนคัน · รวม ~บาท / "ไม่มีคู่กรณี" (เมื่อ ok) / "ยังไม่มีรายการ" |

> **หมายเหตุ:** ผู้บาดเจ็บ/ทรัพย์สิน/รูปภาพ **ไม่ใช่การ์ดใน Hub** เป็นแท็บแยก; SECDEF ไม่มี field `opt/cond` (logic optional-card ในโค้ดเป็น dead branch); `secVisible()` คืน `true` เสมอ → ไม่มีหมวดถูกซ่อน

---

### 5.2 scr-s1 — หมวด 1: เคลม & กรมธรรม์

h2: **"1. เคลม & กรมธรรม์"**; back → hub; `ro-banner`. ฟิลด์ตามลำดับจริง:

1. **ประเภทเคลม** [req ●] — chips `#chipsClaimType` (เคลมสด / เคลมแห้ง / งานนัดหมาย / งานติดตาม) — เลือกแล้วอัปเดต badge `#bClaimType`
2. **รถเสียหาย** [req ●] — seg 2 ปุ่ม หนัก / เบา (`#segHev`)
3. **บริษัทประกัน** [req ●] — pseudo-input **ล็อก** (`#piInsurer`, พื้น `--bg`, `cursor:default`, ท้าย 🔒). **prefill = "ไอโออิกรุงเทพประกันภัย"**. แตะ → toast "บริษัทประกันถูกกำหนดมาจากงานที่ได้รับ — เปลี่ยนไม่ได้" (ไม่มี sheet เลือกบริษัท)
4. ปุ่ม "☁️ ดึงข้อมูลจากบริษัทประกัน" (`#btnWS`, ro-hide, เริ่มซ่อน — โผล่เฉพาะบริษัทที่ `ws:true`)
5. **เลขที่รับแจ้ง** [req ●*] — input text (`#fAccRef`)
6. **เลขที่เคลม** [req ●*] — input text (`#fClaimNo`, validate onblur ตาม mask บริษัท, hint `#claimHint`, error `#claimErr`, ✓ `#claimOk`)
   > *(ข้อ 5–6 บังคับอย่างน้อยหนึ่งช่อง; ถ้ากรอกเลขเคลม + มี insurer → ต้องตรง mask)*
7. **เลขเรื่องเซอร์เวย์** (ไม่บังคับ) — input text (`#fSurvJob`, maxlength 20)

**Collapsible "กรมธรรม์"** (เปิดเริ่มต้น):

8. **เลขกรมธรรม์** [req ●] — input text (`#fPolicyNo`)
9. **มี พรบ.** — สวิตช์ `#swPrb`; เปิดแล้วโผล่ input `#fPrbNo` [req ● เมื่อ prb=true]
10. **วันเริ่มคุ้มครอง** (ไม่บังคับ) — date picker (`polStart`)
11. **วันสิ้นสุด** (ไม่บังคับ) — date picker (`polEnd`); error `#polRangeErr` "วันเกิดเหตุอยู่นอกช่วงคุ้มครอง" (warning)
12. **ผู้เอาประกันภัย** [req ●] — input text (`#fAssured`)
13. **ชื่อผู้ขับขี่ตามกรมธรรม์** (ไม่บังคับ) — input text (`#fDriverByPolicy`)
14. **ประเภทประกัน** [req ●] — picker (`polType`, POL_TYPES 7 ตัวเลือก)
15. **รหัสภัยยานยนต์** (บังคับเฉพาะบริษัทที่ `risk:true`, label `#lblRisk`) — input numeric (`#fRisk`)
16. **อีเมลผู้เอาประกัน** (ไม่บังคับ) — input email (`#fEmail`)
17. **ค่าเสียหายส่วนแรก** (ไม่บังคับ) — input money (`#fDeduct`)

ปุ่มท้าย (ro-hide): "ถัดไป: รถประกัน →"

---

### 5.3 scr-s2 — หมวด 2: รถประกัน

h2: **"2. รถประกัน"**; back → hub; `ro-banner`. ฟิลด์ตามลำดับ:

1. **ทะเบียน** [req ●] — input text (`#fCarReg`)
2. **จังหวัด** [req ●] — picker province (`#vfCarProv` "เลือกจังหวัด")
3. **ประเภทรถ** [req ●] — **dropdown** (8 ตัวเลือกตาม `ddlCType` จริง: `-- ระบุ --` / เก๋งเอเชีย / เก๋งยุโรป / รถจักรยานยนต์ / รถอื่นๆ / กระบะ / รถตู้ / รถบรรทุก) *(เดิม prototype เป็น chips + emoji — แอปจริงใช้ dropdown)*
4. **ยี่ห้อ** [req ●] — picker brand (`#vfBrand`, ตาม BRANDS map ต่อประเภท)
5. **รุ่น** (ไม่บังคับ) — input text (`#fModel`)
6. **สีรถ** (ไม่บังคับ) — picker color (`#vfColor`, swatch)
7. **ปีจดทะเบียน (พ.ศ.)** (ไม่บังคับ) — input numeric (`#fRegYear`, maxlength 4)
8. **รถยนต์ไฟฟ้า (EV)** (ไม่บังคับ) — **dropdown** (ไม่ใช่ EV / BEV / HEV / PHEV / FCEV / MEV); เลือก BEV/HEV/PHEV/FCEV/MEV → โผล่ `#evExtra`: หมายเลขแบตเตอรี่ [req ●], วันเริ่มใช้งานแบตเตอรี่, หมายเลขเครื่องชาร์จ *(เดิม prototype เป็น chips — แอปจริงใช้ dropdown)*
9. **หมายเลขตัวถัง** (ไม่บังคับ) — input text (`#fVin`)
10. **หมายเลขเครื่องยนต์** (ไม่บังคับ) — input text (`#fEngine`)
11. **หมายเลข Model** (ไม่บังคับ) — input text (`#fModelNo`)
12. **หมายเลข กม.** [req ●] — input numeric (`#fKm`, chkKm onblur); warn `#kmWarn` "เลขไมล์น้อยกว่าที่เคยบันทึก (48,200 กม. เมื่อ 03/2569)"

ปุ่มท้าย: "ถัดไป: ผู้ขับขี่ →"

---

### 5.4 scr-s3 — หมวด 3: ผู้ขับขี่รถประกัน

h2: **"3. ผู้ขับขี่รถประกัน"**; back → hub; `ro-banner`. ปุ่มสแกน (ro-hide): "🪪 สแกนบัตรประชาชน", "🚗 สแกนใบขับขี่". ฟิลด์:

1. **เพศ** [req ●] — seg ชาย/หญิง (`#segGender`)
2. **คำนำหน้า** [req ●] — picker title (`#vTitle`)
3. **ชื่อ** [req ●] — input text (`#fDriName`)
4. **นามสกุล** [req ●] — input text (`#fDriLast`)
5. **ความสัมพันธ์กับเจ้าของรถ** [req ●] — picker relation (`#vfRel`)
6. **วันเกิด (พ.ศ.)** [req ●] — date (`birth`)
7. **อายุ** [req ●] — input numeric (`#fDriAge`, maxlength 3, auto-คำนวณจากวันเกิด)
8. **โทรศัพท์** [req ●] — input tel (`#fDriTel`, maxlength 12, fmtTel)
9. **เลขบัตรประชาชน** [req ●] — input tel (`#fCid`, placeholder x-xxxx-xxxxx-xx-x, maxlength 17, fmtCid); ✓ `#cidOk`, error `#cidErr` "checksum ไม่ผ่าน" **(บังคับ checksum mod 11)**
10. **ที่อยู่ปัจจุบัน** [req ●] — input text (`#fDriAddrText`) + picker location (`#vfDriAddr` "ตำบล / อำเภอ / จังหวัด")

**Collapsible "ใบขับขี่"** (เปิดเริ่มต้น):

11. **เลขที่ใบขับขี่** [req ●] — input text (`#fDrvNo`)
12. **ออกให้ที่** (ไม่บังคับ) — picker province (`#vfDrvPlace`)
13. **ประเภทใบขับขี่** (ไม่บังคับ) — picker licType (`#vfLicType`)
14. **วันออกบัตร** (ไม่บังคับ) — date (`drvStart`)
15. **วันหมดอายุ** (ไม่บังคับ) — date (`drvEnd`); warn `#drvExpWarn` "ใบขับขี่หมดอายุก่อนวันเกิดเหตุ" (warning)
16. **ใบสั่งเลขที่ (ถ้ามี)** (ไม่บังคับ) — input text (`#fDriOrder`)

ปุ่มท้าย: "ถัดไป: ความเสียหาย →"

---

### 5.5 scr-s4 — หมวด 4: ความเสียหาย

h2: **"4. ความเสียหาย"**; back → hub; `ro-banner`. *(ชื่อหมวดตัด "& อู่" ออก — ไม่มี toggle ซ่อม/เปลี่ยน)*

- **การ์ดแผนภาพรถ SVG** (`#carSvg`, class `carSvgTap`, viewBox 0 0 340 200, มุมมองบน/top view):
  - **ชิ้นส่วนแตะได้ (`.part`) 21 ชิ้น** (มี `data-p`):
    - แนวกลางลำ: กันชนหน้า, กระจังหน้า, ฝากระโปรงหน้า, กระจกบังลมหน้า, หลังคา, กระจกบังลมหลัง, ฝากระโปรงหลัง, กระบะ, กันชนหลัง (9)
    - ฝั่งขวา: บังโคลนหน้าขวา, ประตูหน้าขวา, ประตูหลังขวา, บังโคลนหลังขวา (4)
    - ฝั่งซ้าย: บังโคลนหน้าซ้าย, ประตูหน้าซ้าย, ประตูหลังซ้าย, บังโคลนหลังซ้าย (4)
    - ไฟ: ไฟหน้าขวา, ไฟหน้าซ้าย, ไฟท้ายขวา, ไฟท้ายซ้าย (4)
  - แต่ละชิ้นมี `<text class="lbl">` กำกับชื่อ (บางชื่อย่อ เช่น data-p="ประตูหน้าขวา" แต่ label="ปต.หน้าขวา")
  - ข้อความใต้ภาพ: "แตะชิ้นส่วนเพื่อระบุระดับความเสียหาย"
- **ปุ่มเพิ่มชิ้นส่วน** (ghost sm, ro-hide): "+ เพิ่มชิ้นส่วน (ชิ้นที่ไม่อยู่บนภาพ)" → `openDmgCustom()`
- **การ์ดรายการความเสียหาย:** หัวข้อ "รายการความเสียหาย (N)" (`#dmgCount`); `#dmgList` มี empty `#dmgEmpty` "ยังไม่มีรายการ — แตะที่ภาพรถด้านบน"
- **ความเสียหายประมาณ** (ไม่บังคับ) — input money ตัวใหญ่ (`#fCost`, class `money bigmoney`) + หน่วย "บาท"

ปุ่มท้าย: "ถัดไป: เหตุการณ์ & สถานที่ →"

**บังคับ:** รายการความเสียหายอย่างน้อย 1 ชิ้น (`S.dmg.length ≥ 1`) — รายละเอียดกลไกดูข้อ 8

---

### 5.6 scr-s5 — หมวด 5: เหตุการณ์ & สถานที่ (รวมตำรวจ + การติดตามงาน)

h2: **"5. เหตุการณ์ & สถานที่"**; sub: **"GPS เติมที่เกิดเหตุให้อัตโนมัติ"**; back → hub; `ro-banner`. ลำดับทั้งหน้า:

1. **วัน-เวลาเกิดเหตุ (พ.ศ.)** [req ●] — date (`accDate`)
2. **สถานที่เกิดเหตุ** [req ●] — input text ถนน/จุดสังเกต (`#fAccPlace`, placeholder "…เช่น หน้าปั๊มน้ำมัน") + picker location (`#vfAccLoc`) — GPS auto-fill ใช้ผ่านตัวเลือกใน location picker เท่านั้น (ตัด standalone GPS button ออกแล้ว; `#mapMock`/`#gpsWarn` ยังคงในหน้าแต่ไม่ถูกเรียกจากหมวดนี้)
3. **ลักษณะการเกิดเหตุ** [req ●] — picker cause (`#vCause`, CAUSES)
4. **ลักษณะความเสียหาย** [req ●] — picker lossType **multi** (`#vLoss` "เลือกได้หลายรายการ", LOSS_TYPES — array ต้องมี ≥1)
5. **รายละเอียดการเกิดเหตุ** [req ●] — textarea (`#fAccDetail`); label hint "เรียบเรียงทีหลังได้ — บังคับตอนส่งรายงาน"
6. **ฝ่ายประมาท** [req ●] — **dropdown** (picker `fault` → `#vFault`, 7 ตัวเลือกจาก `FAULTS`) + `#faultOpoPick` (โผล่เมื่อ fault="รถคู่กรณีเป็นฝ่ายผิด" → บังคับเลือกคันที่ผิด `S.faultOpo`)
7. **ผู้แจ้งเหตุ** (ไม่บังคับ) — input text (`#fAccCall`)
8. **ผู้สำรวจภัย** [req ●] — input text (`#fAccSurv`, placeholder "เติมจากโปรไฟล์ผู้ล็อกอินอัตโนมัติ" — ตัด prefill ตัวอย่างออก); fhelp "เติมจากโปรไฟล์ผู้ล็อกอินอัตโนมัติ — แก้ได้กรณีสำรวจแทน/งานส่งต่อ"
9. **วันที่ลูกค้าแจ้งบ.ประกัน** [req ●] — date (`tl0`)
10. **วันที่บ.ประกันแจ้งสำรวจภัย** [req ●] — date (`tl1`)
11. **วันที่สำรวจภัย (ถึงที่เกิดเหตุ)** [req ●] — date (`tl2`)
12. **วันที่สำรวจภัยเสร็จ** [req ●] — date (`tl3`)
13. **การเรียกร้องค่าเสียหายจากคู่กรณี** (ไม่บังคับ) — `#claimChecks` (checkbox list, OPO_CLAIMS 5 ข้อ) + `#claimTotal` แสดงยอดรวม; ข้อ "รับเงินจำนวน" ติ๊กแล้วโชว์ 2 ช่องแถวเดียวกัน (**รับเงินจำนวน** ~36% + **จากจำนวนเงินเรียกร้องทั้งหมด** [req] ที่เหลือ) ต้องมี `rec` (ยอดเรียกร้องรวม); ถ้า pay > rec → error `#payErr` "รับเงินจากคู่กรณีเกินยอดเรียกร้องรวม" **(เป็น error block ส่ง)**

**`<div class="divider">`**

**ส่วนตำรวจ (อยู่ในหน้านี้ ไม่ใช่หมวดแยก):** สวิตช์ `swrow card` "มีการแจ้งความ / ลงประจำวัน" (`#swPolice`, `togglePolice`); เปิดแล้วโผล่ **`#policeSet`** (เริ่ม `display:none`):

14. **ชื่อพนักงานสอบสวน** [req ●] — input text (`#fPolName`)
15. **สถานีตำรวจ** [req ●] — picker station (`#vStation`, STATIONS 9 รวม "ล่าสุดที่ใช้" ⭐)
16. **ความเห็นพนักงานสอบสวน** (ไม่บังคับ) — textarea (`#fPolComment`)
17. **วันที่ลงประจำวัน** (ไม่บังคับ) — date (`polDate`)
18. **ประจำวันข้อที่** (ไม่บังคับ) — input numeric (`#fBookNo`)
19. **ผลตรวจแอลกอฮอล์** (ไม่บังคับ) — seg 3 ปุ่ม (`#segAlc`: ไม่ได้ตรวจ / ไม่พบ-ไม่เกิน / พบ-เกินกำหนด); เลือกแล้วโผล่ input `#fAlc`

**`<div class="divider">`**

**ส่วน "การติดตามงาน" (ฝังใน `#policeSet` — เห็นต่อเมื่อเปิดสวิตช์ตำรวจ):**

20. **การติดตามงาน** (ไม่บังคับ) — chips (`#chipsFlu`, FLU_ST 3)
21. **ครั้งที่นัดหมาย** (ไม่บังคับ) — stepper −/+ (`#fluNo` เริ่ม 1)
22. **รายละเอียดการนัดหมาย** (ไม่บังคับ) — textarea (`#fFluDetail`)
23. **วันที่** (ไม่บังคับ) — date (`fluDate`)

ปุ่มท้าย: "ถัดไป: คู่กรณี →"

> **ตำรวจบังคับแบบเงื่อนไข (`policeNeeded()`):** ถ้า fault="รอสรุปผลคดี" **หรือ** มีผู้บาดเจ็บ ≥1 คน → บังคับเปิดสวิตช์ตำรวจ; เมื่อเปิดแล้วบังคับ ชื่อพนักงานสอบสวน + สถานีตำรวจ (และถ้าติดตามงาน="มีการนัดหมาย" → บังคับวันที่นัดหมาย)

---

### 5.7 scr-s6 — หมวด 6: คู่กรณี (list)

h2: **"6. คู่กรณี (N/20)"** (`#opoCountH`); back → hub; `ro-banner`
- `#opoSummaryBar` (แสดงเมื่อ >1 คัน: "N คัน • ครบ X • ขาด Y • รวมประมาณ Z บาท"), `#opoList`
- empty `#opoEmpty` (🚗💥 "ยังไม่มีคู่กรณีในเคสนี้") + ปุ่ม (ro-hide) "+ เพิ่มคู่กรณี", "ไม่มีคู่กรณี / ชนสิ่งของ"
- ปุ่ม `#btnAddOpo` (sec, ro-hide, ซ่อนเริ่มต้น) "+ เพิ่มคู่กรณี (N/20)"
- แต่ละการ์ด: "คันที่ i" + badge KFK (ถ้าเข้าเกณฑ์) + ring (ขาด N / ครบ✓) + meta + ปุ่มแก้ไข/ลบ
- **`opoDel(i)`:** confirm → ลบ + **รีนัมเบอร์อัตโนมัติ** + อัปเดต `faultOpo`
- ปุ่ม "ไม่มีคู่กรณี" (`noOpo`) → s6='ok', opo=[]

> **การเพิ่มคู่กรณี = ฟอร์มเต็มทันที (ไม่มี quick-add 3 จังหวะ):** `opoQuickAdd()` จำกัดสูงสุด **20 คัน**, push `mkOpo({kind:'car'})`, ตั้ง s6='part', แล้วเปิด editor เต็มทันที

---

### 5.8 scr-s6edit — Editor คู่กรณีรายคัน

h2: **"คู่กรณีคันที่ i"** (`#opoEditH`) + sub `#opoEditSub`; back → s6; `ro-banner`. ฟอร์ม `#opoAcc` เรนเดอร์ด้วย JS เป็น accordion 5 ท่อน; ปุ่มท้าย "บันทึกคันนี้"

**A. เจ้าของ/รถ**
1. เจ้าของคู่กรณี [req ●] · 2. ที่อยู่เจ้าของรถ · 3. ทรัพย์สิน/รถคู่กรณี (default "รถคู่กรณี") · 4. ปีจดทะเบียนรถ — picker **ค.ศ. 1900–2026** (จงใจต่างจากที่อื่นที่เป็น พ.ศ.) + ประเภทรถ [req ●] (opoCType, OPO_CTYPES 7) · 5. ยี่ห้อ (opoBrandPick — **ต้องเลือกประเภทรถก่อน**) + รุ่น · 6. สีรถ (color) · 7. ทะเบียน [req ●] + จังหวัด [req ●] · 8. EV (opoEv 5: BEV/FCEV/HEV/MEV/PHEV) → โผล่ `oEvExtra`: เลขแบต + วันเริ่มใช้แบต + เลขชาร์จ · 9. VIN + หมายเลข กม. [req ●]

**B. ผู้ขับขี่** (แบบเดียวกับหมวด 3)
ปุ่มสแกน 🪪 บัตร (idcardOpo) / 🚗 ใบขับขี่ (licenseOpo); เพศ [req ●] + คำนำหน้า [req ●]; ชื่อ [req ●] + นามสกุล [req ●]; ความสัมพันธ์กับเจ้าของรถ [req ●]; วันเกิด พ.ศ. [req ●] (oBirth) + อายุ [req ●]; โทรศัพท์ [req ●]; ที่อยู่ปัจจุบัน [req ●]; collapsible "ใบขับขี่": เลขที่ใบขับขี่ [req ●] + ออกให้ที่, ประเภทใบขับขี่, วันออก/วันหมดอายุ, **เลขบัตรประชาชน [req ●] มี checksum ✓**

**C. ประกัน**
มีประกันภัยที่ [req ●] (opoInsurer — OPO_INSURERS 52 รวม "ไม่มีบริษัทประกันภัย"/"อื่นๆ"); ถ้ามีประกัน (≠ ไม่มี/อื่นๆ) → กรมธรรม์ [req ●] + เคลมที่ [req ●] + ประเภทประกัน [req ●]

**D. ความเสียหาย (แผนภาพ)**
label [req ●] "ความเสียหายรถคู่กรณี" + card `opoSvgHost` (**clone `#carSvg` → `#carSvgOpo`**, data แยกที่ `S.opo[i].dmg`) + ปุ่ม "+ เพิ่มชิ้นส่วน" + card รายการ `dmgCountOpo`/`dmgListOpo`

**E. ความเสียหายประมาณ + KFK**
ความเสียหายประมาณ (money bigmoney + "บาท"); ckrow "เข้าสัญญา KFK — Knock for Knock" default ติ๊กถ้า `o.ins ∈ KFK_INSURERS` (8 บริษัท), override ด้วย `o.kfk`

> **`mkOpo.miss()`:** car ต้องมี เจ้าของ/ประเภท/ทะเบียน/จังหวัด/กม./ชื่อ-สกุล/อายุ/วันเกิด/ที่อยู่/โทร/บัตร ปชช./ใบขับขี่/มีประกันภัยที่; ถ้ามีประกัน → กรมธรรม์+เคลม+ประเภท; รายการความเสียหาย ≥1. *(branch kind อื่นเป็น dead — UI push kind:'car' เสมอ)*

---

### 5.9 scr-review — ตรวจสอบ & ส่งรายงาน

h2: **"ตรวจสอบ & ส่งรายงาน"**; sub: **"แตะหัวข้อเพื่อกลับไปแก้"**; back → hub
- `#revList` (การ์ดสรุปรายการ JS); ปุ่ม "ส่งรายงาน" (ro-hide); note อธิบายการตรวจครบทุกข้อ + SLA
- **`submitReport()`:** เก็บ error ทั้งหมด (collectErrors รวม 6 หมวด + inj + asset + img reqs); ไม่มี error → toast "✓ ส่งรายงานแล้ว — เข้าคิว sync" + mark ทุกหมวด ok; มี error → เปิด `shErr` จัดกลุ่มตามหมวด — **นี่คือ gate จริงเดียว** (ระดับหมวดไม่ block; ปุ่ม "ถัดไป" ในหมวดเด้งไปหมวดถัดไปเสมอแม้ยังขาดฟิลด์)

---

## 6. หน้าแท็บอื่น (ไม่ใช่หมวดใน Hub)

### 6.1 ผู้บาดเจ็บ — scr-inj (list) / scr-inj-edit (editor)

**List:** h2 "ผู้บาดเจ็บ (N)" (`#injCountH`); sub "มีผู้บาดเจ็บ → ต้องกรอกข้อมูลตำรวจในหน้า 5 อัตโนมัติ"; empty `#injEmpty` (🤕) + ปุ่ม "+ เพิ่มผู้บาดเจ็บ", "ไม่มีผู้บาดเจ็บ ✓". การเพิ่ม (`injAdd`) prefill `carReg` จาก `#fCarReg` แล้วเปิด editor ทันที (ไม่จำกัดจำนวน). ปุ่ม "ไม่มีผู้บาดเจ็บ" → `[{none:true}]`

**Editor (`#injForm`) ตามลำดับ legacy:** ปุ่มสแกน 🪪 บัตร (idcardInj)
1. ประเภทผู้บาดเจ็บ [req ●] (personType — PERSON_TYPES 5) · 2. ความสัมพันธ์ของผู้บาดเจ็บ (relation) · 3. **ชื่อผู้บาดเจ็บ [req ●]** — seg เพศ ชาย/หญิง + ช่อง `iNm` แถวเดียว · 4. อายุ(ปี) · 5. **เลขบัตรประชาชน/บัตรคนต่างด้าว/หนังสือเดินทาง [req ●]** (`iCid` maxlength 20, **ไม่มี checksum** รับ passport) · 6. อาชีพ + **เลขทะเบียน [req ●]** · 7. ที่อยู่ (พิมพ์ + location) · 8. โทรศัพท์ (fmtTel) · 9. ทำงานที่ · 10. ตำแหน่ง · 11. รายได้ประจำเดือน/วันละ (money) · 12. **เข้ารักษาที่โรงพยาบาล [req ●]** (hospital — HOSPITALS เรียงตามระยะ GPS) · 13. เมื่อวันที่/ถึงวันที่ (ช่วงเข้ารักษา) · 14. ค่ารักษาพยาบาล (money + "บาท") · 15. **ลักษณะอาการบาดเจ็บ** = chips 6 ระดับ (WOUNDS: เล็กน้อยเขียว/ปานกลางเหลือง/สาหัสส้ม/ทุพพลภาพแดง/เสียชีวิตก่อนรักษาดำ/เสียชีวิตหลังรักษาเทาเข้ม) — เคสหนัก(เสียชีวิต*/สาหัส) → toast "⚠ เคสหนัก — ต้องกรอกข้อมูลตำรวจ(หน้า5) และควรแจ้งศูนย์ทันที" · 16. **อาการบาดเจ็บ [req ●]** (textarea)

> **`mkInj.miss()`:** ประเภท, ชื่อ, เลขบัตร, เลขทะเบียน, โรงพยาบาล, อาการบาดเจ็บ

### 6.2 ทรัพย์สินเสียหาย — scr-asset (list) / scr-asset-edit (editor)

**List:** h2 "ทรัพย์สินเสียหาย (N)" (`#assetCountH`); sub "ทรัพย์สินบุคคลภายนอกที่เสียหายจากเหตุครั้งนี้"; empty `#assetEmpty` (🏚) + ปุ่ม "+ เพิ่มทรัพย์สิน", "ไม่มีทรัพย์สินเสียหาย ✓". `assetAdd` เปิด editor ทันที (ไม่จำกัด)

**Editor (`#assetForm`) ตามลำดับ:**
1. **รายการทรัพย์สิน [req ●]** (`aItem`) · 2. **สาเหตุที่ทรัพย์สินเสียหาย [req ●]** (textarea) · 3. **รายละเอียด/ลักษณะความเสียหาย [req ●]** (textarea) · 4. ค่าความเสียหายประมาณ (money + "บาท") · 5. **ชื่อเจ้าของทรัพย์สิน [req ●]** (`aOwner`) · 6. ที่อยู่ปัจจุบัน (พิมพ์ + location) · 7. โทรศัพท์ที่ติดต่อได้ (fmtTel)

> **`mkAsset.miss()`:** รายการทรัพย์สิน, สาเหตุ, รายละเอียด, ชื่อเจ้าของ (ค่าเสียหาย/ที่อยู่/โทร ไม่บังคับ)

### 6.3 รูปภาพ — scr-img (gallery)

h2 "รูปภาพ" (`#imgCountH`); sub "ถ่ายเข้าเคสโดยตรง — ตั้งชื่อ/จัดหมวดอัตโนมัติ"
- การ์ด collapsible "📋 เงื่อนไขจำนวนรูปภาพ" (`#imgReqList`) — แต่ละแถว ✓/⚠ + หมวด + เหตุผล + have/min. **min dynamic:** รถประกัน 8; รถคู่กรณี 6 (0 ถ้าไม่มีคู่กรณี); ทรัพย์สิน 3 (0 ถ้าไม่มี); ผู้บาดเจ็บ **2×จำนวนผู้บาดเจ็บ**; เอกสาร 2; แผนที่ 1 — **filter `min>0`** (แถว min=0 ถูกซ่อน ปรากฏ/หายตามข้อมูลจริง)
- filter chips `#imgFilterChips` = ["ทั้งหมด"] + 6 หมวด (IMG_CATS) แต่ละ chip มี count
- ปุ่ม (ro-hide): "📷 ถ่ายรูป", "☑ เลือก" (`#btnImgSel`)
- **ถ่ายรูป:** ocrShoot mode=photo — หมวด default = filter ปัจจุบัน ถ้า filter="ทั้งหมด" → default "รถประกัน"; auto-ตั้งชื่อ (prefix ป/ค/ท/บ/อก/ผ + running) + แนบเวลา
- กริดรูป `#imgGrid`; แถบเลือก `#imgSelBar`: "เลือก N รูป" + ปุ่ม ทั้งหมด / ย้ายหมวด / ลบ
- แตะรูป (ไม่ใช่โหมดเลือก) → viewer `shImg` (เปลี่ยนชื่อ / ย้ายหมวด / ลบ)
- mock `PHOTO_MOCK` ~34 รูป (รถประกัน 18 / คู่กรณี 8 / ทรัพย์สิน 3 / ผู้บาดเจ็บ 2 / เอกสาร 2 / แผนที่ 1)

### 6.4 ค่าใช้จ่าย — scr-ph (placeholder)

h2 "ค่าใช้จ่าย"; sub "นอกขอบเขต prototype นี้"; back → hub (**ไม่มี ro-banner**); empty (🚧) "หน้าค่าใช้จ่ายใช้โครงเดียวกัน: รายการการ์ด + เพิ่มรายการ + แนบใบเสร็จจากกล้อง"

---

## 7. Bottom Sheets (10 ตัว) + OCR overlay

ทุก sheet มีโครง `.grab` + `.sh-h` (ปุ่ม ✕ = closeSheets + ชื่อ) + `.sh-b`

| Sheet | บทบาท |
|---|---|
| `shPick` | Generic searchable picker (config `PICKERS` ~20 kinds); กลุ่ม "ใช้บ่อย⭐", swatch(สี), multi(lossType), loc(drill-down) |
| `shDate` | Date/time พ.ศ. (ช่องพิมพ์ วว/ดด/ปปปป + เวลา); chips ⏱ตอนนี้/วันนี้/เมื่อวาน (ซ่อนสำหรับ birth/drvStart/drvEnd/oBirth); regex `^\d{1,2}/\d{1,2}/2[45]\d{2}$`; side-effect: คำนวณอายุ, chkPolicyRange, chkDrvExpiry |
| `shDmg` | Damage part: ชื่อชิ้น, custom name (req), seg ข้าง (ซ้าย/ขวา/ทั้งหมด), segLvl (L/M/H/X), ปุ่มลบ + บันทึก |
| `shTL` | Timeline edit: วันที่ + เวลา + **เหตุผลแก้ย้อนหลัง [req ● audit]** + บันทึก |
| `shCancel` | Cancel report (หัวแดง): textarea เหตุผล (maxlen 3000, ขั้นต่ำ 5 ตัว) + counter; ปุ่มยืนยัน disabled จน ≥5 ตัว + confirm() ซ้ำ |
| `shErr` | Error summary (หัวแดง): "พบ N รายการที่ต้องแก้" + แถว `.err-row` "แตะเพื่อไปยังจุดแก้ไข" จัดกลุ่มตามหมวด |
| `shMenu` | Overflow: ➕ เปิดเคลมเพิ่ม / 🗑 ยกเลิกรายงาน(แดง) / 🌙 Dark mode / 🕓 ประวัติการแก้ไข |
| `shCreateMore` | Create-more claim: เลขรับแจ้งใหม่ [req ●] + กรมธรรม์ [req ●] + ตกลง |
| `shImg` | Image viewer: emoji ตามหมวด, ชื่อรูป (onblur rename), ย้ายหมวด (picker imgType), meta EXIF, ปุ่ม 🗑 ลบ (ro-hide) |
| `shWs` | Web Service diff: "☁️ ดึงข้อมูลจาก[บริษัท]", 7 ฟิลด์ diff, ปุ่ม ✓ยืนยันเติมลงฟอร์ม — **ทำงานเฉพาะ `S.insurer.ws=true` (ทิพยฯ/TMITH)** ไม่งั้น toast ปฏิเสธ |

**OCR overlay (`#ocr`)** — แยกจาก sheet: fullscreen camera + shutter/cancel; mode: plate / idcard / idcardOpo / license / licenseOpo / vin / photo / idcardInj

---

## 8. แผนภาพความเสียหาย (Damage Diagram)

**ระดับ L/M/H/X:** ต้องเลือกก่อนบันทึก ไม่งั้น toast "⚠ เลือกระดับ L/M/H/X ก่อน"

**ข้าง ซ้าย/ขวา/ทั้งหมด:** SIDE_CODE ซ้าย→L, ขวา→R, ทั้งหมด→A. **SIDE_BASES 9 ชิ้นมีคู่ซ้าย/ขวา:** ไฟหน้า, ไฟท้าย, บังโคลนหน้า, บังโคลนหลัง, ประตูหน้า, ประตูหลัง, กระจกมองข้าง, ล้อ/ยางหน้า, ล้อ/ยางหลัง
- แตะฝั่งที่ระบุจากรูป → default `segSide` = ข้างนั้น; แตะ base กลาง → `__none__`
- **Custom** (openDmgCustom) → ไม่มี default ข้าง + **บังคับเลือกข้างก่อนบันทึก**

**`saveEntry(p,side)` (กัน overlap):** เลือก A → ลบ entry L/R ของชิ้นเดิม; เลือก L/R → ลบ entry A ของชิ้นเดิม; มี entry เดิม → อัปเดต lv, ไม่งั้น push ใหม่; ชิ้นไม่มีข้าง → `saveEntry(t.p, null)`

**ป้ายในรายการ:** badge ระดับ (สีตามระดับ) + ชื่อชิ้น + badge ข้าง `.sideb` แสดง **L / R / A** + ปุ่มลบ ✕ (ro-hide); repaintSvg เคลียร์คลาส L/M/H/X แล้วระบายใหม่

**Clone ไปคู่กรณี:** `dmgList(kind)` → opo ใช้ `S.opo[i].dmg` (แยกแต่ละคัน), else `S.dmg`; SVG แยก id `carSvg` / `carSvgOpo`; opoEdit clone `#carSvg` → `#carSvgOpo`; event delegation ตัดสิน kind จาก id ของ svg parent

---

## 9. Validation System (3 ชั้น)

### ชั้น 1: ฟิลด์ (inline / on blur / real-time)
- **CID checksum** (`cidValid` mod 11): ครบ 13 หลัก → ตรวจ; ผ่าน ✓, ไม่ผ่าน add คลาส err + แสดง `.ferr` — **ใช้กับผู้ขับ (fCid) และคู่กรณี (oCid); ผู้บาดเจ็บ (iCid) ไม่มี checksum**
- โทรศัพท์ fmtTel (xxx-xxx-xxxx); เงิน fmtMoney (คั่นหลักพัน)
- **Warning (ไม่ block ส่ง):** ช่วงกรมธรรม์ `polRangeErr`, ใบขับขี่หมดอายุ `drvExpWarn`, เลข กม.น้อยกว่าเดิม `kmWarn`, GPS ไกล `gpsWarn`, toast เคสหนัก
- **Error (block ส่ง):** `payErr` (รับเงินเกินยอด) แม้แสดง inline แต่เข้า collectErrors

### ชั้น 2: การ์ด Hub (สถานะรายหมวด)
- `secStatus(k)`: ยังไม่เริ่ม(none) / ครบ✓(ok) / ขาด N รายการ(part) จาก `secMissing` (REQ engine)
- `policeNeeded()`: fault="รอสรุปผลคดี" หรือมีผู้บาดเจ็บ → หมวดตำรวจกลายเป็นจำเป็น (dynamic)
- progress bar "ครบ N/6 หมวด" (total=6 คงที่); *(bottom bar ในโค้ดบางจุดยังเขียน "N/8" — ให้ถือ 6 หมวดเป็นค่าจริงตาม SECDEF)*
- **`doneSection(k)` ไม่บล็อก:** ปุ่ม "ถัดไป" ตั้งสถานะ part/ok แล้วเด้งไปหมวดถัดไปเสมอ (order s1→s6) หรือ Hub

### ชั้น 3: Error summary sheet + fix-next
- `submitReport` → collectErrors (6 หมวด + inj + asset + img reqs); ไม่มี error → ส่งได้; มี → เปิด `shErr`
- fixbar (`#fixbar`): "แก้แล้ว X/N" + "ปัญหาถัดไป →"; `gotoErr(i)` ปิด sheet → ไปหน้า → scroll + flash + focus, mark row fixed
- **fix-next ไม่ auto-validate:** "fixed" = "ไปดูแล้ว" ไม่ใช่ "แก้เสร็จ"; ต้องกด "ตรวจสอบ & ส่ง" ใหม่เพื่อ re-validate

---

## 10. Master Data (จำนวนสมาชิก + legacy/ย่อ)

| ตัวแปร | จำนวน | สถานะ |
|---|---|---|
| `INSURERS` (บริษัทประกันหลัก + mask + ex + ws/risk/fav) | **15** | ย่อจาก legacy (มี mask regex, ตัวอย่างเลขเคลม, flag) |
| `KFK_INSURERS` | **8** | ชื่อเต็มบริษัท (มหาชน) — ใช้ default KFK checkbox |
| `OPO_INSURERS` | **52** | legacy เต็ม (รวม "ไม่มีบริษัทประกันภัย" + "อื่นๆ") |
| `OPO_CTYPES` | **7** | เก๋งเอเชีย/เก๋งยุโรป/จักรยานยนต์/รถอื่นๆ/กระบะ/รถตู้/รถบรรทุก |
| `MC_BRANDS` | **85** | ยี่ห้อมอเตอร์ไซค์ (legacy เต็ม) |
| `OPO_EV` | **5** | BEV/FCEV/HEV/MEV/PHEV |
| `PROVINCES` | **81** | legacy (รวม "เบตง", "บึงกาฬ", "อื่นๆ") |
| `LOCS` | 4 จังหวัด | mock เฉพาะโซน (ชลบุรี/กทม./สมุทรปราการ/ร้อยเอ็ด) |
| `CTYPES` (มี emoji) | **7** | เก๋ง🚗 กระบะ🛻 จักรยานยนต์🏍 รถตู้🚐 รถบรรทุก🚚 เก๋งยุโรป🚙 อื่นๆ🚜 |
| `BRANDS` (map ต่อประเภท) | 7 keys | เก๋ง13/กระบะ8/จยย.=MC_BRANDS/รถตู้4/รถบรรทุก6/เก๋งยุโรป7/อื่นๆ1 |
| `COLORS` | **55** | legacy (รวมสีคู่/หลายสี/UNDEFINE) |
| `CLR_HEX` | 18 keys | map สี→hex (ย่อ) |
| `RELATIONS` | **40** | legacy (มี 'พนักงานผู้เช่า' ซ้ำ) |
| `LIC_TYPES` | **21** | legacy |
| `CAUSES` | **79** | legacy เต็ม |
| `LOSS_TYPES` | **21** | legacy |
| `FAULTS` | **7** | รถประกันผิด/ถูกและผิด/คู่กรณีผิด/ประมาทร่วม/รอสรุปผลคดี/ยกเลิกการเคลม/ไปถึงแล้วไม่พบ |
| `OPO_CLAIMS` | **5** | คัดประจำวัน/รับหลักฐาน/บันทึกยอมรับผิด/บัตรติดต่อ/รับเงินจำนวน |
| `STATIONS` | **9** | mock (รวม "ล่าสุดที่ใช้" ⭐ + "อื่นๆ") |
| `POL_TYPES` | **7** | ชั้น1/2+/2/3+/3/พรบ./ไม่พบความคุ้มครอง |
| `FLU_ST` | **3** | ไม่มีการนัดหมาย/รอการนัดหมาย/มีการนัดหมาย |
| `TMPL` | 3 keys | เทมเพลตบรรยายเหตุ |
| `PERSON_TYPES` | **5** | ผู้ขับ/ผู้โดยสาร รถประกัน/คู่กรณี + บุคคลภายนอกรถ |
| `WOUNDS` (มีสี) | **6** | เล็กน้อย→เสียชีวิตหลังรักษา |
| `HOSPITALS` | **7** | mock ชลบุรี (+ "ยังไม่เข้ารักษา" + "อื่นๆ") |
| `IMG_CATS` | **6** | รถประกัน/คู่กรณี/ทรัพย์สิน/ผู้บาดเจ็บ/เอกสาร/แผนที่ (มี emoji+gradient) |

**สรุป:** legacy เต็ม = OPO_INSURERS, CAUSES, LOSS_TYPES, LIC_TYPES, RELATIONS, MC_BRANDS, COLORS, PROVINCES · ย่อ/mock = INSURERS(หลัก), STATIONS/HOSPITALS/LOCS(โซนชลบุรี), CLR_HEX

---

## 11. Insurer Profile Engine

**ล็อกเป็น "ไอโออิกรุงเทพประกันภัย" ตายตัว** (แนวคิด "บริษัทถูกกำหนดจากงานที่ dispatch มา"):
- `init()`: `setInsurer('ไอโออิกรุงเทพประกันภัย')` — ล็อกตามงาน
- UI `piInsurer` ล็อก มี 🔒 + toast "เปลี่ยนไม่ได้" (ไม่มี sheet เลือกบริษัท)
- ไอโออิ: `mask:/^\d{13}$/, ex:'2026013144960', ws:false, risk:false, fav:true`

**`setInsurer()`:** หา object จาก INSURERS → เก็บใน `S.insurer` → เขียนชื่อลง piInsurer + badge bInsurer (ตัดคำแรก) → โชว์/ซ่อนปุ่ม WS ตาม `ws` → toggle req ของ "รหัสภัย" (`lblRisk`) ตาม `risk` → เรียก `valClaimNo()`

**ผลของโปรไฟล์ (ขับเคลื่อนด้วย flag 2 ตัว):**
- `risk:true` → บังคับ "รหัสภัยยานยนต์" (s1)
- `ws:true` → โชว์ปุ่ม WS + shWs ทำงาน
- `mask` → validate เลขเคลม real-time (ตรง → ✓, ไม่ตรง → error พร้อมตัวอย่าง `ex`)

> INSURERS ทั้งชุด + logic risk/ws พร้อมทำงาน แต่ปัจจุบันเข้าถึงได้แค่ไอโออิเพราะล็อกที่ init + UI ไม่มีทางเลือกเปลี่ยน (flag ของบริษัทอื่นเป็น dead จนกว่าจะปลดล็อก)

---

## 12. State / Offline / Autosave

**State object `S`** ประกาศครั้งแรก (หลัก):
`insurer, claimType, prb, sections{s1..s6:'none'}, pick{}, dates{}, tl[HH:MM,HH:MM,null,null], tlStamp[], dmg[], opo[], fault, faultOpo, opoClaims{}, viewonly, offline, fluNo, editingOpo, errList, fixedCnt, dmgTarget/dateTarget/tlTarget/pickTarget`

**Bolt-on ภายหลัง** (ประกาศแยก): `S.inj=[]; S.asset=[]; S.photos=PHOTO_MOCK(); S.imgFilter='ทั้งหมด'; S.imgSel; S.imgView; S.editingInj; S.editingAsset`
- `inj`/`asset` marker "ไม่มี" = `[{none:true,...}]`

**Autosave:** ทุก input เขียน localStorage ทันที (debounce), แต่ละคู่กรณี/ผู้บาดเจ็บ/ทรัพย์สินเป็น record แยก; indicator "✓ บันทึกแล้ว HH:MM"; dev bar toggle 📶 Offline จำลอง

**SLA:** `tickSLA` ทำงานเฉพาะ claimType="เคลมสด"; mock `SLA_START = NOW()-19.1h` เพื่อโชว์เหลือ ~4.9 ชม. (สีเหลือง) — ไม่ใช่ค่าจริง

---

## 13. หมายเหตุขอบเขต & สิ่งที่เป็น mock

- **6 หมวด** (ไม่ใช่ 8); ไม่มีหน้า scr-s7/scr-s8; ตำรวจ + การติดตามงาน อยู่ท้ายหมวด 5 (การติดตามงานฝังใน `#policeSet`)
- **ถอดออกแล้ว:** ฟีเจอร์ "รถหาย", toggle "ซ่อม/เปลี่ยน", "quick-add คู่กรณี 3 จังหวะ"
- **ค่า hardcode ในมาร์กอัป:** piInsurer (ไอโออิ), fAccSurv ("SV104 สมชาย สำรวจดี"), case-id (SV-2569-04512), badge insurer มาร์กอัป (ทิพยประกันภัย, ถูก sync ทีหลัง), timeline prefill 18:49
- **Mock/simulation:** OCR (fullscreen mock ไม่ใช่กล้องจริง), GPS/reverse geocode, web service diff (7 ฟิลด์), SLA countdown, PHOTO_MOCK ~34 รูป, LOCS/STATIONS/HOSPITALS เฉพาะโซนชลบุรี
- **Dead branch (มีในโค้ดแต่ไม่ทำงานปัจจุบัน):** SECDEF.opt/cond, secVisible conditional-hide, mkOpo.miss() branch ทรัพย์สินคู่กรณี (kind≠car), flag risk/ws ของบริษัทอื่นนอกไอโออิ
- **หน้า scr-ph (ค่าใช้จ่าย):** placeholder นอกขอบเขต prototype

---

## Changelog

**Sync to Prototype v1.43** — เขียนสเปคใหม่ทั้งไฟล์ให้ตรง prototype จริง:
- ลด 8 หมวด → **6 หมวด**; ลบหน้า/หมวด 7 (ตำรวจ) และ 8 (นัดหมาย) — ย้ายไปท้ายหมวด 5
- ลบฟีเจอร์ "รถหาย", toggle "ซ่อม/เปลี่ยน", "quick-add 3 จังหวะ" (คู่กรณีเปิดฟอร์มเต็มทันที)
- หมวด 4 เปลี่ยนชื่อเป็น "ความเสียหาย" (ตัด "& อู่"); เพิ่มรายละเอียดแผนภาพรถ SVG 21 ชิ้น + ตัวเลือกข้าง L/R/A ใช้ร่วมรถประกัน/คู่กรณี (SVG clone, data แยก)
- ระบุ Master Data ครบทุกชุด (legacy vs ย่อ), Insurer Profile ล็อกไอโออิ, State/Offline, Bottom Sheets 10 ตัว + OCR overlay
- แยก validation warning (ไม่ block) vs error (block: payErr) ให้ชัด; ระบุ CID checksum ใช้กับผู้ขับ/คู่กรณี ไม่ใช่ผู้บาดเจ็บ
