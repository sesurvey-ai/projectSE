# -*- coding: utf-8 -*-
# อ่าน เบอร์หัวหน้า.xlsx → _supervisors.json  (ข้ามค่าที่ไม่ใช่เบอร์ เช่น "ยกเลิก"/"คืนแล้ว")
import openpyxl, json

SRC = r"C:\Users\i9\Downloads\เบอร์หัวหน้า.xlsx"
OUT = r"C:\Users\i9\Desktop\se-survey\_supervisors.json"

def is_phone(v):
    if v is None:
        return False
    digits = "".join(ch for ch in str(v) if ch.isdigit())
    return len(digits) >= 8

wb = openpyxl.load_workbook(SRC, data_only=True)
ws = wb["Sheet1"]
rows = list(ws.iter_rows(values_only=True))
# header row 0 = [เบอร์ส่วนตัว, เบอร์ออฟฟิศ, ชื่อ]
sups = []
for r in rows[1:]:
    r = (list(r) + [None, None, None])[:3]
    personal, office, name = r[0], r[1], r[2]
    if not name or not str(name).strip():
        continue
    numbers = []
    if is_phone(personal):
        numbers.append({"number": str(personal).strip(), "label": "ส่วนตัว"})
    if is_phone(office):
        numbers.append({"number": str(office).strip(), "label": "ออฟฟิศ"})
    sups.append({"name": str(name).strip(), "numbers": numbers})

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(sups, f, ensure_ascii=False, indent=1)
print("wrote %d supervisors, %d numbers -> _supervisors.json" %
      (len(sups), sum(len(s["numbers"]) for s in sups)))
