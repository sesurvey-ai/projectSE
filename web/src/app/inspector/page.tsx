'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import CaseList, { type Case } from '@/components/cases/CaseList';

export default function InspectorDashboard() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [downloading, setDownloading] = useState(false);

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

  // draft ค้าง = สร้างเรื่องใน EMCS แล้วแต่ยังไม่มีใครกด "ส่งงานใหม่"
  // เดิมนับไม่ได้เลยเพราะระบบมีแค่ "นำเข้าแล้ว/ยังไม่นำเข้า" — งานค้างจึงมองไม่เห็น
  const pendingDrafts = cases.filter((c) => c.emcs_imported_at && !c.emcs_submitted_at).length;

  useEffect(() => {
    api.get('/api/cases/review')
      .then((res) => { if (res.data.success) setCases(res.data.data); })
      .catch(() => setError('ไม่สามารถโหลดรายการงานได้'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-500">กำลังโหลดรายการงาน...</div></div>;
  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">รายการงานตรวจสอบ</h2>
            <p className="text-gray-500 mt-1">รายการงานที่รอการตรวจสอบและอนุมัติ</p>
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
        {pendingDrafts > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
            <span className="text-lg leading-none">⏳</span>
            <span className="text-sm text-amber-800">
              มี <strong>{pendingDrafts}</strong> เรื่องที่สร้างใน EMCS แล้วแต่ยังไม่ได้กด
              &quot;ส่งงานใหม่&quot; — บริษัทประกันยังไม่ได้รับงาน
            </span>
          </div>
        )}
      </div>
      <CaseList cases={cases} basePath="/inspector" />
    </div>
  );
}
