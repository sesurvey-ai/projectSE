'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSocket } from '@/hooks/useSocket';
import api from '@/lib/api';

const SurveyorMap = dynamic(() => import('@/components/map/SurveyorMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full flex items-center justify-center bg-gray-100 rounded-lg" style={{ height: '500px' }}>
      <p className="text-gray-500">กำลังโหลดแผนที่...</p>
    </div>
  ),
});

interface SurveyorLocation {
  user_id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  latitude: number;
  longitude: number;
  distance?: number;
}

export default function EmployeesPage() {
  const { socket } = useSocket();
  const [surveyors, setSurveyors] = useState<SurveyorLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  // Listen for real-time location updates
  useEffect(() => {
    if (!socket) return;
    const handle = (data: SurveyorLocation | SurveyorLocation[]) => {
      setSurveyors((prev) => {
        if (Array.isArray(data)) return data;
        const idx = prev.findIndex((s) => String(s.user_id) === String(data.user_id));
        if (idx >= 0) { const updated = [...prev]; updated[idx] = data; return updated; }
        return [...prev, data];
      });
    };
    socket.on('location_update', handle);
    return () => { socket.off('location_update', handle); };
  }, [socket]);

  const handleRequestLocation = () => {
    if (!socket) return;
    setLoading(true);
    setRequestSent(true);
    socket.emit('request_location', { request_id: 'all_employees' });

    api.get('/api/locations/latest?limit=100')
      .then((res) => { if (res.data.success && res.data.data) setSurveyors(res.data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">พนักงานทั้งหมด</h1>
        <p className="text-gray-500 mt-1">ดูพิกัดตำแหน่งพนักงานสำรวจทุกคนแบบเรียลไทม์</p>
      </div>

      <div className="mb-6">
        <button
          onClick={handleRequestLocation}
          disabled={loading}
          className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'กำลังเรียกพิกัด...' : 'เรียกพิกัดพนักงานทั้งหมด'}
        </button>
        {surveyors.length > 0 && (
          <span className="ml-4 text-sm text-gray-500">พบ {surveyors.length} คน</span>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">แผนที่ตำแหน่งพนักงาน</h2>
        <SurveyorMap surveyors={surveyors} autoFit={false} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">รายชื่อพนักงาน</h2>
        {surveyors.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {requestSent ? 'กำลังรอข้อมูลพิกัดจากพนักงาน...' : 'กดปุ่ม "เรียกพิกัดพนักงานทั้งหมด" เพื่อดูตำแหน่ง'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 font-semibold text-gray-600">#</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">ชื่อ-นามสกุล</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Username</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">ละติจูด</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">ลองจิจูด</th>
                </tr>
              </thead>
              <tbody>
                {surveyors.map((s, i) => (
                  <tr key={s.user_id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {s.first_name ? `${s.first_name} ${s.last_name || ''}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.username}</td>
                    <td className="px-4 py-3 text-gray-600">{Number(s.latitude).toFixed(6)}</td>
                    <td className="px-4 py-3 text-gray-600">{Number(s.longitude).toFixed(6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
