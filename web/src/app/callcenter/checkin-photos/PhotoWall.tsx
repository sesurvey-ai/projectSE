'use client';

// รูปยืนยันลงเวลา — photo wall ของรอบเช็คอินทั้งวัน เรียงล่าสุดก่อน (ไว้เช็กหน้า ↔ ชื่อ เพราะรหัสผ่านเดาง่าย)
// ข้อมูล: /api/attendance/report (รูป+เวลา+พิกัด) + เวรของวันจาก duty_schedules (DB ทับ seed roster-jun)
// แชร์ใช้ทั้ง callcenter และ admin (สิทธิ์ API เปิดให้สองบทบาทอยู่แล้ว)
import { useState, useEffect, useMemo, useCallback } from 'react';
import api, { getPhotoUrl } from '@/lib/api';
import { ROSTER_JUN } from '../../duty-demo2/roster-jun';

const CENTERS: { id: string; name: string }[] = [
  { id: 'ladprao', name: 'ลาดพร้าว' }, { id: 'raminthra', name: 'รามอินทรา' }, { id: 'onnut', name: 'อ่อนนุช' },
  { id: 'bangkhae', name: 'บางแค' }, { id: 'minburi', name: 'มีนบุรี' }, { id: 'rama9', name: 'พระราม 9' },
  { id: 'bangna', name: 'บางนา' }, { id: 'sathon', name: 'สาทร' }, { id: 'rama2', name: 'พระราม 2' },
  { id: 'bangphlat', name: 'บางพลัด' }, { id: 'pathum', name: 'ปทุมธานี' }, { id: 'pakkret', name: 'ปากเกร็ด' },
  { id: 'nonthaburi', name: 'นนทบุรี' }, { id: 'samutprakan', name: 'สมุทรปราการ' },
];

type Band = 'morning' | 'afternoon' | 'night' | 'fix7' | 'fix11' | 'fix14' | 'offday';
const SH_META: Record<Band, { short: string; range: string }> = {
  morning: { short: 'เวร1', range: '07.00–16.00' },
  afternoon: { short: 'เวร2', range: '15.00–24.00' },
  night: { short: 'เวร3', range: '23.00–08.00' },
  fix7: { short: 'FIX7', range: '07.00–16.00' },
  fix11: { short: 'FIX11', range: '11.00–20.00' },
  fix14: { short: 'FIX14', range: '14.00–23.00' },
  offday: { short: 'หยุด', range: '—' },
};
const isFix = (b: string) => b === 'fix7' || b === 'fix11' || b === 'fix14';
const RAW_TO_BAND: Record<string, Band | null> = {
  s1: 'morning', s2: 'afternoon', s3: 'night',
  fix7: 'fix7', fix11: 'fix11', fix14: 'fix14', f1120: 'fix11', f1423: 'fix14',
  off: null, none: null,
};
const SH_BADGE: Record<Band, { ink: string; bg: string; bd: string }> = {
  morning:   { ink: '#0d6b6d', bg: '#def1f2', bd: '#8fd2d4' },
  afternoon: { ink: '#9C6206', bg: '#FBF0D9', bd: '#e6c98a' },
  night:     { ink: '#4A45C2', bg: '#EBEAFB', bd: '#bcb9f0' },
  fix7:      { ink: '#7E22CE', bg: '#F3E8FF', bd: '#d8b4f0' },
  fix11:     { ink: '#7E22CE', bg: '#F3E8FF', bd: '#d8b4f0' },
  fix14:     { ink: '#7E22CE', bg: '#F3E8FF', bd: '#d8b4f0' },
  offday:    { ink: '#64748b', bg: '#f1f5f9', bd: '#cbd5e1' },
};
const VOL_BADGE = { ink: '#1d4ed8', bg: '#dbeafe', bd: '#93c5fd' };

