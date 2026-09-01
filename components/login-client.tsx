'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Store, Shield, Mail, Lock, ArrowLeft, Eye, EyeOff, AlertCircle, Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth, UserRole } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function LoginClient({ role }: { role: UserRole }) {
  const router = useRouter();
  const { signIn, role: currentRole, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = role === 'admin';
  const Icon = isAdmin ? Shield : Store;
  const accentColor = isAdmin ? 'from-orange-500 to-red-500' : 'from-primary to-accent';

  useEffect(() => {
    if (!loading && currentRole === role) {
      router.push(isAdmin ? '/admin' : '/dealer');
    }
  }, [currentRole, role, loading, router, isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setSubmitting(true);
    const { error: signInError } = await signIn(email, password, role);
    setSubmitting(false);
    if (signInError) {
      setError(signInError);
      return;
    }
    toast.success(isAdmin ? 'Welcome, Admin!' : 'Welcome back!');
    router.push(isAdmin ? '/admin' : '/dealer');
  };

  const demoCredentials = isAdmin
    ? { email: 'admin@dealerconnect.ai', password: 'admin123', label: 'Admin Demo' }
    : { email: 'abc@demo.in', password: 'demo', label: 'Dealer Demo (ABC Electronics)' };

  const fillDemo = () => {
    setEmail(demoCredentials.email);
    setPassword(demoCredentials.password);
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-12">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-background" />
      <div className={cn('absolute -right-32 -top-32 h-96 w-96 rounded-full bg-gradient-to-br opacity-10 blur-3xl', accentColor)} />
      <div className={cn('absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-gradient-to-br opacity-10 blur-3xl', accentColor)} />

      <div className="relative w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <Card className="overflow-hidden border-border/60 shadow-xl">
          {/* Header */}
          <div className={cn('relative bg-gradient-to-br p-6 text-center text-white', accentColor)}>
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
              <Icon className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold">
              {isAdmin ? 'Admin Login' : 'Dealer Login'}
            </h1>
            <p className="mt-1 text-sm text-white/80">
              {isAdmin ? 'Access the platform administration panel' : 'Manage your shop and inventory'}
            </p>
          </div>

          {/* Form */}
          <div className="p-6">
            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email" className="mb-1.5 block text-sm font-medium">Email Address</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={isAdmin ? 'admin@dealerconnect.ai' : 'your@email.com'}
                    className="pl-9"
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="password" className="mb-1.5 block text-sm font-medium">Password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="pl-9 pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <><span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Signing in...</>
                ) : (
                  <>{isAdmin ? <Shield className="mr-2 h-4 w-4" /> : <Store className="mr-2 h-4 w-4" />} Sign In</>
                )}
              </Button>
            </form>

            {/* Demo credentials */}
            <div className="mt-5 rounded-lg border border-accent/30 bg-accent/5 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-accent">
                <Sparkles className="h-3.5 w-3.5" /> Demo Credentials
              </div>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p><span className="font-medium text-foreground">Email:</span> {demoCredentials.email}</p>
                <p><span className="font-medium text-foreground">Password:</span> {demoCredentials.password}</p>
              </div>
              <Button variant="outline" size="sm" className="mt-2 w-full text-xs" onClick={fillDemo}>
                <Check className="mr-1 h-3 w-3" /> Fill demo credentials
              </Button>
            </div>

            {/* Cross-links */}
            {!isAdmin && (
              <p className="mt-5 text-center text-sm text-muted-foreground">
                Don't have a dealer account?{' '}
                <Link href="/dealer/register" className="font-medium text-primary hover:underline">Register your shop</Link>
              </p>
            )}
            <p className="mt-3 text-center text-sm text-muted-foreground">
              {isAdmin ? (
                <>Are you a dealer? <Link href="/dealer/login" className="font-medium text-primary hover:underline">Dealer Login</Link></>
              ) : (
                <>Are you an admin? <Link href="/admin/login" className="font-medium text-primary hover:underline">Admin Login</Link></>
              )}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

export function DealerLoginClient() {
  return <LoginClient role="dealer" />;
}

export function AdminLoginClient() {
  return <LoginClient role="admin" />;
}
