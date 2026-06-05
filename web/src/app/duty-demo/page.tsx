'use client';

import { useMemo, useState, useRef } from 'react';
import { ROSTER_DATA } from './roster-data';

// ─────────────────────────────────────────────────────────────
// ตัวอย่างตารางเวร "แก้ไขได้" — ศูนย์ลาดพร้าว
//  • แต่ละช่องเวรเป็น dropdown เปลี่ยนได้
//  • เพิ่ม / ลบ คอลัมน์พนักงานได้เอง
//  • เวรคงที่ (ผูกกับวันที่ 1..31) · เปลี่ยนเดือน → วันที่/วันเลื่อนตามปฏิทิน
// ─────────────────────────────────────────────────────────────

const TH_DOW = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const MONTHS_TH = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

type ShiftKey = 'none' | 'off' | 's1' | 's2' | 's3' | 'f1120' | 'f1423';
// label = ที่แสดงในช่อง, time = ช่วงเวลา, opt = ข้อความใน dropdown
const SHIFT: Record<ShiftKey, { label: string; time: string; opt: string }> = {
  none: { label: '—', time: '', opt: '— (ว่าง)' },
  off: { label: 'เวรหยุด', time: '', opt: 'เวรหยุด' },
  s1: { label: 'เวร 1', time: '07.00 – 16.00', opt: 'เวร 1 · 07.00 – 16.00' },
  s2: { label: 'เวร 2', time: '15.00 – 24.00', opt: 'เวร 2 · 15.00 – 24.00' },
  s3: { label: 'เวร 3 ดึก', time: '23.00 – 08.00', opt: 'เวร 3 ดึก · 23.00 – 08.00' },
  f1120: { label: 'FIX', time: '11.00 – 20.00', opt: 'FIX · 11.00 – 20.00' },
  f1423: { label: 'FIX', time: '14.00 – 23.00', opt: 'FIX · 14.00 – 23.00' },
};
const SHIFT_OPTIONS: ShiftKey[] = ['off', 's1', 's2', 's3', 'f1120', 'f1423', 'none'];

type Person = { id: number; code: string; name: string; fix: boolean };

const REGIONS = [{ key: 'bkk', label: 'กรุงเทพฯ' }, { key: 'pmt', label: 'ปริมณฑล' }];
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
const emptyGrid = (): ShiftKey[][] => Array.from({ length: 31 }, () => []);

// เขต/อำเภอที่แต่ละศูนย์รับผิดชอบ (จากไฟล์ Excel จริง) · special = พื้นที่นอกเขต/พิเศษ +100฿
const DISTRICTS_BY_CENTER: Record<string, { areas: string[]; special?: string[] }> = {
  ladprao: { areas: ['บางกะปิ', 'วังทองหลาง', 'ลาดพร้าว', 'สะพานสูง', 'สวนหลวง', 'คลองสามวา'], special: ['หนองจอก'] },
  raminthra: { areas: ['สายไหม', 'คันนายาว'] },
  onnut: { areas: ['ลาดกระบัง', 'บางนา', 'ประเวศ', 'สุวรรณภูมิ (บางพลี)'] },
  bangkhae: { areas: ['จอมทอง', 'ภาษีเจริญ', 'บางบอน', 'หนองแขม', 'ทวีวัฒนา', 'คลองสาน', 'ธนบุรี'] },
  minburi: { areas: ['มีนบุรี', 'คลองสามวา', 'หนองจอก', 'ลาดพร้าว', 'คันนายาว'] },
  rama9: { areas: ['ห้วยขวาง', 'ดินแดง', 'พญาไท', 'สาทร', 'ปทุมวัน', 'บางรัก', 'สวนหลวง', 'วัฒนา', 'ราชเทวี'] },
  bangna: { areas: ['พระโขนง', 'บางนา', 'ประเวศ', 'อุดมสุข', 'แยกบางนา'] },
  sathon: { areas: ['สาทร', 'คลองเตย', 'ปทุมวัน', 'บางรัก', 'ป้อมปราบศัตรูพ่าย'] },
  rama2: { areas: ['บางขุนเทียน', 'จอมทอง', 'ราษฎร์บูรณะ', 'บางบอน', 'ทุ่งครุ', 'อ.พระประแดง', 'อ.พระสมุทรเจดีย์'] },
  bangphlat: { areas: ['บางพลัด', 'ตลิ่งชัน', 'บางกอกน้อย', 'บางกอกใหญ่', 'ภาษีเจริญ', 'อ.บางกรวย'] },
  pathum: { areas: ['ทั้งจังหวัดปทุมธานี'], special: ['อ.หนองเสือ', 'อ.สามโคก', 'อ.ลาดหลุมแก้ว', 'เกินคลอง 8'] },
  pakkret: { areas: ['อ.ปากเกร็ด'], special: ['อ.สามโคก', 'อ.ไทรน้อย'] },
  nonthaburi: { areas: ['ทั้งจังหวัดนนทบุรี'], special: ['อ.บางเลน', 'อ.ลาดหลุมแก้ว', 'อ.สามโคก', 'อ.ไทรน้อย'] },
  samutprakan: { areas: ['ทั้งจังหวัดสมุทรปราการ'], special: ['นอกพื้นที่'] },
};

