'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  AlertCircle,
  ArrowRight,
  ChevronRight,
  Eye,
  EyeOff,
  GitCompare,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Monitor,
  Moon,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Sun,
  User,
} from 'lucide-react';
import { CustomerGoogleAuthButton } from '@/components/customer-google-auth';
import { LanguageSwitcher } from '@/components/language-switcher';
import { isVerifiedCustomer } from '@/components/profile/customer-subpage-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { DealerApplication } from '@/lib/types';
import { cn } from '@/lib/utils';

type AccountSettingLink = {
  title: string;
  subtitle: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const ACCOUNT_SETTINGS_ITEMS: AccountSettingLink[] = [
  {
    title: 'Personal Information',
    subtitle: 'Profile photo, full name, email & phone',
    href: '/customer/personal-info',
    icon: User,
  },
  {
    title: 'Saved Location',
    subtitle: 'GPS coordinates & 6-digit PIN delivery area',
    href: '/customer/saved-location',
    icon: MapPin,
  },
  {
    title: 'Saved Stores',
    subtitle: 'Favorite local shops you bookmarked',
    href: '/customer/saved-stores',
    icon: Store,
  },
  {
    title: 'Compare Products',
    subtitle: 'Side-by-side price & specification table',
    href: '/compare',
    icon: GitCompare,
  },
  {
    title: 'Security & Privacy',
    subtitle: 'Password update, verification & privacy',
    href: '/customer/settings',
    icon: Lock,
  },
  {
    title: 'App Preferences',
    subtitle: 'Theme, language & alert notifications',
    href: '/customer/preferences',
    icon: SlidersHorizontal,
  },
];

export function ProfileClient() {
  const router = useRouter();
  const { customer, loading: authLoading, signIn, signUpCustomer, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  const [themeMounted, setThemeMounted] = useState(false);
  const [dealerApp, setDealerApp] = useState<DealerApplication | null>(null);
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);

  // Guest Login & Signup State
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestPin, setGuestPin] = useState('');
  const [guestShowPassword, setGuestShowPassword] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  useEffect(() => {
    setThemeMounted(true);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadDealerApplicationStatus() {
      if (!customer) {
        if (active) setDealerApp(null);
        return;
      }
      try {
        const { data } = await supabase
          .from('dealer_applications')
          .select('*')
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false })
          .limit(1);
        if (active && Array.isArray(data) && data.length > 0) {
          setDealerApp(data[0] as DealerApplication);
        }
      } catch {}
    }
    loadDealerApplicationStatus();
    return () => {
      active = false;
    };
  }, [customer]);

  const handleConfirmSignOut = async () => {
    setSignOutDialogOpen(false);
    await signOut('customer');
    router.push('/customer/login');
  };

  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuestError(null);
    if (!guestEmail.trim() || !guestPassword) {
      setGuestError('Please enter your email and password.');
      return;
    }
    setAuthSubmitting(true);
    const res = await signIn(guestEmail.trim(), guestPassword, 'customer');
    setAuthSubmitting(false);
    if (res.error) {
      setGuestError(res.error || 'Login failed. Check your credentials.');
    }
  };

  const handleGuestSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuestError(null);
    if (!guestName.trim()) {
      setGuestError('Please enter your full name.');
      return;
    }
    if (!guestEmail.trim()) {
      setGuestError('Please enter your email address.');
      return;
    }
    if (guestPassword.length < 6) {
      setGuestError('Password must be at least 6 characters.');
      return;
    }
    setAuthSubmitting(true);
    const res = await signUpCustomer(
      guestEmail.trim(),
      guestPassword,
      guestName.trim(),
      guestPhone.trim(),
      guestPin.trim()
    );
    setAuthSubmitting(false);
    if (res.error) {
      setGuestError(res.error || 'Sign up failed. Please try again.');
    }
  };

  if (authLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 flex flex-col items-center justify-center gap-3 bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-xs font-semibold text-muted-foreground">Loading customer profile...</p>
      </div>
    );
  }

  // ============================================================
  // GUEST VIEW (NO-SCROLL NATIVE MOBILE-APP SCREEN BEFORE LOGIN)
  // ============================================================
  if (!customer) {
    return (
      <div className="mx-auto -mb-20 md:-mb-10 flex min-h-[calc(100dvh-4.1rem)] max-w-md flex-col justify-center px-3.5 pt-1.5 pb-[4.5rem] md:pb-4 bg-background text-foreground">
        <div className="w-full space-y-2">
          {/* Compact App Header */}
          <div className="flex items-center gap-2.5 px-0.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-foreground leading-tight">
                My Profile
              </h1>
              <p className="text-[11px] text-muted-foreground truncate">
                Sign in to access saved stores, location & account settings
              </p>
            </div>
          </div>

          {/* Compact Login / Register Card */}
          <Card className="rounded-2xl border border-border bg-card p-3.5 sm:p-5 shadow-sm space-y-2.5">
            <div className="grid grid-cols-2 p-1 bg-muted rounded-xl border border-border/50">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setGuestError(null);
                }}
                className={cn(
                  'py-1.5 text-xs font-bold rounded-lg transition-all',
                  authMode === 'login'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setGuestError(null);
                }}
                className={cn(
                  'py-1.5 text-xs font-bold rounded-lg transition-all',
                  authMode === 'signup'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Create Account
              </button>
            </div>

            {guestError && (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{guestError}</span>
              </div>
            )}

            {authMode === 'login' ? (
              <form onSubmit={handleGuestLogin} className="space-y-2.5">
                <div>
                  <Label htmlFor="guest-login-email" className="text-[11px] font-bold text-foreground">
                    Email Address
                  </Label>
                  <div className="relative mt-1">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="guest-login-email"
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="you@email.com"
                      className="h-10 pl-9 text-sm rounded-xl"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label htmlFor="guest-login-pw" className="text-[11px] font-bold text-foreground">
                      Password
                    </Label>
                    <Link
                      href="/customer/forgot-password"
                      className="text-[11px] font-semibold text-foreground hover:underline"
                    >
                      Forgot Password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="guest-login-pw"
                      type={guestShowPassword ? 'text' : 'password'}
                      value={guestPassword}
                      onChange={(e) => setGuestPassword(e.target.value)}
                      placeholder="Enter password"
                      className="h-10 pl-9 pr-9 text-sm rounded-xl"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setGuestShowPassword(!guestShowPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Toggle password visibility"
                    >
                      {guestShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={authSubmitting}
                  className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl text-xs sm:text-sm"
                >
                  {authSubmitting ? 'Signing In...' : 'Sign In'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleGuestSignup} className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="guest-signup-name" className="text-[11px] font-bold text-foreground">
                      Full Name *
                    </Label>
                    <Input
                      id="guest-signup-name"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Ramesh Varma"
                      className="h-9 text-xs rounded-xl mt-0.5"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="guest-signup-phone" className="text-[11px] font-bold text-foreground">
                      Mobile
                    </Label>
                    <Input
                      id="guest-signup-phone"
                      type="tel"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9848012345"
                      inputMode="numeric"
                      className="h-9 text-xs rounded-xl mt-0.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Label htmlFor="guest-signup-email" className="text-[11px] font-bold text-foreground">
                      Email *
                    </Label>
                    <Input
                      id="guest-signup-email"
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="you@email.com"
                      className="h-9 text-xs rounded-xl mt-0.5"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="guest-signup-pin" className="text-[11px] font-bold text-foreground">
                      PIN Code
                    </Label>
                    <Input
                      id="guest-signup-pin"
                      value={guestPin}
                      onChange={(e) => setGuestPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="532440"
                      inputMode="numeric"
                      className="h-9 text-xs rounded-xl mt-0.5"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="guest-signup-pw" className="text-[11px] font-bold text-foreground">
                    Password *
                  </Label>
                  <Input
                    id="guest-signup-pw"
                    type="password"
                    value={guestPassword}
                    onChange={(e) => setGuestPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="h-9 text-xs rounded-xl mt-0.5"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={authSubmitting}
                  className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl text-xs sm:text-sm"
                >
                  {authSubmitting ? 'Creating...' : 'Create Free Account'}
                </Button>
              </form>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-card px-2 text-muted-foreground font-semibold">Or</span>
              </div>
            </div>

            <CustomerGoogleAuthButton
              compact
              redirectOnSuccess={false}
              redirectTo="/"
              disabled={authSubmitting}
              onError={setGuestError}
            />
          </Card>

          {/* Compact Single-Row App Preferences Strip */}
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <Settings className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-[11px] font-bold text-foreground truncate">Preferences</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="inline-flex items-center rounded-lg border border-border bg-muted/50 p-0.5 gap-0.5">
                {[
                  { id: 'light', label: 'Light mode', icon: Sun },
                  { id: 'dark', label: 'Dark mode', icon: Moon },
                  { id: 'system', label: 'System theme', icon: Monitor },
                ].map((opt) => {
                  const IconComp = opt.icon;
                  const active = themeMounted && theme === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTheme(opt.id)}
                      aria-label={opt.label}
                      title={opt.label}
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-md transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <IconComp className="h-3.5 w-3.5" />
                    </button>
                  );
                })}
              </div>
              <LanguageSwitcher className="h-7 px-2 text-[11px] rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // AUTHENTICATED CUSTOMER PROFILE (PREMIUM DARK UI)
  // ============================================================
  const isVerified = isVerifiedCustomer(customer);
  const customerInitials = (customer.full_name || 'C')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

  return (
    <div className="min-h-[calc(100dvh-4rem)] w-full overflow-x-hidden bg-[#0A0A0A] text-[#FFFFFF] pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
      <div className="mx-auto max-w-2xl px-4 pt-6 pb-4 space-y-5">
        {/* Profile Header: Avatar, Full Name, and Verified Badge ONLY */}
        <section
          aria-label="Customer Profile Summary"
          className="rounded-2xl border border-[#292929] bg-[#151515] p-5"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#292929] bg-[#202020] text-lg font-bold text-[#FFFFFF]">
              {customer.avatar_url ? (
                <Image
                  src={customer.avatar_url}
                  alt={customer.full_name || 'Customer Avatar'}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <span>{customerInitials || 'C'}</span>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-1.5">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#FFFFFF] truncate">
                {customer.full_name || 'Customer'}
              </h1>
              {isVerified && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#292929] bg-[#202020] px-2.5 py-0.5 text-[11px] font-semibold text-[#FFFFFF]">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Verified Customer</span>
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Account Settings (Strict Order, 6 Items Only) */}
        <section aria-labelledby="account-settings-heading" className="space-y-2.5">
          <h2
            id="account-settings-heading"
            className="px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#A0A0A0]"
          >
            Account Settings
          </h2>

          <div className="rounded-2xl border border-[#292929] bg-[#151515] divide-y divide-[#292929] overflow-hidden">
            {ACCOUNT_SETTINGS_ITEMS.map((item) => {
              const IconComp = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between gap-3.5 px-4 py-3.5 hover:bg-[#202020] active:bg-[#202020] transition-colors group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#292929] bg-[#202020] text-[#FFFFFF]">
                      <IconComp className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#FFFFFF] leading-tight">
                        {item.title}
                      </p>
                      <p className="text-xs text-[#A0A0A0] truncate mt-0.5">{item.subtitle}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#A0A0A0] group-hover:text-[#FFFFFF] transition-colors" />
                </Link>
              );
            })}
          </div>
        </section>

        {/* Compact Secondary Section: Own a Shop? */}
        <section className="rounded-2xl border border-[#292929] bg-[#151515] p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#292929] bg-[#202020]">
              <Store className="h-4 w-4 text-[#FFFFFF]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-[#FFFFFF]">Own a Shop?</p>
              <p className="text-[11px] text-[#A0A0A0] truncate">
                {dealerApp
                  ? `Dealer application status: ${dealerApp.status.replace('_', ' ')}`
                  : 'List your store inventory for local shoppers'}
              </p>
            </div>
          </div>
          <Link
            href="/dealer/register"
            className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[#292929] bg-[#202020] px-3 py-2 text-xs font-semibold text-[#FFFFFF] hover:bg-[#292929] transition-colors whitespace-nowrap"
          >
            <span>Become a Dealer</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>

        {/* Sign Out Action */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setSignOutDialogOpen(true)}
            className="w-full h-12 rounded-2xl border border-[#292929] bg-[#151515] hover:bg-[#202020] text-sm font-semibold text-[#FFFFFF] flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="h-4 w-4 text-[#A0A0A0]" />
            <span>Sign Out of Customer Account</span>
          </button>
        </div>
      </div>

      {/* Sign Out Confirmation Dialog */}
      <Dialog open={signOutDialogOpen} onOpenChange={setSignOutDialogOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl border border-[#292929] bg-[#151515] text-[#FFFFFF]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#FFFFFF]">
              Sign out of your account?
            </DialogTitle>
            <DialogDescription className="text-xs text-[#A0A0A0]">
              You will be signed out of your Customer session on this device. Any active Dealer or Admin sessions stay signed in separately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSignOutDialogOpen(false)}
              className="rounded-xl border-[#292929] bg-[#202020] text-[#FFFFFF] hover:bg-[#292929]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmSignOut}
              className="rounded-xl bg-[#FFFFFF] text-[#0A0A0A] hover:bg-[#E5E5E5] font-bold"
            >
              Confirm Sign Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
