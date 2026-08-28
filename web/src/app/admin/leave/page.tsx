'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

const TABS: { key: StatusFilter; label: string }[] = [
  { key: 'pending', label: 'รออนุมัติ' },
  { key: 'approved', label: 'อนุมัติแล้ว' },
  { key: 'rejected', label: 'ไม่อนุมัติ' },
  { key: 'all', label: 'ทั้งหมด' },
];

const LEAVE_LABELS: Record<string, string> = {
  sick: 'ลาป่วย',
  personal: 'ลากิจ',
  vacation: 'ลาพักร้อน',
  other: 'อื่นๆ',
};

interface LeaveRow {
  id: number;
  user_name?: string;
  username?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason?: string | null;
  status: string;
  reviewer_name?: string | null;
  review_note?: string | null;
  reviewed_at?: string | null;
  created_at?: string | null;
}

function fmtDate(s?: string | null): string {
  if (!s) return '-';
  try {
    return new Date(s.slice(0, 10) + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  } catch {
    return String(s);
  }
}

function daysBetween(a: string, b: string): number {
  try {
    const d1 = new Date(a.slice(0, 10) + 'T00:00:00').getTime();
    const d2 = new Date(b.slice(0, 10) + 'T00:00:00').getTime();
    return Math.round((d2 - d1) / 86400000) + 1;
  } catch {
    return 1;
  }
}

function statusBadge(status: string) {
  const map: Record<string, { cls: string; label: string }> = {
    pending: { cls: 'bg-orange-100 text-orange-700', label: 'รออนุมัติ' },
    approved: { cls: 'bg-green-100 text-green-700', label: 'อนุมัติแล้ว' },
    rejected: { cls: 'bg-red-100 text-red-700', label: 'ไม่อนุมัติ' },
  };
  const s = map[status] ?? { cls: 'bg-gray-100 text-gray-600', label: status };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}

const td = 'px-4 py-3 align-top text-gray-700';

export default function LeaveAdminPage() {
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  // อนุมัติแล้วแต่แจ้งเตือนไปไม่ถึงเครื่องพนักงาน — ต้องบอกให้โทรตาม ไม่ใช่เงียบไป
  const [pushWarning, setPushWarning] = useState('');
  const { socket } = useSocket();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const q = filter === 'all' ? '' : `?status=${filter}`;
    api
      .get(`/api/leave${q}`)
      .then((res) => {
        if (res.data.success) setRows((res.data.data?.requests ?? []) as LeaveRow[]);
        else setError('โหลดข้อมูลไม่สำเร็จ');
      })
      .catch(() => setError('โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * มีคนยื่นใบลาใหม่ / แอดมินอีกคนเพิ่งกดอนุมัติ → โหลดรายการใหม่เอง
   *
   * เดิมหน้านี้โหลดครั้งเดียวตอนเปิด — ใบลาที่ยื่นเข้ามาระหว่างเปิดหน้าค้างอยู่จะไม่โผล่
   * จนกว่าจะกดสลับแท็บหรือ F5 (เป็นเหตุผลหลักที่ใบลาค้างข้ามวัน)
   */
  useEffect(() => {
    if (!socket) return;
    const onChange = () => load();
    socket.on('leave_changed', onChange);
    return () => { socket.off('leave_changed', onChange); };
  }, [socket, load]);

  const review = async (row: LeaveRow, status: 'approved' | 'rejected') => {
    let note = '';
    if (status === 'rejected') {
      note = window.prompt('เหตุผลที่ไม่อนุมัติ (ไม่บังคับ):', '') ?? '';
    }
    setBusyId(row.id);
    try {
      const res = await api.patch(`/api/leave/${row.id}/review`, { status, review_note: note || undefined });
      if (res.data.success) {
        // บันทึกผลแล้ว ≠ พนักงานรู้ตัว — ถ้าแจ้งเตือนไปไม่ถึงต้องบอกให้โทรตาม
        const push = res.data.data?.push as { status?: string; reason?: string } | undefined;
        setPushWarning(push && push.status !== 'sent'
          ? (push.reason || 'แจ้งเตือนไปไม่ถึงเครื่องพนักงาน')
          : '');
        load();
      } else alert('ดำเนินการไม่สำเร็จ');
    } catch {
      alert('ดำเนินการไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-1">ใบลาพนักงาน</h1>
      <p className="text-sm text-gray-500 mb-6">ตรวจสอบและอนุมัติคำขอลาของพนักงาน</p>

      {pushWarning && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded-lg text-sm mb-5">
          <div className="font-semibold mb-1">⚠️ บันทึกผลแล้ว แต่แจ้งเตือนไปไม่ถึงเครื่องพนักงาน</div>
          <div className="text-amber-800">{pushWarning} — <strong>โทรแจ้งพนักงานด้วย</strong> ไม่งั้นเขาจะไม่รู้ผล</div>
          <button type="button" onClick={() => setPushWarning('')}
            className="mt-2 px-4 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700">
            รับทราบ
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === t.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
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
          <div className="text-center text-gray-500 py-16">ไม่มีใบลา</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  {['พนักงาน', 'ประเภท', 'ช่วงวันลา', 'วัน', 'เหตุผล', 'สถานะ', 'การจัดการ'].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className={`${td} font-medium text-gray-800 whitespace-nowrap`}>
                      {r.user_name || r.username || '-'}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{LEAVE_LABELS[r.leave_type] ?? r.leave_type}</td>
                    <td className={`${td} whitespace-nowrap`}>
                      {fmtDate(r.start_date)}
                      {r.start_date.slice(0, 10) !== r.end_date.slice(0, 10) && ` – ${fmtDate(r.end_date)}`}
                    </td>
                    <td className={td}>{daysBetween(r.start_date, r.end_date)}</td>
                    <td className={`${td} max-w-xs`}>
                      <span className="text-gray-600">{r.reason || '-'}</span>
                      {r.status !== 'pending' && (r.reviewer_name || r.review_note) && (
                        <div className="text-xs text-gray-400 mt-1">
                          {r.reviewer_name ? `โดย ${r.reviewer_name}` : ''}
                          {r.review_note ? ` · “${r.review_note}”` : ''}
                        </div>
                      )}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{statusBadge(r.status)}</td>
                    <td className={`${td} whitespace-nowrap`}>
                      {r.status === 'pending' ? (
                        <div className="flex gap-2">
                          <button
                            disabled={busyId === r.id}
                            onClick={() => review(r, 'approved')}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            อนุมัติ
                          </button>
                          <button
                            disabled={busyId === r.id}
                            onClick={() => review(r, 'rejected')}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50"
                          >
                            ไม่อนุมัติ
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!loading && !error && <p className="text-xs text-gray-400 mt-3">{rows.length} รายการ</p>}
    </div>
  );
}
