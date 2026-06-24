# -*- coding: utf-8 -*-
# เทียบตารางเวรจากไฟล์ Excel กับ roster ในระบบ (roster-jun.ts) — รายงานความต่าง ไม่แก้ไฟล์ใด ๆ
import re, json, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import xlrd

SRC = r"C:\Users\i9\Downloads\1.1ตารางเวร กทม เดือน มิ.ย. 2026ล่าสุด(1).xls"
TS  = r"C:\Users\i9\Desktop\se-survey\web\src\app\duty-demo2\roster-jun.ts"

SHEET_TO_ID = {
    'ลาดพร้าว': 'ladprao', 'รามอินทรา': 'raminthra', 'อ่อนนุช': 'onnut', 'บางแค': 'bangkhae',
    'มีนบุรี': 'minburi', 'ปทุมธานี': 'pathum', 'พระราม 9': 'rama9', 'พระราม9': 'rama9',
    'บางนา': 'bangna', 'ปากเกร็ด': 'pakkret', 'นนทบุรี': 'nonthaburi', 'นนทุบรี': 'nonthaburi',
    'สาทร': 'sathon', 'พระราม 2': 'rama2', 'พระราม2': 'rama2', 'สมุทรปราการ': 'samutprakan', 'บางพลัด': 'bangphlat',
}
ID_TH = {v: k for k, v in [('ลาดพร้าว','ladprao'),('รามอินทรา','raminthra'),('อ่อนนุช','onnut'),('บางแค','bangkhae'),('มีนบุรี','minburi'),('ปทุมธานี','pathum'),('พระราม 9','rama9'),('บางนา','bangna'),('ปากเกร็ด','pakkret'),('นนทบุรี','nonthaburi'),('สาทร','sathon'),('พระราม 2','rama2'),('สมุทรปราการ','samutprakan'),('บางพลัด','bangphlat')]}

def norm(v): return re.sub(r'\s+', ' ', str(v)).strip()
def is_day(v):
    try: return 1 <= int(float(v)) <= 31 and str(v).strip() != ''
    except (ValueError, TypeError): return False

def map_shift(s):
    s = norm(s)
    if not s: return 'none'
    if 'หยุด' in s: return 'off'
    if 'ยังไม่' in s or 'ย้าย' in s or 'อบรม' in s or s == 'ลา': return 'none'
    if re.search(r'fix', s, re.I):
        if '11.00' in s and '20.00' in s: return 'fix11'
        if '14.00' in s and '23.00' in s: return 'fix14'
        if '07.00' in s and '16.00' in s: return 'fix7'
        m = re.search(r'FIX\s*0*(\d+)', s, re.I)
        if m and m.group(1) in ('7','07','11','14'): return {'7':'fix7','07':'fix7','11':'fix11','14':'fix14'}[m.group(1)]
        if 'เวร 2.1' in s or 'เวร2.1' in s: return 'fix11'
        if 'เวร 2.2' in s or 'เวร2.2' in s: return 'fix14'
        if 'เวร 1' in s or 'เวร1' in s: return 'fix7'
        return 'none'
    if 'เวร' in s:
        if 'ดึก' in s or 'เวร 3' in s or 'เวร3' in s: return 's3'
        if 'เวร 1' in s or 'เวร1' in s: return 's1'
        if 'เวร 2' in s or 'เวร2' in s: return 's2'
    if '11.00' in s and '20.00' in s: return 'fix11'
    if '14.00' in s and '23.00' in s: return 'fix14'
    if '07.00' in s and '16.00' in s: return 's1'
    if '15.00' in s: return 's2'
    if '23.00' in s and '08.00' in s: return 's3'
    return 'none'

def parse_code(s):
    m = re.search(r'SE\s*0*(\d+)', s)
    return ('SE ' + m.group(1)) if m else ''
def clean_name(s):
    s = re.sub(r'SE\s*0*\d+', '', s)
    s = re.sub(r'เวร\s*FIX|\bFIX\b|\bfix\b', '', s)
    s = re.sub(r'^(นางสาว|น\.ส\.|นาย|นาง)\s*', '', s.strip())
    return re.sub(r'\s+', ' ', s).strip()

def parse_sheet(sh):
    day_rows = [r for r in range(sh.nrows) if is_day(sh.cell_value(r, 0))]
    if not day_rows: return None
    first_day_row = day_rows[0]
    hdr_row, best_n = 1, -1
    for r in range(0, first_day_row):
        n = sum(1 for c in range(2, sh.ncols) if parse_code(norm(sh.cell_value(r, c))))
        if n > best_n: best_n, hdr_row = n, r
    people, cols, seen = [], [], set()
    for c in range(2, sh.ncols):
        raw = norm(sh.cell_value(hdr_row, c)); code = parse_code(raw)
        if not code: continue
        if code not in seen: seen.add(code); people.append({'code': code, 'name': clean_name(raw)})
        cols.append((c, code))
    byday = {}
    for r in day_rows:
        d = int(float(sh.cell_value(r, 0)))
        if d in byday: continue
        row = {}
        for c, code in cols:
            v = map_shift(sh.cell_value(r, c))
            if code not in row or (row[code] == 'none' and v != 'none'): row[code] = v
        byday[d] = row
    last = day_rows[-1]; fullname = {}
    for r in range(last + 1, sh.nrows):
        rc = [norm(sh.cell_value(r, c)) for c in range(sh.ncols)]
        for i, cell in enumerate(rc):
            if re.fullmatch(r'SE\s*0*\d+', cell):
                code = parse_code(cell)
                for j in range(i + 1, len(rc)):
                    if rc[j]:
                        if re.search(r'[ก-๙]', rc[j]) and 'SE' not in rc[j]: fullname[code] = clean_name(rc[j])
                        break
    return {'people': people, 'byday': byday, 'fullname': fullname}

