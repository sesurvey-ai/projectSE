'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

interface Case {
  id: number;
  customer_name: string;
  incident_location: string;
  status: string;
  surveyor_first_name?: string;
  surveyor_last_name?: string;
  creator_first_name?: string;
  creator_last_name?: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = { pending: 'รอดำเนินการ', assigned: 'มอบหมายแล้ว', surveyed: 'สำรวจแล้ว', reviewed: 'ตรวจสอบแล้ว' };
const STATUS_COLORS: Record<string, string> = { pending: 'bg-gray-100 text-gray-800', assigned: 'bg-blue-100 text-blue-800', surveyed: 'bg-yellow-100 text-yellow-800', reviewed: 'bg-green-100 text-green-800' };

export default function AdminCasesPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '15');
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);

      const res = await api.get(`/api/admin/cases?${params}`);
      if (res.data.success) {
        setCases(res.data.data.cases);
        setTotal(res.data.data.total);
        setTotalPages(res.data.data.totalPages);
      }
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/admin/cases/${id}`);
      setDeleteConfirm(null);
      fetchCases();
    } catch {
      alert('ไม่สามารถลบเคสได้');
    }
  };

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">จัดการเคส</h1>
          <p className="text-gray-500 text-sm mt-1">ทั้งหมด {total} เคส</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4 flex flex-wrap gap-4">
        <input
          type="text"
          placeholder="ค้นหาชื่อลูกค้า, สถานที่..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none flex-1 min-w-[200px]"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">ทุกสถานะ</option>
          <option value="pending">รอดำเนินการ</option>
          <option value="assigned">มอบหมายแล้ว</option>
          <option value="surveyed">สำรวจแล้ว</option>
          <option value="reviewed">ตรวจสอบแล้ว</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
        ) : cases.length === 0 ? (
          <div className="text-center text-gray-500 py-12">ไม่พบเคส</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ชื่อลูกค้า</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานที่</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ช่างสำรวจ</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {cases.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">#{c.id}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{c.customer_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-[200px] truncate">{c.incident_location || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-800'}`}>
                      {STATUS_LABELS[c.status] || c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {c.surveyor_first_name ? `${c.surveyor_first_name} ${c.surveyor_last_name}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(c.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/cases/${c.id}/edit`} className="px-3 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors">
                        แก้ไข
                      </Link>
                      {deleteConfirm === c.id ? (
                        <div className="flex gap-1">
                          <button onClick={() => handleDelete(c.id)} className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">ยืนยัน</button>
                          <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400">ยกเลิก</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(c.id)} className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors">ลบ</button>
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
