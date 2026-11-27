'use client';

import { usePathname } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { TourGuide } from '@/components/tour-guide';

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboardView = pathname === '/admin' || pathname === '/dealer';
  const isPortalAuth =
    pathname === '/dealer/login' ||
    pathname === '/dealer/register' ||
    pathname === '/admin/login';

  // For /admin and /dealer dashboard views:
  // Authenticated shells (DealerShell, AdminShell) manage their own internal adaptive layout.
  if (isDashboardView || isPortalAuth) {
    return (
      <div className="min-h-screen w-full bg-background text-foreground scrollbar-hide">
        {children}
      </div>
    );
  }

  return (
    <>
      <div className="relative flex min-h-screen flex-col w-full overflow-x-clip">
        <SiteHeader />
        <main className="flex-1 w-full pb-20 md:pb-10">{children}</main>
      </div>
      <MobileBottomNav />
      <TourGuide />
    </>
  );
}
