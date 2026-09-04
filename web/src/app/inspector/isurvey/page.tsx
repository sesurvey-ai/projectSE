'use client';

/**
 * งานรอตรวจ (ISURVEY) — ดึงงานสถานะ "รอตรวจข้อมูล" ของฉันจาก ISURVEY เข้ามาเป็นเคสบนเว็บนี้ (04/09/69)
 *
 *   ช่างส่งงานบน ISURVEY → หัวหน้ากดดึงที่นี่ (บัญชี ISURVEY ของตัวเอง) → ได้เคส "รอตรวจ" + รูป
 *   → ตรวจ/แก้/ใส่เรทที่หน้าเคส → อนุมัติ → บอทยกเข้า EMCS
 *
 * หน้านี้ "สร้างเคส" อย่างเดียว — ไม่เขียนอะไรกลับ ISURVEY (งานที่นั่นยังเป็น "รอตรวจข้อมูล" เหมือนเดิม)
 */
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

type Row = {
  claim_no: string; survey_no: string; surveyor_name: string; acc_province: string;
  plate_no: string; finish_dt: string; status: string; emcs_sent: boolean;
  imported_case_id?: number | null; imported_status?: string | null;
};
type PullResult = { caseId?: number; warnings?: string[]; photos?: { added?: number; error?: string; note?: string } };

const isoDaysAgo = (d: number) => {
  const t = new Date(Date.now() - d * 86400000 + 7 * 3600000);   // วันตามเวลาไทย
  return t.toISOString().slice(0, 10);
};
const errMsg = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || (e as Error)?.message || 'เกิดข้อผิดพลาด';
const STATUS_TH: Record<string, string> = {
  surveyed: 'รอตรวจ', reviewed: 'อนุมัติแล้ว', assigned: 'ตีกลับ/มอบหมาย', pending: 'รอมอบหมาย',
};

export default function IsurveyPendingPage() {
  const [from, setFrom] = useState(isoDaysAgo(14));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needAccount, setNeedAccount] = useState(false);
  const [pulling, setPulling] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, { ok: boolean; text: string; caseId?: number }>>({});
  const [bulk, setBulk] = useState(false);

  const key = (r: Row) => `${r.claim_no}|${r.survey_no}`;

  const load = useCallback(async () => {
    setLoading(true); setError(''); setNeedAccount(false);
    try {
      const r = await api.get('/api/isurvey/pending', { params: { from, to }, timeout: 180000 });
      setRows((r.data?.data?.cases ?? []) as Row[]);
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 412) setNeedAccount(true);
      setError(errMsg(e)); setRows(null);
    } finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { void load(); }, [load]);

  const pullOne = async (r: Row): Promise<boolean> => {
    const k = key(r);
    setPulling((p) => ({ ...p, [k]: true }));
    try {
      const res = await api.post('/api/isurvey/pull', { claim_no: r.claim_no, survey_no: r.survey_no }, { timeout: 300000 });
      const d = (res.data?.data ?? {}) as PullResult;
      const photos = d.photos?.error ? `รูป: ${d.photos.error}` : `รูป ${d.photos?.added ?? 0} ใบ`;
      const warn = d.warnings?.length ? ` · เตือน ${d.warnings.length} ข้อ` : '';
      setResults((m) => ({ ...m, [k]: { ok: true, text: `ดึงแล้ว → เคส #${d.caseId} (${photos}${warn})`, caseId: d.caseId } }));
      setRows((rs) => (rs ?? []).map((x) => (key(x) === k ? { ...x, imported_case_id: d.caseId ?? null, imported_status: 'surveyed' } : x)));
      return true;
    } catch (e) {
      setResults((m) => ({ ...m, [k]: { ok: false, text: errMsg(e) } }));
      return false;
    } finally {
      setPulling((p) => ({ ...p, [k]: false }));
    }
  };

  const pullAll = async () => {
    const todo = (rows ?? []).filter((r) => !r.imported_case_id);
    if (todo.length === 0) return;
    if (!window.confirm(`ดึงงานที่ยังไม่มีในระบบทั้งหมด ${todo.length} เรื่อง? (ทีละเรื่อง ใช้เวลาประมาณ ${todo.length * 15} วินาที)`)) return;
    setBulk(true);
    try {
      for (const r of todo) { await pullOne(r); }   // ทีละเรื่อง — ISURVEY จำกัด 1 การใช้งาน/บัญชี
    } finally { setBulk(false); }
  };

  const notImported = (rows ?? []).filter((r) => !r.imported_case_id).length;

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">งานรอตรวจ (ISURVEY)</h1>
          <p className="text-sm text-gray-600">งานสถานะ &quot;รอตรวจข้อมูล&quot; ของบัญชี ISURVEY ของคุณ — ดึงเข้ามาเป็นเคสแล้วตรวจ/ใส่เรท/อนุมัติที่นี่</p>
        </div>
        <div className="ml-auto flex items-end gap-2 text-sm">
          <label className="flex flex-col text-xs text-gray-600">ตั้งแต่
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-gray-300 px-2 py-1 text-sm" /></label>
          <label className="flex flex-col text-xs text-gray-600">ถึง
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-gray-300 px-2 py-1 text-sm" /></label>
          <button type="button" onClick={load} disabled={loading || bulk}
            className="px-3 py-1.5 border border-gray-300 bg-white text-sm disabled:opacity-50">{loading ? 'กำลังโหลด…' : 'โหลดรายการ'}</button>
          <button type="button" onClick={pullAll} disabled={loading || bulk || notImported === 0}
            className="px-3 py-1.5 bg-[var(--md-blue)] text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
            {bulk ? 'กำลังดึง…' : `ดึงทั้งหมดที่ยังไม่มี (${notImported})`}
          </button>
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
                <th className="px-3 py-2 text-left">ในระบบเรา</th>
                <th className="px-3 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-500">ไม่มีงานรอตรวจในช่วงวันที่นี้</td></tr>
              )}
              {rows.map((r) => {
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
                      <button type="button" disabled={busy || bulk} onClick={() => pullOne(r)}
                        className={`px-3 py-1 text-xs border ${r.imported_case_id ? 'border-gray-300 bg-white text-gray-700' : 'border-[var(--md-blue)] bg-[var(--md-blue)] text-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={r.imported_case_id ? 'ดึงซ้ำ = สร้างเคสใหม่อีกเคส (ระวังซ้ำ)' : 'สร้างเคส + ดึงรูปเข้าระบบ'}>
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
        ดึงแล้วงานบน ISURVEY ยังเป็น &quot;รอตรวจข้อมูล&quot; เหมือนเดิม (ยังไม่ปิดสถานะให้) · รูปที่ช่างทยอยอัปหลังจากนี้จะยังไม่ตามมา — กด &quot;ดึงซ้ำ&quot; จะได้เคสใหม่ ไม่ใช่เติมรูปเคสเดิม
      </p>
    </div>
  );
}
