# -*- coding: utf-8 -*-
"""สร้าง `src/data/thaiDistrictCentroids.json` — จุดกลางของอำเภอ/เขตทั้ง 928 แห่ง

    python backend/scripts/gen_district_centroids.py

ทำไมต้องมี: การ์ดของบริษัทประกันพิมพ์ LatLng มาให้ก็จริง แต่ **มันคือจุดกลางอำเภอ
อยู่แล้ว ไม่ใช่จุดเกิดเหตุจริง** (user ยืนยัน 24/08/69) — พอรู้แบบนี้เราสร้างเองได้
และได้ครบทั้งไทยไพบูลย์ (การ์ดไม่มีพิกัดเลย) กับไอโออิใบที่ไม่ได้พิมพ์พิกัดมา

ที่มาข้อมูล: ขอบเขตอำเภอของ UN OCHA (COD-AB-THA, CC BY-IGO) ฉบับที่ prasertcbs
แปลงเป็น TopoJSON แบบย่อไว้ — github.com/prasertcbs/thailand_gis
`amphoe/thailand_province_amphoe_simplify.json` (1.3 MB, ขอบเขตปี 2019)

⛔ **ไม่เก็บชื่ออำเภอในไฟล์ผลลัพธ์** — คีย์เป็น `ADM2_PCODE` (= รหัสมาตรฐานไทย)
   แล้วให้ชื่อมาจาก `thaiAreaCodes.ts` ที่ระบบใช้อยู่แล้วที่เดียว เพราะชื่อฝั่ง OCHA
   **ถูกตัดที่ 16 ตัวอักษร** ('ป้อมปราบศัตรูพ่า', 'เมืองประจวบคีรีข') จากข้อจำกัดของ
   shapefile — เอามาใช้ตรง ๆ แล้วจะจับคู่ชื่อไม่ติดโดยไม่มีใครสังเกต
"""
import json, sys, urllib.request

URL = ('https://raw.githubusercontent.com/prasertcbs/thailand_gis/master/'
       'amphoe/thailand_province_amphoe_simplify.json')
OUT = 'backend/src/data/thaiDistrictCentroids.json'


def ring_area_centroid(r):
    """พื้นที่มีเครื่องหมาย + จุดกลาง (shoelace)"""
    a = cx = cy = 0.0
    for i in range(len(r) - 1):
        x0, y0 = r[i]; x1, y1 = r[i + 1]
        f = x0 * y1 - x1 * y0
        a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f
    if a == 0:
        return 0.0, r[0][0], r[0][1]
    a *= 0.5
    return a, cx / (6 * a), cy / (6 * a)


def in_ring(px, py, r):
    ins = False
    for i in range(len(r) - 1):
        x0, y0 = r[i]; x1, y1 = r[i + 1]
        if (y0 > py) != (y1 > py) and px < x0 + (py - y0) * (x1 - x0) / (y1 - y0):
            ins = not ins
    return ins


def on_surface(rings, y):
    """กลางช่วงแนวนอนที่ยาวที่สุดที่ระดับ y — แบบเดียวกับ ST_PointOnSurface"""
    xs = []
    for r in rings:
        for i in range(len(r) - 1):
            x0, y0 = r[i]; x1, y1 = r[i + 1]
            if (y0 > y) != (y1 > y):
                xs.append(x0 + (y - y0) * (x1 - x0) / (y1 - y0))
    xs.sort()
    best = max((( xs[i + 1] - xs[i], (xs[i] + xs[i + 1]) / 2)
                for i in range(0, len(xs) - 1, 2)), default=None)
    return best[1] if best else None


def main():
    raw = (open(sys.argv[1], encoding='utf-8').read() if len(sys.argv) > 1
           else urllib.request.urlopen(URL, timeout=120).read().decode('utf-8'))
    topo = json.loads(raw)
    sx, sy = topo['transform']['scale']
    tx, ty = topo['transform']['translate']

    arcs = []                                    # quantized delta ints → lng/lat
    for arc in topo['arcs']:
        x = y = 0; pts = []
        for dx, dy in arc:
            x += dx; y += dy
            pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)

    def ring(idxs):
        pts = []
        for i in idxs:
            a = arcs[~i][::-1] if i < 0 else arcs[i]
            pts.extend(a[1:] if pts else a)
        return pts

    out, fixed = {}, []
    (obj,) = topo['objects'].values()
    for g in obj['geometries']:
        polys = [[ring(r) for r in poly]
                 for poly in (g['arcs'] if g['type'] == 'MultiPolygon' else [g['arcs']])]
        # จุดกลางถ่วงน้ำหนักพื้นที่ (วงนอกบวก วงในหักออก) ข้ามทุกรูปย่อย
        A = CX = CY = 0.0
        for rings in polys:
            for j, r in enumerate(rings):
                a, cx, cy = ring_area_centroid(r)
                a = abs(a) * (1 if j == 0 else -1)
                A += a; CX += cx * a; CY += cy * a
        lng, lat = (CX / A, CY / A) if A else (polys[0][0][0][0], polys[0][0][0][1])
        # อำเภอรูปพระจันทร์เสี้ยว/เว้าลึก จุดกลางอาจตกนอกตัวอำเภอเอง → ใช้จุดบนพื้นผิวแทน
        if not any(in_ring(lng, lat, rings[0]) and
                   not any(in_ring(lng, lat, h) for h in rings[1:]) for rings in polys):
            big = max(polys, key=lambda rs: abs(ring_area_centroid(rs[0])[0]))
            _, _, cy = ring_area_centroid(big[0])
            x = on_surface(big, cy)
            if x is not None:
                lng, lat, _ = x, cy, fixed.append(g['properties']['ADM2_TH'])
        out[g['properties']['ADM2_PCODE'].replace('TH', '')] = [round(lat, 5), round(lng, 5)]

    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(dict(sorted(out.items())), f, ensure_ascii=False, separators=(',', ':'))
    print(f'{OUT}: {len(out)} อำเภอ · ใช้จุดบนพื้นผิวแทน {len(fixed)} ({", ".join(fixed)})')


if __name__ == '__main__':
    main()
