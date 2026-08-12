#!/usr/bin/env python3
"""เทียบเรทระหว่าง se-billing (SQLite) กับ se-survey (Postgres) — **อ่านอย่างเดียว**

ทำไมต้องมี: ตั้งแต่ 2026-08-12 เรทมี **2 ชุดแยกกันโดยตั้งใจ**
  · se-billing + extension + ISURVEY  → ใช้ SQLite ของตัวเอง (ห้ามแตะ คนใช้งานอยู่จริง)
  · se-survey                          → ใช้ Postgres ของเราเอง
ไม่มี sync ระหว่างกัน เพราะการต่อสายไปแตะระบบที่คนกำลังใช้อยู่คือความเสี่ยงที่เลี่ยงได้
แลกกับความเสี่ยงว่าวันหนึ่งมีคนแก้ข้างเดียวแล้ว **งานเดียวกันจ่ายคนละยอด**
สคริปต์นี้คือตาข่ายกันตรงนั้น — รันเป็นระยะ (เดือนละครั้ง / ก่อนปิดงวดจ่ายเงิน)

ไม่เขียนอะไรทั้งสองฝั่ง ไม่แตะ se-billing แม้แต่บรรทัดเดียว

ใช้:
    python tools/compare_billing_rates.py
    python tools/compare_billing_rates.py --sqlite "C:/path/isurvey-helper.db"

⚠️ ค่าเริ่มต้นอ่าน SQLite ของ **เครื่องพัฒนา** ซึ่งอาจไม่ตรงกับตัวจริงบน
   billing.sesurvey.cloud — ถ้าจะเทียบให้ชัวร์ ก๊อปไฟล์ .db จากเซิร์ฟเวอร์มาก่อน
"""
import argparse
import json
import os
import sqlite3
import sys

sys.stdout.reconfigure(encoding="utf-8")

DEFAULT_SQLITE = r"C:\Users\i9\Desktop\se-billing\server\data\isurvey-helper.db"


def norm(v):
    """ทำให้เทียบกันได้ — SQLite เก็บ JSON เป็นสตริง, Postgres คืนเป็น dict แล้ว"""
    if v is None or v == "":
        return None
    if isinstance(v, (dict, list)):
        return json.dumps(v, sort_keys=True, ensure_ascii=False)
    if isinstance(v, str) and v.strip().startswith(("{", "[")):
        try:
            return json.dumps(json.loads(v), sort_keys=True, ensure_ascii=False)
        except ValueError:
            return v
    return str(v)


TABLES = [
    # (ชื่อที่โชว์, ตาราง sqlite, ตาราง postgres, คีย์, คอลัมน์ที่เทียบ)
    ("เรทรายอำเภอ", "amphur_table", "billing_amphur_rates", "amphur_id",
     ["sur_invest", "ins_invest_12", "ins_invest_34", "ins_trans", "ins_photo_12",
      "sur_invest_by_team", "ins_trans_by_team"]),
    ("เรทรายจังหวัด", "province_rates", "billing_province_rates", "province_id",
     ["sur_invest"]),
    ("ตำบลพิเศษ", "tumbon_fee_override", "billing_tumbon_rates", "tumbon_id",
     ["label", "parent_amphur", "ins_invest_12", "ins_invest_34", "ins_trans",
      "ins_photo_12", "sur_invest_by_team", "ins_trans_by_team"]),
    ("รหัส → ทีม", "surveyor_teams", "billing_surveyor_teams", "sec_code", ["team"]),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sqlite", default=DEFAULT_SQLITE)
    args = ap.parse_args()

    if not os.path.exists(args.sqlite):
        sys.exit(f"หาไฟล์ SQLite ไม่เจอ: {args.sqlite}")

    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        sys.exit("ต้องมี psycopg2 ก่อน:  pip install psycopg2-binary")

    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        sys.exit("ตั้ง DATABASE_URL ก่อน (ของ se-survey)")

    lite = sqlite3.connect(args.sqlite)
    lite.row_factory = sqlite3.Row
    pg = psycopg2.connect(dsn)
    pgc = pg.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    problems = 0
    for label, st, pt, key, cols in TABLES:
        a = {r[key]: dict(r) for r in lite.execute(f"SELECT * FROM {st}")}
        pgc.execute(f"SELECT * FROM {pt}")
        b = {r[key]: r for r in pgc.fetchall()}

        only_billing = sorted(set(a) - set(b))
        only_survey = sorted(set(b) - set(a))
        diff = []
        for k in sorted(set(a) & set(b)):
            for c in cols:
                if norm(a[k].get(c)) != norm(b[k].get(c)):
                    diff.append((k, c, a[k].get(c), b[k].get(c)))

        bad = len(only_billing) + len(only_survey) + len(diff)
        problems += bad
        mark = "✅" if bad == 0 else "❌"
        print(f"{mark} {label:16} se-billing {len(a):4}  se-survey {len(b):4}")
        for k in only_billing:
            print(f"      มีเฉพาะฝั่ง se-billing : {k}")
        for k in only_survey:
            print(f"      มีเฉพาะฝั่ง se-survey  : {k}")
        for k, c, x, y in diff:
            print(f"      ต่างกัน {k} · {c} : se-billing={x!r}  se-survey={y!r}")

    print()
    print("ตรงกันทั้งหมด" if problems == 0
          else f"พบ {problems} จุดที่ไม่ตรงกัน — ต้องตัดสินว่าฝั่งไหนถูกแล้วแก้ให้ตรงกัน")
    lite.close()
    pg.close()
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
