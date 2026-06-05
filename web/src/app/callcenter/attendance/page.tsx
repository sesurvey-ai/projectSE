'use client';

// เวลาเข้างานพนักงาน — บอร์ดการ์ดตามพื้นที่ (จุด → เวร) ตามดีไซน์ "ตารางเวรประจำจุด"
// ข้อมูล: จุด+เวร+คน จากตารางจัดเวร (DB duty_schedules + seed roster-jun เหมือน duty-demo2)
//         overlay การลงเวลาจากแอป (attendance) จับคู่ด้วยรหัส SE → ใครเข้างานแล้ว + เวลา
import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '@/lib/api';
import { ROSTER_JUN } from '../../duty-demo2/roster-jun';

// ── ศูนย์/ภาค (ตรงกับ duty-demo2) ──
const REGIONS = [
  { key: 'bkk', label: 'กรุงเทพฯ' },
  { key: 'pmt', label: 'ปริมณฑล' },
];
const CENTERS: { id: string; name: string; region: string }[] = [
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
type Band = 'morning' | 'afternoon' | 'night' | 'fix';
const SHIFT_ORDER: Band[] = ['morning', 'afternoon', 'night', 'fix'];
const SH_META: Record<Band, { label: string; short: string; range: string }> = {
  morning: { label: 'เวร 1 · เช้า', short: 'เช้า', range: '07.00–16.00' },
  afternoon: { label: 'เวร 2 · บ่าย', short: 'บ่าย', range: '15.00–24.00' },
  night: { label: 'เวร 3 · ดึก', short: 'ดึก', range: '23.00–08.00' },
  fix: { label: 'เวร FIX', short: 'FIX', range: 'เวรพิเศษ' },
};
// raw shift key (จากตาราง) → แถบเวรในการ์ด; off/none = ไม่ขึ้นเวร (ข้าม)
const RAW_TO_BAND: Record<string, Band | null> = {
  s1: 'morning', s2: 'afternoon', s3: 'night', f1120: 'fix', f1423: 'fix', off: null, none: null,
};

type Status = 'present' | 'pending';
const ST_META: Record<Status, { label: string; dot: string }> = {
  present: { label: 'เข้างานแล้ว', dot: 'var(--ok)' },
  pending: { label: 'รอเข้างาน', dot: 'var(--pending)' },
};

type Person = {
  c: string; n: string; p: string; centerId: string; s: string; region: string;
  sh: Band; status: Status; t: string; tags: string[];
};

type AttRow = { user_id: number; username?: string; user_name?: string; code?: string | null; check_in_time?: string | null };
type ZoneData = { staff: { id: string; code: string; name: string }[]; schedule: Record<string, Record<number, string>> };

const p2 = (n: number) => String(n).padStart(2, '0');
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
const onlyDigits = (s: string) => (s || '').replace(/\D/g, '');
const fmtThaiDate = (s: string) => { try { return new Date(s + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); } catch { return s; } };

// ── ป้าย/ชิ้นเล็ก ──
function StatusDot({ status }: { status: Status }) {
  return <span className="dot" style={{ background: ST_META[status].dot }} title={ST_META[status].label} />;
}
function TimeChip({ status, t }: { status: Status; t: string }) {
  return (
    <span className={`timechip s-${status}`}>
      {status === 'present' && <span className="tc-ic">●</span>}
      {status === 'present' ? (t || 'เข้างานแล้ว') : '—'}
    </span>
  );
}
function Tag({ tag }: { tag: string }) {
  const cls = tag.startsWith('FIX') ? 't-fix' : tag === 'อาสา' ? 't-vol' : 't-soft';
  return <span className={`tag ${cls}`}>{tag}</span>;
}

function PersonRow({ p, onSelect, active }: { p: Person; onSelect: (p: Person) => void; active: boolean }) {
  return (
    <button className={`person ${active ? 'is-active' : ''}`} onClick={() => onSelect(p)}>
      <span className="p-code mono">{p.c}</span>
      <span className="p-main">
        <span className="p-name">{p.n}</span>
        <span className="p-phone mono">{p.p || '—'}</span>
      </span>
      <span className="p-tags">{p.tags.map((t) => <Tag key={t} tag={t} />)}</span>
      <span className="p-time"><TimeChip status={p.status} t={p.t} /></span>
    </button>
  );
}

function ShiftGroup({ band, people, onSelect, selected }: { band: Band; people: Person[]; onSelect: (p: Person) => void; selected: Person | null }) {
  const sh = SH_META[band];
  return (
    <div className={`shiftgroup sg-${band}`}>
      <div className="sg-head">
        <span className="sg-bar" />
        <span className="sg-label">{sh.short}</span>
        <span className="sg-range mono">{sh.range}</span>
        <span className="sg-count mono">{people.length}</span>
      </div>
      <div className="sg-people">
        {people.map((p) => (
          <PersonRow key={p.centerId + p.c + p.n} p={p} onSelect={onSelect} active={!!selected && selected.c === p.c && selected.n === p.n && selected.centerId === p.centerId} />
        ))}
      </div>
    </div>
  );
}

function StationCard({ name, people, onSelect, selected }: { name: string; people: Person[]; onSelect: (p: Person) => void; selected: Person | null }) {
  const present = people.filter((p) => p.status === 'present').length;
  const total = people.length;
  const pct = total ? Math.round((present / total) * 100) : 0;
  const byBand: Record<string, Person[]> = {};
  people.forEach((p) => { (byBand[p.sh] = byBand[p.sh] || []).push(p); });
  return (
    <div className="card">
      <div className="card-head">
        <div className="ch-left"><span className="ch-pin">◈</span><h3 className="ch-name">{name}</h3></div>
        <div className="ch-meter" title={`เข้างาน ${present}/${total}`}>
          <span className="ch-frac mono"><b>{present}</b>/{total}</span>
          <span className="ch-bar"><span className="ch-fill" style={{ width: pct + '%' }} /></span>
        </div>
      </div>
      <div className="card-body">
        {SHIFT_ORDER.filter((k) => byBand[k]?.length).map((k) => (
          <ShiftGroup key={k} band={k} people={byBand[k]} onSelect={onSelect} selected={selected} />
        ))}
      </div>
    </div>
  );
}

function DetailDrawer({ p, onClose }: { p: Person | null; onClose: () => void }) {
  if (!p) return null;
  const m = ST_META[p.status];
  const sh = SH_META[p.sh];
  const rg = REGIONS.find((r) => r.key === p.region);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer">
        <button className="dw-close" onClick={onClose}>✕</button>
        <div className="dw-top"><span className="dw-code mono">{p.c}</span><span className="dw-status"><StatusDot status={p.status} />{m.label}</span></div>
        <h2 className="dw-name">{p.n}</h2>
        {p.p ? <a className="dw-phone mono" href={`tel:${p.p.replace(/-/g, '')}`}>{p.p}</a> : <span className="dw-phone mono" style={{ color: 'var(--muted)' }}>ไม่มีเบอร์</span>}
        <div className="dw-grid">
          <div className="dw-cell"><span className="dw-k">ประจำจุด</span><span className="dw-v">{p.s}</span></div>
          <div className="dw-cell"><span className="dw-k">ภูมิภาค</span><span className="dw-v">{rg?.label || p.region}</span></div>
          <div className="dw-cell"><span className="dw-k">เวร</span><span className="dw-v">{sh.label}</span></div>
          <div className="dw-cell"><span className="dw-k">ช่วงเวลา</span><span className="dw-v">{sh.range}</span></div>
          <div className="dw-cell"><span className="dw-k">เวลาเข้างาน</span><span className="dw-v"><TimeChip status={p.status} t={p.t} /></span></div>
        </div>
        {p.tags.length > 0 && <div className="dw-tags">{p.tags.map((t) => <Tag key={t} tag={t} />)}</div>}
      </aside>
    </>
  );
}

