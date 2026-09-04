'use client';

/**
 * งานรอตรวจ (ISURVEY) — ดึงงานของฉันจาก ISURVEY เข้ามาเป็นเคสบนเว็บนี้ (04/09/69)
 *
 *   ช่างส่งงานบน ISURVEY → หัวหน้ากดดึงที่นี่ (บัญชี ISURVEY ของตัวเอง) → ได้เคส "รอตรวจ" + รูป
 *   → ตรวจ/แก้/ใส่เรทที่หน้าเคส → อนุมัติ → บอทยกเข้า EMCS
 *
 * กติกาที่ user เคาะหลังใช้จริง (04/09/69):
 *   - วันที่เริ่มที่ "วันนี้" ทั้งคู่ ผู้ใช้เลือกช่วงเอง · ไม่โหลดอัตโนมัติ (บางบัญชีงานค้างมาก ช้า) กด "โหลดรายการ" เอง
 *   - โหลดมาทุกสถานะ แล้วเลือกสถานะที่จะดูได้ (ค่าเริ่มต้น "รอตรวจข้อมูล")
 *   - "ดึงเข้า" ทีละงานเสร็จ → เด้งไปหน้าเคสนั้นเลย · "ดึงทั้งหมด" ไม่เด้ง
 * หน้านี้ "สร้างเคส" อย่างเดียว — ไม่เขียนอะไรกลับ ISURVEY (งานที่นั่นสถานะเดิม)
 */
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

type Row = {
  claim_no: string; survey_no: string; surveyor_name: string; acc_province: string;
  plate_no: string; finish_dt: string; status: string; emcs_sent: boolean;
  imported_case_id?: number | null; imported_status?: string | null;
};
type Filter = { applied: boolean; group_name: string | null; members: number; hidden: number };
type PullResult = { caseId?: number; warnings?: string[]; photos?: { added?: number; error?: string; note?: string } };

const PENDING = 'รอตรวจข้อมูล';
const ALL = '__all__';
const todayISO = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);   // วันตามเวลาไทย
const errMsg = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || (e as Error)?.message || 'เกิดข้อผิดพลาด';
const STATUS_TH: Record<string, string> = {
  surveyed: 'รอตรวจ', reviewed: 'อนุมัติแล้ว', assigned: 'ตีกลับ/มอบหมาย', pending: 'รอมอบหมาย',
};

