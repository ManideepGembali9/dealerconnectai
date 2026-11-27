'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';

export default function CustomerGoogleCallbackPage() {
  const router = useRouter();
  const { signInWithGoogle } = useAuth();
  const startedRef = useRef(false);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Completing Google sign-in...');

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;

    async function completeGoogleAuth() {
      try {
        const res = await fetch('/api/auth/google/complete', {
          method: 'GET',
          cache: 'no-store',
        });
        const data = await res.json();

        if (!res.ok || !data?.authenticated || !data?.profile?.email) {
          throw new Error(data?.error || 'Could not verify your Google account session.');
        }

        const { error } = await signInWithGoogle({
          email: data.profile.email,
          full_name: data.profile.full_name,
          avatar_url: data.profile.avatar_url,
          google_sub: data.profile.google_sub,
        });

        if (error) {
          throw new Error(error);
        }

        if (!cancelled) {
          setStatus('success');
          setMessage('Signed in with Google! Redirecting to DealerConnect AI...');
          const target =
            typeof data.profile.nextPath === 'string' &&
            data.profile.nextPath.startsWith('/') &&
            !data.profile.nextPath.startsWith('//') &&
            !data.profile.nextPath.startsWith('/dealer') &&
            !data.profile.nextPath.startsWith('/admin')
              ? data.profile.nextPath
              : '/';
          router.replace(target);
        }
      } catch (err: any) {
        if (!cancelled) {
          setStatus('error');
          setMessage(err?.message || 'Google authentication failed. Please try again.');
        }
      }
    }

    completeGoogleAuth();
    return () => {
      cancelled = true;
    };
  }, [router, signInWithGoogle]);

  return (
    <div className="flex min-h-[75vh] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm p-6 text-center space-y-4 shadow-md border-border">
        {status === 'loading' && (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
            <div className="space-y-1">
              <h1 className="text-lg font-bold text-foreground">Signing you in</h1>
              <p className="text-xs text-muted-foreground">{message}</p>
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <h1 className="text-lg font-bold text-foreground">Welcome back!</h1>
              <p className="text-xs text-muted-foreground">{message}</p>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div className="space-y-1">
              <h1 className="text-lg font-bold text-foreground">Google Sign-In Failed</h1>
              <p className="text-xs text-muted-foreground">{message}</p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Button asChild className="w-full h-10 rounded-xl font-bold text-xs">
                <Link href="/customer/login">Back to Customer Login</Link>
              </Button>
              <Button asChild variant="outline" className="w-full h-10 rounded-xl font-bold text-xs">
                <Link href="/">Go to Homepage</Link>
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
