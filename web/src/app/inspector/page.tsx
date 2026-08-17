'use client';

import { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import CaseList, { moneyGaps, type Case } from '@/components/cases/CaseList';

type Tab = 'pending' | 'approved' | 'sent';

export default function InspectorDashboard() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [tab, setTab] = useState<Tab>('pending');
  const [q, setQ] = useState('');
  const [src, setSrc] = useState('');
  const [who, setWho] = useState('');

  /** ต้องโหลดผ่าน api (มี token) แล้วค่อยเซฟเป็นไฟล์ — เปิด URL ตรง ๆ จะโดน 401 */
  const downloadPay = async () => {
    setDownloading(true);
    try {
      const qs = new URLSearchParams();
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      const res = await api.get(`/api/cases/pay/export.xlsx?${qs}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ค่าตอบแทนผู้สำรวจ_${from || 'ทั้งหมด'}_${to || ''}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('ดาวน์โหลดใบเบิกเงินไม่สำเร็จ');
    } finally { setDownloading(false); }
  };

  useEffect(() => {
    api.get('/api/cases/review')
      .then((res) => { if (res.data.success) setCases(res.data.data); })
      .catch(() => setError('ไม่สามารถโหลดรายการงานได้'))
      .finally(() => setLoading(false));
  }, []);

  /**
   * แบ่งงานเป็น 3 กอง — เดิม API คืน surveyed + reviewed ปนกันมาในลิสต์เดียว
   * งานที่อนุมัติ/ส่งไปแล้วจึงเกะกะปนอยู่กับงานที่ยังต้องทำ
   *
   * "ส่งประกันแล้ว" ใช้ emcs_submitted_at ไม่ใช่ emcs_imported_at —
   * นำเข้าแล้ว (มี draft) ยังไม่ใช่ประกันได้รับงาน ต้องเห็นว่าค้างอยู่
   */
  const groups = useMemo(() => {
    const pending: Case[] = [], approved: Case[] = [], sent: Case[] = [];
    for (const c of cases) {
      if (c.emcs_submitted_at) sent.push(c);
      else if (c.status === 'reviewed') approved.push(c);
      else pending.push(c);
    }
    return { pending, approved, sent };
  }, [cases]);

  /** งานที่กดอนุมัติไม่ได้จนกว่าจะเติมข้อมูล — ตัวเลขที่หัวหน้าต้องเห็นก่อนเปิดเคส */
  const incomplete = useMemo(
    () => groups.pending.filter(
      (c) => (c.import_warnings?.length ?? 0) > 0 || moneyGaps(c).length > 0).length,
    [groups.pending]);

  const surveyors = useMemo(() => {
    const s = new Set<string>();
    for (const c of cases) {
      if (c.surveyor_first_name) {
        s.add(`${c.surveyor_code ? c.surveyor_code + ' ' : ''}${c.surveyor_first_name}`);
      }
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'th'));
  }, [cases]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return groups[tab].filter((c) => {
      if (src && String(c.source ?? 'mobile') !== src) return false;
      if (who) {
        const name = `${c.surveyor_code ? c.surveyor_code + ' ' : ''}${c.surveyor_first_name ?? ''}`;
        if (name !== who) return false;
      }
      if (!needle) return true;
      return [c.claim_no, c.survey_job_no, c.claim_ref_no, c.license_plate, c.customer_name]
        .some((v) => String(v ?? '').toLowerCase().includes(needle));
    });
  }, [groups, tab, q, src, who]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-500">กำลังโหลดรายการงาน...</div></div>;
  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>;

  const TABS: { key: Tab; label: string; n: number }[] = [
    { key: 'pending', label: 'รอตรวจ', n: groups.pending.length },
    { key: 'approved', label: 'อนุมัติแล้ว', n: groups.approved.length },
    { key: 'sent', label: 'ส่งประกันแล้ว', n: groups.sent.length },
  ];
  // draft ค้าง = สร้างเรื่องใน EMCS แล้วแต่ยังไม่มีใครกด "ส่งงานใหม่"
  const pendingDrafts = cases.filter((c) => c.emcs_imported_at && !c.emcs_submitted_at).length;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">รายการงานตรวจสอบ</h2>
          <p className="text-gray-500 mt-1">งานที่รอการตรวจสอบและอนุมัติ</p>
        </div>
        {/* ใบเบิกเงินค่าตอบแทนผู้สำรวจ — เฉพาะงานที่คิดเงินผ่านระบบนี้
            งานที่ยังทำผ่านระบบเก่ายังออกใบจาก se-billing เหมือนเดิม */}
        <div className="flex items-end gap-2 shrink-0">
          <label className="text-xs text-gray-500">
            ตั้งแต่
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="block border border-gray-300 rounded px-2 py-1 text-sm text-gray-800" />
          </label>
          <label className="text-xs text-gray-500">
            ถึง
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="block border border-gray-300 rounded px-2 py-1 text-sm text-gray-800" />
          </label>
          <button type="button" onClick={downloadPay} disabled={downloading}
            className="px-4 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:bg-emerald-300">
            {downloading ? 'กำลังสร้าง...' : 'ใบเบิกเงิน (Excel)'}
          </button>
        </div>
      </div>

      {/* แถบสรุป — เดิมต้องไล่อ่านทีละแถวถึงจะรู้ว่าเหลือกี่งาน */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <div className="text-xs text-gray-500">รอตรวจ</div>
          <div className="text-2xl font-semibold text-gray-800">{groups.pending.length}</div>
        </div>
        <div className={`rounded-lg px-4 py-3 border ${incomplete > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs ${incomplete > 0 ? 'text-amber-700' : 'text-gray-500'}`}>ข้อมูลยังไม่ครบ</div>
          <div className={`text-2xl font-semibold ${incomplete > 0 ? 'text-amber-700' : 'text-gray-800'}`}>{incomplete}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <div className="text-xs text-gray-500">อนุมัติแล้ว</div>
          <div className="text-2xl font-semibold text-gray-800">{groups.approved.length}</div>
        </div>
        <div className={`rounded-lg px-4 py-3 border ${pendingDrafts > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
          <div className={`text-xs ${pendingDrafts > 0 ? 'text-amber-700' : 'text-gray-500'}`}>draft ค้างที่ประกัน</div>
          <div className={`text-2xl font-semibold ${pendingDrafts > 0 ? 'text-amber-700' : 'text-gray-800'}`}>{pendingDrafts}</div>
        </div>
      </div>

      {pendingDrafts > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
          <span className="text-lg leading-none">⏳</span>
          <span className="text-sm text-amber-800">
            มี <strong>{pendingDrafts}</strong> เรื่องที่สร้างใน EMCS แล้วแต่ยังไม่ได้กด
            &quot;ส่งงานใหม่&quot; — บริษัทประกันยังไม่ได้รับงาน
          </span>
        </div>
      )}

      <div className="flex gap-2 mb-3">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 text-sm rounded-lg border transition-colors ${
              tab === t.key
                ? 'bg-white border-gray-400 text-gray-800 font-medium'
                : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-100'}`}>
            {t.label} {t.n}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหา เลขเคลม / เลขเซอร์เวย์ / เลขรับแจ้ง / ทะเบียน / ชื่อผู้เอาประกัน"
          className="flex-[2] min-w-0 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-800 bg-white" />
        <select value={src} onChange={(e) => setSrc(e.target.value)}
          className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-800 bg-white">
          <option value="">ที่มา — ทั้งหมด</option>
          <option value="mobile">แอปมือถือ</option>
          <option value="isurvey_live">ระบบเก่า (สด)</option>
          <option value="isurvey_xml">ไฟล์ XML</option>
        </select>
        <select value={who} onChange={(e) => setWho(e.target.value)}
          className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-800 bg-white">
          <option value="">ช่างสำรวจ — ทุกคน</option>
          {surveyors.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {(q || src || who) && (
        <p className="text-xs text-gray-500 mb-2">
          แสดง {shown.length} จาก {groups[tab].length} เรื่อง
          <button type="button" onClick={() => { setQ(''); setSrc(''); setWho(''); }}
            className="ml-2 text-blue-600 hover:underline">ล้างตัวกรอง</button>
        </p>
      )}

      <CaseList cases={shown} basePath="/inspector" />
    </div>
  );
}
