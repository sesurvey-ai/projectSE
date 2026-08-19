'use client';

/**
 * แก้ "ความเสียหายรถประกัน" บนหน้าตรวจงาน
 *
 * จำเป็นเพราะ: ไฟล์ XML ของ ISURVEY **ไม่เคยส่งรายการความเสียหายมาเลย** (ยืนยัน 6/6 ไฟล์ —
 * tag DAMAGE_LIST ว่างเสมอ) เคสที่นำเข้าจึงไม่มีความเสียหายสักชิ้น แต่ EMCS ต้องมี
 * ผู้ตรวจจึงต้องกรอกเองที่นี่ก่อนส่งบอทเข้า EMCS
 *
 * ชื่อชิ้นส่วน = checklist 22 ชิ้นของ EMCS verbatim และ "ด้าน" แยกเป็น pos —
 * ตรงกับที่แอปมือถือเก็บ (car_damage_diagram.dart) เพื่อให้บอทติ๊ก checklist ได้
 * ถ้าใส่ข้างในชื่อ ('ประตูหน้าซ้าย') จะ match ไม่ได้ ตกไปช่องอิสระพร้อมชื่อเพี้ยน
 */
import React from 'react';

export type DamageItem = { part: string; pos: string; level: string };

/** 22 ชิ้นของ checklist EMCS — 10 ตัวหลังเลือกด้าน L/R/A ได้, 12 ตัวแรกไม่มีด้าน */
export const PARTS_NO_SIDE = [
  'กันชนหน้า', 'กันชนหลัง', 'กระจกบังลมหน้า', 'กระจกบังลมหลัง', 'ฝากระโปรงหน้า',
  'ฝากระโปรงหลัง', 'กระจังหน้า', 'กระบะ', 'หลังคา', 'แผงท้าย', 'ฝาปิดท้าย', 'แค็ป',
];
export const PARTS_WITH_SIDE = [
  'ไฟหน้า', 'ไฟท้าย', 'บังโคลนหน้า', 'บังโคลนหลัง', 'ประตูหน้า', 'ประตูหลัง',
  'ไฟเลี้ยวหน้า', 'ไฟเลี้ยวหลัง', 'กระจกมองข้าง', 'บันได',
];
const ALL_PARTS = [...PARTS_NO_SIDE, ...PARTS_WITH_SIDE];

const SIDES = [
  { v: 'A', label: 'ทั้งคู่' },
  { v: 'L', label: 'ซ้าย' },
  { v: 'R', label: 'ขวา' },
];
// ระดับที่ EMCS แสดงบนหน้าจอคือ L/M/H/X (rdoDam_Lavel index 0-3)
const LEVELS = [
  { v: 'L', label: 'L — ต่ำ' },
  { v: 'M', label: 'M — กลาง' },
  { v: 'H', label: 'H — สูง' },
  { v: 'X', label: 'X — สูงมาก' },
];

const sel = 'border border-gray-300 rounded px-2 py-1 text-sm text-gray-800 bg-white';

export default function DamageEditor({
  items, onChange, disabled,
}: {
  items: DamageItem[];
  onChange: (next: DamageItem[]) => void;
  disabled?: boolean;
}) {
  const set = (i: number, k: keyof DamageItem, v: string) => {
    const next = items.map((it, idx) => (idx === i ? { ...it, [k]: v } : it));
    // ชิ้นส่วนที่ EMCS ไม่มีปุ่มเลือกด้าน → บังคับเป็น 'A' กันส่งค่าที่ปลายทางใช้ไม่ได้
    if (k === 'part' && PARTS_NO_SIDE.includes(v)) next[i].pos = 'A';
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          ยังไม่มีรายการความเสียหาย — เคสที่นำเข้าจากไฟล์ XML จะไม่มีข้อมูลส่วนนี้ ต้องกรอกเองก่อนส่งเข้า EMCS
        </p>
      )}

      {items.map((it, i) => {
        /**
         * ชิ้นส่วนที่ไม่อยู่ใน 22 ตัว = "ช่องอิสระ" (มาจากหน้าต่างข้อมูลความเสียหาย
         * หรือจากแอปมือถือ) — ต้องแสดงชื่อได้และเลือกด้านได้เหมือนช่องอิสระของ EMCS
         * ⛔ ถ้าไม่ใส่ชื่อมันกลับเข้าลิสต์ตัวเลือก ช่องจะว่างทั้งที่ข้อมูลมีอยู่
         *    แล้วพอผู้ตรวจแตะแถวนั้นทีเดียว ชื่อที่พิมพ์ไว้จะหายทันที (เจอจริง 18/08/69)
         */
        const known = ALL_PARTS.includes(it.part);
        const hasSide = known ? PARTS_WITH_SIDE.includes(it.part) : Boolean(it.part);
        return (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-400 w-5 text-right">{i + 1}.</span>
            <select
              disabled={disabled} value={it.part} className={`${sel} min-w-[160px]`}
              onChange={(e) => set(i, 'part', e.target.value)}
            >
              <option value="">-- เลือกชิ้นส่วน --</option>
              {!known && it.part && <option value={it.part}>{it.part} (ช่องอิสระ)</option>}
              {ALL_PARTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>

            <select
              disabled={disabled || !hasSide} value={hasSide ? (it.pos || 'A') : 'A'}
              className={`${sel} w-24 ${!hasSide ? 'bg-gray-100 text-gray-400' : ''}`}
              onChange={(e) => set(i, 'pos', e.target.value)}
              title={hasSide ? 'ด้าน' : 'ชิ้นส่วนนี้ EMCS ไม่มีให้เลือกด้าน'}
            >
              {SIDES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
            </select>

            <select
              disabled={disabled} value={it.level} className={`${sel} w-32`}
              onChange={(e) => set(i, 'level', e.target.value)}
            >
              <option value="">-- ระดับ --</option>
              {LEVELS.map((l) => <option key={l.v} value={l.v}>{l.label}</option>)}
            </select>

            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50"
              >
                ลบ
              </button>
            )}
          </div>
        );
      })}

      {!disabled && (
        <button
          type="button"
          onClick={() => onChange([...items, { part: '', pos: 'A', level: '' }])}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
        >
          + เพิ่มชิ้นส่วน
        </button>
      )}
    </div>
  );
}
