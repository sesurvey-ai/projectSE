# Roster Tooling — เครื่องมืออัปเดตตารางเวร (ใช้ซ้ำได้)

สคริปต์ชุดนี้คือ pipeline สำหรับนำ **ตารางเวร SE-AIOI จากไฟล์ Excel รายเดือน** เข้าสู่ระบบ
(ไฟล์ seed `web/src/app/duty-demo2/roster-jun.ts` และตาราง DB `duty_schedules`)

> ⚠️ สคริปต์เหล่านี้เป็น **เครื่องมือเฉพาะเครื่อง** — hardcode path แบบ absolute (`C:\Users\i9\...`)
> และอ้างไฟล์ Excel ใน `~/Downloads` + ไฟล์ mapping จากโปรเจกต์พี่น้อง `se-dashboard`
> ถ้าย้ายเครื่อง/ผู้ใช้ ต้องแก้ path ในหัวไฟล์ก่อน

---

## ภาพรวม flow

```
ไฟล์ Excel (.xls/.xlsx ใน ~/Downloads)
        │  _extract3.py  (ปัจจุบัน, .xlsx)  /  _extract2.py (เก่า, .xls)
        ▼
web/src/app/duty-demo2/roster-jun.ts        ← seed / source of truth (generated — อย่าแก้มือ)
        │  _update_roster_db.js  (dry-run → apply)
        ▼
DB: duty_schedules(center_id, year=2026, month=6)   ← ที่บอร์ดเข้างานอ่านจริง
```

ขั้นตอนเสริม: `_reconcile_names.js` (เกลาชื่อให้ตรง mapping) และ `_create_surveyor_users.js`
(สร้างบัญชีพนักงานจาก roster) จับคู่กันด้วย **รหัส SE (เฉพาะตัวเลข)**

---

## สคริปต์ (6 ตัวที่เก็บไว้)

### Python — แปลง Excel → roster-jun.ts (รันที่ repo root)

| ไฟล์ | หน้าที่ | หมายเหตุ |
|---|---|---|
| `_extract3.py` | **ตัวปัจจุบัน** — อ่าน `.xlsx` (openpyxl) → `roster-jun.ts` | เข้ารหัสนิยาม FIX v1.7.0: FIX7→**fix8** (08-17), FIX11→**fix10** (10-19), **fix14** (14-23) คงเดิม |
| `_extract2.py` | ตัวเก่า — อ่าน `.xls` (xlrd) → `roster-jun.ts` | ⚠️ ยังออก key เก่า `fix7`/`fix11` — ใช้เฉพาะเมื่อไฟล์เป็น `.xls` แล้วต้องเกลา FIX เองทีหลัง |
| `_compare_roster.py` | diff อ่านอย่างเดียว: เทียบ `.xls` กับ `roster-jun.ts` รายเซลล์ (คน/ชื่อ/กะ) | **ไม่เขียนไฟล์ใด ๆ** — ใช้ตรวจก่อน sync |

รองรับชีท `แก้ไข<ศูนย์>` (ทับรายวัน + เปลี่ยนตัวคน), footer ชื่อเต็ม, คอลัมน์/แถวซ้ำ

### Node — sync เข้า DB + เกลาชื่อ + สร้างบัญชี (รันใน `backend/` เพราะ dotenv โหลด `backend/.env`)

| ไฟล์ | คำสั่ง | หน้าที่ |
|---|---|---|
| `_update_roster_db.js` | `node _update_roster_db.js` (dry-run) → `node _update_roster_db.js apply` | sync `roster-jun.ts` → `duty_schedules(2026/6)` + merge ชื่อเต็มจาก DB กลับเข้า seed |
| `_reconcile_names.js` | `node _reconcile_names.js` → `... apply` | เกลา **ทุกชื่อ** ให้ตรง `mapping_supervisor_staff_.json` (จับด้วยรหัส SE) แก้ทั้ง DB + seed |
| `_create_surveyor_users.js` | `node _create_surveyor_users.js` → `... apply` | สร้าง/อัปเดตบัญชีพนักงานจาก roster: `username=se<เลข>`, `code=SE<เลข>` |

---

## กติกาความปลอดภัย

1. **dry-run ก่อนเสมอ** — รันแบบไม่ใส่ arg เพื่อดู diff ก่อน แล้วค่อยใส่ `apply` เขียนจริง
2. **`apply` เขียน 2 ที่พร้อมกัน** (DB + `roster-jun.ts`) — ตรวจ diff ให้ชัวร์ก่อน
3. **`roster-jun.ts` เป็นไฟล์ generated** (`อย่าแก้มือ`) — แก้ชื่อให้ใช้ `_reconcile_names.js` ไม่ใช่แก้มือ
4. **ขึ้นเดือนใหม่** อย่าลืม sync `duty_schedules` ของเดือนนั้น (ปี/เดือนใน `_update_roster_db.js`)
5. ดู [memory: roster-xls-update-flow] ประกอบ

## Dependencies

- Python: `xlrd` (สำหรับ `.xls`), `openpyxl` (สำหรับ `.xlsx`)
- Node: `dotenv`, `pg` (มีใน `backend/` แล้ว) + `backend/.env` ที่มี `DATABASE_URL` ชี้ Supabase pooler
- ไฟล์ภายนอก: Excel ต้นทางใน `~/Downloads`, mapping ชื่อจาก `se-dashboard/mapping_supervisor_staff_.json`
