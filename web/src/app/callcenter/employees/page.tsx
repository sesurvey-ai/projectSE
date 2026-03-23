'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSocket } from '@/hooks/useSocket';
import api from '@/lib/api';

const SurveyorMap = dynamic(() => import('@/components/map/SurveyorMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full flex items-center justify-center bg-gray-100 rounded-lg" style={{ height: '100%' }}>
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
  const [focusTarget, setFocusTarget] = useState<{ lat: number; lng: number; id: string } | null>(null);

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
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">พนักงานทั้งหมด</h1>
          <p className="text-gray-500 text-sm mt-1">ดูพิกัดตำแหน่งพนักงานสำรวจทุกคนแบบเรียลไทม์</p>
        </div>
        <div className="flex items-center gap-3">
          {surveyors.length > 0 && (
            <span className="text-sm text-gray-500">พบ {surveyors.length} คน</span>
          )}
          <button
            onClick={handleRequestLocation}
            disabled={loading}
            className="px-5 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-sm"
          >
            {loading ? 'กำลังเรียกพิกัด...' : 'เรียกพิกัดพนักงานทั้งหมด'}
          </button>
        </div>
      </div>

      <div className="flex gap-4" style={{ height: 'calc(100vh - 160px)' }}>
        {/* Left: Map */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex flex-col min-w-0">
          <h2 className="text-sm font-semibold text-gray-800 mb-2">แผนที่ตำแหน่งพนักงาน</h2>
          <div className="flex-1">
            <SurveyorMap
              surveyors={surveyors}
              autoFit={false}
              defaultCenter={[13.0, 101.0]}
              defaultZoom={6}
              height="100%"
              focusTarget={focusTarget}
            />
          </div>
        </div>

        {/* Right: Employee list */}
        <div className="w-[380px] shrink-0 bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex flex-col">
          <h2 className="text-sm font-semibold text-gray-800 mb-2">รายชื่อพนักงาน</h2>
          <div className="flex-1 overflow-y-auto">
            {surveyors.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                {requestSent ? 'กำลังรอข้อมูลพิกัด...' : 'กดปุ่ม "เรียกพิกัดพนักงานทั้งหมด"'}
              </div>
            ) : (
              <div className="space-y-2">
                {surveyors.map((s, i) => (
                  <div
                    key={s.user_id}
                    onClick={() => setFocusTarget({ lat: Number(s.latitude), lng: Number(s.longitude), id: s.user_id })}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${focusTarget?.id === s.user_id ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">
                        {s.first_name ? `${s.first_name} ${s.last_name || ''}` : s.username}
                      </p>
                      <p className="text-xs text-gray-400">{s.username}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {Number(s.latitude).toFixed(6)}, {Number(s.longitude).toFixed(6)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
