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
  /** รหัสพนักงาน (SE###/SEC###) — ใช้ระบุตัวคนได้แน่กว่าชื่อ และตรงกับที่ใช้เรียกกันในงาน */
  code?: string | null;
  /** จังหวัดที่พิกัดล่าสุดตกอยู่ (เซิร์ฟเวอร์คำนวณจากขอบเขตจังหวัดจริง) — null = อยู่นอกประเทศ/พิกัดเพี้ยน */
  province?: string | null;
  /** เวลาที่มือถือรายงานพิกัดครั้งล่าสุด — ใช้บอกว่าตำแหน่งนี้เชื่อได้แค่ไหน */
  recorded_at?: string | null;
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
  // แจ้งเตือนงานใหม่ไปไม่ถึงเครื่องช่าง — มอบหมายสำเร็จแล้วแต่ต้องโทรตาม
  const [pushWarning, setPushWarning] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  // จังหวัดที่เกิดเหตุ — ใช้จัดกลุ่มช่าง ไม่ใช่กรองทิ้ง (ดูเหตุผลที่กลุ่ม "ช่างคนอื่น")
  const [incidentProvince, setIncidentProvince] = useState<string | null>(null);
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
          if (c.acc_province) setIncidentProvince(String(c.acc_province));
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
        // มอบหมายสำเร็จ ≠ ช่างรู้ตัว — ถ้าแจ้งเตือนไปไม่ถึง ต้องบอกคนจ่ายงานให้โทรตาม
        // (เดิมเด้งออกจากหน้าทันทีเหมือนกันหมด ทั้งที่ push อาจล้มเงียบ)
        const push = res.data.data?.push as { status?: string; reason?: string } | undefined;
        if (push && push.status !== 'sent') {
          setPushWarning(push.reason || 'แจ้งเตือนไปไม่ถึงเครื่องช่าง');
          return;   // ค้างหน้าไว้ให้เห็นคำเตือน ไม่เด้งออก
        }
        if (onAssigned) onAssigned(Number(surveyorUserId));
        else router.push('/callcenter');
      } else setError(res.data.message || 'ไม่สามารถมอบหมายงานได้');
    } catch { setError('เกิดข้อผิดพลาด กรุณาลองใหม่'); }
    finally { setAssigning(null); }
  };

  const sorted = [...surveyors].sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

  /**
   * แบ่งเป็น "อยู่ในจังหวัดที่เกิดเหตุ" กับ "ช่างคนอื่น"
   *
   * ⛔ **กรองทิ้งไม่ได้ ต้องแค่แยกกลุ่ม** — พิกัดของช่างมากกว่าครึ่งเก่ากว่า 7 วัน
   *    วันไหนไม่มีใครรายงานพิกัดจากจังหวัดนั้นเลย คนจ่ายงานจะเห็นรายชื่อว่างเปล่า
   *    แล้วจ่ายงานไม่ได้ทั้งที่จริง ๆ มีคนอยู่แถวนั้น — แย่กว่าเรียงมั่ว
   *
   * แบ่งที่ระดับ**จังหวัด ไม่ใช่อำเภอ** ด้วยเหตุผลเดียวกัน (อำเภอแคบไป จะว่างบ่อยมาก)
   */
  /**
   * มีพิกัดที่เกิดเหตุ (การ์ดไอโออิพิมพ์มาให้) → **เรียงตามระยะทางล้วน ไม่ต้องแบ่งจังหวัด**
   * เพราะระยะทางบอกได้ตรงกว่า และถ้าแบ่งจังหวัดด้วย คนที่อยู่ห่างแค่ 3 กม.
   * แต่คนละฝั่งเส้นแบ่งจังหวัดจะถูกพับไปอยู่ในกลุ่ม "ช่างคนอื่น" ซึ่งกลับหัวกลับหาง
   */
  const byDistance = incidentLat !== undefined && incidentLng !== undefined;
  const inProvince = !byDistance && incidentProvince ? sorted.filter((x) => x.province === incidentProvince) : [];
  const others = !byDistance && incidentProvince ? sorted.filter((x) => x.province !== incidentProvince) : sorted;
  const [showOthers, setShowOthers] = useState(false);

  /** พิกัดอัปเดตเมื่อไหร่ — ตำแหน่งเมื่อ 10 วันก่อนกับเมื่อ 10 นาทีก่อน เชื่อได้ไม่เท่ากัน */
  const freshness = (iso?: string | null): { text: string; cls: string } | null => {
    if (!iso) return null;
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (!Number.isFinite(mins) || mins < 0) return null;
    if (mins < 60) return { text: `${mins} นาทีที่แล้ว`, cls: 'text-green-600' };
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return { text: `${hrs} ชม.ที่แล้ว`, cls: 'text-green-600' };
    const days = Math.round(hrs / 24);
    return { text: `${days} วันก่อน`, cls: days >= 7 ? 'text-red-500' : 'text-amber-600' };
  };

  /** แถวช่าง 1 คน — ใช้ซ้ำทั้งกลุ่ม "ในจังหวัด" และ "คนอื่น" จะได้ไม่ต้องดูแล 2 ที่ */
  const row = (s: SurveyorLocation) => {
    const fresh = freshness(s.recorded_at);
    return (
      <div key={s.user_id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
        <div className="min-w-0">
          <h3 className="font-medium text-gray-800 flex items-center gap-2">
            {/* รหัสพนักงานมาก่อนชื่อ — ชื่อซ้ำกันได้ รหัสไม่ซ้ำ และเป็นตัวที่ใช้เรียกกันในงานจริง */}
            {s.code && (
              <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-mono tracking-tight">{s.code}</span>
            )}
            <span className="truncate">{s.first_name ? `${s.first_name} ${s.last_name || ''}` : s.username}</span>
          </h3>
          <p className="text-sm text-gray-500 flex items-center gap-2 flex-wrap">
            {s.province && <span>{s.province}</span>}
            {/* ตำแหน่งเมื่อ 10 วันก่อนกับเมื่อ 10 นาทีก่อน เชื่อได้ไม่เท่ากัน — ต้องเห็น */}
            {fresh && <span className={fresh.cls}>อัปเดต {fresh.text}</span>}
            {s.distance !== undefined && <span className="text-blue-600">{Number(s.distance).toFixed(1)} กม.</span>}
          </p>
        </div>
        <button type="button" onClick={() => handleAssign(String(s.user_id))} disabled={assigning === String(s.user_id)} className="ml-4 shrink-0 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {assigning === String(s.user_id) ? 'กำลังมอบหมาย...' : 'มอบหมาย'}
        </button>
      </div>
    );
  };

  return (
    <div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">{error}</div>}

      {pushWarning && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded-lg text-sm mb-6">
          <div className="font-semibold mb-1">⚠️ มอบหมายงานแล้ว แต่แจ้งเตือนไปไม่ถึงเครื่องช่าง</div>
          <div className="text-amber-800">{pushWarning} — <strong>โทรแจ้งช่างด้วย</strong> ไม่งั้นอาจไม่มีใครรู้ว่ามีงาน</div>
          <button
            type="button"
            onClick={() => { setPushWarning(''); if (onAssigned) onAssigned(0); else router.push('/callcenter'); }}
            className="mt-2 px-4 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            รับทราบ
          </button>
        </div>
      )}

      <div className="mb-6">
        <button type="button" onClick={handleRequestLocation} disabled={loading} className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
          {loading ? 'กำลังเรียกพิกัด...' : 'เรียกพิกัด'}
        </button>
      </div>

      {/**
        * แผนที่ซ้าย รายชื่อขวา — เดิมวางซ้อนกัน ต้องเลื่อนผ่านแผนที่ทั้งจอกว่าจะเห็นรายชื่อ
        * และเห็นทีละ 4-5 คนจากทั้งหมด 35 คน
        * แยก 2 คอลัมน์เฉพาะจอกว้าง (xl ขึ้นไป) — หน้าสร้างเคสฝังตัวนี้ไว้ในคอลัมน์แคบ
        * ถ้าแยกตลอดจะบีบจนอ่านไม่ออก
        */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">แผนที่ตำแหน่งช่างสำรวจ</h2>
          <SurveyorMap surveyors={sorted} incidentLat={incidentLat} incidentLng={incidentLng} height="520px" />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          รายชื่อช่างสำรวจ
          {sorted.length > 0 && <span className="ml-2 text-sm font-normal text-gray-400">{sorted.length} คน</span>}
        </h2>
        {sorted.length === 0 ? (
          <div className="text-center py-8 text-gray-500">{requestSent ? 'กำลังรอข้อมูลพิกัดจากช่างสำรวจ...' : 'กดปุ่ม "เรียกพิกัด" เพื่อดูตำแหน่งช่างสำรวจ'}</div>
        ) : (
          <div className="space-y-3 xl:max-h-[520px] xl:overflow-y-auto xl:pr-1">
            {byDistance ? (
              <div className="text-xs text-gray-500">
                เรียงตามระยะทางจากที่เกิดเหตุ{incidentProvince ? ` (${incidentProvince})` : ''} — ใกล้สุดขึ้นก่อน
              </div>
            ) : incidentProvince && (
              <div className="text-xs text-gray-500">
                ที่เกิดเหตุอยู่ <span className="font-medium text-gray-700">{incidentProvince}</span>
                {inProvince.length === 0 && ' — ไม่มีใครรายงานพิกัดจากจังหวัดนี้ (ดูรายชื่อทั้งหมดข้างล่าง)'}
              </div>
            )}

            {inProvince.map(row)}

            {!byDistance && incidentProvince && others.length > 0 && (
              <>
                <button type="button" onClick={() => setShowOthers((v) => !v)}
                  className="w-full text-left text-sm text-gray-500 hover:text-gray-700 border-t border-gray-200 pt-3">
                  {showOthers ? '▾' : '▸'} ช่างคนอื่น {others.length} คน
                  <span className="text-gray-400"> (ไม่ได้อยู่ใน{incidentProvince})</span>
                </button>
                {showOthers && others.map(row)}
              </>
            )}
            {(byDistance || !incidentProvince) && others.map(row)}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
