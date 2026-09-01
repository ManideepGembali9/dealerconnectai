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
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg">
          <User className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold">Customer Login</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to save products, track enquiries, and get personalized recommendations</p>
      </div>

      <Card className="w-full p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email" className="mb-1.5 block text-sm">Email or Mobile Number</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="pl-9"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="password" className="mb-1.5 block text-sm">Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="pl-9"
                required
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Link href="/customer/forgot-password" className="text-xs text-primary hover:underline">
              Forgot Password?
            </Link>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
            {loading ? 'Signing in...' : 'Login'}
          </Button>
        </form>

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
          <span className="text-xs text-muted-foreground">Other login options</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="flex gap-2">
          <Link href="/dealer/login" className="flex-1">
            <Button variant="outline" className="w-full">
              <StoreIcon className="mr-2 h-4 w-4" /> Dealer Login
            </Button>
          </Link>
          <Link href="/admin/login" className="flex-1">
            <Button variant="outline" className="w-full">
              <Shield className="mr-2 h-4 w-4" /> Admin Login
            </Button>
          </Link>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Are you a dealer?{' '}
          <Link href="/dealer/login" className="text-primary hover:underline">Dealer Login</Link>
        </p>
      </div>
    </div>
  );
}
