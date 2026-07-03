'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
interface Employee { user_id: number; code?: string | null; name?: string }
interface Summary { records: number; staff: number; complete: number; openOut: number }

const PAGE_SIZE = 50;
const onlyDigits = (s: string) => (s || '').replace(/\D/g, '');

// แปลง shift key ในตารางเวร → ป้ายภาษาไทย (รวม legacy fix7/fix11 → fix8/fix10)
const SHIFT_LABEL: Record<string, string | null> = {
  s1: 'เวร 1', s2: 'เวร 2', s3: 'เวร 3',
  fix8: 'FIX 8', fix10: 'FIX 10', fix14: 'FIX 14',
  fix7: 'FIX 8', fix11: 'FIX 10', f1120: 'FIX 10', f1423: 'FIX 14',
  off: 'หยุด', none: null,
};

const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const p2 = (n: number) => String(n).padStart(2, '0');
const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();

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

// เลขหน้าแบบย่อ: 1 … p-1 p p+1 … last
function pageList(cur: number, last: number): (number | '…')[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const out: (number | '…')[] = [1];
  const lo = Math.max(2, cur - 1), hi = Math.min(last - 1, cur + 1);
  if (lo > 2) out.push('…');
  for (let i = lo; i <= hi; i++) out.push(i);
  if (hi < last - 1) out.push('…');
  out.push(last);
  return out;
}

