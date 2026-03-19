'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

export default function CallcenterDashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        สวัสดี, {user?.first_name} {user?.last_name}
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/callcenter/cases/new"
          className="block p-6 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
        >
          <h3 className="text-lg font-semibold text-blue-600 mb-2">สร้างเคสใหม่</h3>
          <p className="text-gray-500 text-sm">รับแจ้งเหตุและสร้างเคสสำหรับส่งให้พนักงานสำรวจ</p>
        </Link>
      </div>
    </div>
  );
}
