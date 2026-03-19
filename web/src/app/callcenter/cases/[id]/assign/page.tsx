'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import api from '@/lib/api';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

interface SurveyorLocation {
  user_id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  latitude: number;
  longitude: number;
  distance?: number;
}

export default function AssignPage() {
  const params = useParams();
  const router = useRouter();
  const { socket } = useSocket();
  const caseId = params.id as string;

  const [surveyors, setSurveyors] = useState<SurveyorLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [requestSent, setRequestSent] = useState(false);

  const googleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '';
  const { isLoaded: mapsLoaded } = useJsApiLoader({ googleMapsApiKey: googleMapsKey });

  useEffect(() => {
    if (!socket) return;
    const handle = (data: SurveyorLocation | SurveyorLocation[]) => {
      if (Array.isArray(data)) { setSurveyors(data); return; }
      setSurveyors((prev) => {
        const idx = prev.findIndex((s) => s.user_id === data.user_id);
        if (idx >= 0) { const u = [...prev]; u[idx] = data; return u; }
        return [...prev, data];
      });
    };
    socket.on('location_update', handle);
    return () => { socket.off('location_update', handle); };
  }, [socket]);

  const handleRequestLocation = useCallback(() => {
    if (!socket) { setError('ไม่สามารถเชื่อมต่อ Socket ได้'); return; }
    setLoading(true); setRequestSent(true); setError('');
    socket.emit('request_location', { request_id: caseId });
    api.get('/api/locations/latest')
      .then((res) => { if (res.data.success && res.data.data) setSurveyors(res.data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [socket, caseId]);

  const handleAssign = async (surveyorUserId: string) => {
    setAssigning(surveyorUserId); setError('');
    try {
      const res = await api.post(`/api/cases/${caseId}/assign`, { surveyor_id: Number(surveyorUserId) });
      if (res.data.success) router.push('/callcenter');
      else setError(res.data.message || 'ไม่สามารถมอบหมายงานได้');
    } catch { setError('เกิดข้อผิดพลาด กรุณาลองใหม่'); }
    finally { setAssigning(null); }
  };

  const sorted = [...surveyors].sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  const center = sorted.length > 0 ? { lat: sorted[0].latitude, lng: sorted[0].longitude } : { lat: 13.7563, lng: 100.5018 };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">มอบหมายช่างสำรวจ</h1>
        <p className="text-gray-500 mt-1">เลือกช่างสำรวจสำหรับเคส #{caseId}</p>
      </div>

      <div className="flex items-center mb-8">
        <div className="flex items-center"><div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">&#10003;</div><span className="ml-2 text-sm font-medium text-green-600">ข้อมูลเคส</span></div>
        <div className="flex-1 mx-4 h-px bg-blue-600"></div>
        <div className="flex items-center"><div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">2</div><span className="ml-2 text-sm font-medium text-blue-600">มอบหมายช่างสำรวจ</span></div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">{error}</div>}

      <div className="mb-6">
        <button onClick={handleRequestLocation} disabled={loading} className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
          {loading ? 'กำลังเรียกพิกัด...' : 'เรียกพิกัด'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">แผนที่ตำแหน่งช่างสำรวจ</h2>
        {googleMapsKey && mapsLoaded ? (
          <GoogleMap mapContainerStyle={{ width: '100%', height: '400px' }} center={center} zoom={12}>
            {sorted.map((s) => <Marker key={s.user_id} position={{ lat: s.latitude, lng: s.longitude }} title={s.first_name || s.username} />)}
          </GoogleMap>
        ) : (
          <div className="w-full flex items-center justify-center bg-gray-100 rounded-lg border-2 border-dashed border-gray-300" style={{ height: '400px' }}>
            <div className="text-center text-gray-500">
              <p className="text-lg font-medium">แผนที่</p>
              <p className="text-sm mt-1">{!googleMapsKey ? 'ไม่ได้ตั้งค่า Google Maps API Key' : 'กำลังโหลดแผนที่...'}</p>
              {sorted.length > 0 && <p className="text-sm mt-2">พบช่างสำรวจ {sorted.length} คน</p>}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">รายชื่อช่างสำรวจ</h2>
        {sorted.length === 0 ? (
          <div className="text-center py-8 text-gray-500">{requestSent ? 'กำลังรอข้อมูลพิกัดจากช่างสำรวจ...' : 'กดปุ่ม "เรียกพิกัด" เพื่อดูตำแหน่งช่างสำรวจ'}</div>
        ) : (
          <div className="space-y-3">
            {sorted.map((s) => (
              <div key={s.user_id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div>
                  <h3 className="font-medium text-gray-800">{s.first_name ? `${s.first_name} ${s.last_name || ''}` : s.username}</h3>
                  <p className="text-sm text-gray-500">พิกัด: {s.latitude.toFixed(6)}, {s.longitude.toFixed(6)}</p>
                  {s.distance !== undefined && <p className="text-sm text-blue-600">ระยะทาง: {s.distance.toFixed(2)} กม.</p>}
                </div>
                <button onClick={() => handleAssign(s.user_id)} disabled={assigning === s.user_id} className="ml-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {assigning === s.user_id ? 'กำลังมอบหมาย...' : 'มอบหมาย'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