export default function AttendanceTable() {
  const now = new Date();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 }); // เดือนที่ดู (default = เดือนปัจจุบัน)
  const [page, setPage] = useState(0); // 0-based
  const [employee, setEmployee] = useState(''); // user_id ('' = ทั้งหมด)
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState(''); // ช่องพิมพ์ (debounce → q)

  const [rows, setRows] = useState<AttRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Summary>({ records: 0, staff: 0, complete: 0, openOut: 0 });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shiftMap, setShiftMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const from = `${view.y}-${p2(view.m)}-01`;
  const to = `${view.y}-${p2(view.m)}-${p2(daysInMonth(view.y, view.m))}`;

  // debounce ช่องค้นหา → q (แล้วรีเซ็ตไปหน้าแรก)
  useEffect(() => {
    const t = setTimeout(() => { setQ(qInput.trim()); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [qInput]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ from, to, limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
    if (employee) params.set('user_id', employee);
    if (q) params.set('q', q);
    api
      .get(`/api/attendance/report?${params.toString()}`)
      .then((res) => {
        if (res.data.success) {
          const d = res.data.data ?? {};
          setRows((d.rows ?? []) as AttRow[]);
          setTotal(Number(d.total) || 0);
          setSummary((d.summary ?? { records: 0, staff: 0, complete: 0, openOut: 0 }) as Summary);
          setEmployees((d.employees ?? []) as Employee[]);
        } else setError('โหลดข้อมูลไม่สำเร็จ');
      })
      .catch(() => setError('โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, [from, to, page, employee, q]);

  useEffect(() => { load(); }, [load]);

  // โหลดตารางเวรของ "เดือนที่ดู" (ครั้งเดียวต่อเดือน) → map รหัส(digit)+วันที่ → เวร
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const map: Record<string, string> = {};
      try {
        const res = await api.get(`/api/duty/schedules?y=${view.y}&m=${view.m}`);
        const data = (res.data?.data ?? {}) as Record<string, { staff?: { id: string; code: string }[]; schedule?: Record<string, Record<string, string>> }>;
        for (const centerId of Object.keys(data)) {
          const z = data[centerId];
          for (const st of z.staff ?? []) {
            const dig = onlyDigits(st.code);
            if (!dig) continue;
            const sched = z.schedule?.[st.id] ?? {};
            for (const dStr of Object.keys(sched)) {
              const label = SHIFT_LABEL[sched[dStr]];
              if (!label) continue;
              const date = `${view.y}-${p2(view.m)}-${p2(Number(dStr))}`;
              map[`${dig}|${date}`] = label;
            }
          }
        }
      } catch { /* ข้ามถ้าโหลดไม่ได้ */ }
      if (!cancelled) setShiftMap(map);
    })();
    return () => { cancelled = true; };
  }, [view.y, view.m]);

  const shiftOf = (r: AttRow) => shiftMap[`${onlyDigits(r.code || r.username || '')}|${r.work_date}`] ?? '-';

  const shiftMapRef = useRef(shiftMap); shiftMapRef.current = shiftMap;

  const gotoMonth = (delta: number) => {
    setView((v) => {
      let y = v.y, m = v.m + delta;
      if (m < 1) { m = 12; y -= 1; }
      if (m > 12) { m = 1; y += 1; }
      return { y, m };
    });
    setPage(0);
  };
  const isCurrentMonth = view.y === now.getFullYear() && view.m === now.getMonth() + 1;

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showFrom = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const showTo = Math.min(total, (page + 1) * PAGE_SIZE);

  // ส่งออก CSV ของเดือนที่ดู (ตามตัวกรองปัจจุบัน) — ดึงทั้งเดือนแล้วสร้างไฟล์ฝั่ง client
  const exportCsv = useCallback(async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ from, to, limit: '5000', offset: '0' });
      if (employee) params.set('user_id', employee);
      if (q) params.set('q', q);
      const res = await api.get(`/api/attendance/report?${params.toString()}`);
      const all = (res.data?.data?.rows ?? []) as AttRow[];
      const esc = (v: unknown) => {
        const s = v == null ? '' : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = ['วันที่', 'รหัส', 'พนักงาน', 'เวร', 'เข้างาน', 'ออกงาน', 'พิกัดเข้า', 'พิกัดออก'];
      const lines = all.map((r) => [
        r.work_date,
        r.code || '',
        r.user_name || r.username || '',
        shiftMapRef.current[`${onlyDigits(r.code || r.username || '')}|${r.work_date}`] ?? '',
        r.check_in_time || '',
        r.check_out_time || '',
        r.check_in_lat != null && r.check_in_lng != null ? `${r.check_in_lat},${r.check_in_lng}` : '',
        r.check_out_lat != null && r.check_out_lng != null ? `${r.check_out_lat},${r.check_out_lng}` : '',
      ].map(esc).join(','));
      const csv = '﻿' + [header.join(','), ...lines].join('\r\n'); // BOM ให้ Excel อ่านไทยถูก
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${view.y}-${p2(view.m)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('ส่งออกไม่สำเร็จ');
    } finally {
      setExporting(false);
    }
  }, [from, to, employee, q, view.y, view.m]);

  const cards = useMemo(() => ([
    { label: 'รายการเดือนนี้', value: summary.records, cls: 'text-gray-800' },
    { label: 'พนักงานที่ลงเวลา', value: summary.staff, cls: 'text-gray-800' },
    { label: 'ครบเข้า–ออก', value: summary.complete, cls: 'text-green-600' },
    { label: 'ยังไม่ออก', value: summary.openOut, cls: 'text-orange-600' },
  ]), [summary]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-1">เวลาเข้า–ออกงาน</h1>
      <p className="text-sm text-gray-500 mb-6">บันทึกการลงเวลาเข้า–ออกงานของพนักงาน · รายเดือน</p>

      {/* แถบควบคุม: เลื่อนเดือน + ค้นหา + เลือกพนักงาน + ส่งออก */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-1">
          <button onClick={() => gotoMonth(-1)} className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50" aria-label="เดือนก่อนหน้า">‹</button>
          <div className="min-w-[150px] text-center font-semibold text-gray-800">{TH_MONTHS[view.m - 1]} {view.y + 543}</div>
          <button onClick={() => gotoMonth(1)} disabled={isCurrentMonth} className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed" aria-label="เดือนถัดไป">›</button>
          {!isCurrentMonth && (
            <button onClick={() => { setView({ y: now.getFullYear(), m: now.getMonth() + 1 }); setPage(0); }} className="ml-1 px-3 h-9 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">เดือนนี้</button>
          )}
        </div>
        <div className="flex-1" />
        <input
          type="text"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="ค้นหา ชื่อ / รหัส SE"
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm w-52"
        />
        <select
          value={employee}
          onChange={(e) => { setEmployee(e.target.value); setPage(0); }}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white max-w-[220px]"
        >
          <option value="">พนักงานทั้งหมด</option>
          {employees.map((e) => (
            <option key={e.user_id} value={e.user_id}>{e.code ? `${e.code} · ` : ''}{e.name || '-'}</option>
          ))}
        </select>
        <button
          onClick={exportCsv}
          disabled={exporting || total === 0}
          className="px-3 py-2 rounded-lg text-sm text-gray-700 border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {exporting ? 'กำลังส่งออก…' : 'ส่งออก CSV'}
        </button>
      </div>

      {/* การ์ดสรุป */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {cards.map((c) => (
          <div key={c.label} className="bg-gray-50 rounded-xl px-4 py-3">
            <div className="text-xs text-gray-500">{c.label}</div>
            <div className={`text-2xl font-semibold ${c.cls}`}>{c.value.toLocaleString('th-TH')}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="text-center text-gray-500 py-16">{error}</div>
        ) : rows.length === 0 ? (
          <div className="text-center text-gray-500 py-16">
            {q || employee ? 'ไม่พบรายการที่ค้นหาในเดือนนี้' : 'ยังไม่มีข้อมูลการลงเวลาในเดือนนี้'}
          </div>
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
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className={`${td} font-medium text-gray-800`}>{fmtDate(r.work_date)}</td>
                    <td className={`${td} font-mono text-gray-500`}>{r.code || '-'}</td>
                    <td className={td}>{r.user_name || r.username || '-'}</td>
                    <td className={td}>{shiftOf(r)}</td>
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

        {/* แถบแบ่งหน้า */}
        {!loading && !error && total > 0 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 text-sm text-gray-500 flex-wrap">
            <span>แสดง {showFrom.toLocaleString('th-TH')}–{showTo.toLocaleString('th-TH')} จาก {total.toLocaleString('th-TH')} รายการ</span>
            {lastPage > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed" aria-label="หน้าก่อนหน้า">‹</button>
                {pageList(page + 1, lastPage).map((n, i) => n === '…'
                  ? <span key={`e${i}`} className="px-1 text-gray-400">…</span>
                  : <button key={n} onClick={() => setPage(n - 1)} className={`min-w-8 h-8 px-2 rounded-lg border ${n === page + 1 ? 'border-blue-500 text-blue-600 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{n}</button>
                )}
                <button onClick={() => setPage((p) => Math.min(lastPage - 1, p + 1))} disabled={page >= lastPage - 1} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed" aria-label="หน้าถัดไป">›</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
