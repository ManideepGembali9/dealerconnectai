'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  User,
  Heart,
  MapPin,
  Bell,
  Store,
  Package,
  LogOut,
  Settings,
  ShoppingBag,
  Clock,
  Star,
  Trash2,
  ChevronRight,
  Sparkles,
  Phone,
  MessageSquare,
  ShieldCheck,
  Edit3,
  CheckCircle2,
  Lock,
  Mail,
  Navigation,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
  ArrowRight,
  ShoppingCart,
  Building,
  Check,
  AlertCircle,
  X,
  ExternalLink,
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
import { useApp } from '@/lib/providers';
import { useAuth } from '@/lib/auth';
import { fetchProductById, fetchApprovedDealers } from '@/lib/data';
import {
  getDbDealerApplications,
  getDbDealerApplicationByCustomerId,
} from '@/lib/firebase-db';
import { ProductCard } from '@/components/product-card';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { getPinCentroid } from '@/lib/geo';
import type { Product, Dealer, DealerApplication } from '@/lib/types';
import { formatINR, getEffectivePrice } from '@/lib/format';
import { toast } from 'sonner';

export function ProfileClient() {
  const router = useRouter();
  const {
    role,
    customer,
    signOut,
    updateCustomerProfile,
    changePassword,
    signIn,
    signUpCustomer,
  } = useAuth();
  const {
    wishlist,
    savedDealers,
    location,
    setLocation,
    toggleWishlist,
    toggleSavedDealer,
    t,
  } = useApp();

  const [loading, setLoading] = useState(true);
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
  const [savedDealerList, setSavedDealerList] = useState<Dealer[]>([]);
  const [dealerApp, setDealerApp] = useState<DealerApplication | null>(null);

  // Active accordion / expanded section (1: personal, 2: location, 3: wishlist, 4: security, 5: preferences)
  const [expandedSection, setExpandedSection] = useState<string | null>('personal');

  // Single Unified Edit Profile Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editPin, setEditPin] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Security / Change Password Modal
  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // In-App Dealer Registration Sheet/Modal
  const [dealerRegOpen, setDealerRegOpen] = useState(false);

  // Location setting state
  const [pinInput, setPinInput] = useState(location.pinCode ?? '532440');

  // Guest Auth State
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestPin, setGuestPin] = useState('');
  const [guestShowPassword, setGuestShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Sync profile state when customer changes
  useEffect(() => {
    if (customer) {
      setEditName(customer.full_name || '');
      setEditAvatar(customer.avatar_url || '');
      setEditPhone(customer.phone || '');
      setEditEmail(customer.email || '');
      setEditCity(customer.preferred_city || '');
      setEditPin(customer.pin_code || '');
      setPinInput(customer.pin_code || location.pinCode || '532440');
    }
  }, [customer, location.pinCode]);

  // Load wishlist products, saved dealers, and dealer application status
  const loadProfileData = useCallback(async () => {
    try {
      const [allDealers, apps] = await Promise.all([
        fetchApprovedDealers(50),
        getDbDealerApplications(),
      ]);

      // Check dealer application for current customer
      if (customer) {
        const found =
          apps.find(
            (a) =>
              (customer.id && a.customer_id === customer.id) ||
              (customer.email && a.email.toLowerCase() === customer.email.toLowerCase())
          ) || null;
        setDealerApp(found);
      }

      // Wishlist products
      if (wishlist.length > 0) {
        const wishProds = await Promise.all(wishlist.map((id) => fetchProductById(id)));
        setWishlistProducts(wishProds.filter(Boolean) as Product[]);
      } else {
        setWishlistProducts([]);
      }

      // Saved dealers
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

  // Handle location update
  const handleUpdatePin = (pin: string) => {
    const cleanPin = pin.replace(/\D/g, '').slice(0, 6);
    setPinInput(cleanPin);
    if (cleanPin.length === 6) {
      const c = getPinCentroid(cleanPin);
      const newLoc = {
        pinCode: cleanPin,
        label:
          c?.label ??
          (cleanPin === '532440'
            ? 'Amalapuram, AP'
            : cleanPin === '533001'
            ? 'Kakinada, AP'
            : `PIN ${cleanPin}`),
        lat: cleanPin === '532440' ? 16.9034 : cleanPin === '533001' ? 16.9891 : 16.95,
        lng: cleanPin === '532440' ? 82.0175 : cleanPin === '533001' ? 82.2475 : 82.1,
      };
      setLocation(newLoc);
      if (customer) {
        updateCustomerProfile({
          preferred_city: newLoc.label,
          pin_code: cleanPin,
        });
      }
      toast.success(`Active delivery area set to PIN ${cleanPin}`);
    }
  };

  const handleUseGps = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newLoc = {
            pinCode: null,
            label: 'Current Live GPS',
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          setLocation(newLoc);
          toast.success('Location set to your live GPS position');
        },
        () => {
          handleUpdatePin('532440');
        }
      );
    }
  };

  // Handle single unified profile save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    setSavingProfile(true);
    const cleanPin = editPin.trim().replace(/\D/g, '').slice(0, 6);
    const res = await updateCustomerProfile({
      full_name: editName.trim(),
      avatar_url: editAvatar.trim() || undefined,
      phone: editPhone.trim(),
      preferred_city: editCity.trim(),
      pin_code: cleanPin,
    });
    setSavingProfile(false);

    if (res.error) {
      toast.error(res.error);
    } else {
      if (cleanPin.length === 6) {
        setLocation({
          pinCode: cleanPin,
          label: `${editCity || 'Location'} (PIN ${cleanPin})`,
          lat: 16.9034,
          lng: 82.0175,
        });
      }
      toast.success('Profile updated successfully!');
      setEditModalOpen(false);
    }
  };

  // Handle password update
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setSavingPassword(true);
    const res = await changePassword(newPassword);
    setSavingPassword(false);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success('Password changed successfully');
      setSecurityModalOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
    router.push('/');
  };

  // Guest Handlers
  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestEmail.trim() || !guestPassword) {
      toast.error('Please enter your email and password');
      return;
    }
    setAuthLoading(true);
    const res = await signIn(guestEmail.trim(), guestPassword, 'customer');
    setAuthLoading(false);
    if (res.error) {
      toast.error(res.error || 'Login failed. Check your credentials.');
    } else {
      toast.success('Welcome back! You are now signed in.');
    }
  };

  const handleGuestSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      toast.error('Please enter your full name');
      return;
    }
    if (!guestEmail.trim()) {
      toast.error('Please enter your email');
      return;
    }
    if (guestPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setAuthLoading(true);
    const res = await signUpCustomer(
      guestEmail.trim(),
      guestPassword,
      guestName.trim(),
      guestPhone.trim(),
      guestPin.trim()
    );
    setAuthLoading(false);
    if (res.error) {
      toast.error(res.error || 'Sign up failed. Please try again.');
    } else {
      toast.success('Account created! Welcome to DealerConnect AI.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // ============================================================
  // GUEST VIEW (IF NOT SIGNED IN AS CUSTOMER)
  // ============================================================
  if (role !== 'customer' || !customer) {
    return (
      <div className="mx-auto max-w-md px-4 py-8 bg-background text-foreground min-h-[85vh] flex flex-col justify-center space-y-5">
        <div className="text-center space-y-1">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-black shadow-md">
            <User className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Customer Profile
          </h1>
          <p className="text-xs text-muted-foreground">
            Sign in to track orders, save nearby shops, and manage deliveries
          </p>
        </div>

        <Card className="rounded-3xl border border-border bg-card p-6 shadow-xl space-y-4">
          <div className="grid grid-cols-2 p-1 bg-muted/60 rounded-2xl">
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                authMode === 'login'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('signup')}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                authMode === 'signup'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Create Account
            </button>
          </div>

          {authMode === 'login' ? (
            <form onSubmit={handleGuestLogin} className="space-y-3.5">
              <div>
                <Label className="text-xs font-bold text-foreground">Email Address</Label>
                <div className="relative mt-1">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
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
                  <Label className="text-xs font-bold text-foreground">Password</Label>
                  <Link
                    href="/customer/forgot-password"
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    Forgot?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type={guestShowPassword ? 'text' : 'password'}
                    value={guestPassword}
                    onChange={(e) => setGuestPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="h-11 pl-10 pr-10 text-sm rounded-xl"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setGuestShowPassword(!guestShowPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {guestShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={authLoading}
                className="w-full h-11 bg-primary text-primary-foreground font-bold rounded-xl text-sm mt-2"
              >
                {authLoading ? 'Signing In...' : 'Sign In to My Account'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleGuestSignup} className="space-y-3">
              <div>
                <Label className="text-xs font-bold text-foreground">Full Name *</Label>
                <Input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="e.g. Ramesh Varma"
                  className="h-10 text-sm rounded-xl mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-foreground">Email Address *</Label>
                <Input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="ramesh@email.com"
                  className="h-10 text-sm rounded-xl mt-1"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-bold text-foreground">Phone Number</Label>
                  <Input
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="98480 12345"
                    className="h-10 text-sm rounded-xl mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-foreground">PIN Code</Label>
                  <Input
                    value={guestPin}
                    onChange={(e) => setGuestPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="532440"
                    className="h-10 text-sm rounded-xl mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-foreground">Password *</Label>
                <Input
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
                disabled={authLoading}
                className="w-full h-11 bg-primary text-primary-foreground font-bold rounded-xl text-sm mt-2"
              >
                {authLoading ? 'Creating Account...' : 'Create Free Account'}
              </Button>
            </form>
          )}
        </Card>

        {/* BECOME A DEALER CARD (GUEST) */}
        <Card className="rounded-3xl border border-primary/30 bg-primary/5 p-5 shadow-sm space-y-3">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-black shadow-sm">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-foreground">Own a Shop?</h3>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Register your shop and connect with nearby customers through Local Shop Product Finder.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => setDealerRegOpen(true)}
            className="w-full h-10 font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs gap-1.5"
          >
            Become a Dealer <ArrowRight className="h-4 w-4" />
          </Button>
        </Card>

        {/* APP PREFERENCES (GUEST) */}
        <Card className="rounded-3xl border border-border bg-card p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-black text-foreground flex items-center gap-2">
            <Settings className="h-4 w-4 text-foreground" /> App Preferences
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-muted/40 border border-border/60 flex flex-col justify-between gap-2">
              <span className="font-bold text-foreground">Language</span>
              <LanguageSwitcher />
            </div>
            <div className="p-3 rounded-2xl bg-muted/40 border border-border/60 flex flex-col justify-between gap-2">
              <span className="font-bold text-foreground">Theme</span>
              <ThemeToggle />
            </div>
          </div>
        </Card>

        {/* Dealer Registration Modal */}
        <Dialog open={dealerRegOpen} onOpenChange={setDealerRegOpen}>
          <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 rounded-3xl border-border shadow-2xl">
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
  // AUTHENTICATED CUSTOMER PROFILE (MOBILE-APP STYLE LAYOUT)
  // ============================================================
  const customerInitials =
    customer.full_name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'CU';

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 bg-background text-foreground min-h-screen space-y-5 pb-28">
      
      {/* ============================================================
          1. PROFILE HEADER
         ============================================================ */}
      <Card className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-5 text-center sm:text-left">
          
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Avatar with Photo or Initials */}
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-black text-2xl shadow-md overflow-hidden">
              {customer.avatar_url ? (
                <Image
                  src={customer.avatar_url}
                  alt={customer.full_name || 'Profile'}
                  fill
                  className="object-cover"
                />
              ) : (
                customerInitials
              )}
              <div
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-background border border-border text-foreground shadow-sm"
                title="Verified Customer"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              </div>
            </div>

            {/* Customer Details */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-foreground">
                  {customer.full_name || 'Customer'}
                </h1>
                <Badge className="bg-primary/15 text-primary border border-primary/20 font-black uppercase text-[10px] px-2 py-0.5">
                  Verified Customer
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {customer.email}
              </p>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-muted-foreground pt-0.5">
                {customer.phone && (
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <Phone className="h-3.5 w-3.5" /> {customer.phone}
                  </span>
                )}
                {(customer.pin_code || location.pinCode) && (
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <MapPin className="h-3.5 w-3.5" /> PIN {customer.pin_code || location.pinCode}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Header Action Buttons: One Edit Profile, One Security, Sign Out */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
            <Button
              onClick={() => setEditModalOpen(true)}
              size="sm"
              className="h-9 px-3.5 font-bold text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl gap-1.5"
            >
              <Edit3 className="h-3.5 w-3.5" /> Edit Profile
            </Button>
            <Button
              onClick={() => setSecurityModalOpen(true)}
              size="sm"
              variant="outline"
              className="h-9 px-3 font-bold text-xs rounded-xl border-border gap-1.5"
            >
              <Lock className="h-3.5 w-3.5" /> Security
            </Button>
            <Button
              onClick={handleSignOut}
              size="sm"
              variant="ghost"
              className="h-9 px-2.5 font-bold text-xs text-muted-foreground hover:text-destructive rounded-xl"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* ============================================================
          2. BECOME A DEALER / MY DEALER APPLICATION CARD
         ============================================================ */}
      {dealerApp ? (
        <Card className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary font-black">
                <Building className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  My Dealership Application
                </span>
                <h3 className="text-base font-black text-foreground">{dealerApp.shop_name}</h3>
                <span className="text-xs font-mono text-muted-foreground">
                  ID: {dealerApp.id} • {new Date(dealerApp.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Status Badge */}
            {dealerApp.status === 'approved' && (
              <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-xs font-bold gap-1">
                <CheckCircle2 className="h-3 w-3" /> Approved
              </Badge>
            )}
            {dealerApp.status === 'pending' && (
              <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-xs font-bold gap-1">
                <Clock className="h-3 w-3" /> Pending Review
              </Badge>
            )}
            {dealerApp.status === 'under_review' && (
              <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 text-xs font-bold gap-1">
                <Sparkles className="h-3 w-3" /> Under Review
              </Badge>
            )}
            {dealerApp.status === 'rejected' && (
              <Badge className="bg-rose-500/15 text-rose-600 border-rose-500/30 text-xs font-bold gap-1">
                <AlertCircle className="h-3 w-3" /> Not Approved
              </Badge>
            )}
            {dealerApp.status === 'more_info_required' && (
              <Badge className="bg-purple-500/15 text-purple-600 border-purple-500/30 text-xs font-bold gap-1">
                <AlertCircle className="h-3 w-3" /> Info Required
              </Badge>
            )}
          </div>

          {/* Admin Remarks / Status Notice */}
          {dealerApp.status === 'approved' ? (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400 space-y-2">
              <p className="font-semibold">
                🎉 Congratulations! Your dealership has been approved. You now have full access to the dedicated Dealer Merchant Console.
              </p>
              <Button
                asChild
                className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs gap-1.5"
              >
                <Link href="/dealer/login">
                  Open Dealer App <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          ) : dealerApp.status === 'rejected' ? (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-400 space-y-2">
              <p className="font-semibold">
                Reason: {dealerApp.rejection_reason || 'Application requirements not met.'}
              </p>
              <Button
                type="button"
                onClick={() => setDealerRegOpen(true)}
                variant="outline"
                className="w-full h-9 border-rose-500/40 text-rose-600 hover:bg-rose-500/10 font-bold rounded-xl text-xs"
              >
                Submit Fresh Application
              </Button>
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-muted/50 border border-border text-xs text-muted-foreground flex items-center justify-between">
              <span>Admin review in progress. Expect SMS/email confirmation shortly.</span>
              <span className="font-mono text-[11px] font-bold text-foreground">
                {dealerApp.city}
              </span>
            </div>
          )}
        </Card>
      ) : (
        <Card className="rounded-3xl border border-primary/40 bg-primary/5 p-5 shadow-sm space-y-3">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-black shadow-sm">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-foreground">Own a Shop?</h3>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Register your shop and connect with nearby customers through Local Shop Product Finder.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => setDealerRegOpen(true)}
            className="w-full h-10 font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs gap-1.5"
          >
            Become a Dealer <ArrowRight className="h-4 w-4" />
          </Button>
        </Card>
      )}

      {/* ============================================================
          3. ACCOUNT SETTINGS (EXACTLY 5 MAIN OPTIONS)
         ============================================================ */}
      <div className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground px-1">
          Account Settings
        </h2>

        {/* 1. PERSONAL INFORMATION */}
        <Card className="rounded-3xl border border-border bg-card p-4 shadow-sm overflow-hidden transition-all">
          <button
            type="button"
            onClick={() =>
              setExpandedSection(expandedSection === 'personal' ? null : 'personal')
            }
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">Personal Information</h4>
                <p className="text-[11px] text-muted-foreground">Name, phone, email & identity</p>
              </div>
            </div>
            <ChevronRight
              className={`h-4 w-4 text-muted-foreground transition-transform ${
                expandedSection === 'personal' ? 'rotate-90' : ''
              }`}
            />
          </button>

          {expandedSection === 'personal' && (
            <div className="mt-4 pt-4 border-t border-border/60 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-muted/40 border border-border/40">
                  <span className="text-[10px] font-bold text-muted-foreground block">FULL NAME</span>
                  <span className="font-bold text-foreground">{customer.full_name || 'Not set'}</span>
                </div>
                <div className="p-3 rounded-2xl bg-muted/40 border border-border/40">
                  <span className="text-[10px] font-bold text-muted-foreground block">MOBILE PHONE</span>
                  <span className="font-bold text-foreground">{customer.phone || 'Not set'}</span>
                </div>
                <div className="p-3 rounded-2xl bg-muted/40 border border-border/40 col-span-2">
                  <span className="text-[10px] font-bold text-muted-foreground block">EMAIL ADDRESS</span>
                  <span className="font-bold font-mono text-foreground">{customer.email}</span>
                </div>
              </div>

              <Button
                type="button"
                onClick={() => setEditModalOpen(true)}
                variant="outline"
                className="w-full h-9 rounded-xl text-xs font-bold border-border"
              >
                <Edit3 className="h-3.5 w-3.5 mr-1.5" /> Edit Personal Information
              </Button>
            </div>
          )}
        </Card>

        {/* 2. SAVED LOCATION */}
        <Card className="rounded-3xl border border-border bg-card p-4 shadow-sm overflow-hidden transition-all">
          <button
            type="button"
            onClick={() =>
              setExpandedSection(expandedSection === 'location' ? null : 'location')
            }
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">Saved Location</h4>
                <p className="text-[11px] text-muted-foreground">
                  Active delivery area: PIN {customer.pin_code || location.pinCode || '532440'}
                </p>
              </div>
            </div>
            <ChevronRight
              className={`h-4 w-4 text-muted-foreground transition-transform ${
                expandedSection === 'location' ? 'rotate-90' : ''
              }`}
            />
          </button>

          {expandedSection === 'location' && (
            <div className="mt-4 pt-4 border-t border-border/60 space-y-3.5 text-xs">
              <div className="flex items-center gap-2">
                <Input
                  value={pinInput}
                  onChange={(e) => handleUpdatePin(e.target.value)}
                  placeholder="Enter 6-digit PIN"
                  maxLength={6}
                  inputMode="numeric"
                  className="h-10 text-xs rounded-xl"
                />
                <Button
                  type="button"
                  onClick={handleUseGps}
                  variant="outline"
                  className="h-10 px-3 text-xs font-bold rounded-xl shrink-0 gap-1.5"
                >
                  <Navigation className="h-3.5 w-3.5 text-primary" /> Auto GPS
                </Button>
              </div>

              <div className="p-3 rounded-2xl bg-muted/40 border border-border/40 flex items-center justify-between">
                <div>
                  <span className="font-bold text-foreground block">
                    {location.label || customer.preferred_city || 'Default Region'}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Products & shops within 15 km are prioritized
                  </span>
                </div>
                <Badge variant="outline" className="font-mono text-[11px]">
                  PIN {location.pinCode || customer.pin_code || '532440'}
                </Badge>
              </div>
            </div>
          )}
        </Card>

        {/* 3. WISHLIST & SAVED STORES */}
        <Card className="rounded-3xl border border-border bg-card p-4 shadow-sm overflow-hidden transition-all">
          <button
            type="button"
            onClick={() =>
              setExpandedSection(expandedSection === 'wishlist' ? null : 'wishlist')
            }
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
                <Heart className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">Wishlist & Saved Stores</h4>
                <p className="text-[11px] text-muted-foreground">
                  {wishlist.length} saved products • {savedDealers.length} favorite stores
                </p>
              </div>
            </div>
            <ChevronRight
              className={`h-4 w-4 text-muted-foreground transition-transform ${
                expandedSection === 'wishlist' ? 'rotate-90' : ''
              }`}
            />
          </button>

          {expandedSection === 'wishlist' && (
            <div className="mt-4 pt-4 border-t border-border/60 space-y-4 text-xs">
              {/* Favorited Products List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-foreground">Saved Products ({wishlist.length})</span>
                  <Link href="/wishlist" className="text-primary hover:underline font-bold text-[11px]">
                    View All →
                  </Link>
                </div>
                {wishlistProducts.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {wishlistProducts.slice(0, 4).map((p) => (
                      <div
                        key={p.id}
                        className="p-2 rounded-2xl border border-border bg-muted/30 flex items-center gap-2"
                      >
                        <div className="relative h-10 w-10 rounded-xl overflow-hidden shrink-0 bg-muted">
                          <Image
                            src={p.images[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200'}
                            alt={p.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="truncate flex-1">
                          <p className="font-bold text-[11px] truncate text-foreground">{p.name}</p>
                          <p className="font-semibold text-[10px] text-primary">
                            {formatINR(getEffectivePrice(p.price, p.discount_price))}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleWishlist(p.id)}
                          className="text-muted-foreground hover:text-destructive p-1"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-[11px]">No products saved yet.</p>
                )}
              </div>

              {/* Saved Stores */}
              <div>
                <span className="font-bold text-foreground block mb-2">
                  Saved Stores ({savedDealerList.length})
                </span>
                {savedDealerList.length > 0 ? (
                  <div className="space-y-1.5">
                    {savedDealerList.slice(0, 3).map((d) => (
                      <div
                        key={d.id}
                        className="p-2.5 rounded-2xl border border-border bg-muted/30 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-bold text-xs text-foreground">{d.shop_name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {d.city} • PIN {d.pin_code}
                          </p>
                        </div>
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px] font-bold rounded-lg"
                        >
                          <Link href={`/dealer/${d.id}`}>View Shop</Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-[11px]">No favorite stores saved yet.</p>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* 4. SECURITY & PRIVACY */}
        <Card className="rounded-3xl border border-border bg-card p-4 shadow-sm overflow-hidden transition-all">
          <button
            type="button"
            onClick={() =>
              setExpandedSection(expandedSection === 'security' ? null : 'security')
            }
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">Security & Privacy</h4>
                <p className="text-[11px] text-muted-foreground">
                  Password management, verification & session privacy
                </p>
              </div>
            </div>
            <ChevronRight
              className={`h-4 w-4 text-muted-foreground transition-transform ${
                expandedSection === 'security' ? 'rotate-90' : ''
              }`}
            />
          </button>

          {expandedSection === 'security' && (
            <div className="mt-4 pt-4 border-t border-border/60 space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-muted/40 border border-border/40 flex items-center justify-between">
                <div>
                  <span className="font-bold text-foreground block">Account Password</span>
                  <span className="text-[11px] text-muted-foreground">
                    Last updated recently • Encrypted credentials
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSecurityModalOpen(true)}
                  className="h-8 text-xs font-bold rounded-xl border-border"
                >
                  Change Password
                </Button>
              </div>

              <div className="p-3 rounded-2xl bg-muted/40 border border-border/40 flex items-center justify-between">
                <div>
                  <span className="font-bold text-foreground block">Identity Verification</span>
                  <span className="text-[11px] text-muted-foreground">
                    Verified Customer Account Active
                  </span>
                </div>
                <Badge className="bg-primary/10 text-primary border border-primary/20 text-[10px]">
                  Protected
                </Badge>
              </div>
            </div>
          )}
        </Card>

        {/* 5. APP PREFERENCES */}
        <Card className="rounded-3xl border border-border bg-card p-4 shadow-sm overflow-hidden transition-all">
          <button
            type="button"
            onClick={() =>
              setExpandedSection(expandedSection === 'preferences' ? null : 'preferences')
            }
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">App Preferences</h4>
                <p className="text-[11px] text-muted-foreground">
                  Theme mode, regional language & notification alerts
                </p>
              </div>
            </div>
            <ChevronRight
              className={`h-4 w-4 text-muted-foreground transition-transform ${
                expandedSection === 'preferences' ? 'rotate-90' : ''
              }`}
            />
          </button>

          {expandedSection === 'preferences' && (
            <div className="mt-4 pt-4 border-t border-border/60 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-muted/40 border border-border/40 flex flex-col justify-between gap-2">
                  <span className="font-bold text-foreground">Language</span>
                  <LanguageSwitcher />
                </div>
                <div className="p-3 rounded-2xl bg-muted/40 border border-border/40 flex flex-col justify-between gap-2">
                  <span className="font-bold text-foreground">Display Theme</span>
                  <ThemeToggle />
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ============================================================
          4. SIGN OUT BUTTON (CLEARLY VISIBLE AT BOTTOM)
         ============================================================ */}
      <div className="pt-2">
        <Button
          type="button"
          onClick={handleSignOut}
          variant="outline"
          className="w-full h-11 border-destructive/30 text-destructive hover:bg-destructive/10 font-bold rounded-2xl text-xs gap-2"
        >
          <LogOut className="h-4 w-4" /> Sign Out of Customer Account
        </Button>
      </div>

      {/* ============================================================
          PART 2: ONE UNIFIED EDIT PROFILE MODAL
         ============================================================ */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-5 sm:p-6 border-border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-black text-foreground">
              <Edit3 className="h-5 w-5 text-primary" /> Edit Customer Profile
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update your personal information, contact phone, and delivery PIN code.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProfile} className="space-y-3.5 py-1">
            <div>
              <Label className="text-xs font-bold text-foreground">Full Name *</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Your full name"
                className="h-11 text-sm rounded-xl mt-1"
                required
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-foreground">Profile Avatar / Photo URL</Label>
              <Input
                value={editAvatar}
                onChange={(e) => setEditAvatar(e.target.value)}
                placeholder="https://images.unsplash.com/... or leave empty"
                className="h-11 text-sm rounded-xl mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <Label className="text-xs font-bold text-foreground">Mobile Phone</Label>
                <Input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="98480 12345"
                  className="h-11 text-sm rounded-xl mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-foreground">Postal PIN Code</Label>
                <Input
                  value={editPin}
                  onChange={(e) => setEditPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="532440"
                  maxLength={6}
                  inputMode="numeric"
                  className="h-11 text-sm rounded-xl mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-foreground">Email Address (Read Only)</Label>
              <Input
                type="email"
                value={editEmail}
                disabled
                className="h-11 text-sm rounded-xl mt-1 bg-muted/60 font-mono text-muted-foreground"
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-foreground">Preferred City / Town</Label>
              <Input
                value={editCity}
                onChange={(e) => setEditCity(e.target.value)}
                placeholder="e.g. Amalapuram, AP"
                className="h-11 text-sm rounded-xl mt-1"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/50">
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
                className="bg-primary text-primary-foreground font-bold rounded-xl text-xs sm:text-sm h-11 px-5"
              >
                {savingProfile ? 'Saving Changes...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================
          SECURITY / CHANGE PASSWORD MODAL
         ============================================================ */}
      <Dialog open={securityModalOpen} onOpenChange={setSecurityModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-5 sm:p-6 border-border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-black text-foreground">
              <Lock className="h-5 w-5 text-primary" /> Security & Password
            </DialogTitle>
            <DialogDescription className="text-xs">
              Create a new secure password for your customer account.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleChangePassword} className="space-y-3.5 py-1">
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-bold text-foreground">New Password *</Label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="h-11 pl-10 pr-10 text-sm rounded-xl"
                  required
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-foreground mb-1 block">Confirm Password *</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="h-11 pl-10 text-sm rounded-xl"
                  required
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/50">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSecurityModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={savingPassword}
                className="bg-primary text-primary-foreground font-bold rounded-xl text-xs sm:text-sm h-11 px-5"
              >
                {savingPassword ? 'Updating Password...' : 'Update Password'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================
          IN-APP DEALER REGISTRATION MODAL
         ============================================================ */}
      <Dialog open={dealerRegOpen} onOpenChange={setDealerRegOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 rounded-3xl border-border shadow-2xl">
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
