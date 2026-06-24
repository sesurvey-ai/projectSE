# -*- coding: utf-8 -*-
# Extract ตารางเวร กทม จากไฟล์ Excel จริง → roster-jun.ts
# รองรับ: ชีท "แก้ไข<ศูนย์>" (ทับรายวัน + เปลี่ยนตัวคน), FIX รูปแบบใหม่ "FIX เวร 1 07.00-16.00",
#          แถว footer ที่เลขวันซ้ำ (ค่าเดินทาง), คอลัมน์คนซ้ำ (รหัสเดียวกัน 2 คอลัมน์)
import re, json, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import xlrd

SRC = r"C:\Users\i9\Downloads\1.1ตารางเวร กทม เดือน มิ.ย. 2026ล่าสุด(1).xls"
OUT = r"C:\Users\i9\Desktop\se-survey\web\src\app\duty-demo2\roster-jun.ts"

SHEET_TO_ID = {
    'ลาดพร้าว': 'ladprao', 'รามอินทรา': 'raminthra', 'อ่อนนุช': 'onnut', 'บางแค': 'bangkhae',
    'มีนบุรี': 'minburi', 'ปทุมธานี': 'pathum', 'พระราม 9': 'rama9', 'พระราม9': 'rama9',
    'บางนา': 'bangna', 'ปากเกร็ด': 'pakkret', 'นนทบุรี': 'nonthaburi', 'นนทุบรี': 'nonthaburi',
    'สาทร': 'sathon', 'พระราม 2': 'rama2', 'พระราม2': 'rama2', 'สมุทรปราการ': 'samutprakan', 'บางพลัด': 'bangphlat',
}

def norm(v):
    return re.sub(r'\s+', ' ', str(v)).strip()

def is_day(v):
    try:
        return 1 <= int(float(v)) <= 31 and str(v).strip() != ''
    except (ValueError, TypeError):
        return False

def map_shift(s):
    s = norm(s)
    if not s:
        return 'none'
    if 'หยุด' in s:
        return 'off'
    if 'ยังไม่' in s or 'ย้าย' in s or 'อบรม' in s or s == 'ลา':
        return 'none'
    # FIX — เช็คก่อนเวรปกติ (รูปแบบใหม่เขียน "FIX เวร 1 07.00-16.00" / "FIX เวร 2.1 11.00-20.00")
    if re.search(r'fix', s, re.I):
        if '11.00' in s and '20.00' in s:
            return 'fix11'
        if '14.00' in s and '23.00' in s:
            return 'fix14'
        if '07.00' in s and '16.00' in s:
            return 'fix7'
        m = re.search(r'FIX\s*0*(\d+)', s, re.I)          # รูปแบบเก่า: FIX 7 / FIX 11 / FIX 14
        if m and m.group(1) in ('7', '07', '11', '14'):
            return {'7': 'fix7', '07': 'fix7', '11': 'fix11', '14': 'fix14'}[m.group(1)]
        if 'เวร 2.1' in s or 'เวร2.1' in s:                # label ใหม่ไม่มีเวลา
            return 'fix11'
        if 'เวร 2.2' in s or 'เวร2.2' in s:
            return 'fix14'
        if 'เวร 1' in s or 'เวร1' in s:
            return 'fix7'
        return 'none'
    if 'เวร' in s:
        if 'ดึก' in s or 'เวร 3' in s or 'เวร3' in s:
            return 's3'
        if 'เวร 1' in s or 'เวร1' in s:
            return 's1'
        if 'เวร 2' in s or 'เวร2' in s:
            return 's2'
    # เวลาล้วน (ไม่มี label เวร/FIX)
    if '11.00' in s and '20.00' in s:
        return 'fix11'
    if '14.00' in s and '23.00' in s:
        return 'fix14'   # เวลาล้วน 14-23 = FIX14 (บางนา)
    if '07.00' in s and '16.00' in s:
        return 's1'
    if '15.00' in s:
        return 's2'
    if '23.00' in s and '08.00' in s:
        return 's3'
    return 'none'

def parse_code(s):
    m = re.search(r'SE\s*0*(\d+)', s)
    return ('SE ' + m.group(1)) if m else ''

def clean_name(s):
    s = re.sub(r'SE\s*0*\d+', '', s)              # ลบรหัส SE
    s = re.sub(r'เวร\s*FIX|\bFIX\b|\bfix\b', '', s)  # ลบ annotation "เวร FIX" / "fix"
    s = re.sub(r'^(นางสาว|น\.ส\.|นาย|นาง)\s*', '', s.strip())  # ลบคำนำหน้า
    return re.sub(r'\s+', ' ', s).strip()

