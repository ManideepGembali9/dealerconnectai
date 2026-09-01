'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, UserPlus, Loader2, Mail, Lock, Phone, MapPin, User as UserIcon, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

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
  const [loading, setLoading] = useState(false);

  const handleChange = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.fullName.trim()) { toast.error('Please enter your full name'); return; }
    if (!form.email.trim()) { toast.error('Please enter your email'); return; }
    if (!form.phone.trim()) { toast.error('Please enter your mobile number'); return; }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (!agreed) { toast.error('Please accept the Terms of Service and Privacy Policy'); return; }

    setLoading(true);
    try {
      const { error } = await signUpCustomer(
        form.email,
        form.password,
        form.fullName,
        form.phone,
        form.pinCode
      );
      if (error) {
        toast.error(error);
      } else {
        toast.success('Account created successfully!');
        router.push('/customer/dashboard');
      }
    } catch {
      toast.error('Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg">
          <UserPlus className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold">Create Customer Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Join DealerConnect AI to discover products and connect with local dealers</p>
      </div>

      <Card className="w-full p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="fullName" className="mb-1.5 block text-sm">Full Name *</Label>
            <div className="relative">
              <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="fullName" value={form.fullName} onChange={(e) => handleChange('fullName', e.target.value)} placeholder="Enter your full name" className="pl-9" required />
            </div>
          </div>

          <div>
            <Label htmlFor="email" className="mb-1.5 block text-sm">Email *</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="email" type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="you@example.com" className="pl-9" required />
            </div>
          </div>

          <div>
            <Label htmlFor="phone" className="mb-1.5 block text-sm">Mobile Number *</Label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="phone" type="tel" value={form.phone} onChange={(e) => handleChange('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210" className="pl-9" inputMode="numeric" required />
            </div>
          </div>

          <div>
            <Label htmlFor="pinCode" className="mb-1.5 block text-sm">PIN Code</Label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="pinCode" value={form.pinCode} onChange={(e) => handleChange('pinCode', e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="532440" className="pl-9" inputMode="numeric" />
            </div>
          </div>

          <div>
            <Label htmlFor="password" className="mb-1.5 block text-sm">Password *</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="password" type="password" value={form.password} onChange={(e) => handleChange('password', e.target.value)} placeholder="At least 6 characters" className="pl-9" required />
            </div>
          </div>

          <div>
            <Label htmlFor="confirmPassword" className="mb-1.5 block text-sm">Confirm Password *</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="confirmPassword" type="password" value={form.confirmPassword} onChange={(e) => handleChange('confirmPassword', e.target.value)} placeholder="Re-enter password" className="pl-9" required />
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

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            {loading ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>

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
