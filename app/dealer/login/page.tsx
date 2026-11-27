'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DealerLoginScreen } from '@/components/dealer/dealer-login-screen';

function DealerLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') === 'register' ? 'register' : 'signin';

  return (
    <DealerLoginScreen
      initialTab={tab}
      onLoginSuccess={() => {
        router.push('/dealer');
      }}
    />
  );
}

export default function DealerLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Loading Dealer Portal...
          </div>
        </div>
      }
    >
      <DealerLoginContent />
    </Suspense>
  );
}

