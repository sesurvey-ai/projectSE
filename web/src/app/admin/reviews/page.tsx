'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

interface Review {
  id: number;
  case_id: number;
  customer_name: string;
  incident_location: string;
  checker_first_name?: string;
  checker_last_name?: string;
  comment: string;
  proposed_fee: number;
  approved_fee: number;
  status: string;
  reviewed_at: string;
}

const REVIEW_STATUS_LABELS: Record<string, string> = { pending: 'รอตรวจสอบ', approved: 'อนุมัติแล้ว' };
const REVIEW_STATUS_COLORS: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-800', approved: 'bg-green-100 text-green-800' };

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '15');
      if (statusFilter) params.set('status', statusFilter);

      const res = await api.get(`/api/admin/reviews?${params}`);
      if (res.data.success) {
        setReviews(res.data.data.reviews);
        setTotal(res.data.data.total);
        setTotalPages(res.data.data.totalPages);
      }
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/admin/reviews/${id}`);
      setDeleteConfirm(null);
      fetchReviews();
    } catch {
      alert('ไม่สามารถลบรีวิวได้');
    }
  };

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';
  const formatMoney = (n: number) => n != null ? `${Number(n).toLocaleString()} บาท` : '-';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">จัดการรีวิว</h1>
          <p className="text-gray-500 text-sm mt-1">ทั้งหมด {total} รายการ</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4 flex flex-wrap gap-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">ทุกสถานะ</option>
          <option value="pending">รอตรวจสอบ</option>
          <option value="approved">อนุมัติแล้ว</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
        ) : reviews.length === 0 ? (
          <div className="text-center text-gray-500 py-12">ไม่พบรีวิว</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">เคส</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ลูกค้า</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ผู้ตรวจ</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ค่าบริการเสนอ</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ค่าบริการอนุมัติ</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reviews.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">#{r.id}</td>
                  <td className="px-4 py-3 text-sm text-blue-600">#{r.case_id}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{r.customer_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {r.checker_first_name ? `${r.checker_first_name} ${r.checker_last_name}` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${REVIEW_STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-800'}`}>
                      {REVIEW_STATUS_LABELS[r.status] || r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right">{formatMoney(r.proposed_fee)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right">{formatMoney(r.approved_fee)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(r.reviewed_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/reviews/${r.id}/edit`} className="px-3 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors">
                        แก้ไข
                      </Link>
                      {deleteConfirm === r.id ? (
                        <div className="flex gap-1">
                          <button onClick={() => handleDelete(r.id)} className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">ยืนยัน</button>
                          <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400">ยกเลิก</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(r.id)} className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors">ลบ</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-100 text-gray-700">ก่อนหน้า</button>
          <span className="text-sm text-gray-600">หน้า {page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-100 text-gray-700">ถัดไป</button>
        </div>
      )}
    </div>
  );
}
