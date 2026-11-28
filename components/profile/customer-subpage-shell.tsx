'use client';

import Link from 'next/link';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import type { CustomerProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';

export function isVerifiedCustomer(customer: CustomerProfile | null): boolean {
  if (!customer) return false;
  const prefs = (customer.preferences || {}) as Record<string, unknown>;
  return Boolean(
    prefs.verified === true ||
      prefs.email_verified === true ||
      prefs.phone_verified === true ||
      prefs.auth_provider === 'google'
  );
}

export async function compressAvatarFile(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read selected image file.'));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error('Unsupported image format.'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round((img.width || maxSize) * scale));
        const h = Math.max(1, Math.round((img.height || maxSize) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export function CustomerSubpageShell({
  title,
  subtitle,
  redirectPath,
  children,
}: {
  title: string;
  subtitle?: string;
  redirectPath: string;
  children: React.ReactNode;
}) {
  const { customer, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[calc(100dvh-4rem)] w-full overflow-x-hidden bg-background text-foreground px-4 py-20 flex flex-col items-center justify-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-xs font-medium text-muted-foreground">Loading account details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-4rem)] w-full overflow-x-hidden bg-background text-foreground pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
      {/* Clean Minimal Page Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/profile"
              aria-label="Back to My Account"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="truncate text-lg font-extrabold tracking-tight text-foreground">
              {title}
            </h1>
          </div>
          <Link
            href="/"
            className="hidden md:inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Home
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 pt-4 pb-6 space-y-4">
        {subtitle && <p className="text-xs sm:text-sm text-muted-foreground px-0.5">{subtitle}</p>}

        {!customer ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-4 shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted border border-border">
              <ShieldAlert className="h-5 w-5 text-foreground" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-foreground">Sign In Required</h2>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Sign in to your customer account to view and manage {title.toLowerCase()}.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              <Button
                asChild
                className="h-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs px-5"
              >
                <Link href={`/customer/login?redirect=${encodeURIComponent(redirectPath)}`}>
                  Customer Sign In
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-10 rounded-xl border-border text-foreground hover:bg-muted font-semibold text-xs px-4"
              >
                <Link href="/profile">Return to Profile</Link>
              </Button>
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
