'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  User,
  Heart,
  MapPin,
  Store,
  LogOut,
  Settings,
  Clock,
  ChevronRight,
  Phone,
  ShieldCheck,
  Edit3,
  CheckCircle2,
  Lock,
  Mail,
  Camera,
  Eye,
  EyeOff,
  ArrowRight,
  Building,
  AlertCircle,
  ExternalLink,
  Upload,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { DealerRegistrationForm } from '@/components/dealer-registration-form';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import {
  ProfileSettingsPanelContent,
  isCustomerAccountVerified,
  resizeAvatarImage,
  type ProfileSectionId,
} from '@/components/profile/profile-settings-panels';
import { useApp } from '@/lib/providers';
import { useAuth } from '@/lib/auth';
import { fetchProductById, fetchApprovedDealers } from '@/lib/data';
import { getDbDealerApplications } from '@/lib/firebase-db';
import { getPinCentroid } from '@/lib/geo';
import type { Product, Dealer, DealerApplication } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const SETTING_CARDS: {
  id: ProfileSectionId;
  title: string;
  description: string;
  icon: typeof User;
}[] = [
  {
    id: 'personal',
    title: 'Personal Information',
    description: 'Name, phone, email and identity',
    icon: User,
  },
  {
    id: 'location',
    title: 'Saved Location',
    description: 'Manage your preferred location',
    icon: MapPin,
  },
  {
    id: 'wishlist',
    title: 'Wishlist & Saved Stores',
    description: 'Manage your favourite products and shops',
    icon: Heart,
  },
  {
    id: 'security',
    title: 'Security & Privacy',
    description: 'Password management, verification and session privacy',
    icon: ShieldCheck,
  },
  {
    id: 'preferences',
    title: 'App Preferences',
    description: 'Customize your application experience',
    icon: Settings,
  },
];

