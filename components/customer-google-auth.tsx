'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, Mail, Plus, ShieldCheck, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { buildGoogleAvatarDataUri, useAuth, type GoogleAccountInput } from '@/lib/auth';
import type { CustomerProfile } from '@/lib/types';
import { cn } from '@/lib/utils';

type SelectableGoogleAccount = GoogleAccountInput & {
  saved?: boolean;
};

const QUICK_GOOGLE_ACCOUNTS: SelectableGoogleAccount[] = [
  {
    email: 'aarav.sharma@gmail.com',
    full_name: 'Aarav Sharma',
    avatar_url: buildGoogleAvatarDataUri('Aarav Sharma', 'aarav.sharma@gmail.com'),
    google_sub: '104829103849102',
  },
  {
    email: 'priya.nair@gmail.com',
    full_name: 'Priya Nair',
    avatar_url: buildGoogleAvatarDataUri('Priya Nair', 'priya.nair@gmail.com'),
    google_sub: '109284751029384',
  },
  {
    email: 'google.customer@gmail.com',
    full_name: 'Google Customer',
    avatar_url: buildGoogleAvatarDataUri('Google Customer', 'google.customer@gmail.com'),
    google_sub: '100000000000001',
  },
];

function sanitizeCustomerNextPath(target?: string): string {
  if (!target || typeof target !== 'string') return '/';
  const trimmed = target.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/';
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('/admin') || lower.startsWith('/dealer') || lower.startsWith('/api')) {
    return '/';
  }
  return trimmed;
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('h-4 w-4 shrink-0', className)} viewBox="0 0 24 24" aria-hidden="true">
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
  );
}

type CustomerGoogleAuthButtonProps = {
  redirectTo?: string;
  redirectOnSuccess?: boolean;
  compact?: boolean;
  disabled?: boolean;
  autoOpenFromQuery?: boolean;
  className?: string;
  onError?: (message: string | null) => void;
  onSuccess?: () => void;
};

