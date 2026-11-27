'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Shield, Lock, Mail, Eye, EyeOff, AlertCircle, ArrowRight, CheckCircle2,
  KeyRound, Smartphone, RefreshCw, Sparkles, Check, ShieldCheck
} from 'lucide-react';
import { PwaInstallButton } from '@/components/pwa-install-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export function AdminLoginScreen({ onLoginSuccess }: { onLoginSuccess?: () => void }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // App-Style OTP Password Recovery state (Nodemailer & Twilio Verify)
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

  // Countdown timer for Resend OTP
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCountdown > 0 && forgotStep === 'otp' && forgotOpen) {
      timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown, forgotStep, forgotOpen]);

  // Admin login operates independently from Customer and Dealer sessions.

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Please enter both your administrator email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: signInError } = await signIn(cleanEmail, password, 'admin');
      if (signInError) {
        setError(signInError);
        setSubmitting(false);
        return;
      }

      toast.success('Administrator authenticated successfully. Welcome to the Control Center!');
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const openForgotModal = () => {
    setForgotIdentifier(email || 'admin@dealerconnect.ai');
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
    const cleanId = forgotIdentifier.trim().toLowerCase();

    if (!cleanId) {
      setForgotError('Please enter your administrator email or phone number.');
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
        throw new Error(data.error || 'Failed to dispatch OTP');
      }

      setMaskedDest(data.maskedDestination || cleanId);
      setTestOtpHint(data.testOtp || '');
      setForgotStep('otp');
      setResendCountdown(30);
      toast.success(data.message || `Verification code dispatched via ${targetChannel.toUpperCase()}!`);
    } catch (err: any) {
      setForgotError(err?.message || 'Failed to send OTP code.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);

    const cleanOtp = otpCode.trim();
    if (cleanOtp.length < 6) {
      setForgotError('Please enter the full 6-digit OTP code.');
      return;
    }

    setOtpVerifying(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: forgotIdentifier.trim().toLowerCase(), otp: cleanOtp }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid or expired OTP code.');
      }

      setResetToken(data.resetToken);
      setForgotStep('new-password');
      toast.success('Code verified! Enter your new administrator password.');
    } catch (err: any) {
      setForgotError(err?.message || 'OTP verification failed.');
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);

    if (newPassword.length < 4) {
      setForgotError('Master password must be at least 4 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotError('Passwords do not match. Please verify.');
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
        throw new Error(data.error || 'Password reset failed.');
      }

      // Update in localStorage
      localStorage.setItem('dc-admin-custom-password', newPassword);

      if (cleanId.includes('@')) {
        setEmail(cleanId);
      }
      setPassword(newPassword);

      setForgotStep('success');
      toast.success('Administrator master password updated successfully!');
    } catch (err: any) {
      setForgotError(err?.message || 'Password update failed.');
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <div
      className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center bg-gradient-to-br from-background via-purple-950/5 to-muted/40 px-4 py-4 sm:px-6 sm:py-8 touch-pan-y scrollbar-hide selection:bg-purple-500/20"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* Decorative background grid */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(#8b5cf6_1px,transparent_1px)] opacity-15 [background-size:24px_24px]" />

      <div className="relative w-full max-w-md space-y-3 sm:space-y-4 shrink-0 transition-all touch-pan-y">
        {/* Mobile-App Top Strip */}
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-xl border border-border bg-card/80 px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Storefront
          </Link>
          <PwaInstallButton portalName="Admin App" compact />
        </div>

        {/* Compact Mobile-App Header */}
        <div className="text-center space-y-1.5">
          <div className="mx-auto flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-purple-600 text-white shadow-lg shadow-purple-600/25">
            <Shield className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-foreground sm:text-2xl">
            Admin Control Center
          </h1>
          <p className="text-[11px] sm:text-xs text-muted-foreground">
            Independent Master Administration Portal
          </p>
        </div>

        <Card className="border border-border/80 shadow-xl backdrop-blur rounded-3xl p-4 sm:p-6 space-y-4 touch-pan-y">
          <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                Admin Sign In
              </span>
            </div>
            <Badge variant="outline" className="text-[10px] font-semibold text-purple-600 border-purple-500/30">
              Isolated Session
            </Badge>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Authentication Error</p>
                <p className="mt-0.5 text-[11px]">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleAdminSignIn} className="space-y-4">
            <div>
              <Label htmlFor="admin-email" className="mb-1.5 block text-xs font-bold text-foreground">
                Administrator Email / Username
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@dealerconnect.ai"
                  className="h-11 sm:h-12 pl-10 text-base sm:text-sm rounded-xl"
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <Label htmlFor="admin-password" className="text-xs font-bold text-foreground">
                  Master Password
                </Label>
                <button
                  type="button"
                  onClick={openForgotModal}
                  className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center gap-1"
                >
                  <KeyRound className="h-3 w-3" /> Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="h-11 sm:h-12 pl-10 pr-10 text-base sm:text-sm rounded-xl"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 sm:h-12 font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs sm:text-sm shadow-md transition-all mt-1"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Authenticating Master Admin...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Enter Admin Control Center <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="border-t border-border/40 pt-3 text-center">
            <Link
              href="/"
              className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
            >
              ← Return to Customer App Home
            </Link>
          </div>
        </Card>
      </div>

      {/* ============================================================= */}
      {/* APP-STYLE OTP PASSWORD RECOVERY MODAL (NODEMAILER & TWILIO)   */}
      {/* ============================================================= */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-5 sm:p-6 border-border shadow-2xl">
          {/* STEP 1: REQUEST OTP */}
          {forgotStep === 'request' && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-black text-foreground">
                  <KeyRound className="h-5 w-5 text-purple-600" /> Admin Password Recovery
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Enter your registered administrator email to receive a secure 6-digit verification code.
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
                  <Label className="text-xs font-bold text-foreground">Admin Account Email or Phone *</Label>
                  <div className="relative mt-1">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                      placeholder="admin@dealerconnect.ai"
                      className="h-11 sm:h-12 pl-10 text-base sm:text-sm rounded-xl"
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold text-foreground mb-1.5 block">Select Verification Channel</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setForgotChannel('email')}
                      className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 ${
                        forgotChannel === 'email'
                          ? 'border-purple-600 bg-purple-500/10 text-foreground ring-2 ring-purple-500/20'
                          : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <Mail className={`h-4 w-4 mt-0.5 shrink-0 ${forgotChannel === 'email' ? 'text-purple-600' : ''}`} />
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
                          ? 'border-purple-600 bg-purple-500/10 text-foreground ring-2 ring-purple-500/20'
                          : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <Smartphone className={`h-4 w-4 mt-0.5 shrink-0 ${forgotChannel === 'sms' ? 'text-purple-600' : ''}`} />
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
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs sm:text-sm h-11 px-5 gap-1.5"
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
                  <ShieldCheck className="h-5 w-5 text-purple-600" /> Enter 6-Digit Code
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Enter the verification code dispatched to <strong className="text-foreground">{maskedDest}</strong>.
                </DialogDescription>
              </DialogHeader>

              {forgotError && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{forgotError}</span>
                </div>
              )}

              <div className="py-2 text-center space-y-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="------"
                  className="h-14 text-center font-mono text-2xl font-black tracking-[0.5em] rounded-2xl border-purple-500/40 focus:border-purple-600 focus:ring-purple-500/20"
                  autoFocus
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Enter the 6 numbers from your SMS or Email
                </p>

                {testOtpHint && (
                  <div className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full bg-purple-500/10 text-purple-600 text-[11px] font-semibold border border-purple-500/20">
                    <Sparkles className="h-3 w-3" /> Quick Test Code: <span className="font-mono font-bold">{testOtpHint}</span> (or 123456)
                  </div>
                )}
              </div>

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
                    className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center gap-1"
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
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs sm:text-sm h-11 px-5 gap-1.5"
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

          {/* STEP 3: SET NEW PASSWORD */}
          {forgotStep === 'new-password' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-black text-foreground">
                  <Lock className="h-5 w-5 text-purple-600" /> Set New Master Password
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Create a new secure password for your administrator control account.
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
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground">New Master Password *</Label>
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                    >
                      {showNewPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div className="relative mt-1">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 4 characters"
                      className="h-11 sm:h-12 pl-10 pr-10 text-base sm:text-sm rounded-xl"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold text-foreground">Confirm New Password *</Label>
                  <div className="relative mt-1">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type={showNewPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="h-11 sm:h-12 pl-10 text-base sm:text-sm rounded-xl"
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
                  disabled={resettingPassword || newPassword.length < 4}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs sm:text-sm h-11 px-5 gap-1.5"
                >
                  {resettingPassword ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> Updating...
                    </>
                  ) : (
                    <>
                      Update Master Password <Check className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}

          {/* STEP 4: SUCCESS CONFIRMATION */}
          {forgotStep === 'success' && (
            <div className="py-4 text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 shadow-md">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">Master Password Updated!</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Your new credentials have been configured. You can now access the Admin Control Center.
                </p>
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => setForgotOpen(false)}
                  className="font-bold bg-purple-600 hover:bg-purple-700 text-white px-6 h-11 rounded-xl text-xs sm:text-sm"
                >
                  Continue to Sign In →
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
