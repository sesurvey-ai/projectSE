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

/**
 * สรุปรายการความเสียหายแบบอ่านอย่างเดียว — ใช้คู่กับปุ่ม "ข้อมูลความเสียหาย"
 * ทุกที่ที่เก็บรายการไว้ (รถประกัน + คู่กรณีทุกคัน) เพื่อให้เห็นว่าเลือกอะไรไว้
 * โดยไม่ต้องเปิดหน้าต่างทีละคัน (user ขอ 03/09/69)
 * ⛔ ชิ้นส่วนที่ EMCS ไม่มีปุ่มเลือกด้าน (pos ถูกบังคับเป็น 'A') ไม่ต้องโชว์ด้าน
 *    ไม่งั้นได้ "กันชนหน้า - ทั้งคู่ - ต่ำ" ซึ่งอ่านแล้วงงว่าทั้งคู่คืออะไร
 */
const SIDE_TH: Record<string, string> = { A: 'ทั้งคู่', L: 'ซ้าย', R: 'ขวา' };
const LEVEL_TH: Record<string, string> = { L: 'ต่ำ', M: 'กลาง', H: 'สูง', X: 'สูงมาก' };

export const damageLine = (it: DamageItem) => [
  it.part,
  PARTS_NO_SIDE.includes(it.part) || it.pos === 'A' ? '' : (SIDE_TH[it.pos] ?? it.pos),
  LEVEL_TH[it.level] ?? it.level,
].filter(Boolean).join(' - ');

/**
 * ข้อความสรุปสำหรับช่อง "ความเสียหายรถประกันภัย" (damage_description)
 *
 * ⛔ ต้องได้ผลตรงกับ `_syncDamageDesc()` ของแอปมือถือ (survey_form_screen.dart) เป๊ะ ๆ
 *    เพราะเว็บเอาไปเทียบว่าข้อความในช่อง "ยังเป็นของอัตโนมัติอยู่ไหม" ก่อนจะเขียนทับ
 *    เพี้ยนแม้แต่ช่องว่างเดียว = ระบบคิดว่าช่างพิมพ์เอง แล้วไม่อัปเดตตามรายการให้
 *    → จึงใช้ป้ายชุดของแอป (A = 'ทั้งหมด' และโชว์ด้านทุกชิ้น) ไม่ใช่ของ damageLine
 */
const POS_DESC: Record<string, string> = { L: 'ซ้าย', R: 'ขวา', A: 'ทั้งหมด' };
export const autoDamageDesc = (items: DamageItem[]) =>
  (items ?? [])
    .filter((it) => it.part)
    .map((it, i) => `${i + 1}. ` + [it.part, POS_DESC[it.pos] ?? '', LEVEL_TH[it.level] ?? '']
      .filter(Boolean).join(' - '))
    .join('\n');

export function DamageList({ items }: { items: DamageItem[] }) {
  if (!items || items.length === 0) return null;
  /* เรียงไปทางขวาแล้วขึ้นบรรทัดใหม่เมื่อเต็ม (user ขอ 03/09/69) — วางข้างปุ่มได้เลย
     ที่ว่างขวาปุ่มมีเยอะ ส่วนแนวตั้งกินความสูงฟอร์มไปเรื่อย ๆ ตามจำนวนชิ้น
     ⛔ whitespace-nowrap ที่รายการย่อย — ให้ขึ้นบรรทัดใหม่ "ระหว่างชิ้น" เท่านั้น
        ไม่ใช่หักกลางชื่อชิ้นส่วนจนอ่านเป็นคนละรายการ */
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-700 min-w-0">
      {items.map((it, i) => (
        <li key={i} className="whitespace-nowrap">{i + 1}. {damageLine(it)}</li>
      ))}
    </ol>
  );
}

const sel = 'border border-gray-300 rounded-none px-2 py-1 text-sm text-gray-800 bg-white';

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
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-none px-3 py-2">
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
              disabled={disabled} value={it.part} className={`${sel} min-w-[10rem]`}
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
                className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded-none hover:bg-red-50"
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
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-none hover:bg-gray-50 text-gray-700"
        >
          + เพิ่มชิ้นส่วน
        </button>
      )}
    </div>
  );
}
