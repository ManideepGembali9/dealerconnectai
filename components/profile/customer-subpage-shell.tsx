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
      <div className="min-h-[calc(100dvh-4rem)] w-full overflow-x-hidden bg-[#0A0A0A] text-[#FFFFFF] px-4 py-20 flex flex-col items-center justify-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-[#FFFFFF] border-t-transparent" />
        <p className="text-xs font-medium text-[#A0A0A0]">Loading account details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-4rem)] w-full overflow-x-hidden bg-[#0A0A0A] text-[#FFFFFF] pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
      <div className="mx-auto max-w-2xl px-4 pt-5 pb-6 space-y-5">
        {/* Top Back Navigation */}
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 rounded-xl border border-[#292929] bg-[#151515] px-3 py-2 text-xs font-semibold text-[#FFFFFF] hover:bg-[#202020] transition-colors"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span>Back to Profile</span>
          </Link>
        </div>

        {/* Page Heading */}
        <div className="space-y-1 px-0.5">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#FFFFFF]">{title}</h1>
          {subtitle && <p className="text-xs sm:text-sm text-[#A0A0A0]">{subtitle}</p>}
        </div>

        {/* Auth Guard or Subpage Body */}
        {!customer ? (
          <div className="rounded-2xl border border-[#292929] bg-[#151515] p-6 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#202020] border border-[#292929]">
              <ShieldAlert className="h-5 w-5 text-[#FFFFFF]" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-[#FFFFFF]">Sign In Required</h2>
              <p className="text-xs text-[#A0A0A0] max-w-sm mx-auto">
                Sign in to your customer account to view and manage {title.toLowerCase()}.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              <Button
                asChild
                className="h-10 rounded-xl bg-[#FFFFFF] text-[#0A0A0A] hover:bg-[#E5E5E5] font-bold text-xs px-5"
              >
                <Link href={`/customer/login?redirect=${encodeURIComponent(redirectPath)}`}>
                  Customer Sign In
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-10 rounded-xl border-[#292929] bg-[#202020] text-[#FFFFFF] hover:bg-[#292929] font-semibold text-xs px-4"
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
