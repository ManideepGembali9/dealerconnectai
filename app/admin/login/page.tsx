'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { AdminLoginScreen } from '@/components/admin/admin-login-screen';

export default function AdminLoginPage() {
  const router = useRouter();
  const { adminAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && adminAuthenticated) {
      router.push('/admin');
    }
  }, [adminAuthenticated, loading, router]);

  return <AdminLoginScreen onLoginSuccess={() => router.push('/admin')} />;
}