const parseHM = (s: string) => { const [h, m] = s.split('.').map(Number); return (h || 0) * 60 + (m || 0); };
const bandInShift = (b: Band, now: number) => {
  if (b === 'offday') return false;
  const [rs, re] = SH_META[b].range.split('–');
  const s = parseHM(rs), e = parseHM(re);
  return e > s ? now >= s && now < e : now >= s || now < e;
};
const nowMinutes = () => {
  if (typeof window !== 'undefined') {
    const q = new URLSearchParams(window.location.search).get('now');
    if (q) {
      const parts = q.includes(':') ? q.split(':') : [q.slice(0, -2), q.slice(-2)];
      const h = Number(parts[0]), m = Number(parts[1]);
      if (Number.isFinite(h) && Number.isFinite(m)) return h * 60 + m;
    }
  }
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

type AttRow = {
  id: number; user_id: number; work_date: string;
  check_in_time: string | null; check_out_time: string | null;
  check_in_lat: number | null; check_in_lng: number | null; check_in_photo: string | null;
  user_name: string; username: string; code: string | null;
};
type ZoneData = { staff: { id: string; code: string; name: string }[]; schedule: Record<string, Record<number, string>> };

const p2 = (n: number) => String(n).padStart(2, '0');
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
const prevDateStr = (s: string) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
const onlyDigits = (s: string) => (s || '').replace(/\D/g, '');
const fmtThaiDate = (s: string) => { try { return new Date(s + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); } catch { return s; } };
const fmtThaiShort = (s: string) => { try { return new Date(s + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' }); } catch { return s; } };

export default function PhotoWall() {
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState<AttRow[]>([]); // 2 วัน: เมื่อวาน + วันที่เลือก
  const [dbByCenter, setDbByCenter] = useState<Record<string, ZoneData>>({});
  const [dbPrevByCenter, setDbPrevByCenter] = useState<Record<string, ZoneData>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [center, setCenter] = useState('all');
  const [shift, setShift] = useState<'all' | Band | 'fix'>('all');
  const [sel, setSel] = useState<AttRow | null>(null);
  const [updatedAt, setUpdatedAt] = useState('');
  const isToday = date === todayStr();

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    const prev = prevDateStr(date); // ดึงเผื่อเมื่อวาน — รอบข้ามคืน (เวรดึก) ที่ยังไม่เช็คเอาท์
    const [Y, M] = [Number(date.split('-')[0]), Number(date.split('-')[1])];
    const [PY, PM] = [Number(prev.split('-')[0]), Number(prev.split('-')[1])];
    Promise.all([
      api.get(`/api/attendance/report?from=${prev}&to=${date}`).then((r) => r.data?.data?.rows ?? []).catch(() => []),
      api.get(`/api/duty/schedules?y=${Y}&m=${M}`).then((r) => r.data?.data ?? {}).catch(() => ({})),
      PY === Y && PM === M
        ? Promise.resolve(null)
        : api.get(`/api/duty/schedules?y=${PY}&m=${PM}`).then((r) => r.data?.data ?? {}).catch(() => ({})),
    ]).then(([rep, sched, prevSched]) => {
      setRows(rep as AttRow[]);
      setDbByCenter(sched as Record<string, ZoneData>);
      setDbPrevByCenter((prevSched ?? sched) as Record<string, ZoneData>);
      setUpdatedAt(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }));
    }).finally(() => setLoading(false));
  }, [date]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!isToday) return; const t = setInterval(() => load(true), 30000); return () => clearInterval(t); }, [isToday, load]);
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSel(null); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);

  // รหัส(เลข) → เวร+จุด ของวันหนึ่ง (DB ทับ seed) — คน off/none = 'offday' (โผล่เฉพาะเมื่อมีเช็คอิน)
  const buildRoster = (db: Record<string, ZoneData>, dateStr: string) => {
    const D = Number(dateStr.split('-')[2]);
    const map: Record<string, { band: Band; center: string; centerId: string }> = {};
    for (const c of CENTERS) {
      const z = db[c.id];
      const put = (code: string, raw: string) => {
        const d = onlyDigits(code);
        if (d) map[d] = { band: RAW_TO_BAND[raw] ?? 'offday', center: c.name, centerId: c.id };
      };
      if (z && z.staff?.length) z.staff.forEach((s) => put(s.code, z.schedule?.[s.id]?.[D] ?? 'none'));
      else {
        const seed = ROSTER_JUN[c.id];
        if (seed) seed.people.forEach((pp, i) => put(pp.code, seed.grid[D - 1]?.[i] ?? 'none'));
      }
    }
    return map;
  };
  const rosterBy = useMemo(() => buildRoster(dbByCenter, date), [dbByCenter, date]);                              // วันที่เลือก
  const rosterYBy = useMemo(() => buildRoster(dbPrevByCenter, prevDateStr(date)), [dbPrevByCenter, date]);        // เมื่อวาน (รอบข้ามคืน)

  const NOW = nowMinutes();
  const prevD = prevDateStr(date);
  const meta = useCallback((r: AttRow) => {
    const d = onlyDigits(r.code || r.username);
    const carry = r.work_date === prevD; // รอบของเมื่อวาน (แสดงเฉพาะที่ยังเปิดค้าง = ข้ามคืน)
    const ro = (carry ? rosterYBy : rosterBy)[d];
    const band: Band = ro?.band ?? 'offday';
    const open = !!r.check_in_time && !r.check_out_time;
    const vol = open && !bandInShift(band, NOW);
    return { digits: d, band, center: ro?.center ?? '—', centerId: ro?.centerId ?? '', open, vol, carry };
  }, [rosterBy, rosterYBy, prevD, NOW]);

  const cards = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows
      .filter((r) => !!r.check_in_time)
      .filter((r) => r.work_date === date || (r.work_date === prevD && !r.check_out_time)) // วันนี้ทุกรอบ + เมื่อวานเฉพาะรอบค้างข้ามคืน
      .filter((r) => {
        const m = meta(r);
        if (center !== 'all' && m.centerId !== center) return false;
        if (shift !== 'all' && m.band !== shift && !(shift === 'fix' && isFix(m.band))) return false;
        if (term && !`${r.code || ''} ${r.username} ${r.user_name} ${m.center}`.toLowerCase().includes(term)) return false;
        return true;
      })
      .sort((a, b) => `${b.work_date} ${b.check_in_time || ''}`.localeCompare(`${a.work_date} ${a.check_in_time || ''}`));
  }, [rows, q, center, shift, meta, date, prevD]);

  const stats = useMemo(() => ({
    total: cards.length,
    photos: cards.filter((r) => r.check_in_photo).length,
    open: cards.filter((r) => !r.check_out_time).length,
  }), [cards]);

  const shiftChips: { k: 'all' | Band | 'fix'; label: string }[] = [
    { k: 'all', label: 'ทุกเวร' }, { k: 'morning', label: 'เวร1' }, { k: 'afternoon', label: 'เวร2' },
    { k: 'night', label: 'เวร3' }, { k: 'fix', label: 'FIX' }, { k: 'offday', label: 'หยุด' },
  ];

  return (
    <div className="cpw">
      <style dangerouslySetInnerHTML={{ __html: CPW_CSS }} />
      <header className="topbar">
        <div className="tb-title">
          <h1>รูปยืนยันลงเวลา</h1>
          <p>{fmtThaiDate(date)}{isToday && <span className="live"> · อัปเดตอัตโนมัติ{updatedAt && ` (${updatedAt})`}</span>}</p>
        </div>
        <div className="stats">
          <div className="stat"><span className="v mono">{stats.total}</span><span className="l">รอบเช็คอิน</span></div>
          <div className="stat ok"><span className="v mono">{stats.photos}</span><span className="l">มีรูป</span></div>
          <div className="stat in"><span className="v mono">{stats.open}</span><span className="l">ยังอยู่ในระบบ</span></div>
        </div>
      </header>

      <div className="toolbar">
        <div className="search">
          <span className="ic">⌕</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา ชื่อ · รหัส · จุด" />
          {q && <button className="clear" onClick={() => setQ('')}>✕</button>}
        </div>
        <select className="centersel" value={center} onChange={(e) => setCenter(e.target.value)}>
          <option value="all">ทุกจุด</option>
          {CENTERS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="chips">
          {shiftChips.map((c) => (
            <button key={c.k} className={`chip ${shift === c.k ? 'on' : ''}`} onClick={() => setShift(c.k)}>{c.label}</button>
          ))}
        </div>
        <input type="date" className="datesel" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </div>

      {loading ? (
        <div className="empty">กำลังโหลด…</div>
      ) : cards.length === 0 ? (
        <div className="empty">ยังไม่มีการลงเวลา{isToday ? 'วันนี้' : 'ในวันที่เลือก'}</div>
      ) : (
        <div className="grid">
          {cards.map((r) => {
            const m = meta(r);
            const shc = SH_BADGE[m.band];
            return (
              <button key={r.id} className="card" onClick={() => setSel(r)}>
                <div className="ph">
                  {r.check_in_photo
                    ? <img src={getPhotoUrl(r.check_in_photo)} alt={r.user_name} loading="lazy" />
                    : <div className="noimg"><span className="ni-ic">📷</span><span>ไม่มีรูป</span></div>}
                  <span className="t in mono">{m.carry ? `เมื่อวาน ${r.check_in_time}` : r.check_in_time}</span>
                  {m.vol && <span className="vol" style={{ color: VOL_BADGE.ink, background: VOL_BADGE.bg, borderColor: VOL_BADGE.bd }}>อาสา</span>}
                </div>
                <div className="info">
                  <div className="r1">
                    <span className="code mono">{(r.code || r.username).replace(/\s+/g, '')}</span>
                    <span className="name">{r.user_name}</span>
                  </div>
                  <div className="r2">
                    <span>{m.center}</span>
                    <span className="shb" style={{ color: shc.ink, background: shc.bg, borderColor: shc.bd }}>{SH_META[m.band].short}</span>
                    <span className={`out ${r.check_out_time ? '' : 'open'}`}>{r.check_out_time ? `ออก ${r.check_out_time}` : 'ยังอยู่'}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {sel && <PhotoModal row={sel} m={meta(sel)} onClose={() => setSel(null)} />}
    </div>
  );
}

// ── modal รูปเต็ม + รายละเอียด + GPS + ประวัติ 7 วัน ──
function PhotoModal({ row, m, onClose }: {
  row: AttRow;
  m: { band: Band; center: string; open: boolean; vol: boolean; carry: boolean };
  onClose: () => void;
}) {
  const [hist, setHist] = useState<{ d: string; t: string }[] | null>(null);
  useEffect(() => {
    const now = new Date();
    const mk = (back: number) => { const x = new Date(now); x.setDate(now.getDate() - back); return `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}`; };
    api.get(`/api/attendance/report?from=${mk(7)}&to=${mk(1)}&user_id=${row.user_id}`).then((r) => {
      const rs: AttRow[] = r.data?.data?.rows ?? [];
      const byDay: Record<string, string> = {};
      rs.forEach((x) => { if (x.work_date && x.check_in_time && !byDay[x.work_date]) byDay[x.work_date] = x.check_in_time; });
      setHist(Object.keys(byDay).sort().reverse().slice(0, 5).map((d) => ({ d: fmtThaiShort(d), t: byDay[d] })));
    }).catch(() => setHist([]));
  }, [row]);
  const shc = SH_BADGE[m.band];
  const gps = row.check_in_lat != null && row.check_in_lng != null
    ? `https://www.google.com/maps?q=${row.check_in_lat},${row.check_in_lng}` : null;
  return (
    <div className="cpw-modal" onClick={onClose}>
      <div className="mcard" onClick={(e) => e.stopPropagation()}>
        <div className="mph">
          {row.check_in_photo
            ? <img src={getPhotoUrl(row.check_in_photo)} alt={row.user_name} />
            : <div className="noimg big"><span className="ni-ic">📷</span><span>ไม่มีรูปถ่าย</span></div>}
          <button className="mclose" onClick={onClose}>✕</button>
        </div>
        <div className="mbody">
          <div className="mname">{row.user_name}</div>
          <div className="msub">
            <span className="mono">{(row.code || row.username).replace(/\s+/g, '')}</span> · {m.center} ·
            <span className="shb" style={{ color: shc.ink, background: shc.bg, borderColor: shc.bd }}>{SH_META[m.band].short}</span>
            {m.vol && <span className="shb" style={{ color: VOL_BADGE.ink, background: VOL_BADGE.bg, borderColor: VOL_BADGE.bd }}>อาสา</span>}
          </div>
          <div className="mgrid">
            <div className="mf"><span className="k">เช็คอิน</span><span className="v mono">{m.carry ? `เมื่อวาน ${row.check_in_time}` : (row.check_in_time || '—')}</span></div>
            <div className="mf"><span className="k">เช็คเอาท์</span><span className="v mono">{row.check_out_time || '— (ยังอยู่)'}</span></div>
            <div className="mf"><span className="k">ช่วงเวร</span><span className="v mono">{SH_META[m.band].range}</span></div>
            <div className="mf"><span className="k">พิกัด</span><span className="v">{gps ? <a href={gps} target="_blank" rel="noreferrer">เปิดแผนที่ ↗</a> : '—'}</span></div>
          </div>
          <div className="mhist">
            <div className="mh-l">เช็คอินย้อนหลัง</div>
            {hist === null ? <div className="mh-e">กำลังโหลด…</div>
              : hist.length === 0 ? <div className="mh-e">ไม่มีประวัติ 7 วันล่าสุด</div>
              : hist.map((h, i) => <div className="mh-r" key={i}><span>{h.d}</span><span className="mono">{h.t}</span></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

const CPW_CSS = `
.cpw { --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --fill:#f8fafc; --brand:#2563eb; --ok:#16a34a;
  padding: 20px 22px 34px; font-size: 14px; color: var(--ink); }
.cpw .mono { font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.cpw .topbar { display:flex; align-items:flex-end; justify-content:space-between; gap:14px; flex-wrap:wrap; margin-bottom:14px; }
.cpw .tb-title h1 { font-size:20px; font-weight:800; margin:0; }
.cpw .tb-title p { margin:3px 0 0; color:var(--muted); font-size:13px; }
.cpw .live { color:var(--ok); }
.cpw .stats { display:flex; gap:8px; }
.cpw .stat { background:#fff; border:1px solid var(--line); border-radius:12px; padding:8px 14px; display:flex; flex-direction:column; align-items:center; min-width:84px; }
.cpw .stat .v { font-size:18px; font-weight:800; }
.cpw .stat .l { font-size:11.5px; color:var(--muted); }
.cpw .stat.ok .v { color:var(--ok); }
.cpw .stat.in .v { color:var(--brand); }
.cpw .toolbar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:16px; }
.cpw .search { position:relative; flex:1; min-width:200px; max-width:330px; }
.cpw .search .ic { position:absolute; left:11px; top:50%; transform:translateY(-50%); color:var(--muted); }
.cpw .search input { width:100%; padding:9px 30px 9px 30px; border:1px solid var(--line); border-radius:11px; background:#fff; font-size:13.5px; outline:none; }
.cpw .search input:focus { border-color:#93c5fd; }
.cpw .search .clear { position:absolute; right:8px; top:50%; transform:translateY(-50%); border:0; background:none; color:var(--muted); cursor:pointer; }
.cpw .centersel, .cpw .datesel { padding:8.5px 11px; border:1px solid var(--line); border-radius:11px; background:#fff; font-size:13.5px; color:var(--ink); outline:none; }
.cpw .chips { display:flex; gap:6px; flex-wrap:wrap; }
.cpw .chip { padding:7px 13px; border-radius:999px; border:1px solid var(--line); background:#fff; font-size:13px; color:var(--muted); cursor:pointer; }
.cpw .chip.on { background:#0f172a; border-color:#0f172a; color:#fff; }
.cpw .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(172px, 1fr)); gap:12px; }
.cpw .card { text-align:left; padding:0; border:1px solid var(--line); border-radius:14px; background:#fff; overflow:hidden; cursor:pointer; transition:box-shadow .12s, transform .12s; }
.cpw .card:hover { box-shadow:0 6px 18px rgba(15,23,42,.08); transform:translateY(-1px); }
.cpw .ph { position:relative; aspect-ratio:1; background:var(--fill); }
.cpw .ph img { width:100%; height:100%; object-fit:cover; display:block; }
.cpw .noimg { width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; color:#94a3b8; font-size:12px; }
.cpw .noimg .ni-ic { font-size:26px; opacity:.6; }
.cpw .ph .t { position:absolute; top:8px; left:8px; font-size:12.5px; font-weight:700; padding:3px 9px; border-radius:9px; background:rgba(4,52,44,.86); color:#9FE1CB; }
.cpw .ph .vol { position:absolute; top:8px; right:8px; font-size:11px; font-weight:700; padding:2.5px 8px; border-radius:9px; border:1px solid; }
.cpw .info { padding:9px 11px 10px; }
.cpw .r1 { display:flex; align-items:baseline; gap:6px; min-width:0; }
.cpw .r1 .code { font-size:12px; font-weight:700; color:var(--brand); flex:none; }
.cpw .r1 .name { font-size:13px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cpw .r2 { display:flex; align-items:center; gap:6px; margin-top:4px; font-size:11.5px; color:var(--muted); flex-wrap:wrap; }
.cpw .shb { font-size:10.5px; font-weight:700; padding:1.5px 7px; border-radius:8px; border:1px solid; }
.cpw .r2 .out.open { color:var(--ok); font-weight:700; }
.cpw .empty { padding:60px 0; text-align:center; color:var(--muted); }
.cpw-modal { position:fixed; inset:0; background:rgba(15,23,42,.5); display:flex; align-items:center; justify-content:center; z-index:60; padding:18px; }
.cpw-modal .mcard { background:#fff; border-radius:18px; width:min(420px, 94vw); max-height:92vh; overflow:auto; }
.cpw-modal .mph { position:relative; aspect-ratio:1; background:#f1f5f9; }
.cpw-modal .mph img { width:100%; height:100%; object-fit:cover; display:block; border-radius:18px 18px 0 0; }
.cpw-modal .noimg.big { font-size:14px; }
.cpw-modal .noimg.big .ni-ic { font-size:40px; }
.cpw-modal .mclose { position:absolute; top:10px; right:10px; width:32px; height:32px; border-radius:50%; border:0; background:rgba(15,23,42,.55); color:#fff; cursor:pointer; font-size:14px; }
.cpw-modal .mbody { padding:14px 16px 16px; }
.cpw-modal .mname { font-size:17px; font-weight:800; color:#0f172a; }
.cpw-modal .msub { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:4px; font-size:12.5px; color:#64748b; }
.cpw-modal .shb { font-size:10.5px; font-weight:700; padding:1.5px 7px; border-radius:8px; border:1px solid; }
.cpw-modal .mgrid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px; }
.cpw-modal .mf { background:#f8fafc; border:1px solid #eef2f6; border-radius:10px; padding:8px 10px; }
.cpw-modal .mf .k { display:block; font-size:11px; color:#64748b; }
.cpw-modal .mf .v { font-size:13.5px; font-weight:700; color:#0f172a; }
.cpw-modal .mf a { color:#2563eb; text-decoration:none; }
.cpw-modal .mhist { margin-top:12px; border-top:1px solid #eef2f6; padding-top:10px; }
.cpw-modal .mh-l { font-size:11.5px; color:#64748b; margin-bottom:6px; }
.cpw-modal .mh-e { font-size:12.5px; color:#94a3b8; }
.cpw-modal .mh-r { display:flex; justify-content:space-between; font-size:13px; padding:3px 0; color:#0f172a; }
`;
