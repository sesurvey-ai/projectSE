'use client';

// เวลาเข้างานพนักงาน — บอร์ดการ์ดตามพื้นที่ (จุด → เวร) ตามดีไซน์ "ตารางเวรประจำจุด"
// ข้อมูล: จุด+เวร+คน จากตารางจัดเวร (DB duty_schedules + seed roster-jun เหมือน duty-demo2)
//         overlay การลงเวลาจากแอป (attendance) จับคู่ด้วยรหัส SE → ใครเข้างานแล้ว + เวลา
import { useState, useEffect, useMemo, useCallback, useRef, CSSProperties } from 'react';
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
type Band = 'morning' | 'afternoon' | 'night' | 'fix7' | 'fix11' | 'fix14';
const SHIFT_ORDER: Band[] = ['morning', 'afternoon', 'night', 'fix7', 'fix11', 'fix14'];
const SH_META: Record<Band, { label: string; short: string; range: string }> = {
  morning: { label: 'เวร 1 · เช้า', short: 'เช้า', range: '07.00–16.00' },
  afternoon: { label: 'เวร 2 · บ่าย', short: 'บ่าย', range: '15.00–24.00' },
  night: { label: 'เวร 3 · ดึก', short: 'ดึก', range: '23.00–08.00' },
  fix7: { label: 'FIX 7', short: 'FIX7', range: '07.00–16.00' },
  fix11: { label: 'FIX 11', short: 'FIX11', range: '11.00–20.00' },
  fix14: { label: 'FIX 14', short: 'FIX14', range: '14.00–23.00' },
};
const isFix = (b: string) => b === 'fix7' || b === 'fix11' || b === 'fix14';
// raw shift key (จากตาราง) → แถบเวรในการ์ด; off/none = ไม่ขึ้นเวร (ข้าม)
const RAW_TO_BAND: Record<string, Band | null> = {
  s1: 'morning', s2: 'afternoon', s3: 'night',
  fix7: 'fix7', fix11: 'fix11', fix14: 'fix14', f1120: 'fix11', f1423: 'fix14',
  off: null, none: null,
};

type Status = 'present' | 'pending' | 'done';
const ST_META: Record<Status, { label: string; dot: string }> = {
  present: { label: 'เข้างานแล้ว', dot: 'var(--ok)' },
  done: { label: 'ออกงานแล้ว', dot: 'oklch(0.62 0.01 255)' },
  pending: { label: 'รอเข้างาน', dot: 'var(--pending)' },
};
const arrived = (s: Status) => s === 'present' || s === 'done'; // มาทำงานแล้ว (ยังอยู่ หรือ ออกแล้ว)

type Person = {
  c: string; n: string; p: string; centerId: string; s: string; region: string;
  sh: Band; status: Status; t: string; tOut: string; tags: string[];
};

type AttRow = { user_id: number; username?: string; user_name?: string; code?: string | null; check_in_time?: string | null; check_out_time?: string | null; work_date?: string };
type ZoneData = { staff: { id: string; code: string; name: string }[]; schedule: Record<string, Record<number, string>> };

const p2 = (n: number) => String(n).padStart(2, '0');
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
const onlyDigits = (s: string) => (s || '').replace(/\D/g, '');
const fmtThaiDate = (s: string) => { try { return new Date(s + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); } catch { return s; } };