def extract(src):
    wb = xlrd.open_workbook(src); base, fixes = {}, {}
    for sh in wb.sheets():
        nm = sh.name.strip()
        if nm.startswith('แก้ไข'):
            cid = SHEET_TO_ID.get(nm[len('แก้ไข'):].strip())
            if cid:
                p = parse_sheet(sh);  fixes[cid] = p if p else fixes.get(cid)
        else:
            cid = SHEET_TO_ID.get(nm)
            if cid:
                p = parse_sheet(sh)
                if p: base[cid] = p
    data = {}
    for cid, b in base.items():
        f = fixes.get(cid)
        people = [dict(p) for p in b['people']]; codes = [p['code'] for p in people]
        byday = {d: dict(row) for d, row in b['byday'].items()}
        if f:
            for p in f['people']:
                if p['code'] not in codes: codes.append(p['code']); people.append(dict(p))
            for d, row in f['byday'].items(): byday[d] = row
        fulls = {}; fulls.update(b['fullname'])
        if f:
            for k, v in f['fullname'].items():
                if len(v) > len(fulls.get(k, '')): fulls[k] = v
        for p in people:
            full = fulls.get(p['code'])
            if full and len(full) > len(p['name']): p['name'] = full
        grid = []
        for d in range(1, 32):
            row = byday.get(d, {}); grid.append([row.get(c, 'none') for c in codes])
        data[cid] = {'people': people, 'grid': grid}
    return data

def to_bycode(d):
    """{code: [31 shifts]} + {code: name}"""
    codes = [p['code'] for p in d['people']]
    names = {p['code']: p['name'] for p in d['people']}
    bycode = {c: [d['grid'][day][i] for day in range(31)] for i, c in enumerate(codes)}
    return bycode, names

# โหลด roster-jun.ts → JSON
txt = open(TS, encoding='utf-8').read()
js = txt[txt.index('ROSTER_JUN'):].split(' = ', 1)[1].strip()
if js.endswith(';'): js = js[:-1]
SYS = json.loads(js)
XLS = extract(SRC)

print('ไฟล์ Excel:', SRC.split('\\')[-1])
print('roster-jun.ts extract มาจาก:', txt.split('"')[1] if '"' in txt else '?')
print(f"\nศูนย์ใน Excel: {len(XLS)}  |  ในระบบ: {len(SYS)}")
only_xls = sorted(set(XLS) - set(SYS)); only_sys = sorted(set(SYS) - set(XLS))
if only_xls: print('  มีใน Excel แต่ไม่มีในระบบ:', only_xls)
if only_sys: print('  มีในระบบ แต่ไม่มีใน Excel:', only_sys)

total_cell = total_people = total_name = 0
center_summary = []
for cid in sorted(set(XLS) & set(SYS)):
    xb, xn = to_bycode(XLS[cid]); sb, sn = to_bycode(SYS[cid])
    add = sorted(set(xb) - set(sb)); rem = sorted(set(sb) - set(xb))
    namediff = [(c, sn[c], xn[c]) for c in sorted(set(xb) & set(sb)) if xn[c] != sn[c]]
    celldiff = []
    for c in sorted(set(xb) & set(sb)):
        for day in range(31):
            if xb[c][day] != sb[c][day]:
                celldiff.append((day + 1, c, sb[c][day], xb[c][day]))
    total_cell += len(celldiff); total_people += len(add) + len(rem); total_name += len(namediff)
    status = 'ตรงกัน' if not (add or rem or namediff or celldiff) else 'ต่าง'
    center_summary.append((cid, status, len(add), len(rem), len(namediff), len(celldiff)))
    if status == 'ต่าง':
        print(f"\n── {ID_TH.get(cid, cid)} ({cid}) : ต่าง ──")
        if add: print(f"   + คนใน Excel ไม่มีในระบบ: {add}")
        if rem: print(f"   - คนในระบบ ไม่มีใน Excel: {rem}")
        for c, a, b in namediff: print(f"   ~ ชื่อต่าง {c}: ระบบ='{a}' | excel='{b}'")
        if celldiff:
            print(f"   เวรต่าง {len(celldiff)} ช่อง (วัน,รหัส: ระบบ→excel):")
            for day, c, s, x in celldiff[:25]:
                print(f"      วันที่ {day:2d} {c}: {s} → {x}")
            if len(celldiff) > 25: print(f"      …อีก {len(celldiff)-25} ช่อง")

print("\n================ สรุป ================")
print(f"{'ศูนย์':<14}{'สถานะ':<8}{'+คน':>4}{'-คน':>4}{'ชื่อต่าง':>8}{'เวรต่าง':>8}")
for cid, st, a, r, nd, cd in center_summary:
    print(f"{cid:<14}{st:<8}{a:>4}{r:>4}{nd:>8}{cd:>8}")
print(f"\nรวม: เวรต่าง {total_cell} ช่อง · คนเพิ่ม/ลด {total_people} · ชื่อต่าง {total_name}")
print('ผล:', 'ตรงกันทั้งหมด ✓' if (total_cell+total_people+total_name)==0 else 'ไม่ตรงกัน ✗')
