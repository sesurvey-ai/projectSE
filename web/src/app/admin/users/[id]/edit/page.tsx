'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id;

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    role: '',
    is_active: true,
    password: '',
  });
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/api/admin/users/${userId}`)
      .then((res) => {
        if (res.data.success) {
          const u = res.data.data;
          setUsername(u.username);
          setForm({
            first_name: u.first_name,
            last_name: u.last_name,
            role: u.role,
            is_active: u.is_active,
            password: '',
          });
        }
      })
      .catch(() => setError('ไม่พบผู้ใช้'))
      .finally(() => setLoading(false));
  }, [userId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        first_name: form.first_name,
        last_name: form.last_name,
        role: form.role,
        is_active: form.is_active,
      };
      if (form.password) payload.password = form.password;

      const res = await api.put(`/api/admin/users/${userId}`, payload);
      if (res.data.success) {
        router.push('/admin/users');
      } else {
        setError(res.data.message || 'ไม่สามารถอัพเดทได้');
      }
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/admin/users" className="text-blue-600 hover:underline text-sm">&larr; กลับไปรายการผู้ใช้</Link>
        <h1 className="text-2xl font-bold text-gray-800 mt-2">แก้ไขผู้ใช้: {username}</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ</label>
              <input type="text" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">นามสกุล</label>
              <input type="text" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">บทบาท</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900">
              <option value="admin">ผู้ดูแลระบบ</option>
              <option value="surveyor">ช่างสำรวจ</option>
              <option value="callcenter">พนักงานรับแจ้ง</option>
              <option value="checker">ผู้ตรวจสอบ</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่านใหม่ (เว้นว่างถ้าไม่ต้องการเปลี่ยน)</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900" minLength={6} />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_active" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">เปิดใช้งาน</label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link href="/admin/users" className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 text-sm font-medium">
              ยกเลิก
            </Link>
            <button type="submit" disabled={submitting} className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm">
              {submitting ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
