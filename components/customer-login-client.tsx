'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomerGoogleAuthButton } from '@/components/customer-google-auth';
import { useAuth } from '@/lib/auth';
import { AlertCircle, Loader2, Lock, LogIn, Mail, Store as StoreIcon, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_cancelled: 'Google sign-in was cancelled. Please select an account to continue.',
  google_state_invalid: 'Google login verification expired. Please try again.',
  google_not_configured: 'Google OAuth credentials are not configured on the server.',
  google_token_exchange_failed: 'Could not verify authorization with Google. Please try again.',
  google_token_missing: 'Google did not return a valid session token.',
  google_userinfo_failed: 'Could not retrieve your Google profile details.',
  google_profile_incomplete: 'Your Google account did not return an email address.',
  google_callback_failed: 'Google sign-in failed. Please try again.',
};

export function CustomerLoginClient() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const errCode = params.get('error');
    if (errCode && GOOGLE_ERROR_MESSAGES[errCode]) {
      setError(GOOGLE_ERROR_MESSAGES[errCode]);
    }
  }, []);

  const getRedirectPath = () => {
    if (typeof window === 'undefined') return '/';
    const params = new URLSearchParams(window.location.search);
    const r = params.get('redirect');
    if (
      r &&
      r.startsWith('/') &&
      !r.startsWith('//') &&
      !r.startsWith('/admin') &&
      !r.startsWith('/dealer') &&
      !r.startsWith('/api')
    ) {
      return r;
    }
    return '/';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      const { error: sErr } = await signIn(email, password, 'customer');
      if (sErr) {
        setError(sErr);
      } else {
        router.push(getRedirectPath());
      }
    } catch {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col items-center justify-center px-3 sm:px-4 py-8 pb-32 sm:pb-16 touch-pan-y scrollbar-hide">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20">
          <User className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Customer Login</h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Sign in to save products, track enquiries, and compare nearby dealer prices</p>
      </div>

      <Card className="w-full p-5 sm:p-7 rounded-3xl border border-border/80 shadow-2xl backdrop-blur touch-pan-y">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email" className="mb-1.5 block text-xs font-bold text-foreground">Email or Mobile Number</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-11 sm:h-12 pl-10 text-base sm:text-sm rounded-xl"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="password" className="mb-1.5 block text-xs font-bold text-foreground">Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="h-11 sm:h-12 pl-10 text-base sm:text-sm rounded-xl"
                required
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Link href="/customer/forgot-password" className="text-xs font-bold text-primary hover:underline">
              Forgot Password?
            </Link>
          </div>

          <Button type="submit" className="w-full h-11 sm:h-12 rounded-xl font-bold text-xs sm:text-sm shadow-md" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
            {loading ? 'Signing in...' : 'Sign In as Customer'}
          </Button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground font-semibold">Or continue with</span>
          </div>
        </div>

        <CustomerGoogleAuthButton
          redirectTo={getRedirectPath()}
          disabled={loading}
          autoOpenFromQuery
          onError={setError}
        />

        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/customer/signup" className="font-medium text-primary hover:underline">
              Create Customer Account
            </Link>
          </p>
        </div>
      </Card>

      <div className="mt-6 flex w-full flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground font-semibold">Are you a merchant or store owner?</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <Link href="/dealer/login?tab=register" className="w-full">
          <Button variant="outline" className="w-full h-11 sm:h-12 font-bold rounded-xl border-border hover:bg-muted text-foreground">
            <StoreIcon className="mr-2 h-4 w-4 text-primary" /> Become a Dealer — Register Your Shop
          </Button>
        </Link>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Already registered?{' '}
          <Link href="/dealer/login" className="font-bold text-foreground hover:underline">Dealer Sign In</Link>
        </p>
      </div>
    </div>
  );
}
