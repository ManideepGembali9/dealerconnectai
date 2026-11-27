'use client';

import Link from 'next/link';
import { Store, Bell } from 'lucide-react';
import { useApp } from '@/lib/providers';

export function SiteHeader() {
  const { t } = useApp();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 text-foreground shadow-sm transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        
        {/* Brand Logo & Name */}
        <Link href="/" className="flex items-center gap-2.5 transition-transform active:scale-95">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black shadow-sm">
            <Store className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="text-left">
            <span className="text-base sm:text-lg font-black tracking-tight text-foreground">
              Dealer<span className="text-muted-foreground">Connect</span>
            </span>
            <span className="ml-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-black text-foreground">
              AI
            </span>
          </div>
        </Link>

        {/* Right Upper: Notification Symbol */}
        <div className="flex items-center">
          <Link
            href="/notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-all active:scale-95 shadow-sm"
            aria-label="Notifications"
            title={t('notifications') || 'Notifications'}
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
          </Link>
        </div>

      </div>
    </header>
  );
}
