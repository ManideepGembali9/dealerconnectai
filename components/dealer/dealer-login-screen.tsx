'use client';

import { DealerRegistrationForm } from '@/components/dealer-registration-form';
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
import { getDbDealerApplications,getDbDealers } from '@/lib/firebase-db';
import type { Dealer } from '@/lib/types';
import { PwaInstallButton } from '@/components/pwa-install-button';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store
} from 'lucide-react';
import { useEffect,useState } from 'react';
import { toast } from 'sonner';

type DealerLoginProps = {
  onLoginSuccess?: () => void;
  initialTab?: 'signin' | 'register';
};

export function DealerLoginScreen({ onLoginSuccess, initialTab = 'signin' }: DealerLoginProps) {
  const { signIn } = useAuth();

  // Sign In state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Registration Modal State (Opened via in-page button)
  const [regModalOpen, setRegModalOpen] = useState(initialTab === 'register');

  // App-Style OTP Password Recovery State (Nodemailer & Twilio Verify)
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'otp' | 'new-password' | 'success'>('request');
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotChannel, setForgotChannel] = useState<'email' | 'sms'>('email');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [maskedDest, setMaskedDest] = useState('');
  const [testOtpHint, setTestOtpHint] = useState('');
  const [resendCountdown, setResendCountdown] = useState(30);
  const [resetToken, setResetToken] = useState('');
  const [forgotError, setForgotError] = useState<string | null>(null);

  // Quick Demo Accounts list for instant testing
  const [demoDealers, setDemoDealers] = useState<Dealer[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const dls = await getDbDealers();
        setDemoDealers(dls.filter((d) => d.status === 'approved').slice(0, 3));
      } catch (err) {
        console.warn('Failed to load sample dealers:', err);
      }
    })();
  }, []);

  // Countdown timer for Resend OTP
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCountdown > 0 && forgotStep === 'otp' && forgotOpen) {
      timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown, forgotStep, forgotOpen]);

  // Dealer portal login operates independently from Customer and Admin sessions.

  // Handle Dealer Sign In with approval status checks
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Please enter both your dealership email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: signInError } = await signIn(cleanEmail, password, 'dealer');
      if (signInError) {
        // If not found as active dealer, check if an application exists
        const apps = await getDbDealerApplications();
        const existingApp = apps.find((a) => a.email.toLowerCase() === cleanEmail);

        if (existingApp) {
          if (existingApp.status === 'pending' || existingApp.status === 'under_review') {
            setError(
              `Application ${existingApp.id} for "${existingApp.shop_name}" is currently ${existingApp.status === 'under_review' ? 'under review' : 'pending admin approval'}. You will receive SMS & email notifications once approved.`
            );
            setSubmitting(false);
            return;
          }
          if (existingApp.status === 'rejected') {
            setError(
              `Application ${existingApp.id} was not approved.${existingApp.rejection_reason ? ` Reason: ${existingApp.rejection_reason}` : ''} You may submit a new application.`
            );
            setSubmitting(false);
            return;
          }
        }

        setError(signInError);
        setSubmitting(false);
        return;
      }

      toast.success('Dealer authenticated successfully! Welcome to Merchant Console.');
      if (onLoginSuccess) onLoginSuccess();
    } catch (err: any) {
      setError(err?.message || 'Dealer authentication failed. Please verify your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Demo Dealer Login Helper
  const handleQuickDemoLogin = async (demoDealer: Dealer) => {
    setEmail(demoDealer.email);
    setPassword('dealer123');
    setSubmitting(true);
    setError(null);
    try {
      const { error: signInError } = await signIn(demoDealer.email, 'dealer123', 'dealer');
      if (signInError) {
        setError(signInError);
      } else {
        toast.success(`Signed in as ${demoDealer.shop_name}!`);
        if (onLoginSuccess) onLoginSuccess();
      }
    } catch (err: any) {
      setError(err?.message || 'Quick login failed');
    } finally {
      setSubmitting(false);
    }
  };

  // =========================================================================
  // OTP PASSWORD RECOVERY HANDLERS (NODEMAILER & TWILIO)
  // =========================================================================
  const openForgotModal = () => {
    setForgotIdentifier(email.trim() || '');
    setForgotStep('request');
    setForgotError(null);
    setOtpCode('');
    setNewPassword('');
    setConfirmPassword('');
    setForgotOpen(true);
  };

  const handleSendOtp = async (channelOverride?: 'email' | 'sms') => {
    setForgotError(null);
    const targetChannel = channelOverride || forgotChannel;
    const cleanId = forgotIdentifier.trim();

    if (!cleanId) {
      setForgotError('Please enter your showroom email or 10-digit mobile number.');
      return;
    }

    if (targetChannel === 'email' && !cleanId.includes('@')) {
      setForgotError('Please enter a valid email address for email verification.');
      return;
    }

    if (targetChannel === 'sms' && cleanId.includes('@')) {
      setForgotError('Please enter a 10-digit mobile phone number for SMS verification.');
      return;
    }

    setOtpSending(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: cleanId, channel: targetChannel }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to dispatch verification code');
      }

      setMaskedDest(data.maskedDestination || cleanId);
      setTestOtpHint(data.testOtp || '');
      setResendCountdown(30);
      setForgotStep('otp');
      toast.success(data.message || `OTP code sent via ${targetChannel.toUpperCase()}`);
    } catch (err: any) {
      setForgotError(err?.message || 'Failed to send OTP code. Please check your details.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    const cleanOtp = otpCode.trim();

    if (cleanOtp.length < 6) {
      setForgotError('Please enter the full 6-digit verification code.');
      return;
    }

    setOtpVerifying(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: forgotIdentifier.trim(), otp: cleanOtp }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid or expired OTP code.');
      }

      setResetToken(data.resetToken || `tok-${Date.now()}`);
      setForgotStep('new-password');
      toast.success('Identity verified! Create your new dealer password.');
    } catch (err: any) {
      setForgotError(err?.message || 'OTP verification failed. Please try again.');
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);

    if (!newPassword || newPassword.length < 4) {
      setForgotError('Password must be at least 4 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setForgotError('Passwords do not match. Please re-enter.');
      return;
    }

    setResettingPassword(true);
    try {
      const cleanId = forgotIdentifier.trim().toLowerCase();
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: cleanId,
          resetToken,
          newPassword,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update password.');
      }

      // Store in local storage for instant offline fallback
      localStorage.setItem(`dc-dealer-pw-${cleanId}`, newPassword);

      // Pre-fill email and password on the login screen
      if (cleanId.includes('@')) {
        setEmail(cleanId);
      }
      setPassword(newPassword);

      setForgotStep('success');
      toast.success('Dealer password updated successfully!');
    } catch (err: any) {
      setForgotError(err?.message || 'Failed to update password. Please try again.');
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-x-hidden overscroll-none bg-gradient-to-br from-background via-emerald-950/5 to-muted/30 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8">
      <div className="fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20">
        <PwaInstallButton portalName="Dealer App" compact />
      </div>

      <div className="relative my-auto w-full max-w-md space-y-3 sm:space-y-4 shrink-0">
        {/* Brand header */}
        <div className="text-center space-y-1">
          <div className="mx-auto flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
            <Store className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
            Dealer Merchant Portal
          </h1>
          <p className="text-[11px] sm:text-xs text-muted-foreground">
            Manage showroom catalog, stock availability & incoming leads
          </p>
        </div>

        {/* ============================================================= */}
        {/* STANDALONE DEALER LOGIN FORM                                 */}
        {/* ============================================================= */}
        <Card className="border border-border/80 shadow-xl backdrop-blur rounded-3xl p-4 sm:p-6 space-y-4">
          <div>
            <h2 className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
              <Lock className="h-4 w-4 text-emerald-600" /> Authorized Dealer Sign In
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Enter your showroom credentials to access inventory, leads & orders
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <Label htmlFor="dealer-email" className="mb-1.5 block text-xs font-bold text-foreground">
                Showroom Email
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="dealer-email"
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="shop@email.com"
                  className="h-11 sm:h-12 pl-10 text-sm rounded-xl"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <Label htmlFor="dealer-password" className="text-xs font-bold text-foreground">
                  Password
                </Label>
                <button
                  type="button"
                  onClick={openForgotModal}
                  className="text-xs font-bold text-emerald-600 hover:underline dark:text-emerald-400 inline-flex items-center gap-1"
                >
                  <KeyRound className="h-3 w-3" /> Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="dealer-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="h-11 sm:h-12 pl-10 pr-10 text-sm rounded-xl"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 sm:h-12 font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm shadow-md transition-all mt-1"
            >
              {submitting ? 'Authenticating Dealer...' : 'Enter Dealer Console →'}
            </Button>
          </form>

          {/* QUICK DEMO ACCOUNTS HELPER */}
          {demoDealers.length > 0 && (
            <div className="pt-2 border-t border-border/50">
              <p className="text-[11px] font-bold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-emerald-600" /> Quick Sign In (Demo Showrooms)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {demoDealers.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => handleQuickDemoLogin(d)}
                    className="flex-1 min-w-[140px] flex items-center justify-between px-2.5 py-1.5 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted text-left text-[11px] transition-colors"
                  >
                    <span className="font-bold text-foreground truncate pr-1">{d.shop_name}</span>
                    <span className="text-[10px] font-semibold text-emerald-600 shrink-0">Sign In →</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* DEALERSHIP REGISTRATION MODAL TRIGGER */}
          <div className="border-t border-border/60 pt-3 text-center space-y-1.5">
            <p className="text-[11px] text-muted-foreground">
              Own a local showroom or store? Connect with nearby buyers.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRegModalOpen(true)}
              className="w-full h-10 border-dashed border-emerald-600/40 hover:border-emerald-600 hover:bg-emerald-600/5 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-xl gap-2 transition-all"
            >
              <Store className="h-4 w-4" /> Register New Dealership →
            </Button>
          </div>
        </Card>
      </div>

      {/* ============================================================= */}
      {/* DEALER REGISTRATION MODAL (SMOOTH DIALOG WITH INTERNAL SCROLL) */}
      {/* ============================================================= */}
      <Dialog open={regModalOpen} onOpenChange={setRegModalOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 rounded-3xl border-border shadow-2xl">
          <DialogTitle className="sr-only">New Dealership Application</DialogTitle>
          <DialogDescription className="sr-only">Complete your shop registration form to apply for a verified dealer account.</DialogDescription>
          <div className="p-4 sm:p-6">
            <DealerRegistrationForm
              onCancel={() => setRegModalOpen(false)}
              onSuccess={(appId) => {
                toast.success(`Application ${appId} submitted successfully!`);
                setRegModalOpen(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* ============================================================= */}
      {/* APP-STYLE OTP PASSWORD RECOVERY MODAL (NODEMAILER & TWILIO)   */}
      {/* ============================================================= */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-5 sm:p-6 border-border shadow-2xl">
          {/* STEP 1: REQUEST OTP (EMAIL NODEMAILER VS SMS TWILIO) */}
          {forgotStep === 'request' && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-black text-foreground">
                  <KeyRound className="h-5 w-5 text-emerald-600" /> Reset Dealer Password
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Enter your registered showroom email or mobile number to receive a secure 6-digit OTP code.
                </DialogDescription>
              </DialogHeader>

              {forgotError && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{forgotError}</span>
                </div>
              )}

              <div className="space-y-3 py-1">
                <div>
                  <Label className="text-xs font-bold text-foreground">Registered Email or 10-Digit Mobile *</Label>
                  <div className="relative mt-1">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                      placeholder="shop@email.com or 9848012345"
                      className="h-11 sm:h-12 pl-10 text-sm rounded-xl"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Dispatch Channel Selector */}
                <div>
                  <Label className="text-xs font-bold text-foreground mb-1.5 block">Select Verification Channel</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setForgotChannel('email')}
                      className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 ${
                        forgotChannel === 'email'
                          ? 'border-emerald-600 bg-emerald-500/10 text-foreground ring-2 ring-emerald-500/20'
                          : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <Mail className={`h-4 w-4 mt-0.5 shrink-0 ${forgotChannel === 'email' ? 'text-emerald-600' : ''}`} />
                      <div>
                        <p className="text-xs font-bold">Email OTP</p>
                        <p className="text-[10px] text-muted-foreground">Via Nodemailer</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setForgotChannel('sms')}
                      className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 ${
                        forgotChannel === 'sms'
                          ? 'border-emerald-600 bg-emerald-500/10 text-foreground ring-2 ring-emerald-500/20'
                          : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <Smartphone className={`h-4 w-4 mt-0.5 shrink-0 ${forgotChannel === 'sms' ? 'text-emerald-600' : ''}`} />
                      <div>
                        <p className="text-xs font-bold">SMS OTP</p>
                        <p className="text-[10px] text-muted-foreground">Via Twilio Verify</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/50">
                <Button type="button" variant="ghost" onClick={() => setForgotOpen(false)} className="rounded-xl text-xs">
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSendOtp()}
                  disabled={otpSending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm h-11 px-5 gap-1.5"
                >
                  {otpSending ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> Dispatching OTP...
                    </>
                  ) : (
                    <>
                      Send 6-Digit OTP <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* STEP 2: ENTER & VERIFY 6-DIGIT OTP */}
          {forgotStep === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-black text-foreground">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" /> Enter 6-Digit Code
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Enter the verification code sent to <strong className="text-foreground">{maskedDest}</strong>.
                </DialogDescription>
              </DialogHeader>

              {forgotError && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{forgotError}</span>
                </div>
              )}

              {/* Monospace 6-Digit Native OTP Input */}
              <div className="py-2 text-center space-y-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="------"
                  className="h-14 text-center font-mono text-2xl font-black tracking-[0.5em] rounded-2xl border-emerald-500/40 focus:border-emerald-600 focus:ring-emerald-500/20"
                  autoFocus
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Enter the 6 numbers from your SMS or Email
                </p>

                {/* Instant Verification Helper Pill */}
                {testOtpHint && (
                  <div className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full bg-emerald-500/10 text-emerald-600 text-[11px] font-semibold border border-emerald-500/20">
                    <Sparkles className="h-3 w-3" /> Quick Code: <span className="font-mono font-bold">{testOtpHint}</span> (or 123456)
                  </div>
                )}
              </div>

              {/* Resend OTP Bar */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setForgotStep('request')}
                  className="text-muted-foreground hover:text-foreground text-[11px] font-medium"
                >
                  ← Change number/email
                </button>
                {resendCountdown > 0 ? (
                  <span className="text-[11px] text-muted-foreground">
                    Resend code in <strong className="font-mono text-foreground">{resendCountdown}s</strong>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendOtp()}
                    disabled={otpSending}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" /> Resend Code Now
                  </button>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/50">
                <Button type="button" variant="ghost" onClick={() => setForgotOpen(false)} className="rounded-xl text-xs">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={otpVerifying || otpCode.length < 6}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm h-11 px-5 gap-1.5"
                >
                  {otpVerifying ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> Verifying...
                    </>
                  ) : (
                    <>
                      Verify OTP Code <Check className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}

          {/* STEP 3: CREATE NEW DEALER PASSWORD */}
          {forgotStep === 'new-password' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-black text-foreground">
                  <Lock className="h-5 w-5 text-emerald-600" /> Create New Password
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Verification approved! Please enter a new password for your showroom account.
                </DialogDescription>
              </DialogHeader>

              {forgotError && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{forgotError}</span>
                </div>
              )}

              <div className="space-y-3 py-1">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs font-bold text-foreground">New Password *</Label>
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="text-[11px] font-semibold text-emerald-600 hover:underline"
                    >
                      {showNewPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 4 characters"
                      className="h-11 sm:h-12 pl-10 pr-10 text-sm rounded-xl"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold text-foreground mb-1 block">Confirm New Password *</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type={showNewPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="h-11 sm:h-12 pl-10 text-sm rounded-xl"
                      required
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/50">
                <Button type="button" variant="ghost" onClick={() => setForgotOpen(false)} className="rounded-xl text-xs">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={resettingPassword}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm h-11 px-5"
                >
                  {resettingPassword ? 'Updating Password...' : 'Save Password & Sign In →'}
                </Button>
              </DialogFooter>
            </form>
          )}

          {/* STEP 4: SUCCESS CONFIRMATION */}
          {forgotStep === 'success' && (
            <div className="py-5 text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 shadow-md">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-foreground">
                Password Reset Successfully!
              </h3>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Your dealer password has been updated. Your credentials have been saved and pre-filled for immediate login.
              </p>
              <div className="pt-2">
                <Button
                  type="button"
                  onClick={() => {
                    setForgotOpen(false);
                  }}
                  className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm"
                >
                  Back to Sign In & Enter Console →
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
