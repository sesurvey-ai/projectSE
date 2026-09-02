'use client';

import { useEffect, useState } from 'react';

/**
 * ── ตัวสลับฟอนต์ทั้งเว็บ ── (user ขอ 02/09/69 ระหว่างตัดสินใจเลือกฟอนต์)
 *
 * เลือกแล้วเปลี่ยนทันทีทั้งหน้า จำไว้ในเครื่องของคนเลือก **ไม่ใช่ค่าของทั้งระบบ**
 * → แต่ละคนลองคนละแบบพร้อมกันได้ ไม่กวนกัน
 *
 * วิธีทำงาน: เขียน `--font-thai` ทับที่ <html> ให้ชี้ไปตัวแปรของฟอนต์ที่เลือก
 * globals.css อ่าน `var(--font-thai)` อยู่แล้ว ทั้งเว็บจึงเปลี่ยนตามในจังหวะเดียว
 *
 * ⛔ ตัวแปรฟอนต์ทั้ง 3 ต้องประกาศบน <html> (ดู layout.tsx) — ถ้าย้ายไป <body>
 *    `var(--font-plex-thai)` ที่เขียนลง documentElement จะหาไม่เจอ ได้ค่าว่าง
 *    แล้วทั้งเว็บตกไปใช้ฟอนต์สำรองของเครื่องเงียบ ๆ
 * ⛔ ค่าที่จำไว้ถูกอ่านซ้ำในสคริปต์ท้าย <head> ของ layout.tsx ก่อนหน้าถูกวาด
 *    ชื่อคีย์ `ui_font` กับรูปแบบค่าต้องตรงกันทั้งสองที่
 */
const FONTS = [
  { id: 'noto-thai', name: 'Noto Sans Thai', note: 'ที่ใช้อยู่' },
  { id: 'plex-thai', name: 'IBM Plex Sans Thai', note: 'ไทย+ละตินออกแบบคู่กัน' },
  { id: 'sarabun', name: 'Sarabun', note: 'แบบเอกสารราชการ' },
];

export default function FontSwitcher() {
  const [font, setFont] = useState('noto-thai');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ui_font');
      if (saved && FONTS.some((f) => f.id === saved)) setFont(saved);
    } catch { /* โหมดส่วนตัว/ปิดคุกกี้ — ใช้ฟอนต์ตั้งต้นไป ไม่ต้องพัง */ }
  }, []);

  const pick = (id: string) => {
    setFont(id);
    document.documentElement.style.setProperty('--font-thai', `var(--font-${id})`);
    try { localStorage.setItem('ui_font', id); } catch { /* เหมือนข้างบน */ }
  };

  return (
    <label className="flex items-center gap-1.5" title="ลองเปลี่ยนฟอนต์ — จำไว้เฉพาะเครื่องนี้">
      <span className="text-[11px] text-[var(--md-muted)]">ฟอนต์</span>
      <select value={font} onChange={(e) => pick(e.target.value)}
        className="border border-[var(--md-line-2)] rounded-none h-7 px-1.5 text-xs text-[var(--md-ink)] bg-white">
        {FONTS.map((f) => (
          <option key={f.id} value={f.id}>{f.name} · {f.note}</option>
        ))}
      </select>
    </label>
  );
}
