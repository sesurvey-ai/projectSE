'use client';

/**
 * หน้าต่าง "ข้อมูลความเสียหาย" — ลอกหน้าจอเดียวกันของ EMCS มาไว้บนเว็บเรา
 *
 * ทำไมต้องมี: ผู้สำรวจเลือกความเสียหายมาจากแอปแล้ว แต่บ่อยครั้ง**เลือกไม่ครบ**
 * หัวหน้าต้องเติม/แก้ก่อนส่งเข้าระบบประกัน ซึ่งเดิมทำได้แค่ผ่านลิสต์ทีละบรรทัด
 * มองไม่เห็นภาพรวมว่าชิ้นไหนติ๊กไปแล้วบ้าง (user ขอ 18/08/69)
 *
 * โครงหน้าจอตรงกับ EMCS: **checklist 22 ชิ้น** + **ช่องอิสระ 30 ช่อง**
 * ทั้งคู่มี ด้าน (L/R/A) กับ ระดับ (L/M/H/X)
 *
 * ⛔ ไม่ต้องเลือกอย่างใดอย่างหนึ่ง — บอท (`se-autokey/autokey/emcs.py`) จับคู่ชื่อชิ้นส่วน
 *    เข้า checklist ของ EMCS ให้เอง ชื่อไหนไม่ตรงจะไหลลงช่องอิสระอัตโนมัติ
 *    ฝั่งเราจึงเก็บเป็น {ชิ้นส่วน, ด้าน, ระดับ} ชุดเดียว ไม่ต้องแยกประเภท
 *
 * ⛔ ช่องในหน้าต่างนี้ **ห้ามมี name** — มันอยู่ใน <form> เดียวกับฟอร์มหลัก
 *    มี name เมื่อไหร่จะโดน FormData เก็บไปเป็นค่าของรายงานตอนกดบันทึก
 */
import React, { useEffect, useState } from 'react';
import { DamageItem, PARTS_NO_SIDE, PARTS_WITH_SIDE } from './DamageEditor';

/** เรียงตามหน้าจอ EMCS: 6 แถวแรกไม่มีด้าน · 5 แถวหลังเลือกด้านได้ (ซ้าย/ขวาคู่กัน) */
const ROWS: [string, string][] = [
  ['กันชนหน้า', 'กันชนหลัง'],
  ['กระจกบังลมหน้า', 'กระจกบังลมหลัง'],
  ['ฝากระโปรงหน้า', 'ฝากระโปรงหลัง'],
  ['กระจังหน้า', 'กระบะ'],
  ['หลังคา', 'แผงท้าย'],
  ['ฝาปิดท้าย', 'แค็ป'],
  ['ไฟหน้า', 'ไฟท้าย'],
  ['บังโคลนหน้า', 'บังโคลนหลัง'],
  ['ประตูหน้า', 'ประตูหลัง'],
  ['ไฟเลี้ยวหน้า', 'ไฟเลี้ยวหลัง'],
  ['กระจกมองข้าง', 'บันได'],
];
const CHECKLIST = new Set([...PARTS_NO_SIDE, ...PARTS_WITH_SIDE]);

/** EMCS มี 30 ช่องอิสระ แต่ **ฟอร์มตอนสร้างเรื่องใหม่มีแค่ 8** — เกินแล้วบอทกรอกไม่ครบ */
const FREE_SLOTS = 30;
const FREE_SAFE = 8;

const SIDES = ['L', 'R', 'A'] as const;
const LEVELS = ['L', 'M', 'H', 'X'] as const;