export default function IsurveyPendingPage() {
  const router = useRouter();
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState<Filter | null>(null);
  const [status, setStatus] = useState<string>(PENDING);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needAccount, setNeedAccount] = useState(false);
  const [pulling, setPulling] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, { ok: boolean; text: string; caseId?: number }>>({});
  const [bulk, setBulk] = useState(false);

  const key = (r: Row) => `${r.claim_no}|${r.survey_no}`;

  const load = async () => {
    setLoading(true); setError(''); setNeedAccount(false); setResults({});
    try {
      const r = await api.get('/api/isurvey/pending', { params: { from, to }, timeout: 180000 });
      const cases = (r.data?.data?.cases ?? []) as Row[];
      setRows(cases);
      setFilter((r.data?.data?.filter ?? null) as Filter | null);
      // ค่าเริ่มต้นดู "รอตรวจข้อมูล" — ถ้าช่วงนี้ไม่มีเลยค่อยโชว์ทั้งหมด จะได้ไม่เจอตารางว่างทั้งที่มีงาน
      if (!cases.some((c) => c.status === PENDING)) setStatus(ALL); else setStatus(PENDING);
    } catch (e) {
      const code = (e as { response?: { status?: number } })?.response?.status;
      if (code === 412) setNeedAccount(true);
      setError(errMsg(e)); setRows(null);
    } finally { setLoading(false); }
  };

  // สถานะที่มีในรายการที่โหลดมา + จำนวน — ไว้ทำตัวเลือก
  const statusCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.status || '(ไม่ระบุ)', (m.get(r.status || '(ไม่ระบุ)') ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => (a[0] === PENDING ? -1 : b[0] === PENDING ? 1 : b[1] - a[1]));
  }, [rows]);
  const visible = useMemo(() => (rows ?? []).filter((r) => status === ALL || (r.status || '(ไม่ระบุ)') === status), [rows, status]);

  const pullOne = async (r: Row, opts: { navigate: boolean }): Promise<boolean> => {
    const k = key(r);
    setPulling((p) => ({ ...p, [k]: true }));
    try {
      const res = await api.post('/api/isurvey/pull', { claim_no: r.claim_no, survey_no: r.survey_no }, { timeout: 300000 });
      const d = (res.data?.data ?? {}) as PullResult;
      const photos = d.photos?.error ? `รูป: ${d.photos.error}` : `รูป ${d.photos?.added ?? 0} ใบ`;
      const warn = d.warnings?.length ? ` · เตือน ${d.warnings.length} ข้อ` : '';
      setResults((m) => ({ ...m, [k]: { ok: true, text: `ดึงแล้ว → เคส #${d.caseId} (${photos}${warn})`, caseId: d.caseId } }));
      setRows((rs) => (rs ?? []).map((x) => (key(x) === k ? { ...x, imported_case_id: d.caseId ?? null, imported_status: 'surveyed' } : x)));
      // ดึงทีละงาน = ตั้งใจจะไปตรวจงานนั้นต่อ → เปิดหน้าเคสให้เลย ไม่ต้องไปหาในรายการงาน
      if (opts.navigate && d.caseId) router.push(`/inspector/cases/${d.caseId}`);
      return true;
    } catch (e) {
      setResults((m) => ({ ...m, [k]: { ok: false, text: errMsg(e) } }));
      return false;
    } finally {
      setPulling((p) => ({ ...p, [k]: false }));
    }
  };

  const confirmPull = (r: Row): boolean => {
    if (r.status === PENDING) return true;
    return window.confirm(`งานนี้สถานะ "${r.status}" ไม่ใช่ "รอตรวจข้อมูล"${r.emcs_sent ? ' และเข้า EMCS ไปแล้ว' : ''} — ดึงเข้ามาเป็นเคสใหม่แน่ใจ?`);
  };

  const pullAll = async () => {
    const todo = visible.filter((r) => !r.imported_case_id);
    if (todo.length === 0) return;
    const label = status === ALL ? 'ทุกสถานะ' : `สถานะ "${status}"`;
    if (!window.confirm(`ดึงงานที่ยังไม่มีในระบบ (${label}) ทั้งหมด ${todo.length} เรื่อง? (ทีละเรื่อง ใช้เวลาประมาณ ${todo.length * 15} วินาที)`)) return;
    setBulk(true);
    try {
      for (const r of todo) { await pullOne(r, { navigate: false }); }   // ทีละเรื่อง — ISURVEY จำกัด 1 การใช้งาน/บัญชี
    } finally { setBulk(false); }
  };

  const notImported = visible.filter((r) => !r.imported_case_id).length;

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">งานรอตรวจ (ISURVEY)</h1>
          <p className="text-sm text-gray-600">งานของบัญชี ISURVEY ของคุณ — เลือกช่วงวันที่แล้วกดโหลด ดึงเข้ามาเป็นเคสแล้วตรวจ/ใส่เรท/อนุมัติที่นี่</p>
        </div>
        <div className="ml-auto flex flex-wrap items-end gap-2 text-sm">
          <label className="flex flex-col text-xs text-gray-600">ตั้งแต่
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="border border-gray-300 px-2 py-1 text-sm" /></label>
          <label className="flex flex-col text-xs text-gray-600">ถึง
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="border border-gray-300 px-2 py-1 text-sm" /></label>
          <button type="button" onClick={load} disabled={loading || bulk || !from || !to}
            className="px-3 py-1.5 bg-[var(--md-blue)] text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'กำลังโหลด…' : 'โหลดรายการ'}
          </button>
          {rows && (
            <label className="flex flex-col text-xs text-gray-600">สถานะ
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-gray-300 px-2 py-1 text-sm">
                {statusCounts.map(([s, n]) => <option key={s} value={s}>{s} ({n})</option>)}
                <option value={ALL}>ทั้งหมด ({rows.length})</option>
              </select>
            </label>
          )}
          {rows && (
            <button type="button" onClick={pullAll} disabled={loading || bulk || notImported === 0}
              className="px-3 py-1.5 border border-[var(--md-blue)] text-[var(--md-blue)] bg-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
              {bulk ? 'กำลังดึง…' : `ดึงทั้งหมดที่ยังไม่มี (${notImported})`}
            </button>
          )}
        </div>
      </div>

      {needAccount && (
        <div className="mb-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-2">
          ยังไม่ได้ตั้งบัญชี ISURVEY ของคุณ — ไปที่{' '}
          <Link href="/inspector/isurvey/account" className="underline font-semibold">บัญชี ISURVEY</Link> ก่อน
        </div>
      )}
      {error && !needAccount && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-2">{error}</div>
      )}
      {rows === null && !error && !loading && (
        <div className="bg-white border border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
          เลือกช่วงวันที่ (ค่าเริ่มต้น = วันนี้) แล้วกด &quot;โหลดรายการ&quot;
        </div>
      )}

      {rows && filter && (
        <div className="mb-2 text-xs text-gray-600">
          {filter.applied
            ? <>แสดงเฉพาะงานของลูกทีม <span className="font-semibold">{filter.group_name}</span> ({filter.members} รายชื่อ) — ซ่อนงานของทีมอื่น {filter.hidden} เรื่อง · <Link href="/inspector/team" className="text-blue-700 hover:underline">ดูรายชื่อทีม</Link></>
            : <>แสดงงานทั้งบริษัท (บัญชีนี้ยังไม่ได้ผูกทีม — แอดมินผูกได้ที่ &quot;จัดการทีมผู้ตรวจ&quot;)</>}
        </div>
      )}

      {rows && (
        <div className="bg-white border border-gray-200 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">ส่งงานเมื่อ</th>
                <th className="px-3 py-2 text-left">เลขเคลม</th>
                <th className="px-3 py-2 text-left">เลขเซอร์เวย์</th>
                <th className="px-3 py-2 text-left">ผู้สำรวจ</th>
                <th className="px-3 py-2 text-left">จังหวัด</th>
                <th className="px-3 py-2 text-left">ทะเบียน</th>
                <th className="px-3 py-2 text-left">สถานะ ISURVEY</th>
                <th className="px-3 py-2 text-left">ในระบบเรา</th>
                <th className="px-3 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                  {rows.length === 0 ? 'ไม่มีงานในช่วงวันที่นี้' : 'ไม่มีงานในสถานะที่เลือก — เปลี่ยนสถานะด้านบน'}
                </td></tr>
              )}
              {visible.map((r) => {
                const k = key(r);
                const res = results[k];
                const busy = Boolean(pulling[k]);
                return (
                  <tr key={k} className="border-t border-gray-100 align-top">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{r.finish_dt}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-mono">{r.claim_no}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-mono">{r.survey_no}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.surveyor_name}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.acc_province}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.plate_no}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={r.status === PENDING ? 'text-amber-700' : 'text-gray-700'}>{r.status || '-'}</span>
                      {r.emcs_sent && <span className="ml-1 text-[0.65rem] px-1 py-0.5 border border-green-300 text-green-700 bg-green-50">เข้า EMCS แล้ว</span>}
                    </td>
                    <td className="px-3 py-2">
                      {r.imported_case_id ? (
                        <Link href={`/inspector/cases/${r.imported_case_id}`} className="text-green-700 hover:underline whitespace-nowrap">
                          มีแล้ว #{r.imported_case_id}{r.imported_status ? ` · ${STATUS_TH[r.imported_status] ?? r.imported_status}` : ''}
                        </Link>
                      ) : <span className="text-gray-400">ยังไม่มี</span>}
                      {res && (
                        <div className={`text-xs mt-0.5 ${res.ok ? 'text-green-700' : 'text-red-700'}`}>
                          {res.text}{res.ok && res.caseId ? <> · <Link href={`/inspector/cases/${res.caseId}`} className="underline">เปิดเคส</Link></> : null}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button type="button" disabled={busy || bulk} onClick={() => { if (confirmPull(r)) void pullOne(r, { navigate: true }); }}
                        className={`px-3 py-1 text-xs border ${r.imported_case_id ? 'border-gray-300 bg-white text-gray-700' : 'border-[var(--md-blue)] bg-[var(--md-blue)] text-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={r.imported_case_id ? 'ดึงซ้ำ = สร้างเคสใหม่อีกเคส (ระวังซ้ำ)' : 'สร้างเคส + ดึงรูป แล้วเปิดหน้าเคส'}>
                        {busy ? 'กำลังดึง…' : r.imported_case_id ? 'ดึงซ้ำ' : 'ดึงเข้า'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-500 mt-3">
        ดึงแล้วงานบน ISURVEY ยังสถานะเดิม (ยังไม่ปิดสถานะให้) · รูปที่ช่างทยอยอัปหลังจากนี้จะยังไม่ตามมา — กด &quot;ดึงซ้ำ&quot; จะได้เคสใหม่ ไม่ใช่เติมรูปเคสเดิม
      </p>
    </div>
  );
}
