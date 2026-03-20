'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getDashboardPath } from '@/lib/auth';

export default function Home() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated && user) {
        const path = getDashboardPath(user.role);
        router.replace(path || '/login');
      } else {
        router.replace('/login');
      }
    }
  }, [isAuthenticated, loading, user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
    </div>
  );
}
