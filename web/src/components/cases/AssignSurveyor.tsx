'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useSocket } from '@/hooks/useSocket';
import api from '@/lib/api';

const SurveyorMap = dynamic(() => import('@/components/map/SurveyorMap'), { ssr: false, loading: () => <div className="w-full flex items-center justify-center bg-gray-100 rounded-lg" style={{ height: '400px' }}><p className="text-gray-500">กำลังโหลดแผนที่...</p></div> });

interface SurveyorLocation {
  user_id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  latitude: number;
  longitude: number;
  distance?: number;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface AssignSurveyorProps {
  caseId: number | string;
  /** เรียกหลังมอบหมายสำเร็จ — ถ้าไม่ส่ง จะ router.push('/callcenter') */
  onAssigned?: (surveyorId: number) => void;
}

/** ส่วน "มอบหมายช่างสำรวจ" (แผนที่ + รายชื่อ + ปุ่มเรียกพิกัด) ใช้ซ้ำได้ทั้งหน้า standalone และ inline ในหน้าสร้างเคส */
export default function AssignSurveyor({ caseId, onAssigned }: AssignSurveyorProps) {
  const router = useRouter();
  const { socket } = useSocket();
  const caseIdStr = String(caseId);

  const [surveyors, setSurveyors] = useState<SurveyorLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const [incidentLat, setIncidentLat] = useState<number | undefined>();
  const [incidentLng, setIncidentLng] = useState<number | undefined>();
  // โหลดพิกัดเคสเสร็จหรือยัง — กัน race: ต้องได้พิกัดก่อน auto-request ถึงจะเข้า path เรียงตามระยะทาง
  const [caseLoaded, setCaseLoaded] = useState(false);

  // Fetch case coordinates on mount
  useEffect(() => {
    api.get(`/api/cases/${caseIdStr}`)
      .then((res) => {
        if (res.data.success && res.data.data) {
          const c = res.data.data;
          if (c.incident_lat != null) setIncidentLat(parseFloat(c.incident_lat));
          if (c.incident_lng != null) setIncidentLng(parseFloat(c.incident_lng));
        }
      })
      .catch(() => {})
      .finally(() => setCaseLoaded(true));
  }, [caseIdStr]);

  // Listen for real-time location updates via socket
  useEffect(() => {
    if (!socket) return;
    const handle = (data: SurveyorLocation | SurveyorLocation[]) => {
      setSurveyors((prev) => {
        let updated: SurveyorLocation[];
        if (Array.isArray(data)) {
          updated = data;
        } else {
          if (incidentLat !== undefined && incidentLng !== undefined) {
            data.distance = haversineDistance(incidentLat, incidentLng, Number(data.latitude), Number(data.longitude));
          }
          const idx = prev.findIndex((s) => String(s.user_id) === String(data.user_id));
          if (idx >= 0) { updated = [...prev]; updated[idx] = data; }
          else { updated = [...prev, data]; }
        }
        updated.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
        return updated;
      });
    };
    socket.on('location_update', handle);
    return () => { socket.off('location_update', handle); };
  }, [socket, incidentLat, incidentLng]);

  const handleRequestLocation = useCallback(() => {
    if (!socket) { setError('ไม่สามารถเชื่อมต่อ Socket ได้'); return; }
    setLoading(true); setRequestSent(true); setError('');
    socket.emit('request_location', { request_id: caseIdStr });

    const params = new URLSearchParams();
    if (incidentLat !== undefined && incidentLng !== undefined) {
      params.set('lat', String(incidentLat));
      params.set('lng', String(incidentLng));
    }
    // ไม่ส่ง limit → แสดงช่างสำรวจออนไลน์ทุกคน (เรียงตามระยะทางจากจุดเกิดเหตุ)

    api.get(`/api/locations/latest?${params.toString()}`)
      .then((res) => { if (res.data.success && res.data.data) setSurveyors(res.data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [socket, caseIdStr, incidentLat, incidentLng]);

  // Auto-request locations once socket ready AND case coords resolved
  // (รอ caseLoaded กัน race — ถ้ายิงก่อนได้พิกัด รายชื่อจะไม่เรียงตามระยะทาง)
  const autoRequested = useRef(false);
  useEffect(() => {
    if (socket && caseLoaded && !autoRequested.current) {
      autoRequested.current = true;
      handleRequestLocation();
    }
  }, [socket, caseLoaded, handleRequestLocation]);

  const handleAssign = async (surveyorUserId: string) => {
    setAssigning(surveyorUserId); setError('');
    try {
      const res = await api.post(`/api/cases/${caseIdStr}/assign`, { surveyor_id: Number(surveyorUserId) });
      if (res.data.success) {
        if (onAssigned) onAssigned(Number(surveyorUserId));
        else router.push('/callcenter');
      } else setError(res.data.message || 'ไม่สามารถมอบหมายงานได้');
    } catch { setError('เกิดข้อผิดพลาด กรุณาลองใหม่'); }
    finally { setAssigning(null); }
  };

  const sorted = [...surveyors].sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

  return (
    <div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">{error}</div>}

      <div className="mb-6">
        <button type="button" onClick={handleRequestLocation} disabled={loading} className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
          {loading ? 'กำลังเรียกพิกัด...' : 'เรียกพิกัด'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">แผนที่ตำแหน่งช่างสำรวจ</h2>
        <SurveyorMap surveyors={sorted} incidentLat={incidentLat} incidentLng={incidentLng} />
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
                  <p className="text-sm text-gray-500">พิกัด: {Number(s.latitude).toFixed(6)}, {Number(s.longitude).toFixed(6)}</p>
                  {s.distance !== undefined && <p className="text-sm text-blue-600">ระยะทาง: {Number(s.distance).toFixed(2)} กม.</p>}
                </div>
                <button type="button" onClick={() => handleAssign(String(s.user_id))} disabled={assigning === String(s.user_id)} className="ml-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {assigning === String(s.user_id) ? 'กำลังมอบหมาย...' : 'มอบหมาย'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
