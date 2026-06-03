'use client';

import { useState, useMemo, useEffect } from 'react';
import { IBM_Plex_Sans_Thai, IBM_Plex_Mono } from 'next/font/google';
import {
  ROSTER, SHIFTS, REGIONS, STATUS_META, deriveStatus,
  type Person, type ShiftKey, type RegionKey, type Status,
} from './roster-data';

const plexThai = IBM_Plex_Sans_Thai({ subsets: ['thai', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex-thai', display: 'swap' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-mono', display: 'swap' });

const SHIFT_ORDER: ShiftKey[] = ['morning', 'afternoon', 'night', 'fix'];

type Station = { name: string; people: Person[]; byShift: Partial<Record<ShiftKey, Person[]>> };

const tagClass = (tag: string) => (tag.startsWith('FIX') ? 't-fix' : tag === 'อาสา' ? 't-vol' : 't-soft');

// ── สถานะ (จุดสี) ──────────────────────────────────────
function StatusDot({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return <span className="dot" style={{ background: m.dot }} title={m.label} />;
}

// ── ชิปเวลาเข้างาน ──────────────────────────────────────
function TimeChip({ t }: { t: string }) {
  const status = deriveStatus(t);
  const v = (t || '').trim();
  const text = status === 'pending' ? '—' : v;
  return (
    <span className={`timechip s-${status}`}>
      {status === 'present' && <span className="tc-ic">●</span>}
      {text}
    </span>
  );
}

// ── แถวบุคคล ────────────────────────────────────────────
function PersonRow({ p, onSelect, active }: { p: Person; onSelect: (p: Person) => void; active: boolean }) {
  return (
    <button className={`person ${active ? 'is-active' : ''}`} onClick={() => onSelect(p)}>
      <span className="p-code">{p.c}</span>
      <span className="p-main">
        <span className="p-name">{p.n}</span>
        <span className="p-phone">{p.p}</span>
      </span>
      <span className="p-tags">
        {p.tags.map((tag) => (
          <span key={tag} className={`tag ${tagClass(tag)}`}>{tag}</span>
        ))}
      </span>
      <span className="p-time"><TimeChip t={p.t} /></span>
    </button>
  );
}

// ── กลุ่มเวรภายในการ์ดประจำจุด ─────────────────────────
function ShiftGroup({ shiftKey, people, onSelect, selected }: { shiftKey: ShiftKey; people: Person[]; onSelect: (p: Person) => void; selected: Person | null }) {
  const sh = SHIFTS[shiftKey];
  return (
    <div className={`shiftgroup sg-${shiftKey}`}>
      <div className="sg-head">
        <span className="sg-bar" />
        <span className="sg-label">{sh.short}</span>
        <span className="sg-range">{sh.range}</span>
        <span className="sg-count">{people.length}</span>
      </div>
      <div className="sg-people">
        {people.map((p) => (
          <PersonRow key={p.c + p.n} p={p} onSelect={onSelect} active={!!selected && selected.c === p.c && selected.n === p.n} />
        ))}
      </div>
    </div>
  );
}

// ── การ์ดประจำจุด ───────────────────────────────────────
function StationCard({ station, onSelect, selected }: { station: Station; onSelect: (p: Person) => void; selected: Person | null }) {
  const present = station.people.filter((p) => deriveStatus(p.t) === 'present').length;
  const total = station.people.length;
  const pct = total ? Math.round((present / total) * 100) : 0;
  return (
    <div className="card">
      <div className="card-head">
        <div className="ch-left">
          <span className="ch-pin">◈</span>
          <h3 className="ch-name">{station.name}</h3>
        </div>
        <div className="ch-meter" title={`เข้างาน ${present}/${total}`}>
          <span className="ch-frac"><b>{present}</b>/{total}</span>
          <span className="ch-bar"><span className="ch-fill" style={{ width: pct + '%' }} /></span>
        </div>
      </div>
      <div className="card-body">
        {SHIFT_ORDER.filter((k) => station.byShift[k] && station.byShift[k]!.length).map((k) => (
          <ShiftGroup key={k} shiftKey={k} people={station.byShift[k]!} onSelect={onSelect} selected={selected} />
        ))}
      </div>
    </div>
  );
}

// ── ลิ้นชักรายละเอียด ───────────────────────────────────
function DetailDrawer({ p, onClose }: { p: Person | null; onClose: () => void }) {
  if (!p) return null;
  const status = deriveStatus(p.t);
  const m = STATUS_META[status];
  const sh = SHIFTS[p.sh];
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer">
        <button className="dw-close" onClick={onClose}>✕</button>
        <div className="dw-top">
          <span className="dw-code">{p.c}</span>
          <span className="dw-status"><StatusDot status={status} />{m.label}</span>
        </div>
        <h2 className="dw-name">{p.n}</h2>
        <a className="dw-phone" href={`tel:${p.p.replace(/-/g, '')}`}>{p.p}</a>

        <div className="dw-grid">
          <div className="dw-cell"><span className="dw-k">ประจำจุด</span><span className="dw-v">{p.s}</span></div>
          <div className="dw-cell"><span className="dw-k">ภูมิภาค</span><span className="dw-v">{REGIONS[p.region]}</span></div>
          <div className="dw-cell"><span className="dw-k">เวร</span><span className="dw-v">{sh.label}</span></div>
          <div className="dw-cell"><span className="dw-k">ช่วงเวลา</span><span className="dw-v">{sh.range}</span></div>
          <div className="dw-cell"><span className="dw-k">เวลาเข้างาน</span><span className="dw-v"><TimeChip t={p.t} /></span></div>
        </div>

        {p.tags.length > 0 && (
          <div className="dw-tags">
            {p.tags.map((tag) => (<span key={tag} className={`tag ${tagClass(tag)}`}>{tag}</span>))}
          </div>
        )}

        {p.note && (
          <div className="dw-note"><span className="dw-k">หมายเหตุ</span><p>{p.note}</p></div>
        )}
      </aside>
    </>
  );
}

// ── สรุปยอด ─────────────────────────────────────────────
function StatPills({ rows }: { rows: Person[] }) {
  const counts = useMemo(() => {
    const c: Record<Status, number> & { fix: number } = { present: 0, pending: 0, leave: 0, off: 0, watch: 0, fix: 0 };
    rows.forEach((p) => { c[deriveStatus(p.t)]++; if (p.sh === 'fix') c.fix++; });
    return c;
  }, [rows]);
  const items = [
    { k: 'total', label: 'ทั้งหมด', v: rows.length, cls: 'st-total' },
    { k: 'present', label: 'เข้างานแล้ว', v: counts.present, cls: 'st-ok' },
    { k: 'pending', label: 'รอเข้างาน', v: counts.pending, cls: 'st-pending' },
    { k: 'leave', label: 'ลา', v: counts.leave, cls: 'st-leave' },
    { k: 'off', label: 'วันหยุด', v: counts.off, cls: 'st-off' },
    { k: 'fix', label: 'FIX', v: counts.fix, cls: 'st-fix' },
  ];
  return (
    <div className="stats">
      {items.map((it) => (
        <div key={it.k} className={`stat ${it.cls}`}>
          <span className="stat-v">{it.v}</span>
          <span className="stat-l">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── หน้าหลัก ─────────────────────────────────────────────
export default function DutyRosterPage() {
  const [q, setQ] = useState('');
  const [shift, setShift] = useState<ShiftKey | 'all'>('all');
  const [region, setRegion] = useState<RegionKey | 'all'>('all');
  const [statusF, setStatusF] = useState<Status | 'all'>('all');
  const [sortMode, setSortMode] = useState<'name' | 'count'>('name');
  const [selected, setSelected] = useState<Person | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return ROSTER.filter((p) => {
      if (shift !== 'all' && p.sh !== shift) return false;
      if (region !== 'all' && p.region !== region) return false;
      if (statusF !== 'all' && deriveStatus(p.t) !== statusF) return false;
      if (term) {
        const hay = `${p.c} ${p.n} ${p.p} ${p.s}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [q, shift, region, statusF]);

  // จัดกลุ่มตามภูมิภาค → ประจำจุด
  const regionGroups = useMemo(() => {
    const order: RegionKey[] = ['bkk', 'upc'];
    return order.map((rk) => {
      const rows = filtered.filter((p) => p.region === rk);
      const byStation: Record<string, Person[]> = {};
      rows.forEach((p) => { (byStation[p.s] = byStation[p.s] || []).push(p); });
      const stations: Station[] = Object.keys(byStation).map((name) => {
        const people = byStation[name];
        const byShift: Partial<Record<ShiftKey, Person[]>> = {};
        people.forEach((p) => { (byShift[p.sh] = byShift[p.sh] || []).push(p); });
        return { name, people, byShift };
      });
      if (sortMode === 'count') stations.sort((a, b) => b.people.length - a.people.length);
      else stations.sort((a, b) => a.name.localeCompare(b.name, 'th'));
      return { rk, stations, total: rows.length };
    }).filter((g) => g.stations.length);
  }, [filtered, sortMode]);

  const shiftChips = [
    { k: 'all', label: 'ทุกเวร' },
    { k: 'morning', label: 'เช้า' },
    { k: 'afternoon', label: 'บ่าย' },
    { k: 'night', label: 'ดึก' },
    { k: 'fix', label: 'FIX' },
  ];
  const regionChips = [
    { k: 'all', label: 'ทั้งหมด' },
    { k: 'bkk', label: 'กรุงเทพฯ–ปริมณฑล' },
    { k: 'upc', label: 'ต่างจังหวัด' },
  ];
  const statusChips = [
    { k: 'all', label: 'ทุกสถานะ' },
    { k: 'present', label: 'เข้างานแล้ว' },
    { k: 'pending', label: 'รอเข้างาน' },
    { k: 'leave', label: 'ลา' },
    { k: 'off', label: 'หยุด' },
    { k: 'watch', label: 'เฝ้าระวัง' },
  ];

  return (
    <div className={`dr ${plexThai.variable} ${plexMono.variable}`}>
      <style dangerouslySetInnerHTML={{ __html: DR_CSS }} />

      <header className="topbar">
        <div className="tb-id">
          <div className="tb-mark">SE<span>·</span>AISI</div>
          <div className="tb-title">
            <h1>ตารางเวรประจำจุด</h1>
            <p>รายชื่อพนักงาน · ประจำวันที่ 28 พฤษภาคม 2569</p>
          </div>
        </div>
        <StatPills rows={filtered} />
      </header>

      <div className="toolbar">
        <div className="search">
          <span className="search-ic">⌕</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา ชื่อ · รหัส · เบอร์ · ประจำจุด" />
          {q && <button className="search-clear" onClick={() => setQ('')}>✕</button>}
        </div>

        <div className="chips">
          {shiftChips.map((c) => (
            <button key={c.k} className={`chip ${shift === c.k ? 'on' : ''} ck-${c.k}`} onClick={() => setShift(c.k as ShiftKey | 'all')}>{c.label}</button>
          ))}
        </div>

        <div className="chips">
          {regionChips.map((c) => (
            <button key={c.k} className={`chip ${region === c.k ? 'on' : ''}`} onClick={() => setRegion(c.k as RegionKey | 'all')}>{c.label}</button>
          ))}
        </div>

        <div className="chips">
          {statusChips.map((c) => (
            <button key={c.k} className={`chip soft ${statusF === c.k ? 'on' : ''}`} onClick={() => setStatusF(c.k as Status | 'all')}>{c.label}</button>
          ))}
        </div>

        <div className="sort">
          <span>เรียง</span>
          <button className={sortMode === 'name' ? 'on' : ''} onClick={() => setSortMode('name')}>ชื่อจุด</button>
          <button className={sortMode === 'count' ? 'on' : ''} onClick={() => setSortMode('count')}>จำนวนคน</button>
        </div>
      </div>

      <main className="board">
        {regionGroups.length === 0 && (<div className="empty">ไม่พบรายการที่ตรงกับเงื่อนไข</div>)}
        {regionGroups.map((g) => (
          <section key={g.rk} className="region">
            <div className="region-head">
              <h2>{REGIONS[g.rk]}</h2>
              <span className="region-meta">{g.stations.length} จุด · {g.total} คน</span>
            </div>
            <div className="grid">
              {g.stations.map((st) => (
                <StationCard key={st.name} station={st} onSelect={setSelected} selected={selected} />
              ))}
            </div>
          </section>
        ))}
      </main>

      <DetailDrawer p={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

// ── สไตล์ (scope ไว้ใต้ .dr เพื่อไม่ชนกับ Tailwind ของแอป) ──
const DR_CSS = `
.dr {
  --bg: oklch(0.97 0.005 250); --surface: #ffffff; --surface-2: oklch(0.985 0.004 250);
  --ink: oklch(0.27 0.02 255); --ink-2: oklch(0.45 0.02 255); --muted: oklch(0.60 0.015 255);
  --line: oklch(0.91 0.006 255); --line-2: oklch(0.94 0.005 255);
  --brand: oklch(0.52 0.13 248); --brand-soft: oklch(0.95 0.03 248);
  --ok: oklch(0.62 0.13 152); --leave: oklch(0.60 0.19 25); --off: oklch(0.68 0.02 255);
  --watch: oklch(0.74 0.15 78); --pending: oklch(0.78 0.015 255); --fix: oklch(0.55 0.16 305);
  --r: 14px; --shadow: 0 1px 2px oklch(0.4 0.02 255 / 0.05), 0 6px 20px oklch(0.4 0.02 255 / 0.06);
  font-family: var(--font-plex-thai), system-ui, sans-serif;
  background: var(--bg); color: var(--ink); -webkit-font-smoothing: antialiased;
  font-size: 15px; line-height: 1.45;
  margin: -24px; min-height: calc(100vh - 52px);
}
.dr * { box-sizing: border-box; margin: 0; padding: 0; }
.dr .mono { font-family: var(--font-plex-mono), monospace; }
.dr h1, .dr h2, .dr h3 { font-weight: 600; letter-spacing: -0.01em; }

.dr .topbar { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap; padding: 16px 28px; background: oklch(0.99 0.003 250 / 0.85); backdrop-filter: blur(12px); border-bottom: 1px solid var(--line); }
.dr .tb-id { display: flex; align-items: center; gap: 16px; }
.dr .tb-mark { font-family: var(--font-plex-mono), monospace; font-weight: 600; font-size: 14px; letter-spacing: 0.04em; color: #fff; background: var(--brand); padding: 10px 12px; border-radius: 10px; line-height: 1; }
.dr .tb-mark span { opacity: 0.55; margin: 0 1px; }
.dr .tb-title h1 { font-size: 21px; }
.dr .tb-title p { font-size: 13px; color: var(--muted); margin-top: 2px; }

.dr .stats { display: flex; gap: 8px; flex-wrap: wrap; }
.dr .stat { display: flex; flex-direction: column; align-items: flex-start; min-width: 76px; padding: 8px 14px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; }
.dr .stat-v { font-family: var(--font-plex-mono), monospace; font-size: 22px; font-weight: 600; line-height: 1.1; }
.dr .stat-l { font-size: 11.5px; color: var(--muted); margin-top: 1px; }
.dr .st-ok .stat-v { color: var(--ok); }
.dr .st-pending .stat-v { color: oklch(0.62 0.015 255); }
.dr .st-leave .stat-v { color: var(--leave); }
.dr .st-off .stat-v { color: var(--off); }
.dr .st-fix .stat-v { color: var(--fix); }
.dr .st-total { background: var(--ink); border-color: var(--ink); }
.dr .st-total .stat-v { color: #fff; }
.dr .st-total .stat-l { color: oklch(0.8 0.01 255); }

.dr .toolbar { position: sticky; top: 73px; z-index: 20; display: flex; align-items: center; gap: 12px 16px; flex-wrap: wrap; padding: 12px 28px; background: oklch(0.99 0.003 250 / 0.8); backdrop-filter: blur(12px); border-bottom: 1px solid var(--line); }
.dr .search { display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 0 12px; height: 38px; min-width: 280px; flex: 1 1 280px; max-width: 360px; }
.dr .search:focus-within { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-soft); }
.dr .search-ic { color: var(--muted); font-size: 17px; }
.dr .search input { border: none; outline: none; background: none; flex: 1; font: inherit; color: var(--ink); }
.dr .search-clear { border: none; background: none; color: var(--muted); cursor: pointer; font-size: 13px; }

.dr .chips { display: flex; gap: 6px; flex-wrap: wrap; }
.dr .chip { font: inherit; font-size: 13.5px; padding: 7px 14px; border-radius: 999px; cursor: pointer; background: var(--surface); border: 1px solid var(--line); color: var(--ink-2); transition: all 0.12s; }
.dr .chip:hover { border-color: oklch(0.82 0.01 255); }
.dr .chip.on { background: var(--ink); color: #fff; border-color: var(--ink); }
.dr .chip.soft.on { background: var(--brand); border-color: var(--brand); }
.dr .chip.ck-morning.on { background: var(--ok); border-color: var(--ok); }
.dr .chip.ck-afternoon.on { background: var(--watch); border-color: var(--watch); color: oklch(0.3 0.05 78); }
.dr .chip.ck-night.on { background: oklch(0.42 0.08 262); border-color: oklch(0.42 0.08 262); color: #fff; }
.dr .chip.ck-fix.on { background: var(--fix); border-color: var(--fix); color: #fff; }

.dr .sort { display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--muted); margin-left: auto; }
.dr .sort button { font: inherit; font-size: 13px; padding: 6px 11px; border-radius: 8px; cursor: pointer; background: var(--surface); border: 1px solid var(--line); color: var(--ink-2); }
.dr .sort button.on { background: var(--brand-soft); border-color: var(--brand); color: var(--brand); font-weight: 500; }

.dr .board { padding: 24px 28px 80px; }
.dr .region { margin-bottom: 40px; }
.dr .region-head { display: flex; align-items: baseline; gap: 14px; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 2px solid var(--line); }
.dr .region-head h2 { font-size: 17px; color: var(--ink); }
.dr .region-meta { font-size: 13px; color: var(--muted); font-family: var(--font-plex-mono), monospace; }

.dr .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 16px; }

.dr .card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r); box-shadow: var(--shadow); overflow: hidden; display: flex; flex-direction: column; }
.dr .card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px 12px; border-bottom: 1px solid var(--line-2); background: linear-gradient(180deg, var(--surface-2), var(--surface)); }
.dr .ch-left { display: flex; align-items: center; gap: 9px; min-width: 0; }
.dr .ch-pin { color: var(--brand); font-size: 13px; }
.dr .ch-name { font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dr .ch-meter { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex-shrink: 0; }
.dr .ch-frac { font-family: var(--font-plex-mono), monospace; font-size: 12px; color: var(--muted); }
.dr .ch-frac b { color: var(--ok); font-weight: 600; }
.dr .ch-bar { width: 64px; height: 5px; border-radius: 99px; background: var(--line); overflow: hidden; }
.dr .ch-fill { display: block; height: 100%; background: var(--ok); border-radius: 99px; transition: width 0.3s; }

.dr .card-body { padding: 6px 8px 10px; display: flex; flex-direction: column; gap: 2px; }

.dr .shiftgroup { padding: 6px 6px 4px; }
.dr .sg-head { display: flex; align-items: center; gap: 8px; padding: 4px 6px; }
.dr .sg-bar { width: 3px; height: 13px; border-radius: 2px; background: var(--off); }
.dr .sg-morning .sg-bar { background: var(--ok); }
.dr .sg-afternoon .sg-bar { background: var(--watch); }
.dr .sg-night .sg-bar { background: oklch(0.5 0.09 262); }
.dr .sg-fix .sg-bar { background: var(--fix); }
.dr .sg-label { font-size: 12.5px; font-weight: 600; color: var(--ink-2); }
.dr .sg-range { font-family: var(--font-plex-mono), monospace; font-size: 11px; color: var(--muted); }
.dr .sg-count { margin-left: auto; font-family: var(--font-plex-mono), monospace; font-size: 11px; color: var(--muted); background: var(--surface-2); border: 1px solid var(--line-2); border-radius: 99px; padding: 1px 7px; }
.dr .sg-people { display: flex; flex-direction: column; gap: 2px; margin-top: 2px; }

.dr .person { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 10px; width: 100%; text-align: left; font: inherit; cursor: pointer; background: none; border: 1px solid transparent; border-radius: 9px; padding: 7px 8px; transition: background 0.1s, border-color 0.1s; }
.dr .person:hover { background: var(--surface-2); border-color: var(--line-2); }
.dr .person.is-active { background: var(--brand-soft); border-color: oklch(0.8 0.06 248); }
.dr .p-code { font-family: var(--font-plex-mono), monospace; font-size: 11px; font-weight: 500; color: var(--muted); background: var(--surface-2); border: 1px solid var(--line-2); border-radius: 6px; padding: 2px 6px; min-width: 34px; text-align: center; }
.dr .p-main { min-width: 0; display: flex; flex-direction: column; line-height: 1.25; }
.dr .p-name { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dr .p-phone { font-family: var(--font-plex-mono), monospace; font-size: 11px; color: var(--muted); }
.dr .p-tags { display: flex; gap: 4px; }
.dr .tag { font-size: 10.5px; font-weight: 500; padding: 2px 7px; border-radius: 99px; white-space: nowrap; }
.dr .t-vol { background: oklch(0.95 0.04 152); color: oklch(0.42 0.12 152); }
.dr .t-fix { background: oklch(0.95 0.04 305); color: var(--fix); }
.dr .t-soft { background: var(--surface-2); color: var(--muted); border: 1px solid var(--line-2); }

.dr .p-time { justify-self: end; }
.dr .timechip { font-family: var(--font-plex-mono), monospace; font-size: 12px; font-weight: 500; padding: 3px 9px; border-radius: 7px; white-space: nowrap; display: inline-flex; align-items: center; gap: 5px; }
.dr .tc-ic { font-size: 7px; }
.dr .s-present { background: oklch(0.95 0.05 152); color: oklch(0.42 0.12 152); }
.dr .s-present .tc-ic { color: var(--ok); }
.dr .s-leave { background: oklch(0.96 0.04 25); color: var(--leave); }
.dr .s-off { background: var(--surface-2); color: var(--off); border: 1px solid var(--line-2); }
.dr .s-watch { background: oklch(0.96 0.07 82); color: oklch(0.48 0.13 60); }
.dr .s-pending { background: var(--surface-2); color: var(--pending); border: 1px dashed var(--line); }

.dr .dot { width: 9px; height: 9px; border-radius: 99px; display: inline-block; }
.dr .empty { text-align: center; color: var(--muted); padding: 80px 0; font-size: 15px; }

.dr .scrim { position: fixed; inset: 0; background: oklch(0.3 0.02 255 / 0.28); z-index: 40; animation: dr-fade 0.15s; }
@keyframes dr-fade { from { opacity: 0; } }
.dr .drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(380px, 92vw); background: var(--surface); z-index: 50; box-shadow: -8px 0 40px oklch(0.3 0.02 255 / 0.18); padding: 28px; overflow-y: auto; animation: dr-slidein 0.2s cubic-bezier(0.2, 0.8, 0.2, 1); }
@keyframes dr-slidein { from { transform: translateX(40px); opacity: 0; } }
.dr .dw-close { position: absolute; top: 18px; right: 18px; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; background: var(--surface-2); border: 1px solid var(--line); color: var(--ink-2); font-size: 14px; }
.dr .dw-close:hover { background: var(--line-2); }
.dr .dw-top { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.dr .dw-code { font-family: var(--font-plex-mono), monospace; font-size: 13px; font-weight: 600; color: #fff; background: var(--brand); border-radius: 7px; padding: 4px 10px; }
.dr .dw-status { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ink-2); }
.dr .dw-name { font-size: 24px; margin-bottom: 2px; }
.dr .dw-phone { font-family: var(--font-plex-mono), monospace; font-size: 15px; color: var(--brand); text-decoration: none; }
.dr .dw-phone:hover { text-decoration: underline; }
.dr .dw-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--line-2); border: 1px solid var(--line-2); border-radius: 12px; overflow: hidden; margin: 22px 0; }
.dr .dw-cell { background: var(--surface); padding: 11px 14px; display: flex; flex-direction: column; gap: 4px; }
.dr .dw-cell:nth-child(5) { grid-column: 1 / -1; }
.dr .dw-k { font-size: 11.5px; color: var(--muted); }
.dr .dw-v { font-size: 14.5px; font-weight: 500; }
.dr .dw-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 18px; }
.dr .dw-note { background: var(--surface-2); border: 1px solid var(--line-2); border-radius: 12px; padding: 14px; }
.dr .dw-note p { margin-top: 6px; font-size: 14px; color: var(--ink-2); line-height: 1.55; }

@media (max-width: 720px) {
  .dr .topbar { padding: 14px 18px; position: static; }
  .dr .toolbar { padding: 12px 18px; top: 0; position: static; }
  .dr .board { padding: 20px 18px 60px; }
  .dr .grid { grid-template-columns: 1fr; }
  .dr .sort { margin-left: 0; }
  .dr .stats { width: 100%; }
  .dr .stat { flex: 1; min-width: 64px; }
}
`;
