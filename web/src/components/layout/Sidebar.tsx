'use client';

import { useState } from 'react';
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
    { label: 'พนักงานทั้งหมด', href: '/callcenter/employees' },
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
  const [collapsed, setCollapsed] = useState(false);
  const role = user?.role || '';
  const items = NAV_ITEMS[role] || [];
  const title = TITLES[role] || 'SE Survey';

  return (
    <>
      {/* Toggle button (visible when collapsed) */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="fixed top-3 left-3 z-50 w-10 h-10 bg-gray-800 text-white rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors shadow-lg"
          title="เปิดเมนู"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Sidebar */}
      <aside className={`bg-gray-800 text-white min-h-screen flex flex-col transition-all duration-300 ${collapsed ? 'w-0 overflow-hidden' : 'w-64'}`}>
        <div className="p-5 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            <p className="text-gray-400 text-xs mt-1">SE Survey System</p>
          </div>
          <button
            onClick={() => setCollapsed(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
            title="ซ่อนเมนู"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
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
    </>
  );
}
