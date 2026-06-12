'use client';

import { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { ROSTER_JUN } from './roster-jun';

// ── persistence: เซฟกริดลง DB จริงผ่าน backend /api/duty/schedule(s) ──
// ใช้ fetch + token ตรง ๆ (เลี่ยง axios interceptor ที่ 401 แล้วเด้ง /login — หน้านี้ยังเปิดแบบไม่ล็อกอินได้)
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const authToken = (): string | null => (typeof window !== 'undefined' ? localStorage.getItem('token') : null);

// ─────────────────────────────────────────────────────────────
// duty-demo2 — recreated from Claude Design "ตารางเวร" handoff bundle
//  • SaaS-clean premium roster · 4 switchable styles (on-page) · editable shifts
//  • All CSS scoped under .d2 (avoid Tailwind utility clashes); table class = gtbl (not grid)
// ─────────────────────────────────────────────────────────────

type ShiftKey = 's1' | 's2' | 's3' | 'fix7' | 'fix11' | 'fix14' | 'off' | 'none';
const SHIFTS: Record<ShiftKey, { code: string; label: string; time: string; short: string; tone: string }> = {
  s1: { code: '1', label: 'เวร 1', time: '07.00–16.00', short: 'เช้า', tone: 'morning' },
  s2: { code: '2', label: 'เวร 2', time: '15.00–24.00', short: 'บ่าย', tone: 'afternoon' },
  s3: { code: '3', label: 'เวร 3', time: '23.00–08.00', short: 'ดึก', tone: 'night' },
  fix7: { code: 'F7', label: 'FIX 7', time: '07.00–16.00', short: 'FIX7', tone: 'fix' },
  fix11: { code: 'F11', label: 'FIX 11', time: '11.00–20.00', short: 'FIX11', tone: 'fix' },
  fix14: { code: 'F14', label: 'FIX 14', time: '14.00–23.00', short: 'FIX14', tone: 'fix' },
  off: { code: '—', label: 'เวรหยุด', time: 'หยุดพัก', short: 'หยุด', tone: 'off' },
  none: { code: '·', label: 'ว่าง', time: 'ยังไม่จัด', short: 'ว่าง', tone: 'none' },
};
const SHIFT_ORDER: ShiftKey[] = ['s1', 's2', 's3', 'fix7', 'fix11', 'fix14', 'off', 'none'];

// zones = ศูนย์จริง 14 แห่ง (ข้อมูลพนักงาน/เวร จากไฟล์จริง มิ.ย. 2026 → roster-jun.ts) จัดกลุ่มตามภาค
// สีประจำภาค — เลือกให้ต่างจากสีกะในตาราง (เขียว/ส้ม/คราม/เทา): กรุงเทพ=ชมพู, ปริมณฑล=ฟ้า cyan
const REGIONS_Z = [
  { key: 'bkk', label: 'กรุงเทพ', dot: '#E11D48', tint: '#FFE4E6', ink: '#BE123C' },
  { key: 'pmt', label: 'ปริมณฑล', dot: '#0891B2', tint: '#CFFAFE', ink: '#0E7490' },
];
const CENTERS = [
  { id: 'ladprao', name: 'ลาดพร้าว', region: 'bkk' },
  { id: 'raminthra', name: 'รามอินทรา', region: 'bkk' },
  { id: 'onnut', name: 'อ่อนนุช', region: 'bkk' },
  { id: 'bangkhae', name: 'บางแค', region: 'bkk' },
  { id: 'minburi', name: 'มีนบุรี', region: 'bkk' },
  { id: 'rama9', name: 'พระราม 9', region: 'bkk' },
  { id: 'bangna', name: 'บางนา', region: 'bkk' },
  { id: 'sathon', name: 'สาทร', region: 'bkk' },
  { id: 'rama2', name: 'พระราม 2', region: 'bkk' },
  { id: 'bangphlat', name: 'บางพลัด', region: 'bkk' },
  { id: 'pathum', name: 'ปทุมธานี', region: 'pmt' },
  { id: 'pakkret', name: 'ปากเกร็ด', region: 'pmt' },
  { id: 'nonthaburi', name: 'นนทบุรี', region: 'pmt' },
  { id: 'samutprakan', name: 'สมุทรปราการ', region: 'pmt' },
];

type Staff = { id: string; code: string; name: string };

const MONTHS_TH = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const DOW_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']; // getDay()-indexed
type Day = { day: number; dow: string; isSat: boolean; isSun: boolean; isWeekend: boolean };

// map shift keys จาก roster-jun → ชุดของ demo2 (FIX → ประมาณ)
const MAP_SHIFT: Record<string, ShiftKey> = { s1: 's1', s2: 's2', s3: 's3', fix7: 'fix7', fix11: 'fix11', fix14: 'fix14', off: 'off', none: 'none', f1120: 'fix11', f1423: 'fix14' };
type ZoneData = { staff: Staff[]; schedule: Record<string, Record<number, ShiftKey>> };

function buildZoneData(): Record<string, ZoneData> {
  const out: Record<string, ZoneData> = {};
  for (const c of CENTERS) {
    const raw = ROSTER_JUN[c.id];
    if (!raw) { out[c.id] = { staff: [], schedule: {} }; continue; }
    const staff: Staff[] = raw.people.map((p, i) => ({ id: c.id + '_' + i, code: p.code, name: p.name }));
    const schedule: Record<string, Record<number, ShiftKey>> = {};
    staff.forEach((s, pi) => {
      schedule[s.id] = {};
      for (let day = 1; day <= 31; day++) {
        schedule[s.id][day] = MAP_SHIFT[raw.grid[day - 1]?.[pi] ?? 'none'] ?? 'none';
      }
    });
    out[c.id] = { staff, schedule };
  }
  return out;
}
const INITIAL_ZONE_DATA = buildZoneData();
const SEED_Y = 2026, SEED_M = 6; // seed roster-jun = มิ.ย. 2026 เท่านั้น (เดือนอื่นห้ามเอามาแปะ)

// ── หมุนเวรต่อเนื่องข้ามเดือน ──
// วงรอบมาตรฐาน 6 วัน: เช้า เช้า บ่าย บ่าย ดึก หยุด — หาเฟสของแต่ละคนจากท้ายเดือนก่อน แล้ววนต่อในเดือนใหม่
// คนที่ไม่เข้าวงรอบ (FIX / รูปแบบเฉพาะ) ใช้ทำซ้ำรายสัปดาห์ตามวันในสัปดาห์เดิมแทน
const ROTATE_CYCLE: ShiftKey[] = ['s1', 's1', 's2', 's2', 's3', 'off'];
function continueFromPrev(prev: ZoneData, prevY: number, prevM: number, y: number, m: number): ZoneData {
  const prevDays = new Date(prevY, prevM, 0).getDate();
  const nDays = new Date(y, m, 0).getDate();
  const schedule: Record<string, Record<number, ShiftKey>> = {};
  for (const s of prev.staff) {
    const pv = prev.schedule?.[s.id] ?? {};
    const out: Record<number, ShiftKey> = {};
    // นับเฉพาะ 12 วันท้ายเดือนก่อนที่จัดเวรแล้ว แล้วหาเฟส r ที่เข้ากันที่สุด: เวรวัน d = CYCLE[(r+d) % 6]
    let total = 0;
    for (let d = Math.max(1, prevDays - 11); d <= prevDays; d++) { const v = pv[d]; if (v && v !== 'none') total++; }
    let bestR = -1, bestRatio = 0;
    for (let r = 0; r < 6; r++) {
      let hit = 0;
      for (let d = Math.max(1, prevDays - 11); d <= prevDays; d++) {
        const v = pv[d];
        if (!v || v === 'none') continue;
        if (ROTATE_CYCLE[(r + d) % 6] === v) hit++;
      }
      if (total > 0 && hit / total > bestRatio) { bestRatio = hit / total; bestR = r; }
    }
    // เข้าวงรอบเมื่อ: เดา 12 วันท้ายถูก ≥75% และวันสุดท้ายของเดือนก่อนตรงเป๊ะ (กันเฟสเพี้ยนตอนต่อเดือน)
    const inCycle = bestR >= 0 && bestRatio >= 0.75 && total >= 6 && pv[prevDays] === ROTATE_CYCLE[(bestR + prevDays) % 6];
    for (let d = 1; d <= nDays; d++) {
      if (inCycle) { out[d] = ROTATE_CYCLE[(bestR + prevDays + d) % 6]; continue; }
      const dow = new Date(y, m - 1, d).getDay();
      let v: ShiftKey = 'none';
      for (let pd = prevDays; pd >= 1; pd--) {
        if (new Date(prevY, prevM - 1, pd).getDay() === dow) { v = pv[pd] ?? 'none'; break; }
      }
      out[d] = v;
    }
    schedule[s.id] = out;
  }
  return { staff: prev.staff.map((s) => ({ ...s })), schedule };
}

const TONE_OF: Record<ShiftKey, string> = { s1: 'morning', s2: 'afternoon', s3: 'night', fix7: 'fix', fix11: 'fix', fix14: 'fix', off: 'off', none: 'none' };
const SOLID_VAR: Record<ShiftKey, string> = { s1: 'var(--morning-solid)', s2: 'var(--after-solid)', s3: 'var(--night-solid)', fix7: 'var(--fix-solid)', fix11: 'var(--fix-solid)', fix14: 'var(--fix-solid)', off: 'var(--off-solid)', none: 'var(--warn)' };

const VARIANTS = [
  { key: 'pills', label: 'พิลล์นุ่ม', desc: 'ป้ายกลมโทนอ่อน' },
  { key: 'accent', label: 'ขอบสี', desc: 'เส้นขอบไฮไลต์' },
  { key: 'blocks', label: 'บล็อกสี', desc: 'เติมสีเต็มช่อง' },
  { key: 'minimal', label: 'มินิมอล', desc: 'เลขกะ + เส้นบาง' },
];
const FONTS = [
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: 'Anuphan', label: 'Anuphan' },
  { value: "'IBM Plex Sans Thai'", label: 'IBM Plex Thai' },
  { value: "'Noto Sans Thai'", label: 'Noto Sans Thai' },
];
const DEFAULT_FONT = 'Arial, Helvetica, sans-serif'; // ฟอนต์เดียวกับหน้าอื่นในแอป (globals.css body)
const ACCENTS = ['#4F46E5', '#0E9F6E', '#0EA5E9', '#E0651F', '#111827'];
const DENSITY_PAD: Record<string, number> = { compact: 38, regular: 46, comfy: 56 };

