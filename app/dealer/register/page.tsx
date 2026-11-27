'use client';

import { useRouter } from 'next/navigation';
import { DealerLoginScreen } from '@/components/dealer/dealer-login-screen';

export default function DealerRegisterPage() {
  const router = useRouter();

  return (
    <DealerLoginScreen
      initialTab="register"
      onLoginSuccess={() => {
        router.push('/dealer');
      }}
    />
  );
}
