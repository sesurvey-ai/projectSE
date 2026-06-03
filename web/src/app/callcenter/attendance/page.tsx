'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import api, { getPhotoUrl } from '@/lib/api';

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

const p2 = (n: number) => String(n).padStart(2, '0');

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

function fmtThaiDate(s: string): string {
  try {
    return new Date(s + 'T00:00:00').toLocaleDateString('th-TH', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return s;
  }
}

function mapLink(lat?: number | null, lng?: number | null) {
  if (lat == null || lng == null) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <a
      href={`https://www.google.com/maps?q=${lat},${lng}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline text-xs"
      title={`${lat}, ${lng}`}
    >
      แผนที่
    </a>
  );
}

export default function CallcenterAttendancePage() {
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState<AttRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');

  const isToday = date === todayStr();

  const load = useCallback(
    (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      api
        .get(`/api/attendance/report?from=${date}&to=${date}`)
        .then((res) => {
          if (res.data.success) {
            setRows((res.data.data?.rows ?? []) as AttRow[]);
            setUpdatedAt(
              new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            );
          } else {
            setError('โหลดข้อมูลไม่สำเร็จ');
          }
        })
        .catch(() => setError('โหลดข้อมูลไม่สำเร็จ'))
        .finally(() => setLoading(false));
    },
    [date]
  );

  useEffect(() => {
    load();
  }, [load]);

  // อัปเดตอัตโนมัติทุก 30 วินาที เมื่อกำลังดูข้อมูล "วันนี้"
  useEffect(() => {
    if (!isToday) return;
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [isToday, load]);

  // หมายเลขรอบของแต่ละคนในวันนั้น (เรียงตามเวลาเข้า)
  const sessionNo = useMemo(() => {
    const map = new Map<number, number>();
    const count = new Map<number, number>();
    const sorted = [...rows].sort((a, b) => (a.check_in_time || '').localeCompare(b.check_in_time || ''));
    for (const r of sorted) {
      const n = (count.get(r.user_id) || 0) + 1;
      count.set(r.user_id, n);
      map.set(r.id, n);
    }
    return map;
  }, [rows]);

  const stats = useMemo(() => {
    const people = new Set(rows.map((r) => r.user_id));
    const working = rows.filter((r) => !r.check_out_time).length;
    return { people: people.size, sessions: rows.length, working, done: rows.length - working };
  }, [rows]);

  const view = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const filtered = kw
      ? rows.filter(
          (r) => (r.user_name || '').toLowerCase().includes(kw) || (r.username || '').toLowerCase().includes(kw)
        )
      : rows;
    // เข้างานล่าสุดอยู่บนสุด
    return [...filtered].sort((a, b) => (b.check_in_time || '').localeCompare(a.check_in_time || ''));
  }, [rows, q]);

  const td = 'px-4 py-3 whitespace-nowrap';

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">เวลาเข้างานพนักงาน</h1>
          <p className="text-sm text-gray-500 mt-1">
            {fmtThaiDate(date)}
            {isToday && <span className="ml-2 inline-flex items-center gap-1 text-green-600"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />อัปเดตอัตโนมัติ</span>}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">วันที่</label>
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => setDate(e.target.value || todayStr())}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
            />
          </div>
          {!isToday && (
            <button
              onClick={() => setDate(todayStr())}
              className="px-3 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50"
            >
              วันนี้
            </button>
          )}
          <button
            onClick={() => load()}
            className="px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700"
          >
            รีเฟรช
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="ลงเวลาแล้ว" value={stats.people} unit="คน" accent="text-blue-600" />
        <StatCard label="รวมรอบ" value={stats.sessions} unit="รอบ" accent="text-gray-700" />
        <StatCard label="กำลังทำงาน" value={stats.working} unit="รอบ" accent="text-green-600" />
        <StatCard label="ออกงานแล้ว" value={stats.done} unit="รอบ" accent="text-orange-500" />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาชื่อ / username…"
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm w-64"
        />
        {updatedAt && <span className="text-xs text-gray-400">อัปเดตล่าสุด {updatedAt} น.</span>}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="text-center text-gray-500 py-16">{error}</div>
        ) : view.length === 0 ? (
          <div className="text-center text-gray-500 py-16">
            {q ? 'ไม่พบพนักงานที่ค้นหา' : isToday ? 'ยังไม่มีพนักงานลงเวลาเข้างานวันนี้' : 'ไม่มีข้อมูลการลงเวลาในวันนี้'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  {['#', 'พนักงาน', 'เข้างาน', 'ออกงาน', 'สถานะ', 'พิกัด'].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {view.map((r, i) => {
                  const working = !r.check_out_time;
                  const round = sessionNo.get(r.id) || 1;
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className={`${td} text-gray-400`}>{i + 1}</td>
                      <td className={td}>
                        <div className="flex items-center gap-3">
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
                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                              —
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800">
                              {r.user_name || r.username || '-'}
                              {round > 1 && (
                                <span className="ml-2 text-xs text-gray-400 font-normal">รอบ {round}</span>
                              )}
                            </p>
                            <p className="text-xs text-gray-400">{r.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className={`${td} text-green-600 font-semibold`}>{r.check_in_time || '--:--'}</td>
                      <td className={`${td} ${r.check_out_time ? 'text-orange-600 font-medium' : 'text-gray-300'}`}>
                        {r.check_out_time || '--:--'}
                      </td>
                      <td className={td}>
                        {working ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            กำลังทำงาน
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                            ออกงานแล้ว
                          </span>
                        )}
                      </td>
                      <td className={td}>{mapLink(r.check_in_lat, r.check_in_lng)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && !error && view.length > 0 && (
        <p className="text-xs text-gray-400 mt-3">แสดง {view.length} รอบ</p>
      )}
    </div>
  );
}

function StatCard({ label, value, unit, accent }: { label: string; value: number; unit: string; accent: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1">
        <span className={`text-2xl font-bold ${accent}`}>{value}</span>
        <span className="text-sm text-gray-400 ml-1">{unit}</span>
      </p>
    </div>
  );
}
