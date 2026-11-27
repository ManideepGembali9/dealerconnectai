'use client';

import { usePathname } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { Chatbot } from '@/components/chatbot';
import { TourGuide } from '@/components/tour-guide';

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboardView = pathname === '/admin' || pathname === '/dealer';
  const isPortalAuth =
    pathname === '/dealer/login' ||
    pathname === '/dealer/register' ||
    pathname === '/admin/login';

  // For /admin and /dealer dashboard views:
  // Use min-h-screen without root overflow-hidden so unauthenticated portal logins/registrations
  // can scroll naturally on all devices. Authenticated shells (DealerShell, AdminShell) manage
  // their own internal overflow-hidden and viewport locking.
  if (isDashboardView) {
    return (
      <div className="min-h-screen w-full bg-background text-foreground scrollbar-hide">
        {children}
      </div>
    );
  }

  // For portal auth pages (dealer login, dealer register, admin login):
  // Let the browser/window scroll naturally so mobile gestures and touch panning are 100% smooth.
  if (isPortalAuth) {
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
        <main className="flex-1 w-full pb-24 md:pb-10">{children}</main>
      </div>
      <MobileBottomNav />
      <Chatbot />
      <TourGuide />
    </>
  );
}