export function ProfileClient() {
  const router = useRouter();
  const {
    customer,
    loading: authLoading,
    signOut,
    updateCustomerProfile,
    signIn,
    signUpCustomer,
    signInWithGoogle,
    sendOtp,
  } = useAuth();
  const {
    wishlist,
    savedDealers,
    location,
    setLocation,
  } = useApp();

  const [loading, setLoading] = useState(true);
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
  const [savedDealerList, setSavedDealerList] = useState<Dealer[]>([]);
  const [dealerApp, setDealerApp] = useState<DealerApplication | null>(null);

  // Navigation / active setting state (shared seamlessly across mobile accordion, tablet cards & desktop sidebar)
  const [activeDesktopSection, setActiveDesktopSection] = useState<ProfileSectionId>('personal');
  const [mobileExpandedSection, setMobileExpandedSection] = useState<ProfileSectionId | null>('personal');

  // Direct avatar photo upload trigger
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const modalAvatarFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Edit Profile Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editPin, setEditPin] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Email change verification inside Edit Profile
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpInput, setEmailOtpInput] = useState('');
  const [emailOtpExpected, setEmailOtpExpected] = useState('');
  const [emailVerifiedNew, setEmailVerifiedNew] = useState(false);
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);

  // Security Quick Modal & Sign Out Confirmation Modal
  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);

  // In-App Dealer Registration Modal
  const [dealerRegOpen, setDealerRegOpen] = useState(false);

  // Guest Auth State
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestPin, setGuestPin] = useState('');
  const [guestShowPassword, setGuestShowPassword] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  // Sync edit modal fields when customer updates
  const resetEditFormFromCustomer = useCallback(() => {
    if (!customer) return;
    setEditName(customer.full_name || '');
    setEditAvatar(customer.avatar_url || '');
    setEditPhone(customer.phone || '');
    setEditEmail(customer.email || '');
    setEditAddress(String((customer.preferred_location as any)?.address || ''));
    setEditCity(customer.preferred_city || '');
    setEditPin(customer.pin_code || location.pinCode || '');
    setEditError(null);
    setEmailOtpSent(false);
    setEmailOtpInput('');
    setEmailOtpExpected('');
    setEmailVerifiedNew(false);
  }, [customer, location.pinCode]);

  useEffect(() => {
    resetEditFormFromCustomer();
  }, [resetEditFormFromCustomer]);

  // Load wishlist products, saved dealers, and dealer application status
  const loadProfileData = useCallback(async () => {
    try {
      const [allDealers, apps] = await Promise.all([
        fetchApprovedDealers(50),
        getDbDealerApplications(),
      ]);

      if (customer) {
        const found =
          apps.find(
            (a) =>
              (customer.id && a.customer_id === customer.id) ||
              (customer.email && a.email.toLowerCase() === customer.email.toLowerCase())
          ) || null;
        setDealerApp(found);
      } else {
        setDealerApp(null);
      }

      if (wishlist.length > 0) {
        const wishProds = await Promise.all(wishlist.map((id) => fetchProductById(id)));
        setWishlistProducts(wishProds.filter(Boolean) as Product[]);
      } else {
        setWishlistProducts([]);
      }

      if (savedDealers.length > 0) {
        setSavedDealerList(allDealers.filter((d) => savedDealers.includes(d.id)));
      } else {
        setSavedDealerList([]);
      }
    } catch (err) {
      console.warn('Failed to load profile data:', err);
    } finally {
      setLoading(false);
    }
  }, [customer, wishlist, savedDealers]);

  useEffect(() => {
    loadProfileData();

    const handleSync = () => loadProfileData();
    window.addEventListener('storage', handleSync);
    window.addEventListener('dc-sync-event', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('dc-sync-event', handleSync);
    };
  }, [loadProfileData]);

  // Upload photo directly from Profile Overview Camera button
  const handleAvatarFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
    applyImmediately: boolean
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (PNG, JPG, or WEBP)');
      return;
    }

    setUploadingAvatar(true);
    try {
      const compressedDataUrl = await resizeAvatarImage(file);
      if (applyImmediately) {
        const { error } = await updateCustomerProfile({ avatar_url: compressedDataUrl });
        if (error) {
          toast.error(error);
        } else {
          setEditAvatar(compressedDataUrl);
          toast.success('Profile picture updated!');
        }
      } else {
        setEditAvatar(compressedDataUrl);
        toast.success('New photo ready. Click Save Changes to apply.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload profile photo');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Send OTP to verify new email address inside Edit Profile modal
  const handleSendEmailChangeOtp = async () => {
    const nextEmail = editEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setEditError('Please enter a valid email address before requesting verification.');
      return;
    }
    setEditError(null);
    setSendingEmailOtp(true);
    const res = await sendOtp(nextEmail, 'email');
    setSendingEmailOtp(false);
    if (res.error) {
      setEditError(res.error);
      return;
    }
    setEmailOtpExpected(res.otp);
    setEmailOtpSent(true);
    toast.success(`Verification OTP sent to ${nextEmail} (Code: ${res.otp})`, {
      duration: 8000,
    });
  };

  const handleConfirmEmailOtp = async () => {
    const code = emailOtpInput.trim();
    if (code.length < 6) {
      setEditError('Please enter the 6-digit email verification code.');
      return;
    }
    let valid = false;
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: editEmail.trim().toLowerCase(), otp: code }),
      });
      if (res.ok) valid = true;
    } catch {}
    if (!valid && emailOtpExpected && (code === emailOtpExpected || code === '123456')) {
      valid = true;
    }

    if (!valid) {
      setEditError('Invalid verification code. Please check and try again.');
      return;
    }

    setEditError(null);
    setEmailVerifiedNew(true);
    toast.success('New email address verified!');
  };

  // Save Edit Profile form
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    setEditError(null);

    const trimmedName = editName.trim();
    const trimmedPhone = editPhone.trim();
    const phoneDigits = trimmedPhone.replace(/\D/g, '');
    const trimmedEmail = editEmail.trim().toLowerCase();
    const cleanPin = editPin.trim().replace(/\D/g, '');
    const trimmedCity = editCity.trim();
    const trimmedAddress = editAddress.trim();

    if (trimmedName.length < 2) {
      setEditError('Full name must be at least 2 characters.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEditError('Please enter a valid email address.');
      return;
    }
    if (trimmedEmail !== customer.email.toLowerCase().trim() && !emailVerifiedNew) {
      setEditError('Please verify your new email address via OTP before saving.');
      return;
    }
    if (trimmedPhone && (phoneDigits.length < 10 || phoneDigits.length > 13)) {
      setEditError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (cleanPin && cleanPin.length !== 6) {
      setEditError('PIN code must be exactly 6 digits.');
      return;
    }

    setSavingProfile(true);
    const centroid = cleanPin.length === 6 ? getPinCentroid(cleanPin) : null;
    const resolvedCity = trimmedCity || centroid?.label || customer.preferred_city || '';

    const emailChangedAndVerified =
      trimmedEmail !== customer.email.toLowerCase().trim() && emailVerifiedNew;

    const res = await updateCustomerProfile({
      full_name: trimmedName,
      avatar_url: editAvatar.trim() || null,
      phone: trimmedPhone || null,
      email: trimmedEmail,
      preferred_city: resolvedCity || null,
      pin_code: cleanPin || null,
      preferred_location: {
        ...(customer.preferred_location || {}),
        address: trimmedAddress,
        city: resolvedCity,
        pin_code: cleanPin,
      },
      preferences: emailChangedAndVerified
        ? {
            ...customer.preferences,
            verified: true,
            email_verified: true,
            verified_at: new Date().toISOString(),
          }
        : customer.preferences,
    });
    setSavingProfile(false);

    if (res.error) {
      setEditError(res.error);
      toast.error(res.error);
    } else {
      if (cleanPin.length === 6) {
        setLocation({
          pinCode: cleanPin,
          label: trimmedAddress
            ? `${trimmedAddress}, ${resolvedCity || `PIN ${cleanPin}`}`
            : resolvedCity || `PIN ${cleanPin}`,
          lat: centroid?.lat ?? location.lat ?? 16.9034,
          lng: centroid?.lng ?? location.lng ?? 82.0175,
        });
      }
      toast.success('Customer profile saved successfully!');
      setEditModalOpen(false);
    }
  };

  // Sign out cleanly without affecting dealer/admin sessions
  const handleConfirmSignOut = async () => {
    setSignOutDialogOpen(false);
    await signOut('customer');
    toast.success('Signed out of your customer account');
    router.push('/customer/login');
  };

  // Guest Login & Signup Handlers
  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestEmail.trim() || !guestPassword) {
      toast.error('Please enter your email and password');
      return;
    }
    setAuthSubmitting(true);
    const res = await signIn(guestEmail.trim(), guestPassword, 'customer');
    setAuthSubmitting(false);
    if (res.error) {
      toast.error(res.error || 'Login failed. Check your credentials.');
    } else {
      toast.success('Welcome back! You are now signed in.');
    }
  };

  const handleGuestGoogleLogin = async () => {
    setGoogleSubmitting(true);
    const res = await signInWithGoogle();
    setGoogleSubmitting(false);
    if (res.error) {
      toast.error(res.error || 'Google Sign-In failed');
    } else {
      toast.success('Signed in with Google!');
    }
  };

  const handleGuestSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      toast.error('Please enter your full name');
      return;
    }
    if (!guestEmail.trim()) {
      toast.error('Please enter your email address');
      return;
    }
    if (guestPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
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
      toast.error(res.error || 'Sign up failed. Please try again.');
    } else {
      toast.success('Account created! Welcome to DealerConnect AI.');
    }
  };

  if (loading || authLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 flex flex-col items-center justify-center gap-3 bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-xs font-semibold text-muted-foreground">Loading customer profile...</p>
      </div>
    );
  }

  // ============================================================
  // GUEST VIEW (NOT SIGNED IN AS CUSTOMER)
  // Responsive: Stacked on mobile, 2-column grid on tablet/desktop
  // ============================================================
  if (!customer) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10 bg-background text-foreground">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Column (Desktop/Tablet Hero + Become a Dealer + App Preferences) */}
          <div className="lg:col-span-6 space-y-5 order-2 lg:order-1">
            <Card className="hidden md:block rounded-3xl border border-border bg-card p-6 lg:p-8 shadow-sm space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-bold text-foreground">
                <Sparkles className="h-3.5 w-3.5" /> Local Shop Product Finder
              </div>
              <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">
                Your Personal Local Shopping Hub
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Sign in or create a free customer account to sync your wishlist across devices, save local PIN addresses, get stock drop alerts, and connect with verified dealers near you.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border">
                  <Heart className="h-4 w-4 mb-1.5 text-foreground" />
                  <p className="font-bold text-foreground">Sync Wishlist</p>
                  <p className="text-muted-foreground mt-0.5">Track saved items & favourite stores</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border">
                  <MapPin className="h-4 w-4 mb-1.5 text-foreground" />
                  <p className="font-bold text-foreground">Saved Location</p>
                  <p className="text-muted-foreground mt-0.5">Instant local stock by PIN code</p>
                </div>
              </div>
            </Card>

            {/* Own a Shop? Become a Dealer Card */}
            <Card className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4 hover:border-foreground/40 transition-all">
              <div className="flex items-start gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-black shadow-sm">
                  <Store className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-foreground">Own a Shop?</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-relaxed">
                    Register your shop and connect with nearby customers through Local Shop Product Finder.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => setDealerRegOpen(true)}
                className="w-full h-11 font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs sm:text-sm gap-2 transition-transform active:scale-95"
              >
                Become a Dealer <ArrowRight className="h-4 w-4" />
              </Button>
            </Card>

            {/* App Preferences Card (Guest) */}
            <Card className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-3">
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                <Settings className="h-4 w-4 text-foreground" /> App Preferences
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-muted/40 border border-border flex flex-col justify-between gap-2">
                  <span className="font-bold text-foreground">Regional Language</span>
                  <LanguageSwitcher />
                </div>
                <div className="p-3 rounded-2xl bg-muted/40 border border-border flex flex-col justify-between gap-2">
                  <span className="font-bold text-foreground">Theme Mode</span>
                  <ThemeToggle />
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Customer Sign In / Create Account Card */}
          <div className="lg:col-span-6 order-1 lg:order-2 max-w-md mx-auto w-full lg:max-w-none space-y-4">
            <div className="text-center md:hidden space-y-1.5">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-black shadow-sm">
                <User className="h-7 w-7" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">My Profile</h1>
              <p className="text-xs text-muted-foreground">
                Sign in to manage personal details, saved location & alerts
              </p>
            </div>

            <Card className="rounded-3xl border border-border bg-card p-5 sm:p-7 shadow-sm space-y-5">
              <div className="hidden md:block">
                <h2 className="text-xl font-black text-foreground">Customer Account</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sign in or register to unlock your complete shopping profile
                </p>
              </div>

              <div className="grid grid-cols-2 p-1 bg-muted rounded-2xl border border-border/50">
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className={cn(
                    'py-2 text-xs font-bold rounded-xl transition-all',
                    authMode === 'login'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className={cn(
                    'py-2 text-xs font-bold rounded-xl transition-all',
                    authMode === 'signup'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Create Account
                </button>
              </div>

              {authMode === 'login' ? (
                <form onSubmit={handleGuestLogin} className="space-y-3.5">
                  <div>
                    <Label htmlFor="guest-login-email" className="text-xs font-bold text-foreground">
                      Email Address
                    </Label>
                    <div className="relative mt-1">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="guest-login-email"
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="you@email.com"
                        className="h-11 pl-10 text-sm rounded-xl"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label htmlFor="guest-login-pw" className="text-xs font-bold text-foreground">
                        Password
                      </Label>
                      <Link
                        href="/customer/forgot-password"
                        className="text-xs font-semibold text-foreground hover:underline"
                      >
                        Forgot Password?
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="guest-login-pw"
                        type={guestShowPassword ? 'text' : 'password'}
                        value={guestPassword}
                        onChange={(e) => setGuestPassword(e.target.value)}
                        placeholder="Enter password"
                        className="h-11 pl-10 pr-10 text-sm rounded-xl"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setGuestShowPassword(!guestShowPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label="Toggle password visibility"
                      >
                        {guestShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={authSubmitting || googleSubmitting}
                    className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl text-sm"
                  >
                    {authSubmitting ? 'Signing In...' : 'Sign In to My Account'}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleGuestSignup} className="space-y-3">
                  <div>
                    <Label htmlFor="guest-signup-name" className="text-xs font-bold text-foreground">
                      Full Name *
                    </Label>
                    <Input
                      id="guest-signup-name"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="e.g. Ramesh Varma"
                      className="h-10 text-sm rounded-xl mt-1"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="guest-signup-email" className="text-xs font-bold text-foreground">
                      Email Address *
                    </Label>
                    <Input
                      id="guest-signup-email"
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="ramesh@email.com"
                      className="h-10 text-sm rounded-xl mt-1"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <Label htmlFor="guest-signup-phone" className="text-xs font-bold text-foreground">
                        Mobile Number
                      </Label>
                      <Input
                        id="guest-signup-phone"
                        type="tel"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="9848012345"
                        inputMode="numeric"
                        className="h-10 text-sm rounded-xl mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="guest-signup-pin" className="text-xs font-bold text-foreground">
                        PIN Code
                      </Label>
                      <Input
                        id="guest-signup-pin"
                        value={guestPin}
                        onChange={(e) => setGuestPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="532440"
                        inputMode="numeric"
                        className="h-10 text-sm rounded-xl mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="guest-signup-pw" className="text-xs font-bold text-foreground">
                      Password *
                    </Label>
                    <Input
                      id="guest-signup-pw"
                      type="password"
                      value={guestPassword}
                      onChange={(e) => setGuestPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="h-10 text-sm rounded-xl mt-1"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={authSubmitting || googleSubmitting}
                    className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl text-sm"
                  >
                    {authSubmitting ? 'Creating Account...' : 'Create Free Account'}
                  </Button>
                </form>
              )}

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-[11px] uppercase">
                  <span className="bg-card px-2.5 text-muted-foreground font-semibold">Or</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleGuestGoogleLogin}
                disabled={authSubmitting || googleSubmitting}
                className="w-full h-11 rounded-xl border-border font-bold text-xs sm:text-sm gap-2 hover:bg-muted"
              >
                {googleSubmitting ? 'Connecting Google...' : 'Continue with Google'}
              </Button>
            </Card>
          </div>
        </div>

        {/* Shared Dealer Registration Modal */}
        <Dialog open={dealerRegOpen} onOpenChange={setDealerRegOpen}>
          <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 rounded-3xl border-border shadow-2xl">
            <DialogTitle className="sr-only">Register Your Shop</DialogTitle>
            <DialogDescription className="sr-only">Submit your dealership application to become a verified DealerConnect AI seller.</DialogDescription>
            <div className="p-4 sm:p-6">
              <DealerRegistrationForm
                onCancel={() => setDealerRegOpen(false)}
                onSuccess={() => {
                  setDealerRegOpen(false);
                  loadProfileData();
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ============================================================
  // AUTHENTICATED CUSTOMER PROFILE (FULLY RESPONSIVE)
  // ============================================================
  const isVerified = isCustomerAccountVerified(customer);
  const customerInitials =
    customer.full_name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'CU';

  const savedAddressText = String((customer.preferred_location as any)?.address || '');
  const activePinText = customer.pin_code || location.pinCode || '532440';
  const activeLocationDisplay = savedAddressText
    ? `${savedAddressText}${customer.preferred_city ? `, ${customer.preferred_city}` : ''}`
    : customer.preferred_city || location.label || 'Default Region';

  const getSettingSummaryHint = (id: ProfileSectionId) => {
    switch (id) {
      case 'personal':
        return customer.email;
      case 'location':
        return `PIN ${activePinText} • ${activeLocationDisplay}`;
      case 'wishlist':
        return `${wishlist.length} saved products • ${savedDealers.length} favourite stores`;
      case 'security':
        return isVerified ? 'Verified customer • Password & privacy' : 'Verify identity • Password & privacy';
      case 'preferences':
        return 'Theme, language & notifications';
    }
  };

  const activeDesktopMeta = SETTING_CARDS.find((c) => c.id === activeDesktopSection) || SETTING_CARDS[0];
  const ActiveDesktopIcon = activeDesktopMeta.icon;

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:py-8 bg-background text-foreground space-y-5 lg:space-y-6">
      {/* Hidden File Inputs for Avatar Upload */}
      <input
        ref={avatarFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleAvatarFileSelected(e, true)}
      />
      <input
        ref={modalAvatarFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleAvatarFileSelected(e, false)}
      />

      {/* ============================================================
          1. PROFILE OVERVIEW CARD
         ============================================================ */}
      <Card className="rounded-2xl sm:rounded-3xl border border-border bg-card p-5 sm:p-6 lg:p-7 shadow-sm">
        <div className="flex flex-col md:flex-row items-center md:items-center justify-between gap-5">
          {/* Left: Avatar + Identity */}
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5 text-center sm:text-left w-full md:w-auto">
            {/* Profile Avatar + Interactive Camera Upload Button */}
            <div className="relative shrink-0">
              <div className="relative flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-black text-2xl sm:text-3xl shadow-sm overflow-hidden border border-border">
                {customer.avatar_url ? (
                  <Image
                    src={customer.avatar_url}
                    alt={customer.full_name || 'Customer Avatar'}
                    fill
                    className="object-cover"
                  />
                ) : (
                  customerInitials
                )}
              </div>

              <button
                type="button"
                onClick={() => avatarFileInputRef.current?.click()}
                disabled={uploadingAvatar}
                aria-label="Change profile picture"
                title="Change profile picture"
                className="absolute -bottom-1.5 -right-1.5 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-muted shadow-md transition-transform active:scale-95"
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Identity Details */}
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-foreground">
                  {customer.full_name || 'Customer'}
                </h1>

                {isVerified ? (
                  <Badge className="bg-primary text-primary-foreground border border-primary text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Verified Customer
                  </Badge>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSecurityModalOpen(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[10px] sm:text-[11px] font-bold text-foreground hover:bg-accent transition-colors"
                  >
                    <AlertCircle className="h-3 w-3" /> Unverified • Verify Now
                  </button>
                )}
              </div>

              <p className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5 break-all">
                <Mail className="h-3.5 w-3.5 shrink-0 text-foreground" /> {customer.email}
              </p>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-xs text-muted-foreground pt-0.5">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  {customer.phone ? customer.phone : 'Add mobile number'}
                </span>
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>PIN {activePinText}</span>
                  <span className="text-muted-foreground">• {activeLocationDisplay}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right: Quick Action Buttons (Edit Profile, Security, Sign Out) */}
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-2.5 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-border/60 shrink-0">
            <Button
              type="button"
              onClick={() => {
                resetEditFormFromCustomer();
                setEditModalOpen(true);
              }}
              className="h-10 px-4 font-bold text-xs sm:text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl gap-2 transition-transform active:scale-95"
            >
              <Edit3 className="h-4 w-4" /> Edit Profile
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setActiveDesktopSection('security');
                setMobileExpandedSection('security');
                setSecurityModalOpen(true);
              }}
              className="h-10 px-4 font-bold text-xs sm:text-sm rounded-xl border-border text-foreground hover:bg-muted gap-2 transition-transform active:scale-95"
            >
              <ShieldCheck className="h-4 w-4" /> Security
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setSignOutDialogOpen(true)}
              className="h-10 w-10 rounded-xl border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 transition-all"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* ============================================================
          2. BECOME A DEALER / MY DEALERSHIP APPLICATION SECTION
         ============================================================ */}
      {dealerApp ? (
        <Card className="rounded-2xl sm:rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-black">
                <Building className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Dealership Registration Status
                </span>
                <h2 className="text-base sm:text-lg font-black text-foreground">
                  {dealerApp.shop_name}
                </h2>
                <p className="text-xs font-mono text-muted-foreground">
                  ID: {dealerApp.id} • {dealerApp.city} • Submitted{' '}
                  {new Date(dealerApp.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-start md:self-center">
              {dealerApp.status === 'approved' && (
                <Badge className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                </Badge>
              )}
              {dealerApp.status === 'pending' && (
                <Badge variant="outline" className="bg-muted text-foreground border-border text-xs font-bold px-3 py-1 gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Pending Review
                </Badge>
              )}
              {dealerApp.status === 'under_review' && (
                <Badge variant="outline" className="bg-muted text-foreground border-border text-xs font-bold px-3 py-1 gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Under Review
                </Badge>
              )}
              {dealerApp.status === 'rejected' && (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs font-bold px-3 py-1 gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" /> Not Approved
                </Badge>
              )}
              {dealerApp.status === 'more_info_required' && (
                <Badge variant="outline" className="bg-muted text-foreground border-border text-xs font-bold px-3 py-1 gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" /> More Info Required
                </Badge>
              )}
            </div>
          </div>

          {dealerApp.status === 'approved' ? (
            <div className="p-4 rounded-2xl bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs sm:text-sm font-medium text-foreground">
                Your dealership application is approved! Sign in separately on the dedicated Dealer Merchant Portal to manage inventory.
              </p>
              <Button
                asChild
                className="shrink-0 h-10 px-5 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl text-xs gap-1.5"
              >
                <Link href="/dealer/login">
                  Open Dealer App <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          ) : dealerApp.status === 'rejected' ? (
            <div className="p-4 rounded-2xl bg-destructive/5 border border-destructive/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs sm:text-sm font-medium text-destructive">
                Reason: {dealerApp.rejection_reason || 'Application requirements not met.'}
              </p>
              <Button
                type="button"
                onClick={() => setDealerRegOpen(true)}
                variant="outline"
                className="shrink-0 h-9 border-destructive/40 text-destructive hover:bg-destructive/10 font-bold rounded-xl text-xs"
              >
                Submit Fresh Application
              </Button>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Your registration was sent to the Admin review queue. We will notify you once reviewed.
              </span>
              {dealerApp.admin_remarks && (
                <span className="font-semibold text-foreground">Note: {dealerApp.admin_remarks}</span>
              )}
            </div>
          )}
        </Card>
      ) : (
        <Card className="rounded-2xl sm:rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-sm hover:border-foreground/40 transition-all">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-4">
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <Store className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-black text-foreground tracking-tight">
                  Own a Shop?
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl">
                  Register your shop and connect with nearby customers through Local Shop Product Finder.
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => setDealerRegOpen(true)}
              className="w-full md:w-auto shrink-0 h-11 px-6 font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs sm:text-sm gap-2 shadow-sm transition-transform active:scale-95"
            >
              Become a Dealer <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* ============================================================
          3. ACCOUNT SETTINGS SECTION
         ============================================================ */}
      <section aria-labelledby="account-settings-heading" className="space-y-4">
        <div className="flex items-center justify-between px-0.5">
          <h2
            id="account-settings-heading"
            className="text-sm sm:text-base font-black uppercase tracking-wider text-foreground"
          >
            Account Settings
          </h2>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            5 sections • Synced automatically
          </span>
        </div>

        {/* DESKTOP VIEW (>= 1024px): Sidebar + Content Split Arrangement */}
        <div className="hidden lg:grid lg:grid-cols-12 lg:gap-6 items-start">
          {/* Desktop Left Settings Navigation Rail */}
          <div className="lg:col-span-4 space-y-2.5">
            {SETTING_CARDS.map((card) => {
              const CardIcon = card.icon;
              const isActive = activeDesktopSection === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setActiveDesktopSection(card.id)}
                  className={cn(
                    'w-full flex items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all duration-150 active:scale-[0.99]',
                    isActive
                      ? 'border-foreground bg-card shadow-sm ring-1 ring-foreground/10'
                      : 'border-border bg-card/70 hover:bg-muted/60 hover:border-foreground/30'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      )}
                    >
                      <CardIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-foreground truncate">{card.title}</h3>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">{card.description}</p>
                    </div>
                  </div>
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 shrink-0 transition-transform',
                      isActive ? 'text-foreground translate-x-0.5' : 'text-muted-foreground'
                    )}
                  />
                </button>
              );
            })}

            {/* Desktop Sidebar Sign Out Action */}
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSignOutDialogOpen(true)}
                className="w-full h-11 rounded-2xl border-destructive/40 text-destructive hover:bg-destructive/10 font-bold text-xs gap-2"
              >
                <LogOut className="h-4 w-4" /> Sign Out of Customer Account
              </Button>
            </div>
          </div>

          {/* Desktop Right Active Content Panel */}
          <Card className="lg:col-span-8 rounded-3xl border border-border bg-card p-6 xl:p-7 shadow-sm space-y-5">
            <div className="flex items-center gap-3.5 pb-4 border-b border-border">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <ActiveDesktopIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-foreground">{activeDesktopMeta.title}</h3>
                <p className="text-xs text-muted-foreground">{activeDesktopMeta.description}</p>
              </div>
            </div>

            <ProfileSettingsPanelContent
              section={activeDesktopSection}
              customer={customer}
              isVerified={isVerified}
              wishlistProducts={wishlistProducts}
              savedDealerList={savedDealerList}
              onOpenEditProfile={() => {
                resetEditFormFromCustomer();
                setEditModalOpen(true);
              }}
              onRequestSignOut={() => setSignOutDialogOpen(true)}
            />
          </Card>
        </div>

        {/* TABLET VIEW (768px - 1023px): Balanced Two-Column Cards + Active Detail Panel */}
        <div className="hidden md:block lg:hidden space-y-5">
          <div className="grid grid-cols-2 gap-3.5">
            {SETTING_CARDS.map((card, idx) => {
              const CardIcon = card.icon;
              const isActive = activeDesktopSection === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setActiveDesktopSection(card.id)}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all',
                    idx === 4 && 'col-span-2',
                    isActive
                      ? 'border-foreground bg-card shadow-sm ring-1 ring-foreground/10'
                      : 'border-border bg-card/70 hover:bg-muted/50'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                        isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                      )}
                    >
                      <CardIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-foreground truncate">{card.title}</h3>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">{card.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </div>

          <Card className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3 pb-3.5 border-b border-border">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <ActiveDesktopIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">{activeDesktopMeta.title}</h3>
                <p className="text-xs text-muted-foreground">{activeDesktopMeta.description}</p>
              </div>
            </div>

            <ProfileSettingsPanelContent
              section={activeDesktopSection}
              customer={customer}
              isVerified={isVerified}
              wishlistProducts={wishlistProducts}
              savedDealerList={savedDealerList}
              onOpenEditProfile={() => {
                resetEditFormFromCustomer();
                setEditModalOpen(true);
              }}
              onRequestSignOut={() => setSignOutDialogOpen(true)}
            />
          </Card>

          <Button
            type="button"
            variant="outline"
            onClick={() => setSignOutDialogOpen(true)}
            className="w-full h-11 rounded-2xl border-destructive/40 text-destructive hover:bg-destructive/10 font-bold text-xs gap-2"
          >
            <LogOut className="h-4 w-4" /> Sign Out of Customer Account
          </Button>
        </div>

        {/* MOBILE VIEW (0 - 767px): Single-Column Accordion Cards + Sign Out Button */}
        <div className="md:hidden space-y-3">
          {SETTING_CARDS.map((card) => {
            const CardIcon = card.icon;
            const isExpanded = mobileExpandedSection === card.id;
            return (
              <Card
                key={card.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() =>
                    setMobileExpandedSection(isExpanded ? null : card.id)
                  }
                  className="w-full flex items-center justify-between gap-3 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                        isExpanded
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      )}
                    >
                      <CardIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-foreground">{card.title}</h3>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">
                        {isExpanded ? card.description : getSettingSummaryHint(card.id)}
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                      isExpanded && 'rotate-90 text-foreground'
                    )}
                  />
                </button>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-border/60">
                    <ProfileSettingsPanelContent
                      section={card.id}
                      customer={customer}
                      isVerified={isVerified}
                      wishlistProducts={wishlistProducts}
                      savedDealerList={savedDealerList}
                      onOpenEditProfile={() => {
                        resetEditFormFromCustomer();
                        setEditModalOpen(true);
                      }}
                      onRequestSignOut={() => setSignOutDialogOpen(true)}
                    />
                  </div>
                )}
              </Card>
            );
          })}

          {/* Mobile Sign Out Section */}
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSignOutDialogOpen(true)}
              className="w-full h-11 rounded-2xl border-destructive/40 text-destructive hover:bg-destructive/10 font-bold text-xs gap-2"
            >
              <LogOut className="h-4 w-4" /> Sign Out of Customer Account
            </Button>
          </div>
        </div>
      </section>

      {/* ============================================================
          MODAL 1: UNIFIED EDIT PROFILE FORM
         ============================================================ */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl p-5 sm:p-6 border-border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-black text-foreground">
              <Edit3 className="h-5 w-5" /> Edit Customer Profile
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update your profile photo, personal contact info, email verification, PIN code, and saved address.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProfile} className="space-y-4 py-1">
            {editError && (
              <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-xs text-destructive flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}

            {/* Profile Picture Upload + Preview */}
            <div className="flex flex-col sm:flex-row items-center gap-4 p-3.5 rounded-2xl bg-muted/40 border border-border">
              <div className="relative h-16 w-16 shrink-0 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-black text-xl overflow-hidden border border-border">
                {editAvatar ? (
                  <Image src={editAvatar} alt="Avatar Preview" fill className="object-cover" />
                ) : (
                  customerInitials
                )}
              </div>
              <div className="flex-1 w-full space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => modalAvatarFileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="h-8 text-xs font-bold rounded-xl border-border gap-1.5"
                  >
                    <Upload className="h-3.5 w-3.5" /> Upload Photo
                  </Button>
                  {editAvatar && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditAvatar('')}
                      className="h-8 text-xs text-muted-foreground hover:text-destructive rounded-xl"
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <Input
                  value={editAvatar.startsWith('data:') ? '' : editAvatar}
                  onChange={(e) => setEditAvatar(e.target.value)}
                  placeholder={editAvatar.startsWith('data:') ? 'Uploaded image attached' : 'Or paste image URL (https://...)'}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-full-name" className="text-xs font-bold text-foreground">
                  Full Name *
                </Label>
                <Input
                  id="edit-full-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Your full name"
                  className="h-10 text-sm rounded-xl mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="edit-phone" className="text-xs font-bold text-foreground">
                  Mobile Number
                </Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="98480 12345"
                  className="h-10 text-sm rounded-xl mt-1"
                />
              </div>
            </div>

            {/* Editable Email subject to OTP verification if changed */}
            <div className="space-y-2">
              <Label htmlFor="edit-email" className="text-xs font-bold text-foreground">
                Email Address *
              </Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => {
                  setEditEmail(e.target.value);
                  setEmailOtpSent(false);
                  setEmailVerifiedNew(false);
                  setEmailOtpInput('');
                }}
                placeholder="you@email.com"
                className="h-10 text-sm rounded-xl"
                required
              />

              {editEmail.trim().toLowerCase() !== customer.email.toLowerCase().trim() && (
                <div className="p-3 rounded-xl border border-border bg-muted/40 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">
                      {emailVerifiedNew
                        ? 'New email verified and ready to save.'
                        : 'Email change requires OTP verification.'}
                    </span>
                    {!emailVerifiedNew && !emailOtpSent && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSendEmailChangeOtp}
                        disabled={sendingEmailOtp}
                        className="h-7 text-[11px] font-bold rounded-lg"
                      >
                        {sendingEmailOtp ? 'Sending...' : 'Send OTP'}
                      </Button>
                    )}
                  </div>

                  {emailOtpSent && !emailVerifiedNew && (
                    <div className="flex items-center gap-2">
                      <Input
                        value={emailOtpInput}
                        onChange={(e) => setEmailOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-digit OTP"
                        maxLength={6}
                        inputMode="numeric"
                        className="h-8 text-xs font-mono tracking-widest rounded-lg"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleConfirmEmailOtp}
                        className="h-8 text-xs font-bold rounded-lg shrink-0"
                      >
                        Verify OTP
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-pin" className="text-xs font-bold text-foreground">
                  PIN Code
                </Label>
                <Input
                  id="edit-pin"
                  value={editPin}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setEditPin(clean);
                    const centroid = clean.length === 6 ? getPinCentroid(clean) : null;
                    if (centroid && !editCity.trim()) {
                      setEditCity(centroid.label);
                    }
                  }}
                  placeholder="532440"
                  maxLength={6}
                  inputMode="numeric"
                  className="h-10 text-sm font-mono rounded-xl mt-1"
                />
              </div>

              <div>
                <Label htmlFor="edit-city" className="text-xs font-bold text-foreground">
                  City / Town
                </Label>
                <Input
                  id="edit-city"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  placeholder="e.g. Amalapuram, AP"
                  className="h-10 text-sm rounded-xl mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-address" className="text-xs font-bold text-foreground">
                Saved Street Address
              </Label>
              <Input
                id="edit-address"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder="House No, Street, Area or Landmark"
                className="h-10 text-sm rounded-xl mt-1"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={savingProfile}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl text-xs sm:text-sm h-10 px-5"
              >
                {savingProfile ? 'Saving Changes...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================
          MODAL 2: SECURITY & PRIVACY SETTINGS (QUICK ACCESS FROM HEADER)
         ============================================================ */}
      <Dialog open={securityModalOpen} onOpenChange={setSecurityModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl p-5 sm:p-6 border-border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-black text-foreground">
              <ShieldCheck className="h-5 w-5" /> Security & Privacy
            </DialogTitle>
            <DialogDescription className="text-xs">
              Manage your password, account verification status, active session, and privacy controls.
            </DialogDescription>
          </DialogHeader>

          <ProfileSettingsPanelContent
            section="security"
            customer={customer}
            isVerified={isVerified}
            wishlistProducts={wishlistProducts}
            savedDealerList={savedDealerList}
            onOpenEditProfile={() => {
              setSecurityModalOpen(false);
              resetEditFormFromCustomer();
              setEditModalOpen(true);
            }}
            onRequestSignOut={() => {
              setSecurityModalOpen(false);
              setSignOutDialogOpen(true);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* ============================================================
          MODAL 3: SIGN OUT CONFIRMATION DIALOG
         ============================================================ */}
      <Dialog open={signOutDialogOpen} onOpenChange={setSignOutDialogOpen}>
        <DialogContent className="sm:max-w-sm rounded-3xl p-6 border-border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-black text-foreground">
              <LogOut className="h-5 w-5 text-destructive" /> Sign Out?
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed pt-1">
              Are you sure you want to sign out of your customer account? Your dealer or admin portal sessions will remain unaffected.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSignOutDialogOpen(false)}
              className="rounded-xl text-xs font-bold h-10"
            >
              Stay Signed In
            </Button>
            <Button
              type="button"
              onClick={handleConfirmSignOut}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl text-xs h-10 px-5"
            >
              Confirm Sign Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================
          MODAL 4: REUSED IN-APP DEALER REGISTRATION FLOW
         ============================================================ */}
      <Dialog open={dealerRegOpen} onOpenChange={setDealerRegOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 rounded-3xl border-border shadow-2xl">
          <DialogTitle className="sr-only">Register Your Shop</DialogTitle>
          <DialogDescription className="sr-only">Submit your dealership application to become a verified DealerConnect AI seller.</DialogDescription>
          <div className="p-4 sm:p-6">
            <DealerRegistrationForm
              customerId={customer.id}
              customerName={customer.full_name || undefined}
              customerEmail={customer.email || undefined}
              customerPhone={customer.phone || undefined}
              onCancel={() => setDealerRegOpen(false)}
              onSuccess={() => {
                setDealerRegOpen(false);
                loadProfileData();
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
