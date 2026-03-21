'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'ผู้ดูแลระบบ',
  surveyor: 'ช่างสำรวจ',
  callcenter: 'พนักงานรับแจ้ง',
  checker: 'ผู้ตรวจสอบ',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-800',
  surveyor: 'bg-blue-100 text-blue-800',
  callcenter: 'bg-green-100 text-green-800',
  checker: 'bg-purple-100 text-purple-800',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '15');
      if (roleFilter) params.set('role', roleFilter);
      if (search) params.set('search', search);

      const res = await api.get(`/api/admin/users?${params}`);
      if (res.data.success) {
        setUsers(res.data.data.users);
        setTotal(res.data.data.total);
        setTotalPages(res.data.data.totalPages);
      }
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/admin/users/${id}`);
      setDeleteConfirm(null);
      fetchUsers();
    } catch {
      alert('ไม่สามารถปิดการใช้งานผู้ใช้ได้');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">จัดการผู้ใช้</h1>
          <p className="text-gray-500 text-sm mt-1">ทั้งหมด {total} คน</p>
        </div>
        <Link href="/admin/users/new" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
          + เพิ่มผู้ใช้ใหม่
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4 flex flex-wrap gap-4">
        <input
          type="text"
          placeholder="ค้นหาชื่อ, username..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none flex-1 min-w-[200px]"
        />
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">ทุกบทบาท</option>
          <option value="admin">ผู้ดูแลระบบ</option>
          <option value="surveyor">ช่างสำรวจ</option>
          <option value="callcenter">พนักงานรับแจ้ง</option>
          <option value="checker">ผู้ตรวจสอบ</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
        ) : users.length === 0 ? (
          <div className="text-center text-gray-500 py-12">ไม่พบผู้ใช้</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ชื่อ-สกุล</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">บทบาท</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่สร้าง</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">#{u.id}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{u.username}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{u.first_name} {u.last_name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-800'}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {u.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(u.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/users/${u.id}/edit`} className="px-3 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors">
                        แก้ไข
                      </Link>
                      {deleteConfirm === u.id ? (
                        <div className="flex gap-1">
                          <button onClick={() => handleDelete(u.id)} className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">
                            ยืนยัน
                          </button>
                          <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400">
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(u.id)} className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors">
                          ปิดใช้งาน
                        </button>
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
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-100 text-gray-700">
            ก่อนหน้า
          </button>
          <span className="text-sm text-gray-600">หน้า {page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-100 text-gray-700">
            ถัดไป
          </button>
        </div>
      )}
    </div>
  );
}
