'use client';

import { usePathname } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { TourGuide } from '@/components/tour-guide';

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const isHomePage = pathname === '/';
  const isDashboardView = pathname === '/admin' || pathname === '/dealer';
  const isPortalAuth =
    pathname === '/dealer/login' ||
    pathname === '/dealer/register' ||
    pathname === '/admin/login';
  const isCustomerAuth =
    pathname === '/customer/login' ||
    pathname === '/customer/signup' ||
    pathname === '/customer/forgot-password' ||
    pathname === '/customer/callback';

  // For /admin and /dealer dashboard views and portal auth screens:
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
        {isHomePage && <SiteHeader />}
        <main className={isCustomerAuth ? 'flex-1 w-full' : 'flex-1 w-full pb-24 md:pb-10'}>
          {children}
        </main>
      </div>
      {!isCustomerAuth && <MobileBottomNav />}
      {isHomePage && <TourGuide />}
    </>
  );
}