export default function CallcenterAttendancePage() {
  const [date, setDate] = useState(todayStr());
  const [dbByCenter, setDbByCenter] = useState<Record<string, ZoneData>>({});
  const [att, setAtt] = useState<AttRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [shift, setShift] = useState<'all' | Band>('all');
  const [region, setRegion] = useState('all');
  const [statusF, setStatusF] = useState<'all' | Status>('all');
  const [sortMode, setSortMode] = useState<'name' | 'count'>('name');
  const [selected, setSelected] = useState<Person | null>(null);
  const [updatedAt, setUpdatedAt] = useState('');

  const isToday = date === todayStr();

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    const [Y, M] = date.split('-').map(Number);
    Promise.all([
      api.get(`/api/duty/schedules?y=${Y}&m=${M}`).then((r) => r.data?.data ?? {}).catch(() => ({})),
      api.get(`/api/attendance/report?from=${date}&to=${date}`).then((r) => r.data?.data?.rows ?? []).catch(() => []),
    ]).then(([sched, rows]) => {
      setDbByCenter(sched as Record<string, ZoneData>);
      setAtt(rows as AttRow[]);
      setUpdatedAt(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }));
    }).finally(() => setLoading(false));
  }, [date]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!isToday) return; const t = setInterval(() => load(true), 30000); return () => clearInterval(t); }, [isToday, load]);
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);

  // index การลงเวลา: รหัส(ตัวเลข) → เวลาเข้า, ชื่อ → เวลาเข้า (จับคู่ดีที่สุด)
  const attIndex = useMemo(() => {
    const byCode: Record<string, string> = {}, byName: Record<string, string> = {};
    att.forEach((r) => {
      const t = r.check_in_time || 'เข้างานแล้ว';
      const code = onlyDigits(r.code || r.username || '');
      if (code) byCode[code] = t;
      if (r.user_name) byName[r.user_name.trim()] = t;
    });
    return { byCode, byName };
  }, [att]);

  // รวมรายชื่อจากตาราง (DB ทับ seed) ของวันที่เลือก → ใส่สถานะจากการลงเวลา
  const allPeople = useMemo(() => {
    const D = Number(date.split('-')[2]);
    const out: Person[] = [];
    for (const c of CENTERS) {
      const db = dbByCenter[c.id];
      const rows: { code: string; name: string; raw: string }[] = [];
      if (db && db.staff?.length) {
        db.staff.forEach((s) => rows.push({ code: s.code, name: s.name, raw: db.schedule?.[s.id]?.[D] ?? 'none' }));
      } else {
        const seed = ROSTER_JUN[c.id];
        if (seed) seed.people.forEach((pp, i) => rows.push({ code: pp.code, name: pp.name, raw: seed.grid[D - 1]?.[i] ?? 'none' }));
      }
      rows.forEach((r) => {
        const band = RAW_TO_BAND[r.raw];
        if (!band) return; // off/none = ไม่ขึ้นเวรวันนี้
        const codeDigits = onlyDigits(r.code);
        const ci = attIndex.byCode[codeDigits] ?? attIndex.byName[r.name.trim()];
        out.push({
          c: r.code, n: r.name, p: '', centerId: c.id, s: c.name, region: c.region,
          sh: band, status: ci ? 'present' : 'pending', t: ci || '', tags: band === 'fix' ? ['FIX'] : [],
        });
      });
    }
    return out;
  }, [dbByCenter, attIndex, date]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return allPeople.filter((p) => {
      if (shift !== 'all' && p.sh !== shift) return false;
      if (region !== 'all' && p.region !== region) return false;
      if (statusF !== 'all' && p.status !== statusF) return false;
      if (term && !`${p.c} ${p.n} ${p.p} ${p.s}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [allPeople, q, shift, region, statusF]);

  const stats = useMemo(() => {
    const present = filtered.filter((p) => p.status === 'present').length;
    const fix = filtered.filter((p) => p.sh === 'fix').length;
    return { total: filtered.length, present, pending: filtered.length - present, fix };
  }, [filtered]);

  const regionGroups = useMemo(() => {
    return REGIONS.map((rg) => {
      const rows = filtered.filter((p) => p.region === rg.key);
      const byStation: Record<string, Person[]> = {};
      rows.forEach((p) => { (byStation[p.s] = byStation[p.s] || []).push(p); });
      const stations = Object.keys(byStation).map((name) => ({ name, people: byStation[name] }));
      if (sortMode === 'count') stations.sort((a, b) => b.people.length - a.people.length);
      else stations.sort((a, b) => a.name.localeCompare(b.name, 'th'));
      return { rk: rg.key, label: rg.label, stations, total: rows.length };
    }).filter((g) => g.stations.length);
  }, [filtered, sortMode]);

  const shiftChips: { k: 'all' | Band; label: string }[] = [
    { k: 'all', label: 'ทุกเวร' }, { k: 'morning', label: 'เช้า' }, { k: 'afternoon', label: 'บ่าย' }, { k: 'night', label: 'ดึก' }, { k: 'fix', label: 'FIX' },
  ];
  const statusChips: { k: 'all' | Status; label: string }[] = [
    { k: 'all', label: 'ทุกสถานะ' }, { k: 'present', label: 'เข้างานแล้ว' }, { k: 'pending', label: 'รอเข้างาน' },
  ];

  return (
    <div className="atb">
      <style dangerouslySetInnerHTML={{ __html: ATB_CSS }} />

      <header className="topbar">
        <div className="tb-id">
          <div className="tb-mark">{loading ? '…' : '◴'}</div>
          <div className="tb-title">
            <h1>เวลาเข้างานพนักงาน · ประจำจุด</h1>
            <p>{fmtThaiDate(date)}{isToday && <span className="live"> · อัปเดตอัตโนมัติ{updatedAt && ` (${updatedAt})`}</span>}</p>
          </div>
        </div>
        <div className="stats">
          <div className="stat st-total"><span className="stat-v mono">{stats.total}</span><span className="stat-l">ทั้งหมด</span></div>
          <div className="stat st-ok"><span className="stat-v mono">{stats.present}</span><span className="stat-l">เข้างานแล้ว</span></div>
          <div className="stat st-pending"><span className="stat-v mono">{stats.pending}</span><span className="stat-l">รอเข้างาน</span></div>
          <div className="stat st-fix"><span className="stat-v mono">{stats.fix}</span><span className="stat-l">FIX</span></div>
        </div>
      </header>

      <div className="toolbar">
        <div className="search">
          <span className="search-ic">⌕</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา ชื่อ · รหัส · ประจำจุด" />
          {q && <button className="search-clear" onClick={() => setQ('')}>✕</button>}
        </div>
        <div className="chips">
          {shiftChips.map((c) => <button key={c.k} className={`chip ${shift === c.k ? 'on' : ''} ck-${c.k}`} onClick={() => setShift(c.k)}>{c.label}</button>)}
        </div>
        <div className="chips">
          <button className={`chip ${region === 'all' ? 'on' : ''}`} onClick={() => setRegion('all')}>ทั้งหมด</button>
          {REGIONS.map((r) => <button key={r.key} className={`chip ${region === r.key ? 'on' : ''}`} onClick={() => setRegion(r.key)}>{r.label}</button>)}
        </div>
        <div className="chips">
          {statusChips.map((c) => <button key={c.k} className={`chip soft ${statusF === c.k ? 'on' : ''}`} onClick={() => setStatusF(c.k)}>{c.label}</button>)}
        </div>
        <div className="rightctl">
          <input type="date" className="dateinput" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value || todayStr())} />
          <div className="sort"><span>เรียง</span>
            <button className={sortMode === 'name' ? 'on' : ''} onClick={() => setSortMode('name')}>ชื่อจุด</button>
            <button className={sortMode === 'count' ? 'on' : ''} onClick={() => setSortMode('count')}>จำนวนคน</button>
          </div>
        </div>
      </div>

      <main className="board">
        {loading ? (
          <div className="empty">กำลังโหลด…</div>
        ) : regionGroups.length === 0 ? (
          <div className="empty">ไม่พบรายการที่ตรงกับเงื่อนไข<br /><span style={{ fontSize: 13 }}>ตารางเวรของวันนี้ว่าง — จัดเวรได้ที่หน้า &quot;ตารางเวรประจำจุด&quot;</span></div>
        ) : (
          regionGroups.map((g) => (
            <section key={g.rk} className="region">
              <div className="region-head"><h2>{g.label}</h2><span className="region-meta mono">{g.stations.length} จุด · {g.total} คน</span></div>
              <div className="cardgrid">
                {g.stations.map((st) => <StationCard key={st.name} name={st.name} people={st.people} onSelect={setSelected} selected={selected} />)}
              </div>
            </section>
          ))
        )}
      </main>

      <DetailDrawer p={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

const ATB_CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
.atb {
  --bg: oklch(0.97 0.005 250); --surface: #fff; --surface-2: oklch(0.985 0.004 250);
  --ink: oklch(0.27 0.02 255); --ink-2: oklch(0.45 0.02 255); --muted: oklch(0.60 0.015 255);
  --line: oklch(0.91 0.006 255); --line-2: oklch(0.94 0.005 255);
  --brand: oklch(0.52 0.13 248); --brand-soft: oklch(0.95 0.03 248);
  --ok: oklch(0.62 0.13 152); --leave: oklch(0.60 0.19 25); --off: oklch(0.68 0.02 255);
  --watch: oklch(0.74 0.15 78); --pending: oklch(0.70 0.015 255); --fix: oklch(0.55 0.16 305);
  --r: 14px; --shadow: 0 1px 2px oklch(0.4 0.02 255 / 0.05), 0 6px 20px oklch(0.4 0.02 255 / 0.06);
  font-family: 'IBM Plex Sans Thai', system-ui, sans-serif; color: var(--ink); font-size: 15px; line-height: 1.45;
  margin: -24px; background: var(--bg); min-height: calc(100vh - 64px);
}
.atb * { box-sizing: border-box; }
.atb .mono { font-family: 'IBM Plex Mono', monospace; }
.atb h1, .atb h2, .atb h3 { font-weight: 600; letter-spacing: -0.01em; margin: 0; }

.atb .topbar { position: sticky; top: 0; z-index: 12; display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap; padding: 16px 28px; background: oklch(0.99 0.003 250 / 0.9); backdrop-filter: blur(12px); border-bottom: 1px solid var(--line); }
.atb .tb-id { display: flex; align-items: center; gap: 14px; }
.atb .tb-mark { font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 18px; color: #fff; background: var(--brand); width: 40px; height: 40px; display: grid; place-items: center; border-radius: 10px; }
.atb .tb-title h1 { font-size: 20px; }
.atb .tb-title p { font-size: 13px; color: var(--muted); margin-top: 2px; }
.atb .tb-title .live { color: var(--ok); }
.atb .stats { display: flex; gap: 8px; flex-wrap: wrap; }
.atb .stat { display: flex; flex-direction: column; align-items: flex-start; min-width: 80px; padding: 8px 14px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; }
.atb .stat-v { font-size: 22px; font-weight: 600; line-height: 1.1; }
.atb .stat-l { font-size: 11.5px; color: var(--muted); margin-top: 1px; }
.atb .st-ok .stat-v { color: var(--ok); } .atb .st-pending .stat-v { color: oklch(0.55 0.015 255); } .atb .st-fix .stat-v { color: var(--fix); }
.atb .st-total { background: var(--ink); border-color: var(--ink); } .atb .st-total .stat-v { color: #fff; } .atb .st-total .stat-l { color: oklch(0.8 0.01 255); }

.atb .toolbar { position: sticky; top: 73px; z-index: 11; display: flex; align-items: center; gap: 12px 14px; flex-wrap: wrap; padding: 12px 28px; background: oklch(0.99 0.003 250 / 0.88); backdrop-filter: blur(12px); border-bottom: 1px solid var(--line); }
.atb .search { display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 0 12px; height: 38px; min-width: 240px; flex: 1 1 240px; max-width: 340px; }
.atb .search:focus-within { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-soft); }
.atb .search-ic { color: var(--muted); font-size: 17px; }
.atb .search input { border: none; outline: none; background: none; flex: 1; font: inherit; color: var(--ink); }
.atb .search-clear { border: none; background: none; color: var(--muted); cursor: pointer; font-size: 13px; }
.atb .chips { display: flex; gap: 6px; flex-wrap: wrap; }
.atb .chip { font: inherit; font-size: 13.5px; padding: 7px 14px; border-radius: 999px; cursor: pointer; background: var(--surface); border: 1px solid var(--line); color: var(--ink-2); transition: all 0.12s; }
.atb .chip:hover { border-color: oklch(0.82 0.01 255); }
.atb .chip.on { background: var(--ink); color: #fff; border-color: var(--ink); }
.atb .chip.soft.on { background: var(--brand); border-color: var(--brand); }
.atb .chip.ck-morning.on { background: var(--ok); border-color: var(--ok); }
.atb .chip.ck-afternoon.on { background: var(--watch); border-color: var(--watch); color: oklch(0.3 0.05 78); }
.atb .chip.ck-night.on { background: oklch(0.42 0.08 262); border-color: oklch(0.42 0.08 262); }
.atb .chip.ck-fix.on { background: var(--fix); border-color: var(--fix); }
.atb .rightctl { display: flex; align-items: center; gap: 10px; margin-left: auto; }
.atb .dateinput { font: inherit; font-size: 13px; padding: 7px 10px; border-radius: 9px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); }
.atb .sort { display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--muted); }
.atb .sort button { font: inherit; font-size: 13px; padding: 6px 11px; border-radius: 8px; cursor: pointer; background: var(--surface); border: 1px solid var(--line); color: var(--ink-2); }
.atb .sort button.on { background: var(--brand-soft); border-color: var(--brand); color: var(--brand); font-weight: 500; }

.atb .board { padding: 24px 28px 80px; }
.atb .region { margin-bottom: 36px; }
.atb .region-head { display: flex; align-items: baseline; gap: 14px; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 2px solid var(--line); }
.atb .region-head h2 { font-size: 17px; }
.atb .region-meta { font-size: 13px; color: var(--muted); }
.atb .cardgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 16px; }

.atb .card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r); box-shadow: var(--shadow); overflow: hidden; display: flex; flex-direction: column; }
.atb .card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px 12px; border-bottom: 1px solid var(--line-2); background: linear-gradient(180deg, var(--surface-2), var(--surface)); }
.atb .ch-left { display: flex; align-items: center; gap: 9px; min-width: 0; }
.atb .ch-pin { color: var(--brand); font-size: 13px; }
.atb .ch-name { font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.atb .ch-meter { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex-shrink: 0; }
.atb .ch-frac { font-size: 12px; color: var(--muted); } .atb .ch-frac b { color: var(--ok); font-weight: 600; }
.atb .ch-bar { width: 64px; height: 5px; border-radius: 99px; background: var(--line); overflow: hidden; }
.atb .ch-fill { display: block; height: 100%; background: var(--ok); border-radius: 99px; transition: width 0.3s; }
.atb .card-body { padding: 6px 8px 10px; display: flex; flex-direction: column; gap: 2px; }

.atb .shiftgroup { padding: 6px 6px 4px; }
.atb .sg-head { display: flex; align-items: center; gap: 8px; padding: 4px 6px; }
.atb .sg-bar { width: 3px; height: 13px; border-radius: 2px; background: var(--off); }
.atb .sg-morning .sg-bar { background: var(--ok); } .atb .sg-afternoon .sg-bar { background: var(--watch); }
.atb .sg-night .sg-bar { background: oklch(0.5 0.09 262); } .atb .sg-fix .sg-bar { background: var(--fix); }
.atb .sg-label { font-size: 12.5px; font-weight: 600; color: var(--ink-2); }
.atb .sg-range { font-size: 11px; color: var(--muted); }
.atb .sg-count { margin-left: auto; font-size: 11px; color: var(--muted); background: var(--surface-2); border: 1px solid var(--line-2); border-radius: 99px; padding: 1px 7px; }
.atb .sg-people { display: flex; flex-direction: column; gap: 2px; margin-top: 2px; }

.atb .person { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 10px; width: 100%; text-align: left; font: inherit; cursor: pointer; background: none; border: 1px solid transparent; border-radius: 9px; padding: 7px 8px; transition: background 0.1s, border-color 0.1s; }
.atb .person:hover { background: var(--surface-2); border-color: var(--line-2); }
.atb .person.is-active { background: var(--brand-soft); border-color: oklch(0.8 0.06 248); }
.atb .p-code { font-size: 11px; font-weight: 500; color: var(--muted); background: var(--surface-2); border: 1px solid var(--line-2); border-radius: 6px; padding: 2px 6px; min-width: 40px; text-align: center; }
.atb .p-main { min-width: 0; display: flex; flex-direction: column; line-height: 1.25; }
.atb .p-name { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.atb .p-phone { font-size: 11px; color: var(--muted); }
.atb .p-tags { display: flex; gap: 4px; }
.atb .tag { font-size: 10.5px; font-weight: 500; padding: 2px 7px; border-radius: 99px; white-space: nowrap; }
.atb .t-vol { background: oklch(0.95 0.04 152); color: oklch(0.42 0.12 152); }
.atb .t-fix { background: oklch(0.95 0.04 305); color: var(--fix); }
.atb .t-soft { background: var(--surface-2); color: var(--muted); border: 1px solid var(--line-2); }
.atb .p-time { justify-self: end; }
.atb .timechip { font-size: 12px; font-weight: 500; padding: 3px 9px; border-radius: 7px; white-space: nowrap; display: inline-flex; align-items: center; gap: 5px; font-family: 'IBM Plex Mono', monospace; }
.atb .tc-ic { font-size: 7px; }
.atb .s-present { background: oklch(0.95 0.05 152); color: oklch(0.42 0.12 152); } .atb .s-present .tc-ic { color: var(--ok); }
.atb .s-pending { background: var(--surface-2); color: var(--pending); border: 1px dashed var(--line); }
.atb .dot { width: 9px; height: 9px; border-radius: 99px; display: inline-block; }
.atb .empty { text-align: center; color: var(--muted); padding: 80px 0; font-size: 15px; line-height: 1.8; }

.atb .scrim { position: fixed; inset: 0; background: oklch(0.3 0.02 255 / 0.28); z-index: 40; animation: atbfade 0.15s; }
@keyframes atbfade { from { opacity: 0; } }
.atb .drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(380px, 92vw); background: var(--surface); z-index: 50; box-shadow: -8px 0 40px oklch(0.3 0.02 255 / 0.18); padding: 28px; overflow-y: auto; animation: atbslide 0.2s cubic-bezier(0.2, 0.8, 0.2, 1); }
@keyframes atbslide { from { transform: translateX(40px); opacity: 0; } }
.atb .dw-close { position: absolute; top: 18px; right: 18px; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; background: var(--surface-2); border: 1px solid var(--line); color: var(--ink-2); font-size: 14px; }
.atb .dw-top { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.atb .dw-code { font-size: 13px; font-weight: 600; color: #fff; background: var(--brand); border-radius: 7px; padding: 4px 10px; }
.atb .dw-status { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ink-2); }
.atb .dw-name { font-size: 24px; margin-bottom: 2px; }
.atb .dw-phone { font-size: 15px; color: var(--brand); text-decoration: none; }
.atb .dw-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--line-2); border: 1px solid var(--line-2); border-radius: 12px; overflow: hidden; margin: 22px 0; }
.atb .dw-cell { background: var(--surface); padding: 11px 14px; display: flex; flex-direction: column; gap: 4px; }
.atb .dw-cell:nth-child(5) { grid-column: 1 / -1; }
.atb .dw-k { font-size: 11.5px; color: var(--muted); }
.atb .dw-v { font-size: 14.5px; font-weight: 500; }
.atb .dw-tags { display: flex; gap: 6px; flex-wrap: wrap; }

@media (max-width: 720px) {
  .atb .topbar, .atb .toolbar { position: static; }
  .atb .cardgrid { grid-template-columns: 1fr; }
  .atb .rightctl { margin-left: 0; }
}
`;
