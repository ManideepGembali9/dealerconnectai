'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Search, MapPin, Heart, User, LayoutDashboard, Package, MessageSquare, BarChart3, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useApp } from '@/lib/providers';

export function MobileBottomNav() {
  const pathname = usePathname();
  const { role } = useAuth();
  const { wishlist } = useApp();

  if (role === 'dealer' || role === 'admin') {
    const dealerNav = [
      { href: '/dealer', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/dealer?tab=products', label: 'Products', icon: Package },
      { href: '/dealer?tab=enquiries', label: 'Enquiries', icon: MessageSquare },
      { href: '/dealer?tab=analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/dealer?tab=settings', label: 'Profile', icon: Settings },
    ];

    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-background/95 backdrop-blur-lg md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-around">
          {dealerNav.map((item) => {
            const isActive = item.href.includes('?tab=') ? pathname === '/dealer' : pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className="flex flex-1 flex-col items-center gap-0.5 py-2">
                <item.icon className={cn('h-5 w-5', isActive ? 'text-primary' : 'text-muted-foreground')} />
                <span className={cn('text-[10px]', isActive ? 'font-medium text-primary' : 'text-muted-foreground')}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  const customerNav = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/search', label: 'Search', icon: Search },
    { href: '/nearby', label: 'Nearby', icon: MapPin },
    { href: role === 'customer' ? '/customer/favorites' : '/wishlist', label: 'Favorites', icon: Heart, badge: wishlist.length },
    { href: role === 'customer' ? '/customer/dashboard' : '/profile', label: role === 'customer' ? 'Dashboard' : 'Profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-background/95 backdrop-blur-lg md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-around">
        {customerNav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className="relative flex flex-1 flex-col items-center gap-0.5 py-2">
              <div className="relative">
                <item.icon className={cn('h-5 w-5 transition-colors', isActive ? 'text-primary' : 'text-muted-foreground')} />
                {item.badge && item.badge > 0 && (
                  <span className="absolute -right-2 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className={cn('text-[10px]', isActive ? 'font-medium text-primary' : 'text-muted-foreground')}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
