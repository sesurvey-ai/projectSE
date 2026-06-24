'use client';

import { useState, useEffect, useCallback } from 'react';
import api, { getPhotoUrl } from '@/lib/api';
import PhotoWall from '../../callcenter/checkin-photos/PhotoWall';

interface AttRow {
  id: number;
  user_id: number;
  user_name?: string;
  username?: string;
  work_date: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  check_in_lat?: number | null;
  check_in_lng?: number | null;
  check_out_lat?: number | null;
  check_out_lng?: number | null;
  check_in_photo?: string | null;
}

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
  const [view, setView] = useState<'table' | 'photos'>('table'); // ตาราง = บันทึกเวลา/GPS, photos = รูปยืนยัน

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

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-1">เวลาเข้า–ออกงาน</h1>
      <p className="text-sm text-gray-500 mb-6">บันทึกการลงเวลาเข้า–ออกงานของพนักงาน</p>

      {/* สลับมุมมอง: ตาราง (เวลา/GPS) ↔ รูปยืนยัน (photo wall) — รวมจากเมนู "รูปยืนยันลงเวลา" เดิม */}
      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 mb-5">
        <button onClick={() => setView('table')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${view === 'table' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>ตาราง</button>
        <button onClick={() => setView('photos')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${view === 'photos' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>รูปยืนยัน</button>
      </div>

      {view === 'photos' ? (
        <PhotoWall />
      ) : (
        <>
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
                  {['วันที่', 'พนักงาน', 'รูปเข้างาน', 'เข้างาน', 'ออกงาน', 'พิกัดเข้า', 'พิกัดออก'].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className={`${td} font-medium text-gray-800`}>{fmtDate(r.work_date)}</td>
                    <td className={td}>{r.user_name || r.username || '-'}</td>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!loading && !error && <p className="text-xs text-gray-400 mt-3">{rows.length} รายการ</p>}
        </>
      )}
    </div>
  );
}
