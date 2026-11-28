'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Store,
  Bell,
  Home,
  LayoutGrid,
  Heart,
  ShoppingCart,
  User,
} from 'lucide-react';
import { useApp } from '@/lib/providers';
import { useAuth } from '@/lib/auth';
import { fetchUnreadCount } from '@/lib/notifications';
import { useRealtimeSync } from '@/lib/realtime-client';
import { cn } from '@/lib/utils';

export function SiteHeader() {
  const pathname = usePathname();
  const { wishlist, cartCount, t } = useApp();
  const { customer } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = () => {
    fetchUnreadCount({ id: customer?.id, email: customer?.email })
      .then((count) => {
        setUnreadCount(count);
      })
      .catch(() => {});
  };

  useRealtimeSync('all', refreshUnread, { onReconnect: refreshUnread });

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      fetchUnreadCount({ id: customer?.id, email: customer?.email })
        .then((count) => {
          if (mounted) setUnreadCount(count);
        })
        .catch(() => {});
    };
    refresh();
    window.addEventListener('dc-sync-event', refresh);
    window.addEventListener('dc-notification-sent', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      mounted = false;
      window.removeEventListener('dc-sync-event', refresh);
      window.removeEventListener('dc-notification-sent', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [pathname, customer?.id, customer?.email]);

  const navItems = [
    {
      href: '/',
      label: t('home') || 'Home',
      icon: Home,
      isActive: pathname === '/',
    },
    {
      href: '/categories',
      label: t('categories') || 'Categories',
      icon: LayoutGrid,
      isActive: pathname.startsWith('/categories'),
    },
    {
      href: '/wishlist',
      label: t('wishlist') || 'Wishlist',
      icon: Heart,
      badge: wishlist.length,
      isActive: pathname.startsWith('/wishlist'),
    },
    {
      href: '/cart',
      label: t('cart') || 'Cart',
      icon: ShoppingCart,
      badge: cartCount,
      isActive: pathname.startsWith('/cart'),
    },
    {
      href: '/profile',
      label: t('myProfile') || 'My Profile',
      icon: User,
      isActive:
        pathname === '/profile' ||
        pathname.startsWith('/profile') ||
        pathname.startsWith('/customer/profile'),
    },
  ];

  const customerInitials = customer?.full_name
    ? customer.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 text-foreground shadow-sm transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Brand Logo & Name */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 transition-transform active:scale-95"
        >
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

        {/* Responsive Tablet & Desktop Navigation (hidden on mobile < 768px) */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-1 lg:gap-1.5"
        >
          {navItems.map((item) => {
            const IconComp = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs lg:text-sm font-semibold transition-all duration-150 active:scale-95',
                  item.isActive
                    ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {item.href === '/profile' && customerInitials ? (
                  <span
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black',
                      item.isActive
                        ? 'bg-primary-foreground text-primary'
                        : 'bg-muted text-foreground border border-border'
                    )}
                  >
                    {customerInitials}
                  </span>
                ) : (
                  <IconComp className="h-4 w-4 shrink-0" />
                )}
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={cn(
                      'ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-black',
                      item.isActive
                        ? 'bg-primary-foreground text-primary'
                        : 'bg-primary text-primary-foreground'
                    )}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Upper: Notification Symbol */}
        <div className="flex shrink-0 items-center">
          <Link
            href="/notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-all active:scale-95 shadow-sm"
            aria-label="Notifications"
            title={t('notifications') || 'Notifications'}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 ? (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black text-primary-foreground ring-2 ring-background">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            ) : (
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
