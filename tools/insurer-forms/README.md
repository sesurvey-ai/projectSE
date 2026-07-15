# insurer-forms — เทียบข้อมูล se-survey กับฟอร์มพอร์ทัลประกัน (e-Survey)

เครื่องมือ QA สำหรับ **เติมข้อมูลจาก se-survey ลงไฟล์ HTML จริงของพอร์ทัลประกัน** (หน้า
"กรอกรายละเอียดอุบัติเหตุ" / "ทรัพย์สิน" / "ผู้บาดเจ็บ") แล้วเปิดดูเทียบ 1:1 ว่าแต่ละฟิลด์
ของแอปตกลงช่องถูกต้องไหม — ใช้ตาราง lookup ชื่อ→รหัสชุดเดียวกับ `backend/src/services/xmlExport.service.ts`

## ใช้ยังไง

```bash
npm install cheerio          # ครั้งแรกครั้งเดียว
# ใช้ fixture ตัวอย่าง (เคส 21BR10AVD-6906-000098):
FORMS_DIR="C:\path\to\21BR10AVD-6906-000098" node fill-forms.js

# หรือใช้ข้อมูลเคสจริง — dump report ก่อน:
#   GET /api/cases/<id>/detail  →  เซฟ data.report เป็น report.json
REPORT_JSON="C:\path\to\report.json" FORMS_DIR="C:\path\to\forms" node fill-forms.js
```

ได้ไฟล์ `_filled_*.html` ข้างต้นฉบับ → เปิดในเบราว์เซอร์เทียบกับของประกัน

## ขอบเขต / ข้อจำกัด

- ครอบคลุมฟิลด์หลักของทั้ง 3 หน้า (text/dropdown-รหัส/radio/calendar/repeater)
- **repeater** (ทรัพย์สิน/ผู้บาดเจ็บ) เติมเท่าจำนวนแถว (`dtlAsset$ctlNN`/`dtlInj$ctlNN`) ที่มีในไฟล์
  ต้นฉบับ — ถ้าเคสมีรายการมากกว่าแถวในไฟล์ ส่วนเกินจะไม่ถูกเติม
- **เขต/อำเภอ** ปล่อยว่าง (พอร์ทัลใช้รหัส 4 หลัก cascade — ยังไม่มีตารางครบ ดู xmlExport.service.ts)
- ตาราง lookup ในไฟล์นี้เป็นชุดย่อ (จังหวัด/สี/ความสัมพันธ์ที่พบบ่อย) — เพิ่มได้ตามต้องการ