export function CustomerGoogleAuthButton({
  redirectTo = '/',
  redirectOnSuccess = true,
  compact = false,
  disabled = false,
  autoOpenFromQuery = false,
  className,
  onError,
  onSuccess,
}: CustomerGoogleAuthButtonProps) {
  const router = useRouter();
  const { signInWithGoogle } = useAuth();

  const [checkingOAuth, setCheckingOAuth] = useState(false);
  const [submittingEmail, setSubmittingEmail] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [savedProfiles, setSavedProfiles] = useState<SelectableGoogleAccount[]>([]);

  const safeRedirect = useMemo(() => sanitizeCustomerNextPath(redirectTo), [redirectTo]);

  const refreshSavedGoogleAccounts = () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('dc-customers-registry');
      const list = raw ? (JSON.parse(raw) as CustomerProfile[]) : [];
      if (!Array.isArray(list)) return;

      const googleOnes: SelectableGoogleAccount[] = [];
      for (const item of list) {
        if (!item?.email) continue;
        const prefs = (item.preferences || {}) as Record<string, unknown>;
        const isGoogle =
          prefs.auth_provider === 'google' ||
          item.id?.startsWith('google-') ||
          item.email.toLowerCase().endsWith('@gmail.com');
        if (!isGoogle) continue;
        googleOnes.push({
          email: item.email.toLowerCase().trim(),
          full_name: item.full_name || item.email.split('@')[0],
          avatar_url:
            item.avatar_url ||
            buildGoogleAvatarDataUri(item.full_name || item.email, item.email),
          google_sub: typeof prefs.google_sub === 'string' ? prefs.google_sub : undefined,
          saved: true,
        });
      }
      setSavedProfiles(googleOnes);
    } catch {
      setSavedProfiles([]);
    }
  };

  useEffect(() => {
    if (!autoOpenFromQuery || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('google') === 'picker') {
      refreshSavedGoogleAccounts();
      setPickerOpen(true);
    }
  }, [autoOpenFromQuery]);

  const selectableAccounts = useMemo(() => {
    const merged = new Map<string, SelectableGoogleAccount>();
    for (const acc of savedProfiles) {
      merged.set(acc.email.toLowerCase(), acc);
    }
    for (const preset of QUICK_GOOGLE_ACCOUNTS) {
      const key = preset.email.toLowerCase();
      if (!merged.has(key)) {
        merged.set(key, preset);
      }
    }
    return Array.from(merged.values());
  }, [savedProfiles]);

  const handleContinueClick = async () => {
    onError?.(null);
    setPickerError(null);
    setCheckingOAuth(true);

    try {
      const res = await fetch(
        `/api/auth/google/start?format=json&next=${encodeURIComponent(safeRedirect)}`,
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        }
      );

      if (res.ok) {
        const data = await res.json();
        if (data?.mode === 'oauth' && typeof data?.authUrl === 'string') {
          window.location.assign(data.authUrl);
          return;
        }
      }
    } catch {
      // Fall back cleanly to interactive Google account selector
    } finally {
      setCheckingOAuth(false);
    }

    refreshSavedGoogleAccounts();
    setCustomMode(false);
    setPickerOpen(true);
  };

  const completeWithAccount = async (account: GoogleAccountInput) => {
    setPickerError(null);
    onError?.(null);
    const cleanEmail = account.email.trim().toLowerCase();

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setPickerError('Please enter a valid Google email address.');
      return;
    }

    setSubmittingEmail(cleanEmail);
    try {
      const result = await signInWithGoogle({
        email: cleanEmail,
        full_name: account.full_name?.trim(),
        avatar_url:
          account.avatar_url ||
          buildGoogleAvatarDataUri(account.full_name?.trim() || cleanEmail, cleanEmail),
        google_sub: account.google_sub,
      });

      if (result.error) {
        setPickerError(result.error);
        onError?.(result.error);
        return;
      }

      setPickerOpen(false);
      onSuccess?.();
      if (redirectOnSuccess) {
        router.push(safeRedirect);
      }
    } catch {
      const msg = 'Google sign-in failed. Please try again.';
      setPickerError(msg);
      onError?.(msg);
    } finally {
      setSubmittingEmail(null);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await completeWithAccount({
      email: customEmail,
      full_name: customName,
      google_sub: `local-${customEmail.trim().toLowerCase()}`,
    });
  };

  const busy = disabled || checkingOAuth || Boolean(submittingEmail);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={handleContinueClick}
        disabled={busy}
        className={cn(
          'w-full flex items-center justify-center gap-2.5 rounded-xl border-border/80 font-bold hover:bg-muted/60 transition-colors',
          compact ? 'h-9 text-xs' : 'h-11 sm:h-12 text-xs sm:text-sm',
          className
        )}
      >
        {checkingOAuth || submittingEmail ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        <span>{checkingOAuth || submittingEmail ? 'Connecting Google...' : 'Continue with Google'}</span>
      </Button>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md rounded-2xl p-4 sm:p-6">
          <DialogHeader className="text-left space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card shadow-xs">
                <GoogleIcon className="h-4 w-4" />
              </div>
              <DialogTitle className="text-base sm:text-lg font-extrabold tracking-tight">
                Choose a Google account
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Select your Google account to continue as a Customer on DealerConnect AI.
            </DialogDescription>
          </DialogHeader>

          {pickerError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              {pickerError}
            </div>
          )}

          {!customMode ? (
            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-0.5">
              {selectableAccounts.map((acc) => {
                const isThisBusy = submittingEmail === acc.email.toLowerCase();
                return (
                  <button
                    key={acc.email}
                    type="button"
                    disabled={Boolean(submittingEmail)}
                    onClick={() => completeWithAccount(acc)}
                    className="w-full flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left hover:bg-muted/60 hover:border-foreground/30 transition-all disabled:opacity-60"
                  >
                    <Image
                      src={
                        acc.avatar_url ||
                        buildGoogleAvatarDataUri(acc.full_name || acc.email, acc.email)
                      }
                      alt={acc.full_name || acc.email}
                      width={40}
                      height={40}
                      unoptimized
                      className="h-10 w-10 rounded-full object-cover border border-border shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-foreground truncate">
                          {acc.full_name || acc.email.split('@')[0]}
                        </p>
                        {acc.saved && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Saved
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{acc.email}</p>
                    </div>
                    {isThisBusy && <Loader2 className="h-4 w-4 animate-spin text-foreground shrink-0" />}
                  </button>
                );
              })}

              <button
                type="button"
                disabled={Boolean(submittingEmail)}
                onClick={() => {
                  setPickerError(null);
                  setCustomMode(true);
                }}
                className="w-full flex items-center gap-3 rounded-xl border border-dashed border-border px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground shrink-0">
                  <Plus className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">Use another Google account</p>
                  <p className="text-[11px] text-muted-foreground">
                    Enter your own Gmail or Google email address
                  </p>
                </div>
              </button>
            </div>
          ) : (
            <form onSubmit={handleCustomSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="google-account-name" className="text-xs font-bold">
                  Full Name
                </Label>
                <div className="relative">
                  <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="google-account-name"
                    type="text"
                    placeholder="Your Google profile name"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="h-10 pl-9 text-sm rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="google-account-email" className="text-xs font-bold">
                  Google Email *
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="google-account-email"
                    type="email"
                    placeholder="you@gmail.com"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    className="h-10 pl-9 text-sm rounded-xl"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPickerError(null);
                    setCustomMode(false);
                  }}
                  disabled={Boolean(submittingEmail)}
                  className="h-10 flex-1 rounded-xl font-bold text-xs"
                >
                  Back to accounts
                </Button>
                <Button
                  type="submit"
                  disabled={Boolean(submittingEmail)}
                  className="h-10 flex-1 rounded-xl font-bold text-xs"
                >
                  {submittingEmail ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Continuing...
                    </>
                  ) : (
                    'Continue'
                  )}
                </Button>
              </div>
            </form>
          )}

          <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>
              Customer Portal only — Dealer and Admin sessions remain separate.
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
