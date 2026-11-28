'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  AlertCircle,
  ArrowRight,
  Bot,
  ChevronRight,
  Eye,
  EyeOff,
  GitCompare,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MessageSquare,
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
import { ProfileShoppingChat } from '@/components/chatbot';
import { Badge } from '@/components/ui/badge';
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

type AccountOptionItem = {
  id: string;
  title: string;
  href?: string;
  action?: 'chatbot';
  icon: React.ComponentType<{ className?: string }>;
};

const PROFILE_OPTIONS_ITEMS: AccountOptionItem[] = [
  {
    id: 'personal-info',
    title: 'Personal Information',
    href: '/customer/personal-info',
    icon: User,
  },
  {
    id: 'saved-locations',
    title: 'Saved Locations',
    href: '/customer/saved-location',
    icon: MapPin,
  },
  {
    id: 'saved-stores',
    title: 'Saved Stores',
    href: '/customer/saved-stores',
    icon: Store,
  },
  {
    id: 'compare',
    title: 'Compare Products',
    href: '/compare',
    icon: GitCompare,
  },
  {
    id: 'my-enquiries',
    title: 'My Enquiries',
    href: '/customer/enquiries',
    icon: MessageSquare,
  },
  {
    id: 'security',
    title: 'Security',
    href: '/customer/settings',
    icon: Lock,
  },
  {
    id: 'preferences',
    title: 'App Preferences',
    href: '/customer/preferences',
    icon: SlidersHorizontal,
  },
  {
    id: 'ai-chatbot',
    title: 'AI Chatbot',
    action: 'chatbot',
    icon: Bot,
  },
];

export function ProfileClient() {
  const router = useRouter();
  const { customer, loading: authLoading, signIn, signUpCustomer, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  const [themeMounted, setThemeMounted] = useState(false);
  const [dealerApp, setDealerApp] = useState<DealerApplication | null>(null);
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

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
      } catch { }
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
  // AUTHENTICATED CUSTOMER PROFILE (MOBILE-APP MY ACCOUNT UI)
  // ============================================================
  const isVerified = isVerifiedCustomer(customer);
  const customerInitials = (customer.full_name || customer.email || 'C')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

  return (
    <div className="min-h-[calc(100dvh-4rem)] w-full overflow-x-hidden bg-muted/30 dark:bg-background text-foreground pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
      {/* Attractive Profile Backdrop Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/85 text-primary-foreground">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-black/10 blur-xl"
        />

        <div className="relative mx-auto max-w-2xl px-4 pt-5 pb-14">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-extrabold tracking-tight">My Account</h1>
            <Link
              href="/"
              className="hidden md:inline-flex items-center rounded-lg bg-white/15 px-3 py-1 text-xs font-semibold hover:bg-white/25 transition-colors"
            >
              Home
            </Link>
          </div>
        </div>
      </div>

      <div className="relative mx-auto max-w-2xl px-4 -mt-10 space-y-4">
        {/* Centered Profile Identity Card */}
        <section
          aria-label="Customer Profile Summary"
          className="rounded-3xl border border-border bg-card px-5 pt-4 pb-5 shadow-sm text-center"
        >
          <div className="-mt-12 mx-auto relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-card bg-muted text-xl font-black text-foreground shadow-md">
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

          <div className="mt-3 space-y-1">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
              {customer.full_name || 'Customer'}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              {customer.email}
            </p>
            {isVerified && (
              <div className="pt-1 flex justify-center">
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  <span>Verified Customer</span>
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Exact Ordered Options 1..8 */}
        <section aria-label="Account Options">
          <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden shadow-sm">
            {PROFILE_OPTIONS_ITEMS.map((item) => {
              const IconComp = item.icon;
              if (item.action === 'chatbot') {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setChatOpen(true)}
                    className="w-full flex items-center justify-between gap-3.5 px-4 py-3.5 hover:bg-muted/60 active:bg-muted transition-colors group text-left"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/70 text-foreground">
                        <IconComp className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">{item.title}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </button>
                );
              }

              return (
                <Link
                  key={item.id}
                  href={item.href || '/profile'}
                  className="flex items-center justify-between gap-3.5 px-4 py-3.5 hover:bg-muted/60 active:bg-muted transition-colors group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/70 text-foreground">
                      <IconComp className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">{item.title}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                </Link>
              );
            })}
          </div>
        </section>

        {/* Option 9: Own a Shop? / Become a Dealer */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-foreground">Own a Shop?</p>
                {dealerApp && (
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {dealerApp.status.replace('_', ' ')}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {dealerApp
                  ? `Dealer application: ${dealerApp.shop_name}`
                  : 'List your shop & inventory for local buyers'}
              </p>
            </div>
          </div>
          <Link
            href="/dealer/register"
            className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
          >
            <span>Become a Dealer</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>

        {/* Option 10: Prominent Red Logout Action */}
        <div>
          <button
            type="button"
            onClick={() => setSignOutDialogOpen(true)}
            className="w-full h-12 rounded-2xl border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Sign Out Confirmation Dialog */}
      <Dialog open={signOutDialogOpen} onOpenChange={setSignOutDialogOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl border border-border bg-card text-foreground">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Logout from Customer App?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              You will be signed out of the Customer App on this device. Any active Dealer or Admin sessions stay signed in separately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSignOutDialogOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmSignOut}
              className="rounded-xl font-bold"
            >
              Confirm Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Chatbot — opened from profile */}
      <ProfileShoppingChat open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
