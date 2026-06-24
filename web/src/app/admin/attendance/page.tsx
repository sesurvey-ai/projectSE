'use client';

import { useState, useEffect, useCallback } from 'react';
import api, { getPhotoUrl } from '@/lib/api';

interface AttRow {
  id: number;
  user_id: number;
  user_name?: string;
  username?: string;
  code?: string | null;
  work_date: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  check_in_lat?: number | null;
  check_in_lng?: number | null;
  check_out_lat?: number | null;
  check_out_lng?: number | null;
  check_in_photo?: string | null;
}

const onlyDigits = (s: string) => (s || '').replace(/\D/g, '');

// แปลง shift key ในตารางเวร → ป้ายภาษาไทย (รวม legacy fix7/fix11 → fix8/fix10)
const SHIFT_LABEL: Record<string, string | null> = {
  s1: 'เวร 1', s2: 'เวร 2', s3: 'เวร 3',
  fix8: 'FIX 8', fix10: 'FIX 10', fix14: 'FIX 14',
  fix7: 'FIX 8', fix11: 'FIX 10', f1120: 'FIX 10', f1423: 'FIX 14',
  off: 'หยุด', none: null,
};

function fmtDate(s?: string | null): string {
  if (!s) return '-';
  try {
    return new Date(s.slice(0, 10) + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' });
  } catch {
    return String(s);
  }
}

const td = 'px-4 py-3 whitespace-nowrap text-gray-700';

function mapLink(lat?: number | null, lng?: number | null) {
  if (lat == null || lng == null) return null;
  return (
    <a
      href={`https://www.google.com/maps?q=${lat},${lng}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline text-xs"
      title={`${lat}, ${lng}`}
    >
      ดูแผนที่
    </a>
  );
}

export default function AttendanceAdminPage() {
  const [rows, setRows] = useState<AttRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [shiftMap, setShiftMap] = useState<Record<string, string>>({}); // `${digit}|${YYYY-MM-DD}` → ป้ายเวร

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    api
      .get(`/api/attendance/report${qs ? `?${qs}` : ''}`)
      .then((res) => {
        if (res.data.success) setRows((res.data.data?.rows ?? []) as AttRow[]);
        else setError('โหลดข้อมูลไม่สำเร็จ');
      })
      .catch(() => setError('โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  // โหลดตารางเวรของเดือนที่มีในข้อมูล → map รหัส(digit)+วันที่ → เวร (join เหมือนบอร์ดเข้างาน)
  useEffect(() => {
    const months = Array.from(new Set(rows.map((r) => (r.work_date || '').slice(0, 7)).filter(Boolean)));
    if (months.length === 0) { setShiftMap({}); return; }
    let cancelled = false;
    (async () => {
      const map: Record<string, string> = {};
      for (const ym of months) {
        const [y, m] = ym.split('-').map(Number);
        try {
          const res = await api.get(`/api/duty/schedules?y=${y}&m=${m}`);
          const data = (res.data?.data ?? {}) as Record<string, { staff?: { id: string; code: string }[]; schedule?: Record<string, Record<string, string>> }>;
          for (const centerId of Object.keys(data)) {
            const z = data[centerId];
            for (const s of z.staff ?? []) {
              const dig = onlyDigits(s.code);
              if (!dig) continue;
              const sched = z.schedule?.[s.id] ?? {};
              for (const dStr of Object.keys(sched)) {
                const label = SHIFT_LABEL[sched[dStr]];
                if (!label) continue;
                const date = `${y}-${String(m).padStart(2, '0')}-${String(Number(dStr)).padStart(2, '0')}`;
                map[`${dig}|${date}`] = label;
              }
            }
          }
        } catch { /* ข้ามเดือนที่โหลดไม่ได้ */ }
      }
      if (!cancelled) setShiftMap(map);
    })();
    return () => { cancelled = true; };
  }, [rows]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-1">เวลาเข้า–ออกงาน</h1>
      <p className="text-sm text-gray-500 mb-6">บันทึกการลงเวลาเข้า–ออกงานของพนักงาน</p>

      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div>
          <label className="block text-xs text-gray-500 mb-1">ตั้งแต่วันที่</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">ถึงวันที่</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm" />
        </div>
        {(from || to) && (
          <button
            onClick={() => { setFrom(''); setTo(''); }}
            className="px-3 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50"
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="text-center text-gray-500 py-16">{error}</div>
        ) : rows.length === 0 ? (
          <div className="text-center text-gray-500 py-16">ยังไม่มีข้อมูลการลงเวลา</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  {['วันที่', 'รหัส', 'พนักงาน', 'เวร', 'รูปเข้างาน', 'เข้างาน', 'ออกงาน', 'พิกัดเข้า', 'พิกัดออก'].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => {
                  const shift = shiftMap[`${onlyDigits(r.code || r.username || '')}|${r.work_date}`] ?? '-';
                  return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className={`${td} font-medium text-gray-800`}>{fmtDate(r.work_date)}</td>
                    <td className={`${td} font-mono text-gray-500`}>{r.code || '-'}</td>
                    <td className={td}>{r.user_name || r.username || '-'}</td>
                    <td className={td}>{shift}</td>
                    <td className={td}>
                      {r.check_in_photo ? (
                        <a href={getPhotoUrl(r.check_in_photo)} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={getPhotoUrl(r.check_in_photo)}
                            alt="รูปเข้างาน"
                            className="w-10 h-10 rounded-lg object-cover border border-gray-200 hover:opacity-80 transition-opacity"
                          />
                        </a>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className={`${td} ${r.check_in_time ? 'text-green-600 font-medium' : 'text-gray-300'}`}>{r.check_in_time || '--:--'}</td>
                    <td className={`${td} ${r.check_out_time ? 'text-orange-600 font-medium' : 'text-gray-300'}`}>{r.check_out_time || '--:--'}</td>
                    <td className={td}>{mapLink(r.check_in_lat, r.check_in_lng) ?? <span className="text-gray-300 text-xs">—</span>}</td>
                    <td className={td}>{mapLink(r.check_out_lat, r.check_out_lng) ?? <span className="text-gray-300 text-xs">—</span>}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!loading && !error && <p className="text-xs text-gray-400 mt-3">{rows.length} รายการ</p>}
    </div>
  );
}
