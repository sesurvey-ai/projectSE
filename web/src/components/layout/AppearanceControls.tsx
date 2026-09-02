'use client';

import { useEffect, useState } from 'react';

/**
 * ── ตั้งค่าการแสดงผล: ฟอนต์ + ขนาดตัวอักษร ── (user ขอ 02/09/69)
 *
 * เก็บไว้ในเครื่องของคนเลือก **ไม่ใช่ค่าของทั้งระบบ** → พนักงานสายตาไม่เท่ากัน
 * ตั้งคนละขนาดพร้อมกันได้ ไม่กวนกัน
 *
 * ⛔ ตัวแปรฟอนต์ทั้ง 3 ประกาศบน <html> (ดู layout.tsx) — ตัวสลับเขียน
 *    `--font-thai: var(--font-xxx)` ที่ documentElement ถ้าย้ายตัวแปรไป <body>
 *    var() จะหาไม่เจอ ได้ค่าว่าง แล้วทั้งเว็บตกไปใช้ฟอนต์สำรองของเครื่องเงียบ ๆ
 * ⛔ ขนาดตัวอักษรทำโดยขยับ font-size ของ <html> — ทั้งเว็บวัดเป็น rem จึงโตตามกันหมด
 *    (ตัวหนังสือ ช่องกรอก ระยะห่าง) **ยกเว้นจุดสลับเลย์เอาต์ min-[1500px] ที่ผูกกับ
 *    ความกว้างจอจริง** ตั้งใจให้เป็นแบบนั้น — ขยายแล้วจอไม่ได้กว้างขึ้น
 * ⛔ คีย์ ui_font / ui_scale กับรูปแบบค่า ต้องตรงกับสคริปต์ท้าย <head> ใน layout.tsx
 *    ซึ่งอ่านค่าเดียวกันนี้ก่อนหน้าถูกวาด (ไม่งั้นหน้าแวบเปลี่ยนทุกครั้งที่เปิด)
 */
const FONTS = [
  { id: 'sarabun', name: 'Sarabun', note: 'ที่ใช้อยู่' },
  { id: 'noto-thai', name: 'Noto Sans Thai', note: 'กลาง ๆ' },
  { id: 'plex-thai', name: 'IBM Plex Sans Thai', note: 'ไทย+ละตินคู่กัน' },
];
/** 5 ระดับ · 100% คือขนาดออกแบบ ที่เหลือคือใหญ่ขึ้นเท่านั้น (เล็กกว่านี้อ่านฟอร์มไม่ไหว) */
const SCALES = [100, 110, 120, 130, 140];

export const applyScale = (pct: number) => {
  document.documentElement.style.fontSize = pct === 100 ? '' : `${(16 * pct) / 100}px`;
};

export default function AppearanceControls({ compact = false }: { compact?: boolean }) {
  const [font, setFont] = useState('sarabun');
  const [scale, setScale] = useState(100);

  useEffect(() => {
    try {
      const f = localStorage.getItem('ui_font');
      if (f && FONTS.some((x) => x.id === f)) setFont(f);
      const s = Number(localStorage.getItem('ui_scale'));
      if (SCALES.includes(s)) setScale(s);
    } catch { /* โหมดส่วนตัว/ปิดคุกกี้ — ใช้ค่าตั้งต้นไป ไม่ต้องพัง */ }
  }, []);

  const pickFont = (id: string) => {
    setFont(id);
    document.documentElement.style.setProperty('--font-thai', `var(--font-${id})`);
    try { localStorage.setItem('ui_font', id); } catch { /* เหมือนข้างบน */ }
  };
  const step = (dir: 1 | -1) => {
    const i = SCALES.indexOf(scale);
    const next = SCALES[Math.min(SCALES.length - 1, Math.max(0, (i < 0 ? 0 : i) + dir))];
    setScale(next);
    applyScale(next);
    try { localStorage.setItem('ui_scale', String(next)); } catch { /* เหมือนข้างบน */ }
  };

  const BTN = 'w-7 h-7 flex items-center justify-center border border-white/25 text-gray-200'
    + ' hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed';

  // แถบยุบแล้วกว้าง 3.5rem — ใส่ได้แค่ปุ่มย่อ/ขยาย ส่วนฟอนต์ต้องกางเมนูก่อน
  if (compact) {
    return (
      <div className="flex flex-col items-center gap-1 pb-3" title={`ขนาดตัวอักษร ${scale}%`}>
        <button type="button" onClick={() => step(1)} disabled={scale === SCALES[SCALES.length - 1]}
          className={BTN} aria-label="ตัวอักษรใหญ่ขึ้น">ก+</button>
        <button type="button" onClick={() => step(-1)} disabled={scale === SCALES[0]}
          className={BTN} aria-label="ตัวอักษรเล็กลง">ก−</button>
      </div>
    );
  }

  return (
    <div className="border-t border-white/15 p-4 space-y-2">
      <div>
        <label className="block text-[0.6875rem] text-gray-400 mb-1">ฟอนต์</label>
        <select value={font} onChange={(e) => pickFont(e.target.value)}
          className="w-full border border-white/25 bg-transparent text-gray-100 text-xs h-7 px-1.5">
          {/* พื้นหลังของ <option> คุมโดยระบบปฏิบัติการ — ต้องตั้งสีเองไม่งั้นขาวบนขาวบางเครื่อง */}
          {FONTS.map((f) => (
            <option key={f.id} value={f.id} className="text-gray-900 bg-white">
              {f.name} · {f.note}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[0.6875rem] text-gray-400">ขนาดตัวอักษร</span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => step(-1)} disabled={scale === SCALES[0]}
            className={BTN} aria-label="เล็กลง">ก−</button>
          <span className="w-10 text-center text-xs text-gray-200 tabular-nums">{scale}%</span>
          <button type="button" onClick={() => step(1)} disabled={scale === SCALES[SCALES.length - 1]}
            className={BTN} aria-label="ใหญ่ขึ้น">ก+</button>
        </div>
      </div>
    </div>
  );
}
