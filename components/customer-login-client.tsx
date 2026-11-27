'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Store, Shield, User, LogIn, Loader2, Mail, Lock, Store as StoreIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export function CustomerLoginClient() {
  const router = useRouter();
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        toast.error(error);
      } else {
        toast.success('Signed in with Google!');
        router.push('/customer/dashboard');
      }
    } catch {
      toast.error('Google sign in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      const { error } = await signIn(email, password, 'customer');
      if (error) {
        toast.error(error);
      } else {
        toast.success('Welcome back!');
        router.push('/customer/dashboard');
      }
    } catch {
      toast.error('Login failed. Please try again.');
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

          <Button type="submit" className="w-full h-11 sm:h-12 rounded-xl font-bold text-xs sm:text-sm shadow-md" disabled={loading || googleLoading}>
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

        <Button
          type="button"
          variant="outline"
          className="w-full h-11 sm:h-12 flex items-center justify-center gap-2.5 font-bold text-xs sm:text-sm rounded-xl border-border/80 hover:bg-muted/50"
          onClick={handleGoogleSignIn}
          disabled={loading || googleLoading}
        >
          {googleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          {googleLoading ? 'Connecting Google...' : 'Continue with Google'}
        </Button>

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