export default function DutyDemoPage() {
  const [view, setView] = useState({ y: 2026, m: 5 });
  const [centerId, setCenterId] = useState('ladprao');
  const [dataByCenter, setDataByCenter] = useState<Record<string, { people: Person[]; grid: ShiftKey[][] }>>(() => {
    const d: Record<string, { people: Person[]; grid: ShiftKey[][] }> = {};
    let pid = 1;
    for (const c of CENTERS) {
      const raw = ROSTER_DATA[c.id];
      d[c.id] = raw
        ? { people: raw.people.map((p) => ({ id: pid++, code: p.code, name: p.name, fix: false })), grid: raw.grid as ShiftKey[][] }
        : { people: [], grid: emptyGrid() };
    }
    return d;
  });
  const nextId = useRef(1000);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const people = dataByCenter[centerId].people;
  const grid = dataByCenter[centerId].grid;
  const updateCur = (fn: (c: { people: Person[]; grid: ShiftKey[][] }) => { people: Person[]; grid: ShiftKey[][] }) =>
    setDataByCenter((d) => ({ ...d, [centerId]: fn(d[centerId]) }));

  const rows = useMemo(() => {
    const daysIn = new Date(view.y, view.m, 0).getDate();
    return Array.from({ length: daysIn }, (_, i) => ({ d: i + 1, dow: new Date(view.y, view.m - 1, i + 1).getDay() }));
  }, [view]);

  const setCell = (dayIdx: number, pIdx: number, val: ShiftKey) =>
    updateCur((c) => ({ ...c, grid: c.grid.map((row, r) => (r === dayIdx ? row.map((x, i) => (i === pIdx ? val : x)) : row)) }));

  const editPerson = (pIdx: number, field: 'code' | 'name', val: string) =>
    updateCur((c) => ({ ...c, people: c.people.map((p, i) => (i === pIdx ? { ...p, [field]: val } : p)) }));

  const addPerson = () => {
    const id = nextId.current++;
    updateCur((c) => ({ people: [...c.people, { id, code: 'SE', name: 'พนักงานใหม่', fix: false }], grid: c.grid.map((row) => [...row, 'off' as ShiftKey]) }));
  };

  const removePerson = (pIdx: number) =>
    updateCur((c) => ({ people: c.people.filter((_, i) => i !== pIdx), grid: c.grid.map((row) => row.filter((_, i) => i !== pIdx)) }));

  const changeMonth = (delta: number) =>
    setView((v) => {
      let m = v.m + delta;
      let y = v.y;
      if (m > 12) { m = 1; y += 1; }
      if (m < 1) { m = 12; y -= 1; }
      return { y, m };
    });

  return (
    <div className="demo">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <header className="hd">
        <div>
          <h1>ตารางเวร {MONTHS_TH[view.m]} {view.y + 543} — ศูนย์{CENTERS.find((c) => c.id === centerId)?.name}</h1>
          <p>แก้เวรแต่ละช่องได้ (เลือกจาก dropdown) · เพิ่ม/ลบคอลัมน์พนักงานได้ · เปลี่ยนเดือนแล้ววันที่/วันเลื่อนตาม เวรคงที่</p>
        </div>
        <div className="ctl">
          <button className="add-btn" onClick={addPerson}>+ เพิ่มพนักงาน</button>
          <div className="rotctl">
            <span>เดือน:</span>
            <button onClick={() => changeMonth(-1)}>◀</button>
            <b>{MONTHS_TH[view.m]} {view.y + 543}</b>
            <button onClick={() => changeMonth(1)}>▶</button>
          </div>
        </div>
      </header>

      <div className="centertabs">
        {REGIONS.map((rg) => (
          <div key={rg.key} className="ctab-group">
            <span className="ctab-glabel">{rg.label}</span>
            {CENTERS.filter((c) => c.region === rg.key).map((c) => (
              <button key={c.id} className={`ctab ${centerId === c.id ? 'on' : ''}`} onClick={() => { setCenterId(c.id); setConfirmId(null); }}>
                {c.name}
                {dataByCenter[c.id].people.length > 0 && <span className="ctab-n">{dataByCenter[c.id].people.length}</span>}
              </button>
            ))}
          </div>
        ))}
      </div>

      {people.length === 0 ? (
        <div className="emptybox">ศูนย์นี้ยังไม่มีพนักงาน — กด “+ เพิ่มพนักงาน” เพื่อเริ่มสร้างตาราง</div>
      ) : (
      <div className="tablewrap">
        <table className="dtable" style={{ minWidth: 142 + people.length * 158 }}>
          <colgroup>
            <col style={{ width: 50 }} />
            <col style={{ width: 92 }} />
            {people.map((p) => <col key={p.id} />)}
          </colgroup>
          <thead>
            <tr>
              <th className="c-date">วันที่</th>
              <th className="c-dow">วัน</th>
              {people.map((p, pIdx) => (
                <th key={p.id} className="c-person">
                  {confirmId === p.id ? (
                    <span className="col-confirm">
                      <button className="col-yes" onClick={() => { removePerson(pIdx); setConfirmId(null); }}>ลบ</button>
                      <button className="col-no" onClick={() => setConfirmId(null)}>ยกเลิก</button>
                    </span>
                  ) : (
                    <button className="col-x" title="ลบคอลัมน์นี้" onClick={() => setConfirmId(p.id)}>✕</button>
                  )}
                  <div className="ph-row">
                    <input className="ph-code-in" value={p.code} onChange={(e) => editPerson(pIdx, 'code', e.target.value)} spellCheck={false} />
                    <input className="ph-name-in" value={p.name} onChange={(e) => editPerson(pIdx, 'name', e.target.value)} spellCheck={false} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, dayIdx) => {
              const weekend = r.dow === 0 || r.dow === 6;
              return (
                <tr key={r.d} className={weekend ? 'we' : ''}>
                  <td className="c-date">{r.d}</td>
                  <td className="c-dow">วัน{TH_DOW[r.dow]}</td>
                  {people.map((p, pIdx) => {
                    const val = grid[dayIdx][pIdx];
                    return (
                      <td key={p.id} className={`cell ${val}`}>
                        <select value={val} onChange={(e) => setCell(dayIdx, pIdx, e.target.value as ShiftKey)}>
                          {SHIFT_OPTIONS.map((k) => <option key={k} value={k}>{SHIFT[k].opt}</option>)}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      <section className="footer">
        <div className="legend">
          <b>เวร:</b>
          {(['s1', 's2', 's3', 'off', 'f1120'] as ShiftKey[]).map((s) => (
            <span key={s} className="lg"><span className={`pill ${s}`}>{SHIFT[s].label}</span>{SHIFT[s].time && <i>{SHIFT[s].time}</i>}</span>
          ))}
        </div>
        <div className="areas">
          <b>พื้นที่รับผิดชอบ ({CENTERS.find((c) => c.id === centerId)?.name}):</b> {(DISTRICTS_BY_CENTER[centerId]?.areas ?? []).join(' · ') || '—'}
          {DISTRICTS_BY_CENTER[centerId]?.special && (
            <span className="sp">พื้นที่พิเศษ/นอกพื้นที่: {DISTRICTS_BY_CENTER[centerId]?.special?.join(' · ')} <em>+100 บาท</em></span>
          )}
        </div>
        <p className="note">
          * คลิกที่ช่องเวรเพื่อเปลี่ยนค่า (dropdown) · กด <b>+ เพิ่มพนักงาน</b> เพื่อเพิ่มคอลัมน์ · กด <b>✕</b> บนหัวคอลัมน์เพื่อลบ ·
          แก้รหัส/ชื่อได้ที่หัวคอลัมน์ · เปลี่ยนเดือนแล้วเวรคงเดิม มีแค่วันที่/วันที่เลื่อน (ตัวอย่าง — ยังไม่บันทึกลงฐานข้อมูล)
        </p>
      </section>
    </div>
  );
}

const CSS = `
.demo { font-family: Arial, Helvetica, sans-serif; color:#1f2937; background:#f1f5f9; min-height:100vh; padding:24px; }
.demo * { box-sizing:border-box; }
.demo .hd { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; flex-wrap:wrap; margin-bottom:16px; }
.demo .hd h1 { font-size:22px; font-weight:700; margin:0; }
.demo .hd p { font-size:13px; color:#64748b; margin:4px 0 0; max-width:760px; }
.demo .ctl { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.demo .add-btn { font:inherit; font-size:13.5px; font-weight:600; padding:9px 16px; border-radius:10px; border:1px solid #16a34a; background:#16a34a; color:#fff; cursor:pointer; }
.demo .add-btn:hover { background:#15803d; }
.demo .rotctl { display:flex; align-items:center; gap:8px; font-size:13px; color:#475569; background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:7px 12px; }
.demo .rotctl button { width:30px; height:30px; border:1px solid #cbd5e1; background:#fff; border-radius:8px; cursor:pointer; font-size:13px; }
.demo .rotctl button:hover { background:#f1f5f9; }
.demo .rotctl b { min-width:118px; text-align:center; }

.demo .pill { display:inline-block; font-size:11.5px; font-weight:600; padding:2px 9px; border-radius:99px; white-space:nowrap; }
.demo .pill.s1 { background:#86efac; color:#14532d; }
.demo .pill.s2 { background:#fcd34d; color:#78350f; }
.demo .pill.s3 { background:#a5b4fc; color:#312e81; }
.demo .pill.off { background:#94a3b8; color:#1f2937; }
.demo .pill.f1120, .demo .pill.f1423 { background:#f9a8d4; color:#831843; }

.demo .tablewrap { overflow:auto; border:1px solid #cbd5e1; border-radius:12px; background:#fff; max-height:74vh; }
.demo .dtable { border-collapse:collapse; width:100%; table-layout:fixed; font-size:13.5px; }
.demo .dtable th, .demo .dtable td { border:1px solid #e2e8f0; text-align:center; }
.demo .dtable thead th { position:sticky; top:0; z-index:3; background:#1e293b; color:#fff; padding:7px 5px; font-weight:600; vertical-align:middle; }
.demo .c-person { position:relative; }
.demo .col-x { position:absolute; top:3px; right:4px; width:17px; height:17px; line-height:15px; border-radius:5px; border:none; background:rgba(255,255,255,.14); color:#fca5a5; font-size:10px; cursor:pointer; padding:0; }
.demo .col-x:hover { background:#dc2626; color:#fff; }
.demo .col-confirm { position:absolute; top:2px; right:3px; display:flex; gap:3px; z-index:6; }
.demo .col-yes, .demo .col-no { font:inherit; font-size:10.5px; font-weight:600; padding:2px 8px; border-radius:5px; cursor:pointer; }
.demo .col-yes { border:none; background:#dc2626; color:#fff; }
.demo .col-yes:hover { background:#b91c1c; }
.demo .col-no { border:1px solid rgba(255,255,255,.35); background:rgba(255,255,255,.12); color:#e2e8f0; }
.demo .col-no:hover { background:rgba(255,255,255,.22); }
.demo .ph-row { display:flex; align-items:baseline; gap:8px; padding:2px 20px 2px 10px; }
.demo .ph-code-in { flex:0 0 auto; width:48px; border:none; background:transparent; color:#cbd5e1; font:inherit; font-size:13px; text-align:left; outline:none; padding:1px 0; }
.demo .ph-name-in { flex:1 1 auto; min-width:0; border:none; background:transparent; color:#fff; font:inherit; font-size:14.5px; font-weight:600; text-align:left; outline:none; padding:1px 3px; border-radius:4px; }
.demo .ph-code-in:focus, .demo .ph-name-in:focus { background:rgba(255,255,255,.12); }
.demo .ph-code-in::placeholder, .demo .ph-name-in::placeholder { color:#64748b; }

.demo .dtable .c-date, .demo .dtable .c-dow { position:sticky; background:#f8fafc; font-weight:600; color:#334155; z-index:2; }
.demo .dtable .c-date { left:0; }
.demo .dtable .c-dow { left:50px; text-align:left; padding-left:8px; box-shadow:1px 0 0 #cbd5e1; }
.demo .dtable thead .c-date, .demo .dtable thead .c-dow { background:#1e293b; color:#fff; text-align:center; padding-left:5px; z-index:4; }
.demo .dtable tr.we .c-date, .demo .dtable tr.we .c-dow { background:#fef2f2; color:#b91c1c; }

.demo .cell { padding:0; height:42px; }
.demo .cell select { width:100%; height:100%; border:none; background:transparent; color:inherit; font:inherit; font-weight:600; font-size:13.5px; text-align:center; text-align-last:center; cursor:pointer; padding:4px 2px; }
.demo .cell select:hover { background:rgba(0,0,0,.04); }
.demo .cell select:focus { outline:2px solid #2563eb; outline-offset:-2px; }
.demo .cell { position:relative; }
.demo .cell.s1 { background:#86efac; color:#14532d; }
.demo .cell.s2 { background:#fcd34d; color:#78350f; }
.demo .cell.s3 { background:#a5b4fc; color:#312e81; }
.demo .cell.off { background:#94a3b8; color:#1f2937; }
.demo .cell.f1120, .demo .cell.f1423 { background:#f9a8d4; color:#831843; }
.demo .cell.none { background:#fff; color:#cbd5e1; }

.demo .footer { margin-top:16px; }
.demo .legend { display:flex; align-items:center; gap:14px; flex-wrap:wrap; font-size:13px; margin-bottom:10px; }
.demo .legend .lg { display:inline-flex; align-items:center; gap:6px; }
.demo .legend .lg i { font-style:normal; color:#64748b; font-size:12px; }
.demo .areas { font-size:13px; color:#334155; background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:10px 14px; }
.demo .areas .sp { display:block; margin-top:5px; color:#64748b; }
.demo .areas em { color:#dc2626; font-style:normal; font-weight:600; }
.demo .note { font-size:12px; color:#94a3b8; margin-top:10px; line-height:1.7; }
.demo .centertabs { display:flex; gap:8px 22px; flex-wrap:wrap; align-items:center; margin-bottom:14px; padding:11px 14px; background:#fff; border:1px solid #e2e8f0; border-radius:12px; }
.demo .ctab-group { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.demo .ctab-glabel { font-size:11.5px; font-weight:700; color:#94a3b8; margin-right:2px; }
.demo .ctab { font:inherit; font-size:13px; padding:6px 13px; border-radius:8px; border:1px solid #e2e8f0; background:#f8fafc; color:#475569; cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
.demo .ctab:hover { border-color:#cbd5e1; background:#f1f5f9; }
.demo .ctab.on { background:#1e293b; border-color:#1e293b; color:#fff; font-weight:600; }
.demo .ctab-n { font-size:10.5px; background:rgba(0,0,0,.12); border-radius:99px; padding:0 6px; }
.demo .ctab.on .ctab-n { background:rgba(255,255,255,.25); }
.demo .emptybox { background:#fff; border:1px dashed #cbd5e1; border-radius:12px; padding:48px 20px; text-align:center; color:#64748b; font-size:14px; }
`;
