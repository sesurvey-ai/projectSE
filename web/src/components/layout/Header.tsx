'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

const ROLE_LABELS: Record<string, string> = {
  admin: 'ผู้ดูแลระบบ',
  callcenter: 'พนักงานรับแจ้ง',
  checker: 'เจ้าหน้าที่ตรวจสอบ',
};

export default function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-gray-700">แผงควบคุม</h2>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-700">
            {user?.first_name} {user?.last_name}
          </p>
          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
            {ROLE_LABELS[user?.role || ''] || user?.role}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          ออกจากระบบ
        </button>
      </div>
    </header>
  );
}