// ---- per-shift custom colors (กำหนดสีแต่ละเวรเองได้) ----
const SHIFT_COLOR_KEYS: { key: ShiftKey; label: string; short: string }[] = [
  { key: 's1', label: 'เวร 1', short: 'เช้า' },
  { key: 's2', label: 'เวร 2', short: 'บ่าย' },
  { key: 's3', label: 'เวร 3', short: 'ดึก' },
  { key: 'off', label: 'เวรหยุด', short: 'หยุด' },
];
// แต่ละเวร map → ชุด CSS var (--<prefix>-tint/-strong/-solid/-ink)
const SHIFT_VAR_PREFIX: Record<string, string> = { s1: 'morning', s2: 'after', s3: 'night', off: 'off' };
const DEFAULT_SHIFT_COLORS: Record<string, string> = { s1: '#139DA0', s2: '#E0991A', s3: '#6366E8', off: '#bababa' };
const hx2 = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
function mixHex(hex: string, target: number, t: number) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return '#' + hx2(r + (target - r) * t) + hx2(g + (target - g) * t) + hx2(b + (target - b) * t);
}
// derive tint(อ่อน)/strong(บล็อก)/solid(จุด)/ink(ตัวอักษร) + on(สีตัวเลขบนจุด) จากสีฐานเดียว
// ข้ามเวรที่ยังเป็นสีเริ่มต้น → ใช้พาเลตต์ที่จูนมือไว้ตามเดิม (หน้าตาไม่เปลี่ยนจนกว่าผู้ใช้จะปรับ)
function shiftCssVars(colors: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const k of Object.keys(colors)) {
    const base = colors[k];
    if (base.toLowerCase() === (DEFAULT_SHIFT_COLORS[k] || '').toLowerCase()) continue;
    const p = SHIFT_VAR_PREFIX[k];
    const n = parseInt(base.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (k === 'off') {
      // เวรหยุด = ใช้สีที่เลือกเป๊ะ ๆ เป็นพื้นทึบ (WYSIWYG: swatch = ช่องในตาราง) · ตัวอักษรปรับ contrast เอง
      const onc = lum > 0.6 ? '#1A1C1E' : '#FFFFFF';
      out['--off-tint'] = base; out['--off-strong'] = base; out['--off-solid'] = base;
      out['--off-ink'] = onc; out['--off-on'] = onc;
    } else {
      out['--' + p + '-solid'] = base;
      out['--' + p + '-tint'] = mixHex(base, 255, 0.86);
      out['--' + p + '-strong'] = mixHex(base, 255, 0.72);
      out['--' + p + '-ink'] = mixHex(base, 0, 0.32);
      out['--' + p + '-on'] = lum > 0.68 ? '#2B2F36' : '#ffffff';
    }
  }
  return out;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const Icon = {
  search: (p: any) => (<svg viewBox="0 0 24 24" fill="none" {...p}><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>),
  x: (p: any) => (<svg viewBox="0 0 24 24" fill="none" {...p}><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>),
  chevL: (p: any) => (<svg viewBox="0 0 24 24" fill="none" {...p}><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  chevR: (p: any) => (<svg viewBox="0 0 24 24" fill="none" {...p}><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  check: (p: any) => (<svg viewBox="0 0 24 24" fill="none" {...p}><path d="M5 12l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  cal: (p: any) => (<svg viewBox="0 0 24 24" fill="none" {...p}><rect x="3.5" y="5" width="17" height="15" rx="3" stroke="currentColor" strokeWidth="2" /><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>),
  sliders: (p: any) => (<svg viewBox="0 0 24 24" fill="none" {...p}><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="16" cy="6" r="2" fill="currentColor" /><circle cx="8" cy="12" r="2" fill="currentColor" /><circle cx="16" cy="18" r="2" fill="currentColor" /></svg>),
};

// ---- Shift cell ----
function ShiftCell({ shiftKey, onOpen, dim }: { shiftKey: ShiftKey; onOpen: (e: React.MouseEvent<HTMLDivElement>) => void; dim: boolean }) {
  const s = SHIFTS[shiftKey];
  const tone = TONE_OF[shiftKey];
  return (
    <td className={'shift-cell' + (dim ? ' col-dim' : '')}>
      <div className="cell" data-tone={tone} tabIndex={0} onClick={onOpen}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(e as unknown as React.MouseEvent<HTMLDivElement>); } }}>
        <div className="body">
          <span className="dot" data-n={s.code}></span>
          <span className="lab">{s.label}{['s1', 's2', 's3'].includes(shiftKey) ? ' · ' + s.short : ''}</span>
          <span className="cell-time">{s.time}</span>
        </div>
      </div>
    </td>
  );
}

// ---- Staff header card ----
function StaffHead({ staff, counts, dim, confirming, onAsk, onConfirm, onCancel, onEdit }: {
  staff: Staff; counts: Record<ShiftKey, number>; dim: boolean;
  confirming: boolean; onAsk: () => void; onConfirm: () => void; onCancel: () => void;
  onEdit: (field: 'code' | 'name', val: string) => void;
}) {
  const work = counts.s1 + counts.s2 + counts.s3;
  const pct = (n: number) => (work ? (n / work) * 100 : 0);
  return (
    <th className={'staff-head' + (dim ? ' col-dim' : '')}>
      <div className="staff-card">
        {confirming ? (
          <span className="sc-confirm">
            <button className="sc-yes" onClick={onConfirm}>ลบ</button>
            <button className="sc-no" onClick={onCancel}>ยกเลิก</button>
          </span>
        ) : (
          <button className="sc-x" onClick={onAsk} title="ลบพนักงาน">✕</button>
        )}
        <input className="code" value={staff.code} onChange={(e) => onEdit('code', e.target.value)} spellCheck={false} />
        <input className="nm" value={staff.name} onChange={(e) => onEdit('name', e.target.value)} spellCheck={false} />
        <div className="minibar" title="สัดส่วนกะ เช้า · บ่าย · ดึก">
          <i className="m" style={{ width: pct(counts.s1) + '%' }}></i>
          <i className="a" style={{ width: pct(counts.s2) + '%' }}></i>
          <i className="n" style={{ width: pct(counts.s3) + '%' }}></i>
        </div>
        <div className="mini-counts">
          <span><b>{work}</b> เวร</span>
          <span className="nightc">ดึก <b>{counts.s3}</b></span>
          <span>หยุด <b>{counts.off}</b></span>
        </div>
      </div>
    </th>
  );
}

// ---- Shift picker popover ----
function ShiftPicker({ anchor, staff, day, current, onPick, onClose }: {
  anchor: HTMLElement; staff: Staff; day: Day; current: ShiftKey;
  onPick: (k: ShiftKey) => void; onClose: () => void;
}) {
  const [pos, setPos] = useState({ top: -999, left: -999 });
  useLayoutEffect(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const w = 234, h = 430;
    let left = r.left;
    let top = r.bottom + 6;
    if (left + w > window.innerWidth - 12) left = window.innerWidth - w - 12;
    if (top + h > window.innerHeight - 12) top = r.top - h - 6;
    if (top < 12) top = 12;
    setPos({ top, left });
  }, [anchor]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <>
      <div className="pop-backdrop" onClick={onClose}></div>
      <div className="popover" style={pos}>
        <div className="pop-head">
          <div>
            <div className="pt">{staff.code} · {staff.name}</div>
            <div className="pd">วันที่ {day.day} ({day.dow})</div>
          </div>
        </div>
        {SHIFT_ORDER.map((k) => {
          const s = SHIFTS[k];
          return (
            <button key={k} className={'pop-opt' + (k === current ? ' sel' : '')} onClick={() => onPick(k)}>
              <span className="oico" style={{ background: SOLID_VAR[k] }}>{s.code}</span>
              <span className="ol">
                <span className="a">{s.label}</span>
                <span className="b">{s.time}</span>
              </span>
              <span className="chk">{Icon.check({ width: 17, height: 17 })}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

export default function DutyRoster({ embedded = false }: { embedded?: boolean } = {}) {
  const [variant, setVariant] = useState('blocks');
  const [accent, setAccent] = useState('#4F46E5');
  const [shiftColors, setShiftColors] = useState<Record<string, string>>(DEFAULT_SHIFT_COLORS);
  const [font, setFont] = useState(DEFAULT_FONT);
  const [density, setDensity] = useState('regular');
  const [weekendHi, setWeekendHi] = useState(true);
  const [coverWarn, setCoverWarn] = useState(4);
  const [panelOpen, setPanelOpen] = useState(!embedded);

  const [query, setQuery] = useState('');
  const [pop, setPop] = useState<{ staffId: string; day: number; anchor: HTMLElement } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState('ladprao');
  const [view, setView] = useState({ y: 2026, m: 6 });
  const [dataByZone, setDataByZone] = useState<Record<string, ZoneData>>(() => INITIAL_ZONE_DATA);
  const nextSe = useRef(900);
  const [saving, setSaving] = useState(false);
  const [authMissing, setAuthMissing] = useState(false);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});       // zoneId → มีแก้ไขยังไม่บันทึก
  const [savedZones, setSavedZones] = useState<Record<string, string>>({}); // zoneId → เวลาเซฟ ('db' = โหลดจาก DB)
  const [generated, setGenerated] = useState<Record<string, boolean>>({}); // zoneId → ร่างที่ระบบหมุนต่อจากเดือนก่อนให้

  const zd = dataByZone[zoneId] ?? { staff: [], schedule: {} };
  const staff = zd.staff;
  const schedule = zd.schedule;
  const updateZone = (fn: (z: ZoneData) => ZoneData) => {
    setDataByZone((d) => ({ ...d, [zoneId]: fn(d[zoneId] ?? { staff: [], schedule: {} }) }));
    setDirty((dz) => ({ ...dz, [zoneId]: true }));
  };

  const days = useMemo(() => {
    const n = new Date(view.y, view.m, 0).getDate();
    return Array.from({ length: n }, (_, i) => {
      const day = i + 1;
      const di = new Date(view.y, view.m - 1, day).getDay();
      return { day, dow: DOW_TH[di], isSat: di === 6, isSun: di === 0, isWeekend: di === 0 || di === 6 };
    });
  }, [view]);
  const changeMonth = (delta: number) => setView((v) => {
    let m = v.m + delta, y = v.y;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    return { y, m };
  });

  // โหลดตารางที่เคยบันทึกของเดือนนี้จาก DB → ศูนย์ที่ยังไม่มีข้อมูล:
  //   มิ.ย. 2026 = ใช้ seed roster-jun · เดือนอื่น = หมุนเวรต่อจาก "เดือนก่อนหน้า" ให้อัตโนมัติเป็นร่าง (ต้องกดบันทึกเอง)
  // ไม่ล็อกอิน/ออฟไลน์ → คง seed ไว้ (หน้านี้ยังใช้แบบเดโมได้)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = authToken();
        const hd: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const pm = view.m === 1 ? { y: view.y - 1, m: 12 } : { y: view.y, m: view.m - 1 };
        const [res, prevRes] = await Promise.all([
          fetch(`${API_BASE}/api/duty/schedules?y=${view.y}&m=${view.m}`, { headers: hd }),
          fetch(`${API_BASE}/api/duty/schedules?y=${pm.y}&m=${pm.m}`, { headers: hd }),
        ]);
        if (res.status === 401) { if (!cancelled) setAuthMissing(true); return; }
        if (!res.ok || cancelled) return;
        const saved = ((await res.json()).data ?? {}) as Record<string, ZoneData>;
        const prevSaved = prevRes.ok ? (((await prevRes.json()).data ?? {}) as Record<string, ZoneData>) : {};
        if (cancelled) return;
        setAuthMissing(false);
        const seedOf = (yy: number, mm: number, cid: string) =>
          (yy === SEED_Y && mm === SEED_M ? INITIAL_ZONE_DATA[cid] : undefined);
        const merged: Record<string, ZoneData> = {};
        const draft: Record<string, boolean> = {};
        for (const c of CENTERS) {
          const cur = saved[c.id] ?? seedOf(view.y, view.m, c.id);
          if (cur) { merged[c.id] = cur; continue; }
          const prev = prevSaved[c.id] ?? seedOf(pm.y, pm.m, c.id);
          if (prev && prev.staff?.length) {
            merged[c.id] = continueFromPrev(prev, pm.y, pm.m, view.y, view.m);
            draft[c.id] = true;
          } else merged[c.id] = { staff: [], schedule: {} };
        }
        setDataByZone(merged);
        setDirty({ ...draft });   // ร่างที่หมุนให้ = ยังไม่บันทึก
        setGenerated(draft);
        const sv: Record<string, string> = {};
        for (const id of Object.keys(saved)) sv[id] = 'db';
        setSavedZones(sv);
      } catch { /* ออฟไลน์ → คง seed */ }
    })();
    return () => { cancelled = true; };
  }, [view]);

  // บันทึกศูนย์ปัจจุบัน (zone) ของเดือนปัจจุบัน ลง DB
  const saveZone = async () => {
    const token = authToken();
    if (!token) { setAuthMissing(true); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/duty/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ center_id: zoneId, year: view.y, month: view.m, data: dataByZone[zoneId] }),
      });
      if (res.status === 401) { setAuthMissing(true); return; }
      if (!res.ok) return;
      const out = (await res.json()).data;
      setAuthMissing(false);
      setDirty((d) => ({ ...d, [zoneId]: false }));
      setGenerated((g) => ({ ...g, [zoneId]: false }));
      setSavedZones((s) => ({ ...s, [zoneId]: out?.updated_at ?? 'db' }));
    } catch { /* network error → คง dirty ไว้ */ }
    finally { setSaving(false); }
  };

  const addStaff = () => {
    const id = 'NEW' + nextSe.current++;
    const sd: Record<number, ShiftKey> = {};
    for (let day = 1; day <= 31; day++) sd[day] = 'none';
    updateZone((z) => ({ staff: [...z.staff, { id, code: 'SE', name: 'พนักงานใหม่' }], schedule: { ...z.schedule, [id]: sd } }));
  };
  const removeStaff = (id: string) => {
    updateZone((z) => { const s2 = { ...z.schedule }; delete s2[id]; return { staff: z.staff.filter((s) => s.id !== id), schedule: s2 }; });
    setConfirmId(null);
  };
  const editStaff = (id: string, field: 'code' | 'name', val: string) =>
    updateZone((z) => ({ ...z, staff: z.staff.map((s) => (s.id === id ? { ...s, [field]: val } : s)) }));

  const q = query.trim().toLowerCase();
  const isDim = (s: Staff) => !!q && !(s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));

  const counts = useMemo(() => {
    const out: Record<string, Record<ShiftKey, number>> = {};
    staff.forEach((s) => {
      const c: Record<ShiftKey, number> = { s1: 0, s2: 0, s3: 0, fix7: 0, fix11: 0, fix14: 0, off: 0, none: 0 };
      days.forEach((d) => { c[schedule[s.id]?.[d.day] ?? 'none']++; });
      out[s.id] = c;
    });
    return out;
  }, [schedule, staff, days]);

  const coverage = useMemo(() => days.map((d) => {
    let work = 0, empty = 0;
    staff.forEach((s) => {
      const k = schedule[s.id]?.[d.day] ?? 'none';
      if (k !== 'off' && k !== 'none') work++;
      if (k === 'none') empty++;
    });
    return { day: d.day, work, empty, low: work < coverWarn };
  }), [schedule, coverWarn, staff, days]);

  const totals = useMemo(() => {
    const tot: Record<ShiftKey, number> = { s1: 0, s2: 0, s3: 0, fix7: 0, fix11: 0, fix14: 0, off: 0, none: 0 };
    staff.forEach((s) => SHIFT_ORDER.forEach((k) => { tot[k] += counts[s.id]?.[k] ?? 0; }));
    return tot;
  }, [counts, staff]);

  const emptyTotal = totals.none;
  const lowDays = coverage.filter((c) => c.low).length;

  const setShift = (staffId: string, day: number, key: ShiftKey) =>
    updateZone((z) => ({ ...z, schedule: { ...z.schedule, [staffId]: { ...z.schedule[staffId], [day]: key } } }));

  const padH = DENSITY_PAD[density];
  const popStaff = pop && staff.find((s) => s.id === pop.staffId);
  const fz = density === 'compact' ? '13px' : density === 'comfy' ? '14.5px' : '14px';

  const wrapStyle = {
    '--brand': accent, '--brand-ink': accent, '--fz': fz, '--cell-h': padH + 'px',
    ...shiftCssVars(shiftColors),
    fontFamily: `${font}, system-ui, sans-serif`,
  } as React.CSSProperties;

  const saveTone = saving ? 'busy' : dirty[zoneId] ? 'dirty' : savedZones[zoneId] ? 'ok' : 'none';
  const saveText = saving ? 'กำลังบันทึก…'
    : dirty[zoneId] ? (generated[zoneId] ? 'ร่างหมุนต่อจากเดือนก่อน — ยังไม่บันทึก' : 'ยังไม่บันทึก')
    : savedZones[zoneId] ? ('บันทึกแล้ว' + (savedZones[zoneId] !== 'db' ? ' · ' + savedZones[zoneId].slice(11) : ''))
    : 'ยังไม่เคยบันทึก';

  return (
    <div className={'d2' + (embedded ? ' d2-embed' : '')} data-variant={variant} style={wrapStyle}>
      <style dangerouslySetInnerHTML={{ __html: D2_CSS }} />

      {/* Topbar */}
      <div className="topbar">
        <div className="brand-mark">{Icon.cal({})}</div>
        <div className="brand-text">
          <h1>ตารางเวร — โซน{CENTERS.find((c) => c.id === zoneId)?.name}</h1>
          <p>ระบบจัดเวรพนักงานรักษาความปลอดภัย</p>
        </div>
        <div className="save-group">
          <span className={'save-status ' + saveTone}>
            {saveTone === 'ok' && Icon.check({ width: 13, height: 13 })}
            {saveText}
          </span>
          <button className="save-btn" onClick={saveZone} disabled={saving}>บันทึกศูนย์นี้</button>
          {authMissing && <span className="save-note">ต้องล็อกอิน admin ก่อน</span>}
        </div>
        <div className="month-chip">
          <span className="nav"><button aria-label="เดือนก่อน" onClick={() => changeMonth(-1)}>{Icon.chevL({ width: 16, height: 16 })}</button></span>
          <span style={{ minWidth: 130, textAlign: 'center' }}>{MONTHS_TH[view.m]} {view.y + 543}</span>
          <span className="nav"><button aria-label="เดือนถัดไป" onClick={() => changeMonth(1)}>{Icon.chevR({ width: 16, height: 16 })}</button></span>
        </div>
      </div>

      {/* Zone tabs */}
      <div className="zones">
        {REGIONS_Z.flatMap((rg) => [
          <span key={rg.key} className="zone-head" style={{ '--dot': rg.dot, '--tint': rg.tint, '--rink': rg.ink } as React.CSSProperties}>{rg.label}</span>,
          ...CENTERS.filter((c) => c.region === rg.key).map((c) => (
            <button key={c.id} className={'zone' + (zoneId === c.id ? ' active' : '')}
              style={{ '--ztint': rg.tint, '--zink': rg.ink, '--zdot': rg.dot } as React.CSSProperties}
              onClick={() => { setZoneId(c.id); setConfirmId(null); }}>
              {c.name}<span className="cnt">{dataByZone[c.id]?.staff.length ?? 0}</span>
            </button>
          )),
        ])}
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search">
          {Icon.search({})}
          <input placeholder="ค้นหาพนักงาน / รหัส SE…" value={query} onChange={(e) => setQuery(e.target.value)} />
          {query && <span className="clear" onClick={() => setQuery('')}>{Icon.x({ width: 15, height: 15 })}</span>}
        </div>
        <button className="add-staff" onClick={addStaff}>+ เพิ่มพนักงาน</button>
        <div className="legend">
          <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--morning-solid)' }}></span>เวร 1 · เช้า · 07.00–16.00</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--after-solid)' }}></span>เวร 2 · บ่าย · 15.00–24.00</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--night-solid)' }}></span>เวร 3 · ดึก · 23.00–08.00</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--fix-solid)' }}></span>FIX 7 · 07.00–16.00</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--fix-solid)' }}></span>FIX 11 · 11.00–20.00</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--fix-solid)' }}></span>FIX 14 · 14.00–23.00</span>
        </div>
        <div className="stat-pills">
          <div className="stat-pill"><span className="n">{staff.length}</span><span className="l">พนักงาน<br />ในโซน</span></div>
          <div className={'stat-pill' + (emptyTotal ? ' warn' : '')}><span className="n">{emptyTotal}</span><span className="l">ช่องว่าง<br />ยังไม่จัด</span></div>
          <div className={'stat-pill' + (lowDays ? ' warn' : '')}><span className="n">{lowDays}</span><span className="l">วันที่<br />คนไม่พอ</span></div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid-wrap">
        <table className="gtbl">
          <thead>
            <tr>
              <th className="col-day head-meta"><div className="lbl">วันที่</div></th>
              <th className="col-dow head-meta"><div className="lbl">วัน</div></th>
              {staff.map((s) => <StaffHead key={s.id} staff={s} counts={counts[s.id]} dim={isDim(s)}
                confirming={confirmId === s.id} onAsk={() => setConfirmId(s.id)}
                onConfirm={() => removeStaff(s.id)} onCancel={() => setConfirmId(null)}
                onEdit={(f, v) => editStaff(s.id, f, v)} />)}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const wkCls = weekendHi && d.isWeekend ? (d.isSun ? ' weekend sun' : ' weekend') : '';
              return (
                <tr key={d.day} className={wkCls.trim()}>
                  <td className="col-day"><div className="d"><span className="dnum">{d.day}</span></div></td>
                  <td className="col-dow">{d.dow}</td>
                  {staff.map((s) => (
                    <ShiftCell key={s.id} shiftKey={schedule[s.id]?.[d.day] ?? 'none'} dim={isDim(s)}
                      onOpen={(e) => setPop({ staffId: s.id, day: d.day, anchor: e.currentTarget })} />
                  ))}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="col-day"></td>
              <td className="col-dow"><div className="totals"><span className="foot-lbl">รวมทั้งโซน</span></div></td>
              {staff.map((s) => {
                const c = counts[s.id];
                return (
                  <td key={s.id} className={isDim(s) ? 'col-dim' : ''}>
                    <div className="totals">
                      <div className="ttl-row">
                        <span className="tchip"><span className="sw" style={{ background: 'var(--morning-solid)' }}></span><b>{c.s1}</b></span>
                        <span className="tchip"><span className="sw" style={{ background: 'var(--after-solid)' }}></span><b>{c.s2}</b></span>
                        <span className="tchip"><span className="sw" style={{ background: 'var(--night-solid)' }}></span><b>{c.s3}</b></span>
                        <span className="tchip"><span className="sw" style={{ background: 'var(--off-solid)' }}></span><b>{c.off}</b></span>
                      </div>
                    </div>
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Shift picker */}
      {pop && popStaff && (
        <ShiftPicker anchor={pop.anchor} staff={popStaff} day={days[pop.day - 1]} current={schedule[pop.staffId]?.[pop.day] ?? 'none'}
          onPick={(k) => { setShift(pop.staffId, pop.day, k); setPop(null); }} onClose={() => setPop(null)} />
      )}

      {/* On-page style switcher */}
      {!panelOpen && (
        <button className="twk-fab" onClick={() => setPanelOpen(true)} aria-label="ปรับแต่งสไตล์">{Icon.sliders({ width: 20, height: 20 })}</button>
      )}
      {panelOpen && (
        <div className="twk-panel">
          <div className="twk-top">
            <span className="twk-title">ปรับแต่งตาราง</span>
            <button className="twk-close" onClick={() => setPanelOpen(false)}>{Icon.x({ width: 16, height: 16 })}</button>
          </div>

          <div className="twk-h">สไตล์ตาราง</div>
          <div className="twk-variants">
            {VARIANTS.map((v) => (
              <button key={v.key} className={'twk-v' + (variant === v.key ? ' on' : '')} onClick={() => setVariant(v.key)}>
                <div className="vl">{v.label}</div><div className="vd">{v.desc}</div>
              </button>
            ))}
          </div>

          <div className="twk-h">ธีม</div>
          <div className="twk-row2">สีหลัก</div>
          <div className="twk-colors">
            {ACCENTS.map((c) => (
              <button key={c} className={'twk-color' + (accent === c ? ' on' : '')} style={{ background: c }} onClick={() => setAccent(c)} aria-label={c} />
            ))}
          </div>
          <div className="twk-row2" style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>สีประจำเวร</span>
            <button className="twk-reset" onClick={() => setShiftColors({ ...DEFAULT_SHIFT_COLORS })}>คืนค่าเริ่มต้น</button>
          </div>
          <div className="twk-shiftcolors">
            {SHIFT_COLOR_KEYS.map((s) => (
              <label key={s.key} className="twk-sc">
                <span className="sc-sw" style={{ background: shiftColors[s.key] }}>
                  <input type="color" value={shiftColors[s.key]} onChange={(e) => setShiftColors((c) => ({ ...c, [s.key]: e.target.value }))} />
                </span>
                <span className="sc-name">{s.label}<i>{s.short}</i></span>
              </label>
            ))}
          </div>
          <div className="twk-row2" style={{ marginTop: 12 }}>ฟอนต์</div>
          <select className="twk-select" value={font} onChange={(e) => setFont(e.target.value)}>
            {FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <div className="twk-row2" style={{ marginTop: 12 }}>ความหนาแน่น</div>
          <div className="twk-seg">
            {[{ v: 'compact', l: 'แน่น' }, { v: 'regular', l: 'ปกติ' }, { v: 'comfy', l: 'โปร่ง' }].map((o) => (
              <button key={o.v} className={density === o.v ? 'on' : ''} onClick={() => setDensity(o.v)}>{o.l}</button>
            ))}
          </div>

          <div className="twk-h">การช่วยอ่าน</div>
          <div className="twk-toggle">
            <span style={{ fontSize: 12.5 }}>ไฮไลต์เสาร์–อาทิตย์</span>
            <button className={'twk-sw' + (weekendHi ? ' on' : '')} onClick={() => setWeekendHi(!weekendHi)}><i /></button>
          </div>
          <div className="twk-row2" style={{ marginTop: 12 }}>เตือนเมื่อคนเข้าเวรน้อยกว่า <b style={{ color: 'var(--ink)' }}>{coverWarn} คน</b></div>
          <div className="twk-slider">
            <input type="range" min={1} max={7} value={coverWarn} onChange={(e) => setCoverWarn(Number(e.target.value))} />
          </div>
        </div>
      )}
    </div>
  );
}

const D2_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600;700&family=IBM+Plex+Sans+Thai:wght@400;500;600;700&family=Noto+Sans+Thai:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');

.d2 {
  --bg:#F6F7F9; --surface:#FFFFFF; --surface-2:#FBFBFD; --line:#EBEDF1; --line-2:#E2E5EA;
  --ink:#1B1E26; --ink-2:#5A616E; --ink-3:#8B919E; --brand-soft:#EEF0FE;
  --morning-tint:#def1f2; --morning-ink:#0d6b6d; --morning-solid:#139DA0; --morning-strong:#bde4e4;
  --after-tint:#FBF0D9; --after-ink:#9C6206; --after-solid:#E0991A; --after-strong:#F6E2B8;
  --night-tint:#EBEAFB; --night-ink:#4A45C2; --night-solid:#6366E8; --night-strong:#DBDBF7;
  --off-tint:#bababa; --off-ink:#1A1C1E; --off-solid:#bababa; --off-strong:#bababa;
  --warn:#E06A3A; --warn-tint:#FFF3EE;
  --fix-tint:#F3E8FF; --fix-ink:#7E22CE; --fix-solid:#A855F7; --fix-strong:#E9D5FF;
  --radius:14px; --radius-sm:9px;
  --shadow-sm:0 1px 2px rgba(20,24,40,.05),0 1px 1px rgba(20,24,40,.03);
  --shadow:0 6px 24px -8px rgba(20,24,40,.16),0 2px 6px -2px rgba(20,24,40,.08);
  --shadow-lg:0 18px 50px -12px rgba(20,24,40,.28);
  background:var(--bg); color:var(--ink); font-size:var(--fz,14px);
  -webkit-font-smoothing:antialiased; min-height:100vh; display:flex; flex-direction:column;
}
.d2 * { box-sizing:border-box; }
/* embedded ในเลย์เอาต์ที่มี header/sidebar อยู่แล้ว (callcenter) — ไม่ดัน 100vh, พื้นโปร่งให้กลืนกับ main */
.d2.d2-embed { min-height:auto; background:transparent; }
.d2.d2-embed .topbar { border-radius:14px 14px 0 0; border:1px solid var(--line); }
.d2.d2-embed .zones { border-left:1px solid var(--line); border-right:1px solid var(--line); }
.d2.d2-embed .toolbar { border-left:1px solid var(--line); border-right:1px solid var(--line); }
.d2 .mono { font-family:"JetBrains Mono", ui-monospace, monospace; font-feature-settings:"tnum"; }

.d2 .topbar { display:flex; align-items:center; gap:18px; padding:16px 26px 14px; background:var(--surface); border-bottom:1px solid var(--line); }
.d2 .brand-mark { width:38px; height:38px; border-radius:11px; background:linear-gradient(150deg,var(--brand),#6D63F0); display:grid; place-items:center; color:#fff; flex:none; box-shadow:0 6px 16px -6px rgba(79,70,229,.7); }
.d2 .brand-mark svg { width:20px; height:20px; }
.d2 .brand-text h1 { margin:0; font-size:17px; font-weight:600; letter-spacing:-.01em; }
.d2 .brand-text p { margin:1px 0 0; font-size:12.5px; color:var(--ink-3); }
.d2 .save-group { margin-left:auto; display:flex; align-items:center; gap:11px; }
.d2 .save-status { display:inline-flex; align-items:center; gap:5px; font-size:12px; font-weight:600; white-space:nowrap; }
.d2 .save-status.dirty { color:#B45309; }
.d2 .save-status.ok { color:#0C7A53; }
.d2 .save-status.busy { color:var(--ink-3); }
.d2 .save-status.none { color:var(--ink-3); font-weight:500; }
.d2 .save-btn { padding:8px 16px; border-radius:10px; border:1px solid var(--brand); background:var(--brand); color:#fff; font:inherit; font-size:13px; font-weight:600; cursor:pointer; box-shadow:var(--shadow-sm); transition:.15s; white-space:nowrap; }
.d2 .save-btn:hover:not(:disabled) { filter:brightness(1.07); }
.d2 .save-btn:disabled { opacity:.6; cursor:default; }
.d2 .save-note { font-size:11px; color:#B45309; white-space:nowrap; }
.d2 .month-chip { display:flex; align-items:center; gap:10px; padding:7px 8px 7px 14px; background:var(--surface-2); border:1px solid var(--line-2); border-radius:11px; font-weight:500; }
.d2 .month-chip .nav { display:flex; gap:4px; }
.d2 .month-chip button { width:28px; height:28px; border-radius:8px; border:1px solid var(--line-2); background:#fff; color:var(--ink-2); cursor:pointer; display:grid; place-items:center; transition:.15s; }
.d2 .month-chip button:hover { background:var(--brand-soft); color:var(--brand-ink); border-color:#D6D8FB; }

.d2 .zones { display:flex; align-items:center; gap:6px; flex-wrap:wrap; padding:11px 26px; background:var(--surface); border-bottom:1px solid var(--line); }
.d2 .zone-head { display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:700; letter-spacing:.04em; padding:5px 12px; border-radius:999px; text-transform:uppercase; color:var(--rink); background:var(--tint); }
.d2 .zone-head::before { content:''; width:7px; height:7px; border-radius:50%; background:var(--dot); flex:none; }
.d2 .zone-head:not(:first-child) { margin-left:18px; }
.d2 .zone { display:inline-flex; align-items:center; gap:7px; padding:5px 9px 5px 12px; border-radius:9px; font-size:13px; font-weight:500; color:var(--ink-2); background:transparent; border:1px solid transparent; cursor:pointer; transition:.15s; }
.d2 .zone:hover { background:var(--surface-2); border-color:var(--line); }
.d2 .zone .cnt { font-size:11px; font-weight:600; min-width:18px; height:18px; padding:0 5px; border-radius:6px; background:var(--line); color:var(--ink-2); display:grid; place-items:center; }
.d2 .zone.active { background:var(--ztint); color:var(--zink); border-color:var(--ztint); font-weight:600; }
.d2 .zone.active .cnt { background:var(--zdot); color:#fff; }

.d2 .toolbar { display:flex; align-items:center; gap:16px; flex-wrap:wrap; padding:14px 26px; }
.d2 .search { display:flex; align-items:center; gap:9px; background:var(--surface); border:1px solid var(--line-2); border-radius:11px; padding:9px 13px; width:290px; box-shadow:var(--shadow-sm); transition:.15s; }
.d2 .search:focus-within { border-color:var(--brand); box-shadow:0 0 0 3px var(--brand-soft); }
.d2 .search svg { width:16px; height:16px; color:var(--ink-3); flex:none; }
.d2 .search input { border:none; outline:none; background:none; font:inherit; width:100%; color:var(--ink); }
.d2 .search input::placeholder { color:var(--ink-3); }
.d2 .search .clear { cursor:pointer; color:var(--ink-3); display:grid; place-items:center; }
.d2 .search .clear:hover { color:var(--ink); }
.d2 .legend { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
.d2 .legend-item { display:inline-flex; align-items:center; gap:7px; font-size:12.5px; color:var(--ink-2); white-space:nowrap; }
.d2 .legend-dot { width:11px; height:11px; border-radius:4px; }
.d2 .stat-pills { margin-left:auto; display:flex; gap:8px; }
.d2 .stat-pill { display:flex; align-items:center; gap:9px; background:var(--surface); border:1px solid var(--line); border-radius:11px; padding:8px 13px; box-shadow:var(--shadow-sm); }
.d2 .stat-pill .n { font-size:17px; font-weight:700; letter-spacing:-.02em; }
.d2 .stat-pill .l { font-size:11px; color:var(--ink-3); line-height:1.15; }
.d2 .stat-pill.warn .n { color:var(--warn); }

.d2 .grid-wrap { margin:4px 26px 30px; flex:1; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); box-shadow:var(--shadow); overflow:auto; }
.d2 table.gtbl { border-collapse:separate; border-spacing:0; width:100%; }
.d2 .gtbl th, .d2 .gtbl td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); }
.d2 .gtbl thead th { position:sticky; top:0; z-index:6; background:var(--surface); }
.d2 .col-day, .d2 .col-dow, .d2 .col-cover { position:sticky; z-index:5; background:var(--surface); }
.d2 .col-day { left:0; width:52px; min-width:52px; }
.d2 .col-dow { left:52px; width:96px; min-width:96px; box-shadow:6px 0 12px -8px rgba(20,24,40,.18); }
.d2 .col-cover { left:148px; width:70px; min-width:70px; box-shadow:6px 0 12px -8px rgba(20,24,40,.18); }
.d2 thead .col-day, .d2 thead .col-dow, .d2 thead .col-cover { z-index:8; }
.d2 .head-meta { padding:0; vertical-align:bottom; }
.d2 .head-meta .lbl { font-size:11px; color:var(--ink-3); font-weight:600; padding:10px 8px; text-align:center; letter-spacing:.03em; }
.d2 .staff-head { padding:0; vertical-align:top; min-width:150px; }
.d2 .staff-card { padding:11px 12px 10px; text-align:left; position:relative; }
.d2 .staff-card .code { display:block; width:100%; border:none; background:transparent; outline:none; padding:0 18px 0 0; font-size:11px; font-weight:700; color:var(--brand-ink); letter-spacing:.03em; font-family:"JetBrains Mono", monospace; }
.d2 .staff-card .nm { display:block; width:100%; border:none; background:transparent; outline:none; padding:0; font-size:13.5px; font-weight:600; margin-top:2px; line-height:1.25; color:var(--ink); font-family:inherit; }
.d2 .staff-card .code:focus, .d2 .staff-card .nm:focus { background:var(--brand-soft); border-radius:4px; }
.d2 .minibar { display:flex; height:6px; border-radius:4px; overflow:hidden; margin-top:8px; background:var(--off-strong); }
.d2 .minibar i { display:block; height:100%; }
.d2 .minibar i.m { background:var(--morning-solid); }
.d2 .minibar i.a { background:var(--after-solid); }
.d2 .minibar i.n { background:var(--night-solid); }
.d2 .mini-counts { display:flex; gap:9px; margin-top:6px; font-size:11px; color:var(--ink-2); white-space:nowrap; }
.d2 .mini-counts b { font-weight:700; color:var(--ink); }
.d2 .mini-counts .nightc { color:var(--night-ink); }
.d2 .col-day .d { text-align:center; padding:0; }
.d2 .col-day .dnum { font-size:14px; font-weight:600; font-family:"JetBrains Mono", monospace; }
.d2 td.col-dow { padding:8px 12px; color:var(--ink-2); font-size:13px; }
.d2 tr.weekend td.col-day .dnum, .d2 tr.weekend td.col-dow { color:var(--warn); }
.d2 tr.sun td.col-day .dnum, .d2 tr.sun td.col-dow { color:#C0392B; }
.d2 tr.weekend td.col-day, .d2 tr.weekend td.col-dow, .d2 tr.weekend td.col-cover { background:var(--warn-tint); }
.d2 tr.weekend td.shift-cell { background:#FDFAF8; }
.d2 .cover { display:flex; flex-direction:column; align-items:center; gap:2px; padding:7px 0; }
.d2 .cover .cv { font-size:14px; font-weight:700; font-family:"JetBrains Mono", monospace; }
.d2 .cover .bar { width:40px; height:4px; border-radius:3px; background:var(--off-strong); overflow:hidden; }
.d2 .cover .bar i { display:block; height:100%; background:var(--morning-solid); }
.d2 .cover.low .cv { color:var(--warn); }
.d2 .cover.low .bar i { background:var(--warn); }

.d2 td.shift-cell { padding:4px; height:var(--cell-h,46px); background:var(--surface); }
.d2 .cell { position:relative; height:100%; border-radius:var(--radius-sm); cursor:pointer; display:flex; align-items:center; transition:transform .12s, box-shadow .12s; outline:none; }
.d2 .cell:hover { box-shadow:0 0 0 2px var(--brand-soft), inset 0 0 0 1px #D6D8FB; }
.d2 .cell:focus-visible { box-shadow:0 0 0 2px var(--brand); }
.d2 .cell .lab, .d2 .cell .cell-time { white-space:nowrap; }
.d2 .cell-time { font-family:"JetBrains Mono", monospace; }
.d2 .cell[data-tone="morning"] { --tint:var(--morning-tint); --ink-c:var(--morning-ink); --solid:var(--morning-solid); --strong:var(--morning-strong); --on:var(--morning-on,#fff); }
.d2 .cell[data-tone="afternoon"] { --tint:var(--after-tint); --ink-c:var(--after-ink); --solid:var(--after-solid); --strong:var(--after-strong); --on:var(--after-on,#fff); }
.d2 .cell[data-tone="night"] { --tint:var(--night-tint); --ink-c:var(--night-ink); --solid:var(--night-solid); --strong:var(--night-strong); --on:var(--night-on,#fff); }
.d2 .cell[data-tone="off"] { --tint:var(--off-tint); --ink-c:var(--off-ink); --solid:var(--off-solid); --strong:var(--off-strong); --on:var(--off-on,#fff); }
.d2 .cell[data-tone="fix"] { --tint:var(--fix-tint); --ink-c:var(--fix-ink); --solid:var(--fix-solid); --strong:var(--fix-strong); --on:#fff; }
.d2 .cell[data-tone="none"] { --tint:#fff; --ink-c:var(--warn); --solid:var(--warn); --strong:var(--warn-tint); }

.d2[data-variant="pills"] .cell { padding:0 7px; justify-content:flex-start; }
.d2[data-variant="pills"] .cell .body { display:flex; align-items:center; gap:8px; width:100%; background:var(--tint); border-radius:8px; padding:6px 10px; }
.d2[data-variant="pills"] .cell .dot { width:8px; height:8px; border-radius:50%; background:var(--solid); flex:none; }
.d2[data-variant="pills"] .cell .lab { font-size:12.5px; font-weight:600; color:var(--ink-c); }
.d2[data-variant="pills"] .cell .cell-time { font-size:11px; color:var(--ink-c); opacity:.72; margin-left:auto; }
.d2[data-variant="pills"] .cell[data-tone="off"] .body, .d2[data-variant="pills"] .cell[data-tone="none"] .body { justify-content:center; }
.d2[data-variant="pills"] .cell[data-tone="off"] .cell-time, .d2[data-variant="pills"] .cell[data-tone="none"] .cell-time { display:none; }
.d2[data-variant="pills"] .cell[data-tone="none"] .body { background:#fff; border:1.5px dashed #E9C3B2; }
.d2[data-variant="pills"] .cell[data-tone="none"] .dot { background:var(--warn); }

.d2[data-variant="accent"] .cell { padding:0; }
.d2[data-variant="accent"] .cell .body { display:flex; flex-direction:column; justify-content:center; width:100%; height:100%; padding:5px 11px; border-left:3px solid var(--solid); border-radius:0 8px 8px 0; background:linear-gradient(90deg,var(--tint),transparent 78%); }
.d2[data-variant="accent"] .cell .dot { display:none; }
.d2[data-variant="accent"] .cell .lab { font-size:12.5px; font-weight:600; color:var(--ink-c); }
.d2[data-variant="accent"] .cell .cell-time { font-size:10.5px; color:var(--ink-2); }
.d2[data-variant="accent"] .cell[data-tone="off"] .cell-time, .d2[data-variant="accent"] .cell[data-tone="none"] .cell-time { display:none; }
.d2[data-variant="accent"] .cell[data-tone="off"] .body { background:none; }
.d2[data-variant="accent"] .cell[data-tone="none"] .body { background:none; border-left-style:dashed; }

.d2[data-variant="blocks"] td.shift-cell { padding:2px; }
.d2[data-variant="blocks"] .cell { padding:0; }
.d2[data-variant="blocks"] .cell .body { display:flex; align-items:center; gap:8px; width:100%; height:100%; padding:6px 11px; background:var(--strong); border-radius:7px; }
.d2[data-variant="blocks"] .cell .dot { width:22px; height:22px; border-radius:6px; background:var(--solid); color:var(--on,#fff); display:grid; place-items:center; font-size:12px; font-weight:700; flex:none; }
.d2[data-variant="blocks"] .cell .dot::after { content:attr(data-n); font-family:"JetBrains Mono", monospace; }
.d2[data-variant="blocks"] .cell .lab { font-size:12.5px; font-weight:700; color:var(--ink-c); }
.d2[data-variant="blocks"] .cell .cell-time { font-size:10.5px; color:var(--ink-c); opacity:.75; margin-left:auto; }
.d2[data-variant="blocks"] .cell[data-tone="off"] .dot, .d2[data-variant="blocks"] .cell[data-tone="none"] .dot { display:none; }
.d2[data-variant="blocks"] .cell[data-tone="off"] .body, .d2[data-variant="blocks"] .cell[data-tone="none"] .body { justify-content:center; }
.d2[data-variant="blocks"] .cell[data-tone="off"] .cell-time, .d2[data-variant="blocks"] .cell[data-tone="none"] .cell-time { display:none; }
.d2[data-variant="blocks"] .cell[data-tone="none"] .body { background:#fff; border:1.5px dashed #E9C3B2; }

.d2[data-variant="minimal"] .cell { padding:0 8px; justify-content:center; }
.d2[data-variant="minimal"] .cell .body { display:flex; align-items:center; gap:9px; width:100%; justify-content:center; border-bottom:2px solid var(--solid); padding:7px 4px 6px; }
.d2[data-variant="minimal"] .cell .dot { width:20px; height:20px; border-radius:50%; border:1.5px solid var(--solid); color:var(--ink-c); display:grid; place-items:center; font-size:11px; font-weight:700; flex:none; font-family:"JetBrains Mono", monospace; }
.d2[data-variant="minimal"] .cell .dot::after { content:attr(data-n); }
.d2[data-variant="minimal"] .cell .lab { display:none; }
.d2[data-variant="minimal"] .cell .cell-time { font-size:11px; color:var(--ink-2); font-weight:500; }
.d2[data-variant="minimal"] .cell[data-tone="off"] .body, .d2[data-variant="minimal"] .cell[data-tone="none"] .body { border-bottom-color:var(--line-2); }
.d2[data-variant="minimal"] .cell[data-tone="off"] .cell-time, .d2[data-variant="minimal"] .cell[data-tone="none"] .cell-time { color:var(--ink-3); }
.d2[data-variant="minimal"] .cell[data-tone="off"] .dot { border-color:var(--off-solid); color:var(--off-ink); }
.d2[data-variant="minimal"] .cell[data-tone="none"] .dot { border-style:dashed; border-color:var(--warn); color:var(--warn); }
.d2[data-variant="minimal"] .cell[data-tone="none"] .body { border-bottom-color:transparent; }

.d2 .cell[data-tone="none"]::after { content:""; position:absolute; top:4px; right:4px; width:5px; height:5px; border-radius:50%; background:var(--warn); }
.d2[data-variant="blocks"] .cell[data-tone="none"]::after, .d2[data-variant="pills"] .cell[data-tone="none"]::after { display:none; }

.d2 tfoot td { position:sticky; bottom:0; z-index:5; background:var(--surface-2); border-top:2px solid var(--line-2); }
.d2 tfoot .col-day, .d2 tfoot .col-dow, .d2 tfoot .col-cover { background:var(--surface-2); }
.d2 .totals { padding:9px 12px; }
.d2 .totals .ttl-row { display:flex; gap:8px; flex-wrap:wrap; }
.d2 .tchip { display:inline-flex; align-items:center; gap:5px; font-size:11.5px; color:var(--ink-2); }
.d2 .tchip .sw { width:9px; height:9px; border-radius:3px; }
.d2 .tchip b { color:var(--ink); font-weight:700; font-family:"JetBrains Mono", monospace; }
.d2 .totals .foot-lbl { font-size:11px; font-weight:600; color:var(--ink-3); letter-spacing:.03em; }
.d2 .col-dim { opacity:.28; filter:grayscale(.4); }

.d2 .pop-backdrop { position:fixed; inset:0; z-index:40; }
.d2 .popover { position:fixed; z-index:41; width:234px; max-height:calc(100vh - 24px); overflow-y:auto; background:var(--surface); border:1px solid var(--line-2); border-radius:14px; box-shadow:var(--shadow-lg); padding:7px; animation:d2pop .14s cubic-bezier(.2,.9,.3,1.2); }
@keyframes d2pop { from { transform:translateY(-6px) scale(.985); } to { transform:none; } }
.d2 .pop-head { padding:7px 9px 8px; display:flex; align-items:center; justify-content:space-between; }
.d2 .pop-head .pt { font-size:12px; color:var(--ink-3); }
.d2 .pop-head .pd { font-size:13px; font-weight:600; }
.d2 .pop-opt { display:flex; align-items:center; gap:11px; width:100%; padding:9px 10px; border-radius:9px; border:1px solid transparent; background:none; cursor:pointer; text-align:left; transition:.12s; margin-bottom:1px; }
.d2 .pop-opt:hover { background:var(--surface-2); }
.d2 .pop-opt.sel { background:var(--brand-soft); border-color:#DCDCFB; }
.d2 .pop-opt .oico { width:30px; height:30px; border-radius:8px; display:grid; place-items:center; font-weight:700; font-family:"JetBrains Mono", monospace; flex:none; color:#fff; font-size:13px; }
.d2 .pop-opt .ol { flex:1; display:flex; flex-direction:column; gap:1px; }
.d2 .pop-opt .ol .a { font-size:13px; font-weight:600; }
.d2 .pop-opt .ol .b { font-size:11px; color:var(--ink-3); font-family:"JetBrains Mono", monospace; }
.d2 .pop-opt .chk { color:var(--brand); opacity:0; }
.d2 .pop-opt.sel .chk { opacity:1; }

/* on-page style switcher */
.d2 .twk-fab { position:fixed; right:22px; bottom:22px; z-index:30; width:48px; height:48px; border-radius:50%; background:var(--brand); color:#fff; border:none; box-shadow:var(--shadow); cursor:pointer; display:grid; place-items:center; }
.d2 .twk-panel { position:fixed; right:22px; bottom:22px; z-index:31; width:286px; max-height:calc(100vh - 44px); overflow:auto; background:var(--surface); border:1px solid var(--line-2); border-radius:16px; box-shadow:var(--shadow-lg); padding:16px; }
.d2 .twk-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:4px; }
.d2 .twk-title { font-size:14px; font-weight:700; }
.d2 .twk-close { width:28px; height:28px; border-radius:8px; border:1px solid var(--line-2); background:var(--surface-2); color:var(--ink-2); cursor:pointer; display:grid; place-items:center; }
.d2 .twk-h { font-size:11px; font-weight:700; color:var(--ink-3); letter-spacing:.04em; text-transform:uppercase; margin:15px 0 9px; }
.d2 .twk-variants { display:grid; grid-template-columns:1fr 1fr; gap:7px; }
.d2 .twk-v { text-align:left; padding:9px 11px; border-radius:10px; cursor:pointer; border:1px solid var(--line-2); background:var(--surface-2); }
.d2 .twk-v.on { border-color:var(--brand); background:var(--brand-soft); }
.d2 .twk-v .vl { font-size:12.5px; font-weight:600; color:var(--ink); }
.d2 .twk-v .vd { font-size:10.5px; color:var(--ink-3); margin-top:1px; }
.d2 .twk-row2 { font-size:12.5px; color:var(--ink-2); margin-bottom:7px; }
.d2 .twk-colors { display:flex; gap:8px; }
.d2 .twk-color { width:28px; height:28px; border-radius:8px; cursor:pointer; border:2px solid #fff; box-shadow:0 0 0 1px var(--line-2); }
.d2 .twk-color.on { box-shadow:0 0 0 2px var(--brand); }
.d2 .twk-reset { font:inherit; font-size:11px; font-weight:600; color:var(--brand); background:none; border:none; padding:0; cursor:pointer; }
.d2 .twk-reset:hover { text-decoration:underline; }
.d2 .twk-shiftcolors { display:grid; grid-template-columns:1fr 1fr; gap:9px 12px; }
.d2 .twk-sc { display:flex; align-items:center; gap:9px; cursor:pointer; }
.d2 .twk-sc .sc-sw { position:relative; width:30px; height:30px; border-radius:9px; flex:none; box-shadow:inset 0 0 0 1px rgba(0,0,0,.10); overflow:hidden; }
.d2 .twk-sc .sc-sw input[type="color"] { position:absolute; inset:-4px; width:calc(100% + 8px); height:calc(100% + 8px); padding:0; border:none; background:none; cursor:pointer; opacity:0; }
.d2 .twk-sc .sc-name { display:flex; flex-direction:column; line-height:1.18; font-size:12.5px; font-weight:600; color:var(--ink); }
.d2 .twk-sc .sc-name i { font-style:normal; font-size:10.5px; font-weight:500; color:var(--ink-3); }
.d2 .twk-select { width:100%; padding:8px 10px; border-radius:9px; border:1px solid var(--line-2); background:var(--surface-2); font:inherit; font-size:13px; color:var(--ink); cursor:pointer; }
.d2 .twk-seg { display:flex; gap:4px; background:var(--surface-2); border:1px solid var(--line-2); border-radius:10px; padding:3px; }
.d2 .twk-seg button { flex:1; padding:7px; border:none; background:none; border-radius:7px; font:inherit; font-size:12px; cursor:pointer; color:var(--ink-2); }
.d2 .twk-seg button.on { background:var(--surface); color:var(--ink); font-weight:600; box-shadow:var(--shadow-sm); }
.d2 .twk-toggle { display:flex; align-items:center; justify-content:space-between; }
.d2 .twk-sw { width:40px; height:23px; border-radius:99px; background:var(--line-2); position:relative; cursor:pointer; transition:.15s; border:none; padding:0; }
.d2 .twk-sw.on { background:var(--brand); }
.d2 .twk-sw i { position:absolute; top:2.5px; left:2.5px; width:18px; height:18px; border-radius:50%; background:#fff; transition:.15s; }
.d2 .twk-sw.on i { left:19px; }
.d2 .twk-slider input { width:100%; accent-color:var(--brand); }

.d2 .add-staff { display:inline-flex; align-items:center; gap:6px; padding:9px 14px; border-radius:11px; border:1px solid var(--brand); background:var(--brand); color:#fff; font:inherit; font-size:13px; font-weight:600; cursor:pointer; box-shadow:var(--shadow-sm); white-space:nowrap; }
.d2 .add-staff:hover { filter:brightness(1.07); }
.d2 .sc-x { position:absolute; top:9px; right:9px; width:18px; height:18px; border-radius:5px; border:1px solid var(--line-2); background:var(--surface-2); color:var(--ink-3); font-size:10px; line-height:1; cursor:pointer; padding:0; display:grid; place-items:center; z-index:2; }
.d2 .sc-x:hover { background:var(--warn); color:#fff; border-color:var(--warn); }
.d2 .sc-confirm { position:absolute; top:7px; right:7px; display:flex; gap:4px; z-index:3; }
.d2 .sc-yes { font:inherit; font-size:10.5px; font-weight:700; padding:3px 9px; border-radius:6px; border:none; background:var(--warn); color:#fff; cursor:pointer; }
.d2 .sc-no { font:inherit; font-size:10.5px; font-weight:600; padding:3px 9px; border-radius:6px; border:1px solid var(--line-2); background:var(--surface); color:var(--ink-2); cursor:pointer; }

@media (max-width:980px) { .d2 .stat-pills { width:100%; margin-left:0; } .d2 .search { width:100%; } }
`;
