'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

const NAV_ITEMS: Record<string, { label: string; href: string }[]> = {
  admin: [
    { label: 'แดชบอร์ด', href: '/admin' },
    { label: 'จัดการผู้ใช้', href: '/admin/users' },
    { label: 'จัดการเคส', href: '/admin/cases' },
    { label: 'จัดการรีวิว', href: '/admin/reviews' },
  ],
  callcenter: [
    { label: 'หน้าหลัก', href: '/callcenter' },
    { label: 'สร้างเคสใหม่', href: '/callcenter/cases/new' },
  ],
  checker: [
    { label: 'รายการงาน', href: '/inspector' },
  ],
};

const TITLES: Record<string, string> = {
  admin: 'ผู้ดูแลระบบ',
  callcenter: 'Call Center',
  checker: 'ระบบตรวจสอบ',
};

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const role = user?.role || '';
  const items = NAV_ITEMS[role] || [];
  const title = TITLES[role] || 'SE Survey';

  return (
    <aside className="w-64 bg-gray-800 text-white min-h-screen flex flex-col">
      <div className="p-5 border-b border-gray-700">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-gray-400 text-xs mt-1">SE Survey System</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-4 py-2.5 rounded-lg text-sm transition-colors ${
              pathname === item.href
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