// ── การ์ดดีไซน์ใหม่ (เฉพาะลาดพร้าว) ──
const fmtThaiShort = (s: string) => { try { return new Date(s + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' }); } catch { return s; } };
// สีเวร — ตรงกับ "ตารางเวรประจำจุด" (DutyRoster): solid(แถบ/จุด) · ink(ป้าย) · tint(พื้นหัว)
const BAND: Record<string, { solid: string; ink: string; tint: string }> = {
  morning:   { solid: '#139DA0', ink: '#0d6b6d', tint: '#def1f2' },
  afternoon: { solid: '#E0991A', ink: '#9C6206', tint: '#FBF0D9' },
  night:     { solid: '#6366E8', ink: '#4A45C2', tint: '#EBEAFB' },
  fix7:      { solid: '#A855F7', ink: '#7E22CE', tint: '#F3E8FF' },
  fix11:     { solid: '#A855F7', ink: '#7E22CE', tint: '#F3E8FF' },
  fix14:     { solid: '#A855F7', ink: '#7E22CE', tint: '#F3E8FF' },
};
const ST_PILL: Record<Status, { cls: string; label: string }> = {
  present: { cls: 'ok', label: 'เข้างาน' },
  done: { cls: 'out', label: 'ออกแล้ว' },
  pending: { cls: 'wait', label: 'ยังไม่มา' },
};
function lpcInitials(name: string) {
  const first = (name || '').trim().split(/\s+/)[0] || '';
  return first.slice(0, 2) || '–';
}
// ทดสอบ: รูปอวตาร (key = เลขรหัสพนักงาน) — ถ้ามีรูปโชว์รูป ไม่มีโชว์ตัวย่อ (อนาคตดึงจาก DB)
const LPC_PHOTOS: Record<string, string> = {
  '225': '/avatars/se225.jpg', '351': '/avatars/se351.jpg', '37': '/avatars/se37.jpg',
  '400': '/avatars/se400.jpg', '393': '/avatars/se393.jpg', '480': '/avatars/se480.jpg',
};
const photoOf = (code: string) => LPC_PHOTOS[onlyDigits(code)];
// ── ป้าย/ชิ้นเล็ก ──
function StatusDot({ status }: { status: Status }) {
  return <span className="dot" style={{ background: ST_META[status].dot }} title={ST_META[status].label} />;
}
function TimeChip({ status, t, tOut }: { status: Status; t: string; tOut?: string }) {
  if (status === 'pending') return <span className="timechip s-pending">—</span>;
  if (status === 'done') return <span className="timechip s-done">{(t || '—') + ' – ' + (tOut || '—')}</span>;
  return <span className="timechip s-present"><span className="tc-ic">●</span>{t || 'เข้างานแล้ว'}</span>;
}
function Tag({ tag }: { tag: string }) {
  const cls = tag.startsWith('FIX') ? 't-fix' : tag === 'อาสา' ? 't-vol' : 't-soft';
  return <span className={`tag ${cls}`}>{tag}</span>;
}

function PersonRow({ p, onSelect, active }: { p: Person; onSelect: (p: Person) => void; active: boolean }) {
  return (
    <button className={`person ${p.status} ${active ? 'is-active' : ''}`} onClick={() => onSelect(p)}>
      <span className="p-code mono">{p.c}</span>
      <span className="p-main">
        <span className="p-name">{p.n}</span>
        {p.p && <span className="p-phone mono">{p.p}</span>}
      </span>
      <span className="p-tags">{p.tags.map((t) => <Tag key={t} tag={t} />)}</span>
      <span className="p-time"><TimeChip status={p.status} t={p.t} tOut={p.tOut} /></span>
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
  const present = people.filter((p) => arrived(p.status)).length;
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

// ไอคอน (โทร/แชท/แก้ไขกะ) — จากดีไซน์ "การ์ดเช็คอิน B"
const IcPhone = (<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2Z" /></svg>);
const IcChat = (<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-4-1L3 20l1.1-4.9a8.4 8.4 0 0 1-.9-3.6 8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 8.8 8Z" /></svg>);
const IcEdit = (<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>);
const shiftStart = (band: Band) => (SH_META[band]?.range.split('–')[0] || '').replace('.', ':') || '—';

function LpcPerson({ p, onOpen, onToast, active, showShift }: { p: Person; onOpen: (p: Person) => void; onToast: (m: string) => void; active: boolean; showShift?: boolean }) {
  const [hover, setHover] = useState(false);
  const timeText = p.status === 'done' ? `${p.t || '—'} – ${p.tOut || '—'}` : p.status === 'present' ? (p.t || '—') : 'ยังไม่มา';
  return (
    <div className={`lpc-person ${p.status} ${active ? 'active' : ''}`} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onClick={() => onOpen(p)} role="button" tabIndex={0}>
      <span className="lpc-av">
        <span className="lpc-av-ring">{photoOf(p.c)
          ? <img className="lpc-av-img" src={photoOf(p.c)} alt={p.n} />
          : <span className="lpc-av-in">{lpcInitials(p.n)}</span>}</span>
        {p.status !== 'pending' && <span className="lpc-av-badge">✓</span>}
      </span>
      <span className="lpc-main">
        <span className="lpc-r1">
          <span className="lpc-code mono">{p.c}</span>
          <span className="lpc-name">{p.n}</span>
          {!showShift && <span className={`lpc-time ${p.status}`}>{timeText}</span>}
        </span>
        {showShift && (
          <span className="lpc-r2">
            <span className="lpc-shlabel">{SH_META[p.sh].short} · {SH_META[p.sh].range}</span>
            <span className={`lpc-time ${p.status}`}>{timeText}</span>
          </span>
        )}
      </span>
      {hover && (
        <span className="lpc-acts" onClick={(e) => e.stopPropagation()}>
          <button className="lpc-act accent" title="โทร" onClick={() => onToast(`กำลังโทรหา ${p.n}…`)}>{IcPhone}</button>
          <button className="lpc-act" title="แชท" onClick={() => onToast(`เปิดแชทกับ ${p.n}`)}>{IcChat}</button>
        </span>
      )}
    </div>
  );
}

function LadpraoCard({ name, people, date, onOpen, onToast, selected }: { name: string; people: Person[]; date: string; onOpen: (p: Person) => void; onToast: (m: string) => void; selected: Person | null }) {
  const came = people.filter((p) => arrived(p.status)).length;
  const absent = people.filter((p) => p.status === 'pending').length;
  const byBand: Record<string, Person[]> = {};
  people.forEach((p) => { (byBand[p.sh] = byBand[p.sh] || []).push(p); });
  const doneList = people.filter((p) => p.status === 'done');
  const isActive = (p: Person) => !!selected && selected.c === p.c && selected.n === p.n && selected.centerId === p.centerId;
  return (
    <div className="lpc">
      <div className="lpc-head">
        <div className="lpc-htitle">
          <span className="lpc-today">{date === todayStr() ? 'วันนี้ · ' : ''}{fmtThaiShort(date)}</span>
          <h3 className="lpc-name-h">{name}</h3>
        </div>
        <div className="lpc-counts">
          <span className="lpc-count ok"><b>{came}</b> เช็คอิน</span>
          <span className="lpc-count wait"><b>{absent}</b> ยังไม่มา</span>
        </div>
      </div>
      <div className="lpc-body">
        {SHIFT_ORDER.filter((k) => byBand[k]?.length).map((band) => {
          const rows = byBand[band].filter((p) => p.status !== 'done'); // คนออกแล้ว -> กล่อง "นอกระบบ"
          if (!rows.length) return null;
          return (
            <div className="lpc-shift" key={band} style={{ '--band': BAND[band].solid, '--band-ink': BAND[band].ink, '--band-tint': BAND[band].tint } as CSSProperties}>
              <div className="lpc-shead">
                <span className="lpc-sdot" />
                {isFix(band)
                  ? <span className="lpc-fix">{SH_META[band].short}</span>
                  : <span className="lpc-slabel">{SH_META[band].short}</span>}
                <span className="lpc-srange mono">{SH_META[band].range}</span>
              </div>
              {rows.map((p) => (
                <LpcPerson key={p.centerId + p.c + p.n} p={p} onOpen={onOpen} onToast={onToast} active={isActive(p)} />
              ))}
            </div>
          );
        })}
        {doneList.length > 0 && (
          <div className="lpc-shift lpc-out" style={{ '--band': 'var(--muted)', '--band-ink': 'var(--muted)', '--band-tint': 'var(--surface-2)' } as CSSProperties}>
            <div className="lpc-shead">
              <span className="lpc-sdot" />
              <span className="lpc-slabel">ออกงานแล้ว · นอกระบบ</span>
              <span className="lpc-srange mono">{doneList.length} คน</span>
            </div>
            {doneList.map((p) => (
              <LpcPerson key={p.centerId + p.c + p.n} p={p} onOpen={onOpen} onToast={onToast} active={isActive(p)} showShift />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field2({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (<div className="lpc-field"><div className="lpc-fl">{label}</div><div className={'lpc-fv' + (mono ? ' mono' : '')}>{value}</div></div>);
}

// แผงรายละเอียด (คลิกแถว) — เช็คอินวันนี้ + ประวัติย้อนหลัง + ปุ่มโทร/แชท/แก้ไขกะ (จากดีไซน์ B)
function LpcDetail({ p, onClose, onToast }: { p: Person; onClose: () => void; onToast: (m: string) => void }) {
  const pill = ST_PILL[p.status];
  const [hist, setHist] = useState<{ d: string; t: string }[] | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const code = onlyDigits(p.c);
    const now = new Date();
    const mk = (back: number) => { const x = new Date(now); x.setDate(now.getDate() - back); return `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}`; };
    api.get(`/api/attendance/report?from=${mk(7)}&to=${mk(1)}`).then((r) => {
      const rows: AttRow[] = r.data?.data?.rows ?? [];
      const byDay: Record<string, string> = {};
      rows.forEach((x) => { const wd = x.work_date; if (wd && x.check_in_time && onlyDigits(x.code || x.username || '') === code && !byDay[wd]) byDay[wd] = x.check_in_time; });
      setHist(Object.keys(byDay).sort().reverse().slice(0, 4).map((wd) => ({ d: fmtThaiShort(wd), t: byDay[wd] })));
    }).catch(() => setHist([]));
    return () => window.removeEventListener('keydown', onKey);
  }, [p, onClose]);
  return (
    <div className="lpc-modal" onClick={onClose}>
      <div className="lpc-card" onClick={(e) => e.stopPropagation()}>
        <div className="lpc-mhead">
          <span className={`lpc-mav ${p.status}`}>{photoOf(p.c)
            ? <img className="lpc-av-img" src={photoOf(p.c)} alt={p.n} />
            : lpcInitials(p.n)}</span>
          <div className="lpc-mid">
            <div className="lpc-mname">{p.n}</div>
            <div className="lpc-mse">{p.s} · <span className="mono">{p.c}</span></div>
          </div>
          <span className={`lpc-pill ${pill.cls}`}>{pill.label}</span>
        </div>
        <div className="lpc-msec">
          <div className="lpc-mlabel">เช็คอินวันนี้</div>
          <div className="lpc-mgrid">
            <Field2 label="กะ" value={`${SH_META[p.sh].short} · ${SH_META[p.sh].range}`} />
            <Field2 label="เวลาเข้างาน" value={shiftStart(p.sh)} mono />
            <Field2 label="เช็คอินจริง" value={p.status === 'pending' ? '—' : (p.t || '—')} mono />
            <Field2 label={p.status === 'done' ? 'เวลาออก' : 'สถานะ'} value={p.status === 'done' ? (p.tOut || '—') : pill.label} mono={p.status === 'done'} />
          </div>
        </div>
        <div className="lpc-msec">
          <div className="lpc-mlabel">ประวัติเช็คอินล่าสุด</div>
          {hist === null ? <div className="lpc-mempty">กำลังโหลด…</div>
            : hist.length === 0 ? <div className="lpc-mempty">ยังไม่มีประวัติย้อนหลัง</div>
            : <div className="lpc-mhist">{hist.map((h, i) => (
                <div className="lpc-hrow" key={i}><span className="lpc-hdot" /><span className="lpc-hd">{h.d}</span><span className="lpc-ht mono">{h.t}</span></div>
              ))}</div>}
        </div>
        <div className="lpc-macts">
          <button className="lpc-mact primary" onClick={() => onToast(`กำลังโทรหา ${p.n}…`)}>{IcPhone}โทร</button>
          <button className="lpc-mact" onClick={() => onToast(`เปิดแชทกับ ${p.n}`)}>{IcChat}แชท</button>
          <button className="lpc-mact" onClick={() => onToast(`แก้ไข/มอบหมายกะของ ${p.n}`)}>{IcEdit}แก้ไขกะ</button>
        </div>
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
          <div className="dw-cell"><span className="dw-k">{p.status === 'done' ? 'เวลาเข้า–ออก' : 'เวลาเข้างาน'}</span><span className="dw-v"><TimeChip status={p.status} t={p.t} tOut={p.tOut} /></span></div>
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
  const [shift, setShift] = useState<'all' | Band | 'fix'>('all');
  const [region, setRegion] = useState('all');
  const [statusF, setStatusF] = useState<'all' | Status>('all');
  const [sortMode, setSortMode] = useState<'name' | 'count'>('name');
  const [selected, setSelected] = useState<Person | null>(null);
  const [lpSel, setLpSel] = useState<Person | null>(null); // ลาดพร้าว: คลิกเปิดแผงรายละเอียด
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((m: string) => { setToast(m); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 1900); }, []);
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

  // index การลงเวลา: รหัส(ตัวเลข)/ชื่อ → { เข้าเร็วสุด, ออกช้าสุด, ยังเปิดอยู่ไหม }
  // open=true ถ้ามี "รอบ" ที่ยังไม่ลงเวลาออก (check_out ว่าง) → ยังทำงานอยู่; ถ้าปิดหมด → ออกงานแล้ว
  const attIndex = useMemo(() => {
    type Rec = { in: string; out: string | null; open: boolean };
    const byCode: Record<string, Rec> = {}, byName: Record<string, Rec> = {};
    const merge = (map: Record<string, Rec>, key: string, inT: string, outT: string | null) => {
      if (!key) return;
      const ex = map[key];
      if (!ex) { map[key] = { in: inT, out: outT, open: !outT }; return; }
      if (inT && (!ex.in || inT < ex.in)) ex.in = inT;        // เข้าเร็วสุด
      if (outT && (!ex.out || outT > ex.out)) ex.out = outT;  // ออกช้าสุด
      if (!outT) ex.open = true;                              // มีรอบเปิดค้าง → ยังทำงานอยู่
    };
    att.forEach((r) => {
      const inT = r.check_in_time || '';
      const outT = r.check_out_time || null;
      merge(byCode, onlyDigits(r.code || r.username || ''), inT, outT);
      merge(byName, (r.user_name || '').trim(), inT, outT);
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
        const rec = attIndex.byCode[codeDigits] ?? attIndex.byName[r.name.trim()];
        const status: Status = !rec ? 'pending' : rec.open ? 'present' : 'done';
        out.push({
          c: r.code, n: r.name, p: '', centerId: c.id, s: c.name, region: c.region,
          sh: band, status, t: rec?.in || '', tOut: rec && !rec.open ? (rec.out || '') : '',
          tags: isFix(band) ? [SH_META[band].short] : [],
        });
      });
    }
    return out;
  }, [dbByCenter, attIndex, date]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return allPeople.filter((p) => {
      if (shift !== 'all' && p.sh !== shift && !(shift === 'fix' && isFix(p.sh))) return false;
      if (region !== 'all' && p.region !== region) return false;
      if (statusF !== 'all' && (statusF === 'present' ? !arrived(p.status) : p.status !== statusF)) return false;
      if (term && !`${p.c} ${p.n} ${p.p} ${p.s}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [allPeople, q, shift, region, statusF]);

  const stats = useMemo(() => {
    const present = filtered.filter((p) => arrived(p.status)).length;
    const out = filtered.filter((p) => p.status === 'done').length;
    const fix = filtered.filter((p) => isFix(p.sh)).length;
    return { total: filtered.length, present, out, pending: filtered.length - present, fix };
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

  const shiftChips: { k: 'all' | Band | 'fix'; label: string }[] = [
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
          <div className="stat st-out"><span className="stat-v mono">{stats.out}</span><span className="stat-l">ออกแล้ว</span></div>
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
                {g.stations.map((st) => st.name === 'ลาดพร้าว'
                  ? <LadpraoCard key={st.name} name={st.name} people={st.people} date={date} onOpen={setLpSel} onToast={showToast} selected={lpSel} />
                  : <StationCard key={st.name} name={st.name} people={st.people} onSelect={setSelected} selected={selected} />)}
              </div>
            </section>
          ))
        )}
      </main>

      <DetailDrawer p={selected} onClose={() => setSelected(null)} />
      {lpSel && <LpcDetail p={lpSel} onClose={() => setLpSel(null)} onToast={showToast} />}
      <div className={'lpc-toast' + (toast ? ' show' : '')}>{toast}</div>
    </div>
  );
}

const ATB_CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
.atb {
  --bg: oklch(0.97 0.005 250); --surface: #fff; --surface-2: oklch(0.985 0.004 250);
  --ink: oklch(0.27 0.02 255); --ink-2: oklch(0.45 0.02 255); --muted: oklch(0.60 0.015 255);
  --line: oklch(0.91 0.006 255); --line-2: oklch(0.94 0.005 255);
  --brand: oklch(0.52 0.13 248); --brand-soft: oklch(0.95 0.03 248);
  --ok: oklch(0.62 0.13 152); --leave: oklch(0.60 0.19 25); --off: oklch(0.68 0.02 255);
  --watch: oklch(0.74 0.15 78); --pending: oklch(0.70 0.015 255); --fix: oklch(0.55 0.16 305);
  --r: 14px; --shadow: 0 1px 2px oklch(0.4 0.02 255 / 0.05), 0 6px 20px oklch(0.4 0.02 255 / 0.06);
  font-family: Arial, Helvetica, sans-serif; color: var(--ink); font-size: 15px; line-height: 1.45;
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
.atb .st-ok .stat-v { color: var(--ok); } .atb .st-pending .stat-v { color: oklch(0.55 0.015 255); } .atb .st-fix .stat-v { color: var(--fix); } .atb .st-out .stat-v { color: oklch(0.52 0.06 245); }
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
.atb .sg-night .sg-bar { background: oklch(0.5 0.09 262); } .atb .sg-fix7 .sg-bar, .atb .sg-fix11 .sg-bar, .atb .sg-fix14 .sg-bar { background: var(--fix); }
.atb .sg-label { font-size: 12.5px; font-weight: 600; color: var(--ink-2); }
.atb .sg-range { font-size: 11px; color: var(--muted); }
.atb .sg-count { margin-left: auto; font-size: 11px; color: var(--muted); background: var(--surface-2); border: 1px solid var(--line-2); border-radius: 99px; padding: 1px 7px; }
.atb .sg-people { display: flex; flex-direction: column; gap: 2px; margin-top: 2px; }

.atb .person { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 10px; width: 100%; text-align: left; font: inherit; cursor: pointer; background: none; border: 1px solid transparent; border-radius: 9px; padding: 7px 8px; transition: background 0.1s, border-color 0.1s; }
.atb .person:hover { background: var(--surface-2); border-color: var(--line-2); }
.atb .person.is-active { background: var(--brand-soft); border-color: oklch(0.8 0.06 248); }
/* คนที่เข้างานแล้ว = พื้นหลังเขียว มองเห็นง่าย */
.atb .person.present { background: oklch(0.95 0.045 152); border-color: transparent; }
.atb .person.present:hover { background: oklch(0.93 0.06 152); border-color: transparent; }
/* คนที่ออกงานแล้ว (checkout/logout) = เทาอ่อน ไม่เขียว */
.atb .person.done { background: oklch(0.96 0.003 255); border-color: transparent; }
.atb .person.done:hover { background: oklch(0.945 0.004 255); border-color: transparent; }
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
.atb .s-done { background: transparent; color: oklch(0.62 0.003 255); border: none; }
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

/* ── การ์ดดีไซน์ใหม่ (ลาดพร้าว) ── */
.atb .lpc { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); overflow: hidden; display: flex; flex-direction: column; }
.atb .lpc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 15px 18px 13px; border-bottom: 1px solid var(--line-2); background: linear-gradient(180deg, var(--surface-2), var(--surface)); }
.atb .lpc-today { font-size: 11.5px; color: var(--muted); font-weight: 500; }
.atb .lpc-name-h { font-size: 19px; font-weight: 700; margin-top: 2px; letter-spacing: -0.01em; }
.atb .lpc-counts { display: flex; gap: 6px; flex-shrink: 0; }
.atb .lpc-count { font-size: 11.5px; padding: 5px 10px; border-radius: 10px; font-weight: 500; white-space: nowrap; }
.atb .lpc-count b { font-size: 14px; font-weight: 700; margin-right: 2px; }
.atb .lpc-count.ok { background: oklch(0.95 0.05 152); color: oklch(0.42 0.12 152); }
.atb .lpc-count.wait { background: var(--surface-2); color: var(--muted); border: 1px solid var(--line); }
.atb .lpc-body { padding: 8px 12px 14px; display: flex; flex-direction: column; gap: 3px; }
.atb .lpc-shift { padding: 4px 0 6px 9px; border-left: 3px solid var(--band); margin-bottom: 2px; }
.atb .lpc-shead { display: flex; align-items: center; gap: 8px; padding: 4px 11px; background: var(--band-tint); border-radius: 8px; margin-bottom: 3px; }
.atb .lpc-sdot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; background: var(--band); }
.atb .lpc-slabel { font-size: 13px; font-weight: 700; color: var(--band-ink); }
.atb .lpc-fix { font-size: 13px; font-weight: 700; color: var(--band-ink); }
.atb .lpc-srange { margin-left: auto; font-size: 11px; color: var(--muted); }
.atb .lpc-r2 { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 3px; white-space: nowrap; }
.atb .lpc-shlabel { font-size: 11px; color: var(--muted); font-weight: 600; white-space: nowrap; }
.atb .lpc-out { margin: 8px 4px 2px; padding: 2px 6px 4px; background: oklch(0.975 0.002 255); border: 1px dashed var(--line); border-radius: 12px; }
.atb .lpc-out .lpc-slabel { color: var(--muted); }

.atb .lpc-person { position: relative; display: flex; align-items: center; gap: 11px; width: 100%; text-align: left; padding: 8px; border-radius: 12px; cursor: pointer; border: 1px solid transparent; transition: background 0.1s, border-color 0.1s; }
.atb .lpc-person:hover { background: var(--surface-2); }
.atb .lpc-person.active { background: var(--brand-soft); border-color: oklch(0.8 0.06 248); }

.atb .lpc-av { position: relative; width: 42px; height: 42px; flex-shrink: 0; }
.atb .lpc-av-ring { width: 42px; height: 42px; border-radius: 50%; border: 2.5px solid var(--line); display: grid; place-items: center; }
.atb .lpc-av-in { font-size: 13.5px; font-weight: 700; }
.atb .lpc-av-img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block; }
.atb .lpc-av-badge { position: absolute; right: -1px; bottom: -1px; width: 16px; height: 16px; border-radius: 50%; display: grid; place-items: center; font-size: 9px; color: #fff; border: 2px solid var(--surface); background: var(--ok); }
.atb .lpc-person.present .lpc-av-ring { border-color: oklch(0.72 0.13 152); background: oklch(0.96 0.04 152); }
.atb .lpc-person.present .lpc-av-in { color: oklch(0.42 0.12 152); }
.atb .lpc-person.present .lpc-av-badge { background: var(--ok); }
.atb .lpc-person.done .lpc-av-ring { border-color: oklch(0.84 0.01 255); background: oklch(0.96 0.004 255); }
.atb .lpc-person.done .lpc-av-in { color: oklch(0.52 0.01 255); }
.atb .lpc-person.done .lpc-av-badge { background: oklch(0.72 0.02 255); }
.atb .lpc-person.pending .lpc-av-ring { border-color: oklch(0.88 0.008 255); background: oklch(0.975 0.003 255); }
.atb .lpc-person.pending .lpc-av-in { color: oklch(0.62 0.01 255); }

.atb .lpc-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.atb .lpc-r1 { display: flex; align-items: center; gap: 7px; }
.atb .lpc-name { flex: 1; min-width: 0; font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.atb .lpc-code { font-size: 10.5px; font-weight: 600; color: var(--muted); background: var(--surface-2); border: 1px solid var(--line-2); border-radius: 6px; padding: 1px 6px; flex-shrink: 0; }
.atb .lpc-person.present .lpc-code { color: oklch(0.42 0.12 152); background: oklch(0.96 0.04 152); border-color: oklch(0.78 0.1 152); }
.atb .lpc-person.done .lpc-code { color: oklch(0.5 0.012 255); background: oklch(0.965 0.004 255); border-color: oklch(0.86 0.01 255); }
.atb .lpc-person.pending .lpc-code { color: oklch(0.6 0.012 255); background: oklch(0.975 0.003 255); border-color: oklch(0.88 0.008 255); }
.atb .lpc-pill { font-size: 10.5px; font-weight: 600; padding: 2px 9px; border-radius: 999px; flex-shrink: 0; }
.atb .lpc-pill.ok { background: oklch(0.95 0.05 152); color: oklch(0.42 0.12 152); }
.atb .lpc-pill.out { background: var(--surface-2); color: var(--muted); }
.atb .lpc-pill.wait { background: oklch(0.96 0.05 78); color: oklch(0.5 0.12 78); }
.atb .lpc-time { font-size: 12.5px; font-weight: 700; font-family: 'IBM Plex Mono', monospace; flex-shrink: 0; }
.atb .lpc-time.present { color: oklch(0.45 0.12 152); }
.atb .lpc-time.done { color: var(--muted); font-weight: 600; }
.atb .lpc-time.pending { color: var(--pending); font-weight: 500; font-family: inherit; font-size: 11.5px; }

.atb .lpc-acts { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); display: flex; gap: 5px; background: var(--surface); padding: 3px; border-radius: 11px; box-shadow: 0 2px 8px oklch(0.4 0.02 255 / 0.18); }
.atb .lpc-act { width: 32px; height: 32px; border-radius: 9px; border: 1px solid var(--line); background: var(--surface); display: grid; place-items: center; cursor: pointer; color: var(--ink-2); transition: background .12s, color .12s, transform .12s, border-color .12s; }
.atb .lpc-act:hover { background: var(--surface-2); transform: translateY(-1px); }
.atb .lpc-act.accent { color: #0f766e; }
.atb .lpc-act.accent:hover { background: #effaf7; border-color: #0f766e; }

/* แผงรายละเอียด (คลิกแถว) + toast — ดีไซน์ B */
.atb .lpc-modal { position: fixed; inset: 0; background: rgba(15,23,42,.32); backdrop-filter: blur(3px); display: grid; place-items: center; z-index: 50; padding: 16px; animation: atbfade .15s; }
.atb .lpc-card { width: 100%; max-width: 392px; background: #fff; border-radius: 18px; box-shadow: 0 24px 60px -12px rgba(15,23,42,.4); overflow: hidden; animation: lpcpop .18s cubic-bezier(.2,.8,.2,1); }
@keyframes lpcpop { from { transform: scale(.96); opacity: 0; } }
.atb .lpc-mhead { display: flex; align-items: center; gap: 13px; padding: 18px 20px; border-bottom: 1px solid #f1f4f7; }
.atb .lpc-mav { width: 50px; height: 50px; border-radius: 99px; display: grid; place-items: center; font-weight: 700; font-size: 17px; flex-shrink: 0; border: 2px solid var(--line); background: var(--surface-2); }
.atb .lpc-mav.present { border-color: oklch(0.72 0.13 152); background: oklch(0.96 0.04 152); color: oklch(0.42 0.12 152); }
.atb .lpc-mav.done { border-color: oklch(0.84 0.01 255); background: oklch(0.96 0.004 255); color: oklch(0.52 0.01 255); }
.atb .lpc-mav.pending { border-color: oklch(0.88 0.008 255); color: oklch(0.6 0.01 255); }
.atb .lpc-mid { flex: 1; min-width: 0; }
.atb .lpc-mname { font-size: 16.5px; font-weight: 700; color: #0f172a; }
.atb .lpc-mse { font-size: 12.5px; color: var(--muted); font-weight: 500; margin-top: 2px; }
.atb .lpc-msec { padding: 15px 20px; border-bottom: 1px solid #f6f8fa; }
.atb .lpc-mlabel { font-size: 11.5px; font-weight: 700; color: var(--muted); letter-spacing: .03em; margin-bottom: 10px; }
.atb .lpc-mgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.atb .lpc-field { background: var(--surface-2); border-radius: 11px; padding: 9px 12px; }
.atb .lpc-fl { font-size: 11px; color: var(--muted); font-weight: 600; margin-bottom: 3px; }
.atb .lpc-fv { font-size: 13.5px; font-weight: 700; color: var(--ink); }
.atb .lpc-mhist { display: flex; flex-direction: column; }
.atb .lpc-hrow { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-top: 1px solid #f4f6f8; }
.atb .lpc-hrow:first-child { border-top: none; }
.atb .lpc-hdot { width: 7px; height: 7px; border-radius: 99px; background: var(--ok); flex-shrink: 0; }
.atb .lpc-hd { font-size: 13px; color: var(--ink-2); flex: 1; }
.atb .lpc-ht { font-size: 13px; font-weight: 700; color: oklch(0.42 0.12 152); }
.atb .lpc-mempty { font-size: 12.5px; color: var(--muted); padding: 2px 0 4px; }
.atb .lpc-macts { display: flex; gap: 8px; padding: 14px 20px 18px; }
.atb .lpc-mact { flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px; padding: 11px 8px; border-radius: 12px; cursor: pointer; font: inherit; font-size: 13.5px; font-weight: 600; border: 1px solid var(--line); background: #fff; color: var(--ink-2); transition: filter .15s; }
.atb .lpc-mact:hover { filter: brightness(.97); }
.atb .lpc-mact.primary { border: none; background: #0f766e; color: #fff; }
.atb .lpc-toast { position: fixed; left: 50%; bottom: 32px; transform: translateX(-50%) translateY(8px); background: #0f172a; color: #fff; font-size: 13.5px; font-weight: 600; padding: 11px 18px; border-radius: 12px; box-shadow: 0 12px 30px -8px rgba(15,23,42,.5); opacity: 0; pointer-events: none; transition: opacity .2s, transform .2s; z-index: 60; }
.atb .lpc-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

@media (max-width: 720px) {
  .atb .topbar, .atb .toolbar { position: static; }
  .atb .cardgrid { grid-template-columns: 1fr; }
  .atb .rightctl { margin-left: 0; }
}
`;
