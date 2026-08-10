'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import CaseList, { type Case } from '@/components/cases/CaseList';

export default function InspectorDashboard() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        <h2 className="text-2xl font-bold text-gray-800">รายการงานตรวจสอบ</h2>
        <p className="text-gray-500 mt-1">รายการงานที่รอการตรวจสอบและอนุมัติ</p>
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
