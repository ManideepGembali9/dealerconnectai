'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomerGoogleAuthButton } from '@/components/customer-google-auth';
import { useAuth } from '@/lib/auth';
import { AlertCircle, Loader2, Lock, Mail, MapPin, Phone, User as UserIcon, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function CustomerSignupClient() {
  const router = useRouter();
  const { signUpCustomer } = useAuth();
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
        router.push(getRedirectPath());
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

          <Button type="submit" className="w-full h-11 sm:h-12 rounded-xl font-bold text-xs sm:text-sm shadow-md" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            {loading ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground font-semibold">Or sign up with</span>
          </div>
        </div>

        <CustomerGoogleAuthButton
          redirectTo={getRedirectPath()}
          disabled={loading}
          onError={setError}
        />

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
