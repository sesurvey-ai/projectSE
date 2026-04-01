'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';

interface CaseRow {
  id: number;
  customer_name: string;
  insurance_company?: string;
  status: string;
  created_at: string;
  surveyor_first_name?: string;
  surveyor_last_name?: string;
  claim_no?: string;
  survey_job_no?: string;
  claim_ref_no?: string;
  visit_count?: number;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'รอมอบหมาย',   color: 'text-gray-700',   bg: 'bg-gray-100' },
  assigned:  { label: 'มอบหมายแล้ว', color: 'text-orange-700', bg: 'bg-orange-100' },
  surveyed:  { label: 'สำรวจแล้ว',   color: 'text-blue-700',   bg: 'bg-blue-100' },
  reviewed:  { label: 'ตรวจสอบแล้ว', color: 'text-green-700',  bg: 'bg-green-100' },
};

export default function CallcenterDashboard() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [recent, setRecent] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/cases/stats')
      .then((res) => {
        if (res.data.success) {
          setCounts(res.data.data.counts);
          setRecent(res.data.data.recent);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { key: 'pending',  label: 'รอมอบหมาย',   icon: '📋', gradient: 'from-gray-500 to-gray-600' },
    { key: 'assigned', label: 'มอบหมายแล้ว', icon: '🔄', gradient: 'from-orange-500 to-orange-600' },
    { key: 'surveyed', label: 'สำรวจแล้ว',   icon: '🔍', gradient: 'from-blue-500 to-blue-600' },
    { key: 'reviewed', label: 'ตรวจสอบแล้ว', icon: '✅', gradient: 'from-green-500 to-green-600' },
  ];

  const formatDate = (d: string) => {
    try {
      const dt = new Date(d);
      return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
    } catch { return d; }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">สวัสดี, {user?.first_name} {user?.last_name}</h1>
          <p className="text-gray-500 text-sm">ภาพรวมงานทั้งหมดในระบบ</p>
        </div>
        {!loading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-5 py-3 flex items-center gap-3">
            <span className="text-gray-600 font-medium">งานทั้งหมดในระบบ</span>
            <span className="text-2xl font-bold text-gray-800">{counts.total ?? 0} <span className="text-sm font-normal text-gray-500">เคส</span></span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {cards.map((c) => (
              <div key={c.key} className={`bg-gradient-to-br ${c.gradient} rounded-xl p-5 text-white shadow-sm`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{c.icon}</span>
                  <span className="text-3xl font-bold">{counts[c.key] ?? 0}</span>
                </div>
                <p className="text-sm opacity-90">{c.label}</p>
              </div>
            ))}
          </div>

          {/* Recent cases table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">เคสล่าสุด</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-5 py-3 font-semibold text-gray-600">สถานะ</th>
                    <th className="px-5 py-3 font-semibold text-gray-600">เลขเคลม</th>
                    <th className="px-5 py-3 font-semibold text-gray-600">เลขเซอร์เวย์</th>
                    <th className="px-5 py-3 font-semibold text-gray-600">เลขรับแจ้ง</th>
                    <th className="px-5 py-3 font-semibold text-gray-600">ช่างสำรวจ</th>
                    <th className="px-5 py-3 font-semibold text-gray-600">ครั้งที่</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((c) => {
                    const s = STATUS_MAP[c.status] || { label: c.status, color: 'text-gray-700', bg: 'bg-gray-100' };
                    return (
                      <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-5 py-3">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.color}`}>
                            {s.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-600">{c.claim_no || '-'}</td>
                        <td className="px-5 py-3 text-gray-600">{c.survey_job_no || '-'}</td>
                        <td className="px-5 py-3 text-gray-600">{c.claim_ref_no || '-'}</td>
                        <td className="px-5 py-3 text-gray-600">
                          {c.surveyor_first_name ? `${c.surveyor_first_name} ${c.surveyor_last_name || ''}` : '-'}
                        </td>
                        <td className="px-5 py-3 text-gray-500">{c.visit_count || 1}</td>
                      </tr>
                    );
                  })}
                  {recent.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">ยังไม่มีเคส</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