def parse_sheet(sh):
    """อ่าน 1 ชีท → {people:[{code,name}], byday:{day:{code:shift}}, fullname:{code:name}} หรือ None"""
    day_rows = [r for r in range(sh.nrows) if is_day(sh.cell_value(r, 0))]
    if not day_rows:
        return None
    first_day_row = day_rows[0]
    # header row = แถวที่มีรหัส SE มากสุด ก่อนถึงแถววันแรก
    hdr_row, best_n = 1, -1
    for r in range(0, first_day_row):
        n = sum(1 for c in range(2, sh.ncols) if parse_code(norm(sh.cell_value(r, c))))
        if n > best_n:
            best_n, hdr_row = n, r
    people, cols = [], []   # people: ไม่ซ้ำรหัส (คอลัมน์ซ้ำจะ merge ค่าแบบ non-none ชนะ)
    seen_codes = set()
    for c in range(2, sh.ncols):
        raw = norm(sh.cell_value(hdr_row, c))
        code = parse_code(raw)
        if not code:
            continue
        if code not in seen_codes:
            seen_codes.add(code)
            people.append({'code': code, 'name': clean_name(raw)})
        cols.append((c, code))
    # ตารางเวรรายวัน — เลขวันซ้ำ (แถว footer ค่าเดินทาง) เอาครั้งแรกเท่านั้น
    byday = {}
    for r in day_rows:
        d = int(float(sh.cell_value(r, 0)))
        if d in byday:
            continue
        row = {}
        for c, code in cols:
            v = map_shift(sh.cell_value(r, c))
            if code not in row or (row[code] == 'none' and v != 'none'):
                row[code] = v
        byday[d] = row
    # ชื่อเต็มจาก footer (code -> ชื่อเต็ม)
    last_day_row = day_rows[-1]
    fullname = {}
    for r in range(last_day_row + 1, sh.nrows):
        rc = [norm(sh.cell_value(r, c)) for c in range(sh.ncols)]
        for i, cell in enumerate(rc):
            if re.fullmatch(r'SE\s*0*\d+', cell):
                code = parse_code(cell)
                for j in range(i + 1, len(rc)):
                    if rc[j]:
                        if re.search(r'[ก-๙]', rc[j]) and 'SE' not in rc[j]:
                            fullname[code] = clean_name(rc[j])
                        break
    return {'people': people, 'byday': byday, 'fullname': fullname}

wb = xlrd.open_workbook(SRC)
base, fixes = {}, {}
for sh in wb.sheets():
    nm = sh.name.strip()
    if nm.startswith('แก้ไข'):
        cid = SHEET_TO_ID.get(nm[len('แก้ไข'):].strip())
        if cid:
            p = parse_sheet(sh)
            if p:
                fixes[cid] = p
    else:
        cid = SHEET_TO_ID.get(nm)
        if cid:
            p = parse_sheet(sh)
            if p:
                base[cid] = p

data = {}
for cid, b in base.items():
    f = fixes.get(cid)
    people = [dict(p) for p in b['people']]
    codes = [p['code'] for p in people]
    byday = {d: dict(row) for d, row in b['byday'].items()}
    if f:
        # คนใหม่จากชีทแก้ไข ต่อท้ายรายชื่อ
        for p in f['people']:
            if p['code'] not in codes:
                codes.append(p['code'])
                people.append(dict(p))
        # วันที่มีในชีทแก้ไข = ใช้ชีทแก้ไขทั้งแถว (คนที่ไม่อยู่ในชีทแก้ไขวันนั้น → none)
        for d, row in f['byday'].items():
            byday[d] = row
    # ชื่อเต็ม: footer แก้ไข > footer หลัก > ชื่อจาก header
    fulls = {}
    fulls.update(b['fullname'])
    if f:
        for k, v in f['fullname'].items():
            if len(v) > len(fulls.get(k, '')):
                fulls[k] = v
    for p in people:
        full = fulls.get(p['code'])
        if full and len(full) > len(p['name']):
            p['name'] = full
    grid = []
    for d in range(1, 32):
        row = byday.get(d, {})
        grid.append([row.get(c, 'none') for c in codes])
    data[cid] = {'people': people, 'grid': grid}
    if f:
        print(f"  [merge] {cid}: ชีทแก้ไขทับวันที่ {min(f['byday'])}-{max(f['byday'])}"
              + (f" · คนใหม่: {[p['code'] for p in f['people'] if p['code'] not in [q['code'] for q in b['people']]]}" if any(p['code'] not in [q['code'] for q in b['people']] for p in f['people']) else ''))

with open(OUT, 'w', encoding='utf-8') as f:
    f.write('// AUTO-EXTRACTED จากไฟล์ "1.1ตารางเวร กทม เดือน มิ.ย. 2026ล่าสุด(1).xls" — ข้อมูลจริงต่อศูนย์ อย่าแก้มือ\n')
    f.write('export type RawPerson = { code: string; name: string };\n')
    f.write('export const ROSTER_JUN: Record<string, { people: RawPerson[]; grid: string[][] }> = ')
    f.write(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
    f.write(';\n')

print('extracted centers:', len(data))
for cid, d in data.items():
    print(f"  {cid:12s} people={len(d['people']):2d}  day10: {' '.join(d['grid'][9])}")
