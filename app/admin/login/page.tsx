'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { AdminLoginScreen } from '@/components/admin/admin-login-screen';

export default function AdminLoginPage() {
  const router = useRouter();
  const { role, loading } = useAuth();

  useEffect(() => {
    if (!loading && role === 'admin') {
      router.push('/admin');
    }
  }, [role, loading, router]);

  return <AdminLoginScreen onLoginSuccess={() => router.push('/admin')} />;
}