/** ปุ่มกลม ๆ แบบ radio ของ EMCS — เล็กและกดง่ายกว่า select ตอนมี 30 แถว */
function Radios({ value, options, onPick, disabled, hidden }: {
  value: string; options: readonly string[]; onPick: (v: string) => void;
  disabled?: boolean; hidden?: boolean;
}) {
  if (hidden) return <div className="w-[5.375rem] shrink-0" />;
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {options.map((o) => (
        <label key={o} className="flex flex-col items-center gap-0.5 cursor-pointer">
          <input type="radio" checked={value === o} disabled={disabled}
            onChange={() => onPick(o)} className="w-3.5 h-3.5 accent-blue-600" />
          <span className="text-[0.625rem] leading-none text-gray-500">{o}</span>
        </label>
      ))}
    </div>
  );
}

export default function DamageDialog({
  open, items, onClose, onSave, disabled,
}: {
  open: boolean;
  items: DamageItem[];
  onClose: () => void;
  onSave: (next: DamageItem[]) => void;
  disabled?: boolean;
}) {
  /** แก้บนสำเนาก่อน — กด "ปิด" แล้วของเดิมต้องไม่เปลี่ยน (เหมือนปุ่มปิดของ EMCS)
   *
   *  ⛔ ช่องอิสระต้องเก็บเป็น "อาเรย์ 30 ช่องคงที่" แยกจาก draft — ห้ามคำนวณจาก draft
   *     ทุก render โดยกรองช่องว่างทิ้ง เพราะการกรองทำให้ index ของแถวขยับทุกครั้งที่พิมพ์
   *     (พิมพ์ 'ท่อ' ช่องแรก แล้วพิมพ์ 'ก' ที่ช่องถัดลงมา → 'ก' เด้งไปโผล่คอลัมน์ขวา
   *      เพราะตารางเรียง 2 คอลัมน์แบบซ้าย-ขวาสลับกันตาม index — user เจอ 20/08/69) */
  const blank = (): DamageItem => ({ part: '', pos: '', level: '' });
  const [checked, setChecked] = useState<DamageItem[]>([]);
  const [free, setFree_] = useState<DamageItem[]>(() => Array.from({ length: FREE_SLOTS }, blank));
  useEffect(() => {
    if (!open) return;
    setChecked(items.filter((d) => CHECKLIST.has(d.part)));
    const rest = items.filter((d) => !CHECKLIST.has(d.part) && d.part.trim());
    setFree_(Array.from({ length: FREE_SLOTS }, (_, i) => rest[i] ?? blank()));
  }, [open, items]);
  if (!open) return null;

  const find = (part: string) => checked.find((d) => d.part === part);
  const upd = (part: string, patch: Partial<DamageItem>) =>
    setChecked(checked.map((d) => (d.part === part ? { ...d, ...patch } : d)));
  const toggle = (part: string) => {
    // ⛔ ติ๊กแล้ว **ห้ามเลือกด้าน/ระดับให้อัตโนมัติ** — ผู้ตรวจสอบต้องเลือกเอง
    //    (เดิม default 'A'+'L' ทำให้ทุกชิ้นกลายเป็น "เสียหายน้อย ทั้งสองด้าน" โดยไม่มีใครสั่ง)
    if (find(part)) setChecked(checked.filter((d) => d.part !== part));
    else setChecked([...checked, { part, pos: '', level: '' }]);
  };

  const setFree = (i: number, patch: Partial<DamageItem>) =>
    setFree_(free.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const freeRows = free;
  const freeUsed = free.filter((f) => f.part.trim()).length;
  const picked = [...checked, ...free.filter((f) => f.part.trim())];
  /** ชิ้นที่เลือกแล้วแต่ยังไม่ระบุระดับ — EMCS ต้องการระดับ ไม่งั้นแถวนั้นไปไม่ถึง */
  const noLevel = picked.filter((d) => !String(d.level ?? '').trim()).length;

  const cell = 'flex items-center gap-2 px-2 py-1.5 border-b border-gray-100 min-w-0';
  const txt = 'flex-1 min-w-0 border-b border-gray-300 px-1 py-0.5 text-sm text-gray-800 bg-transparent focus:outline-none focus:border-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white border border-[var(--md-line)] shadow-xl w-full max-w-[62.5rem] my-4">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--md-line)] bg-[var(--md-tint)]">
          <span className="font-semibold text-gray-800">ข้อมูลความเสียหาย</span>
          <span className="text-xs text-gray-500">
            เลือกไว้ {picked.length} รายการ
            {freeUsed > 0 && ` · ช่องอิสระ ${freeUsed}`}
            {/* ไม่บล็อกการกดตกลง แค่บอกให้รู้ตัว — ระบบประกันต้องการ "ระดับ" ของทุกชิ้น */}
            {noLevel > 0 && (
              <span className="ml-2 text-amber-800 bg-amber-50 border border-amber-300 rounded-none px-2 py-0.5">
                ⚠ ยังไม่ได้เลือกระดับ {noLevel} ชิ้น
              </span>
            )}
          </span>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          {/* ── checklist 22 ชิ้น ── ชื่อต้องตรงกับ EMCS ทุกตัวอักษร บอทถึงจะติ๊กถูกช่อง */}
          <div className="grid grid-cols-1 md:grid-cols-2">
            {ROWS.map(([a, b]) => [a, b].map((part) => {
              const it = find(part);
              const hasSide = PARTS_WITH_SIDE.includes(part);
              return (
                <label key={part} className={cell}>
                  <input type="checkbox" checked={Boolean(it)} disabled={disabled}
                    onChange={() => toggle(part)} className="w-4 h-4 shrink-0 accent-blue-600" />
                  <span className="text-sm text-gray-800 flex-1 min-w-0 truncate">{part}</span>
                  <Radios value={it?.pos ?? ''} options={SIDES} hidden={!hasSide}
                    disabled={disabled || !it} onPick={(v) => upd(part, { pos: v })} />
                  <Radios value={it?.level ?? ''} options={LEVELS}
                    disabled={disabled || !it} onPick={(v) => upd(part, { level: v })} />
                </label>
              );
            }))}
          </div>

          {/* ── ช่องอิสระ ── ชิ้นส่วนที่ไม่มีใน checklist (ปีกโคลน · คิ้ว · ฝาครอบ ฯลฯ) */}
          <div className="px-4 pt-3 pb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-xs font-semibold tracking-wide text-gray-400 uppercase">ช่องอิสระ</span>
            <span className="text-xs text-gray-500">พิมพ์ชื่อชิ้นส่วนที่ไม่มีในรายการข้างบน</span>
            {freeUsed > FREE_SAFE && (
              <span className="text-xs text-amber-800 bg-amber-50 border border-amber-300 rounded-none px-2 py-0.5">
                ⚠ ใช้ไป {freeUsed} ช่อง — ฟอร์มสร้างเรื่องใหม่ของระบบประกันมีแค่ {FREE_SAFE} ช่อง
                ส่วนที่เกินบอทจะกรอกให้ไม่ครบ ต้องไปเติมเองที่นั่น
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2">
            {freeRows.map((r, i) => (
              <div key={i} className={cell}>
                <input type="text" value={r.part} disabled={disabled}
                  onChange={(e) => setFree(i, { part: e.target.value })} className={txt} />
                <Radios value={r.pos} options={SIDES}
                  disabled={disabled || !r.part.trim()} onPick={(v) => setFree(i, { pos: v })} />
                <Radios value={r.level} options={LEVELS}
                  disabled={disabled || !r.part.trim()} onPick={(v) => setFree(i, { level: v })} />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
          <button type="button" onClick={onClose}
            className="px-4 py-1.5 text-sm border border-gray-300 rounded-none hover:bg-gray-50">
            ปิด
          </button>
          <button type="button" disabled={disabled}
            onClick={() => { onSave(picked); onClose(); }}
            className="px-5 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-none hover:bg-blue-700 disabled:bg-blue-300">
            ตกลง
          </button>
        </div>
      </div>
    </div>
  );
}
