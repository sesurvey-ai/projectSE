'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
// หน้าคิวตรวจ/หน้าเคสฟังสัญญาณ case_changed เพื่ออัปเดตเองโดยไม่ต้องกด F5
// ไม่มี provider = useSocket() คืน null แล้วเหลือแต่การโหลดซ้ำตามเวลา (ช้ากว่ามาก)
import { SocketProvider } from '@/providers/SocketProvider';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default function InspectorLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) router.replace('/login');
      else if (user?.role !== 'checker') router.replace('/login');
    }
  }, [isAuthenticated, loading, user, router]);

  if (loading || !isAuthenticated) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <SocketProvider>
      <div className="flex min-h-screen min-w-[1024px]">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-6 bg-gray-50">{children}</main>
        </div>
      </div>
    </SocketProvider>
  );
}
