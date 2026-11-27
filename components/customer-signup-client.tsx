'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { AlertCircle, Loader2,Lock,Mail,MapPin,Phone,User as UserIcon,UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function CustomerSignupClient() {
  const router = useRouter();
  const { signUpCustomer, signInWithGoogle } = useAuth();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    pinCode: '',
  });
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignUp = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const { error: gErr } = await signInWithGoogle();
      if (gErr) {
        setError(gErr);
      } else {
        router.push('/customer/dashboard');
      }
    } catch {
      setError('Google sign-up failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleChange = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.fullName.trim()) { setError('Please enter your full name'); return; }
    if (!form.email.trim()) { setError('Please enter your email'); return; }
    if (!form.phone.trim()) { setError('Please enter your mobile number'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return; }
    if (!agreed) { setError('Please accept the Terms of Service and Privacy Policy'); return; }

    setLoading(true);
    try {
      const { error: sErr } = await signUpCustomer(
        form.email,
        form.password,
        form.fullName,
        form.phone,
        form.pinCode
      );
      if (sErr) {
        setError(sErr);
      } else {
        router.push('/customer/dashboard');
      }
    } catch {
      setError('Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col items-center justify-center px-3 sm:px-4 py-8 pb-36 sm:pb-20 touch-pan-y scrollbar-hide">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20">
          <UserPlus className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Create Customer Account</h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Join DealerConnect AI to discover products and connect with local dealers</p>
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
            <Label htmlFor="fullName" className="mb-1.5 block text-xs font-bold text-foreground">Full Name *</Label>
            <div className="relative">
              <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="fullName" value={form.fullName} onChange={(e) => handleChange('fullName', e.target.value)} placeholder="Enter your full name" className="h-11 sm:h-12 pl-10 text-base sm:text-sm rounded-xl" required />
            </div>
          </div>

          <div>
            <Label htmlFor="email" className="mb-1.5 block text-xs font-bold text-foreground">Email *</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="email" type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="you@example.com" className="h-11 sm:h-12 pl-10 text-base sm:text-sm rounded-xl" required />
            </div>
          </div>

          <div>
            <Label htmlFor="phone" className="mb-1.5 block text-xs font-bold text-foreground">Mobile Number *</Label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="phone" type="tel" value={form.phone} onChange={(e) => handleChange('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210" className="h-11 sm:h-12 pl-10 text-base sm:text-sm rounded-xl" inputMode="numeric" required />
            </div>
          </div>

          <div>
            <Label htmlFor="pinCode" className="mb-1.5 block text-xs font-bold text-foreground">PIN Code</Label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="pinCode" value={form.pinCode} onChange={(e) => handleChange('pinCode', e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="532440" className="h-11 sm:h-12 pl-10 text-base sm:text-sm rounded-xl" inputMode="numeric" />
            </div>
          </div>

          <div>
            <Label htmlFor="password" className="mb-1.5 block text-xs font-bold text-foreground">Password *</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="password" type="password" value={form.password} onChange={(e) => handleChange('password', e.target.value)} placeholder="At least 6 characters" className="h-11 sm:h-12 pl-10 text-base sm:text-sm rounded-xl" required />
            </div>
          </div>

          <div>
            <Label htmlFor="confirmPassword" className="mb-1.5 block text-xs font-bold text-foreground">Confirm Password *</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="confirmPassword" type="password" value={form.confirmPassword} onChange={(e) => handleChange('confirmPassword', e.target.value)} placeholder="Re-enter password" className="h-11 sm:h-12 pl-10 text-base sm:text-sm rounded-xl" required />
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} id="terms" />
            <label htmlFor="terms" className="text-xs text-muted-foreground cursor-pointer">
              I agree to the{' '}
              <Link href="/" className="text-primary hover:underline">Terms of Service</Link> and{' '}
              <Link href="/" className="text-primary hover:underline">Privacy Policy</Link>.
            </label>
          </div>

          <Button type="submit" className="w-full h-11 sm:h-12 rounded-xl font-bold text-xs sm:text-sm shadow-md" disabled={loading || googleLoading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            {loading ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or sign up with</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full flex items-center justify-center gap-2.5 font-medium border-border/80 hover:bg-muted/50"
          onClick={handleGoogleSignUp}
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
          {googleLoading ? 'Connecting Google...' : 'Sign up with Google'}
        </Button>

        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/customer/login" className="font-medium text-primary hover:underline">
              Login
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
