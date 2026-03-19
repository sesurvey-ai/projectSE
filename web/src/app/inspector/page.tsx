'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import CaseList from '@/components/cases/CaseList';

export default function InspectorDashboard() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      </div>
      <CaseList cases={cases} basePath="/inspector" />
    </div>
  );
}
