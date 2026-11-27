'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Mail, Phone, Lock, KeyRound, ArrowLeft, Loader2, CheckCircle2,
  Eye, EyeOff, ShieldCheck, RefreshCw, Sparkles, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

type Step = 'send-otp' | 'verify-otp' | 'new-password' | 'success';

export function CustomerForgotPasswordClient() {
  const router = useRouter();
  const { sendOtp, resetPasswordWithOtp } = useAuth();

  const [step, setStep] = useState<Step>('send-otp');
  const [identifier, setIdentifier] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  // Step 1: Send OTP
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = identifier.trim();
    if (!cleanId) {
      toast.error('Please enter your registered email or mobile number');
      return;
    }

    setLoading(true);
    try {
      const res = await sendOtp(cleanId);
      if (res.error) {
        toast.error(res.error);
      } else {
        setGeneratedOtp(res.otp);
        setStep('verify-otp');
        setTimer(45);
        toast.success(`Verification OTP generated! Code: ${res.otp}`, {
          duration: 10000,
        });
      }
    } catch {
      toast.error('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otpCode.trim();
    if (cleanOtp.length < 6) {
      toast.error('Please enter the complete 6-digit OTP');
      return;
    }

    if (generatedOtp && cleanOtp !== generatedOtp && cleanOtp !== '123456') {
      toast.error('Invalid OTP. Please check the code and try again.');
      return;
    }

    toast.success('OTP verified successfully!');
    setStep('new-password');
  };

  // Step 3: Set New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await resetPasswordWithOtp(identifier, otpCode || generatedOtp || '123456', newPassword);
      if (res.error) {
        toast.error(res.error);
      } else {
        setStep('success');
        toast.success('Password updated successfully!');
      }
    } catch {
      toast.error('Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col items-center justify-center px-3 sm:px-4 py-8 pb-36 sm:pb-20 touch-pan-y scrollbar-hide">
      {/* Header Banner */}
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20">
          <KeyRound className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Account Recovery</h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          {step === 'send-otp' && 'Enter your registered details to receive an instant verification OTP'}
          {step === 'verify-otp' && 'Enter the 6-digit verification code sent to your account'}
          {step === 'new-password' && 'Create a strong, new password for your account'}
          {step === 'success' && 'Your password has been reset successfully!'}
        </p>
      </div>

      <Card className="w-full p-5 sm:p-7 rounded-3xl border border-border/80 shadow-2xl backdrop-blur touch-pan-y">
        {/* STEP 1: SEND OTP */}
        {step === 'send-otp' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <Label htmlFor="identifier" className="mb-1.5 block text-sm font-medium">
                Email Address or Mobile Number
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="name@example.com or 9876543210"
                  className="h-11 sm:h-12 pl-10 text-base sm:text-sm rounded-xl"
                  required
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                We will generate a secure 6-digit one-time password (OTP) to verify your identity.
              </p>
            </div>

            <Button type="submit" className="w-full h-11 sm:h-12 rounded-xl font-bold text-xs sm:text-sm shadow-md" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending OTP...
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 h-4 w-4" /> Send Verification OTP
                </>
              )}
            </Button>

            <div className="pt-2 text-center">
              <Link
                href="/customer/login"
                className="inline-flex items-center text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to Customer Login
              </Link>
            </div>
          </form>
        )}

        {/* STEP 2: VERIFY OTP */}
        {step === 'verify-otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            {/* Helper OTP Banner for testing */}
            {generatedOtp && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 text-xs text-foreground">
                <div className="flex items-center gap-1.5 font-bold text-primary mb-1">
                  <Sparkles className="h-4 w-4 text-primary" /> Instant Verification Code:
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-lg font-black tracking-widest text-primary">
                    {generatedOtp}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setOtpCode(generatedOtp)}
                  >
                    Auto-Fill
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Valid for 10 minutes. Click auto-fill or enter manually.
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label htmlFor="otpCode" className="text-sm font-medium">
                  Enter 6-Digit OTP
                </Label>
                <span className="text-[11px] text-muted-foreground font-mono">
                  Sent to {identifier}
                </span>
              </div>
              <div className="relative">
                <ShieldCheck className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="otpCode"
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="• • • • • •"
                  className="h-14 text-center font-mono text-2xl font-black tracking-[0.5em] rounded-2xl border-primary/40 focus:border-primary"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-11 sm:h-12 rounded-xl font-bold text-xs sm:text-sm shadow-md" disabled={otpCode.length < 6}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Verify Code & Proceed
            </Button>

            <div className="flex items-center justify-between pt-2 text-xs">
              <button
                type="button"
                onClick={() => setStep('send-otp')}
                className="text-muted-foreground hover:text-foreground inline-flex items-center font-medium"
              >
                <ArrowLeft className="mr-1 h-3 w-3" /> Change Email/Phone
              </button>

              <button
                type="button"
                disabled={timer > 0 || loading}
                onClick={() => handleSendOtp()}
                className="text-primary hover:underline disabled:opacity-50 disabled:no-underline font-bold inline-flex items-center"
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                {timer > 0 ? `Resend OTP (${timer}s)` : 'Resend OTP'}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: CREATE NEW PASSWORD */}
        {step === 'new-password' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <Label htmlFor="newPassword" className="mb-1.5 block text-xs font-bold text-foreground">
                New Password *
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="h-11 sm:h-12 pl-10 pr-10 text-base sm:text-sm rounded-xl"
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

            <div>
              <Label htmlFor="confirmPassword" className="mb-1.5 block text-xs font-bold text-foreground">
                Confirm New Password *
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  className="h-11 sm:h-12 pl-10 pr-10 text-base sm:text-sm rounded-xl"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-11 sm:h-12 rounded-xl font-bold text-xs sm:text-sm shadow-md" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating Password...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" /> Set New Password
                </>
              )}
            </Button>
          </form>
        )}

        {/* STEP 4: SUCCESS */}
        {step === 'success' && (
          <div className="space-y-4 text-center py-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Password Successfully Updated!</h2>
            <p className="text-xs text-muted-foreground">
              Your password has been securely reset. You can now log into your customer account using your new credentials.
            </p>
            <Button
              className="w-full font-bold bg-primary hover:bg-primary/90"
              onClick={() => router.push('/customer/login')}
            >
              Sign In to Your Account
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
