'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Home,
  LayoutGrid,
  Heart,
  ShoppingCart,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/providers';

export function MobileBottomNav() {
  const pathname = usePathname();
  const { wishlist, cartCount } = useApp();

  // Exact 5 items requested: Home, Categories, Wishlist, Cart, My Profile
  const navItems = [
    {
      href: '/',
      label: 'Home',
      icon: Home,
      isActive: pathname === '/',
    },
    {
      href: '/categories',
      label: 'Categories',
      icon: LayoutGrid,
      isActive: pathname.startsWith('/categories'),
    },
    {
      href: '/wishlist',
      label: 'Wishlist',
      icon: Heart,
      badge: wishlist.length,
      isActive: pathname.startsWith('/wishlist'),
    },
    {
      href: '/cart',
      label: 'Cart',
      icon: ShoppingCart,
      badge: cartCount,
      isActive: pathname.startsWith('/cart'),
    },
    {
      href: '/profile',
      label: 'My Profile',
      icon: User,
      isActive:
        pathname === '/profile' ||
        pathname.startsWith('/profile') ||
        pathname.startsWith('/customer/profile'),
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur text-foreground shadow-lg md:hidden transition-colors"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around px-1 py-1.5">
        {navItems.map((item) => {
          const ActiveIcon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex min-w-0 flex-1 flex-col items-center justify-center py-1 transition-all active:scale-95',
                item.isActive
                  ? 'text-foreground font-black'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className="relative">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-xl transition-all',
                    item.isActive && 'bg-primary text-primary-foreground shadow-sm'
                  )}
                >
                  <ActiveIcon
                    className={cn(
                      'h-4 w-4 transition-transform',
                      item.isActive && 'scale-105'
                    )}
                  />
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black text-primary-foreground ring-2 ring-background shadow-sm">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  'mt-0.5 max-w-full truncate px-0.5 text-[10px] sm:text-[11px] font-medium leading-none tracking-tight',
                  item.isActive && 'font-black text-foreground'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
