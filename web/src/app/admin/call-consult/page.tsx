'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

type GroupBy = 'supervisor' | 'staff' | 'day' | 'week';

const TABS: { key: GroupBy; label: string }[] = [
  { key: 'supervisor', label: 'รายหัวหน้า' },
  { key: 'staff', label: 'รายพนักงาน' },
  { key: 'day', label: 'รายวัน' },
  { key: 'week', label: 'รายสัปดาห์' },
];

interface ReportResp {
  range: { from: string; to: string };
  group_by: GroupBy;
  count: number;
  rows: Record<string, unknown>[];
}

function fmtDur(sec: unknown): string {
  const s = Number(sec) || 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function fmtBucket(iso: unknown): string {
  try {
    return new Date(String(iso)).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  } catch {
    return String(iso);
  }
}

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return toISO(d); };

export default function CallConsultReport() {
  const [groupBy, setGroupBy] = useState<GroupBy>('supervisor');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<ReportResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ตั้งช่วงเริ่มต้น = 30 วันล่าสุด (ทำใน effect ฝั่ง client เลี่ยง hydration mismatch จาก new Date())
  useEffect(() => {
    const now = new Date();
    const f = new Date(); f.setDate(f.getDate() - 30);
    setFrom(toISO(f));
    setTo(toISO(now));
  }, []);

  const load = useCallback(() => {
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    // to + 1 วัน = รวมวันสิ้นสุดด้วย (backend ใช้ started_at < to)
    api
      .get(`/api/consult/report?group_by=${groupBy}&from=${from}&to=${addDays(to, 1)}`)
      .then((res) => {
        if (res.data.success) setData(res.data.data as ReportResp);
        else setError('โหลดข้อมูลไม่สำเร็จ');
      })
      .catch(() => setError('โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, [groupBy, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const setPreset = (kind: 'd30' | 'month' | 'year' | 'lastyear') => {
    const now = new Date();
    if (kind === 'd30') { const f = new Date(); f.setDate(f.getDate() - 30); setFrom(toISO(f)); setTo(toISO(now)); }
    else if (kind === 'month') { setFrom(toISO(new Date(now.getFullYear(), now.getMonth(), 1))); setTo(toISO(now)); }
    else if (kind === 'year') { const y = now.getFullYear(); setFrom(`${y}-01-01`); setTo(`${y}-12-31`); }
    else { const y = now.getFullYear() - 1; setFrom(`${y}-01-01`); setTo(`${y}-12-31`); }
  };

  const rows = data?.rows ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-1">รายงานการโทรปรึกษาหัวหน้า</h1>
      <p className="text-sm text-gray-500 mb-6">ติดตามอัตราหัวหน้ารับสาย/ไม่รับสาย เพื่อลดปัญหาไม่รับสาย</p>

      {/* group_by tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setGroupBy(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              groupBy === t.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ช่วงวันที่ (เลือกวัน/ปีเองได้ + ปุ่มลัด) */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div>
          <label className="block text-xs text-gray-500 mb-1">ตั้งแต่วันที่</label>
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">ถึงวันที่</label>
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm" />
        </div>
        <div className="flex gap-2">
          {[{ k: 'd30', l: '30 วัน' }, { k: 'month', l: 'เดือนนี้' }, { k: 'year', l: 'ปีนี้' }, { k: 'lastyear', l: 'ปีก่อน' }].map((pp) => (
            <button key={pp.k} onClick={() => setPreset(pp.k as 'd30' | 'month' | 'year' | 'lastyear')}
              className="px-3 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">{pp.l}</button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="text-center text-gray-500 py-16">{error}</div>
        ) : rows.length === 0 ? (
          <div className="text-center text-gray-500 py-16">ยังไม่มีข้อมูลการโทร</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>{headers(groupBy).map((h) => <th key={h} className="px-4 py-3 font-medium whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {renderRow(groupBy, r)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {data && !loading && !error && (
        <p className="text-xs text-gray-400 mt-3">
          ช่วงข้อมูล {fmtBucket(from)} – {fmtBucket(to)} · {data.count} แถว
        </p>
      )}
    </div>
  );
}

function headers(g: GroupBy): string[] {
  switch (g) {
    case 'supervisor':
      return ['หัวหน้า', 'เบอร์', 'ทั้งหมด', 'รับสาย', 'ไม่รับ', 'พลาด', 'ปฏิเสธ', '% ไม่รับสาย', 'คุยเฉลี่ย'];
    case 'staff':
      return ['พนักงาน', 'โทรทั้งหมด', 'ติดต่อได้', 'ต้องโทรซ้ำ'];
    default:
      return ['ช่วงเวลา', 'ทั้งหมด', 'รับสาย', 'ไม่รับสาย', '% ไม่รับสาย', 'คุยเฉลี่ย'];
  }
}

const td = 'px-4 py-3 whitespace-nowrap text-gray-700';

function rateBadge(rate: unknown) {
  const v = Number(rate) || 0;
  const cls = v >= 50 ? 'bg-red-100 text-red-700' : v >= 20 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{v}%</span>;
}

function renderRow(g: GroupBy, r: Record<string, unknown>) {
  if (g === 'supervisor') {
    return (
      <>
        <td className={`${td} font-medium text-gray-800`}>{String(r.supervisor_name ?? '-')}</td>
        <td className={td}>{String(r.supervisor_number ?? '-')}</td>
        <td className={td}>{String(r.total ?? 0)}</td>
        <td className={`${td} text-green-600 font-medium`}>{String(r.answered ?? 0)}</td>
        <td className={td}>{String(r.no_answer ?? 0)}</td>
        <td className={td}>{String(r.missed ?? 0)}</td>
        <td className={td}>{String(r.rejected ?? 0)}</td>
        <td className={td}>{rateBadge(r.not_answered_rate)}</td>
        <td className={td}>{fmtDur(r.avg_talk_sec)}</td>
      </>
    );
  }
  if (g === 'staff') {
    return (
      <>
        <td className={`${td} font-medium text-gray-800`}>{String(r.staff_name ?? '-')}</td>
        <td className={td}>{String(r.total_calls ?? 0)}</td>
        <td className={`${td} text-green-600 font-medium`}>{String(r.connected ?? 0)}</td>
        <td className={td}>{String(r.retry_calls ?? 0)}</td>
      </>
    );
  }
  return (
    <>
      <td className={`${td} font-medium text-gray-800`}>{fmtBucket(r.bucket)}</td>
      <td className={td}>{String(r.total ?? 0)}</td>
      <td className={`${td} text-green-600 font-medium`}>{String(r.answered ?? 0)}</td>
      <td className={td}>{String(r.not_answered ?? 0)}</td>
      <td className={td}>{rateBadge(r.not_answered_rate)}</td>
      <td className={td}>{fmtDur(r.avg_talk_sec)}</td>
    </>
  );
}
