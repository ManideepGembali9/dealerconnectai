'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Search, MapPin, Mic, Camera, Menu, X, Store, LayoutDashboard, Sun, Moon, Laptop, Globe, Heart, Scale, LogIn, LogOut, Shield, User, Bell, MessageSquare, Settings, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/lib/providers';
import { useAuth } from '@/lib/auth';
import { LANGUAGES, Language } from '@/lib/i18n';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetHeader,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { fetchUnreadCount } from '@/lib/notifications';

export function SiteHeader() {
  const { t, lang, setLang, location, setLocation, wishlist, compare } = useApp();
  const { role, dealer, customer, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [pin, setPin] = useState(location.pinCode ?? '');
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleLogout = async () => {
    await signOut();
    router.push('/');
    toast.success('Signed out successfully');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (pin.trim()) params.set('pin', pin.trim());
    router.push(`/search?${params.toString()}`);
    setMobileOpen(false);
  };

  const handlePin = (value: string) => {    setPin(value);
    if (value.length === 6) {
      setLocation({ pinCode: value, label: value, lat: null, lng: null });
    }
  };

  const useLiveLocation = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ pinCode: null, label: 'Live location', lat: pos.coords.latitude, lng: pos.coords.longitude });
          toast('Location set to your current position');
        },
        () => {
          setLocation({ pinCode: '532440', label: 'Amalapuram, AP', lat: 16.9034, lng: 82.0175 });
          setPin('532440');
          toast('Using demo location (Amalapuram, 532440)');
        }
      );
    }
  };

  const navLinks = [
    { href: '/', label: t('home') },
    { href: '/categories', label: t('categories') },
    { href: '/ai-search', label: 'AI Search' },
    { href: '/nearby', label: 'Nearby Shops' },
    { href: '/search?sort=trending', label: t('trending') },
    { href: '/search?filter=offers', label: t('offers') },
    ...(role === 'customer' ? [
      { href: '/customer/dashboard', label: 'Dashboard' },
      { href: '/customer/settings', label: 'Settings' },
    ] : []),
    ...(role === 'dealer' ? [{ href: '/dealer', label: t('dealerDashboard') }] : []),
    ...(role === 'admin' ? [{ href: '/admin', label: t('adminDashboard') }] : []),
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href.split('?')[0]);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur-lg supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-sm">
            <Store className="h-5 w-5" />
          </div>
          <div className="hidden sm:block">
            <span className="text-base font-bold tracking-tight">DealerConnect</span>
            <span className="ml-1 bg-gradient-to-r from-primary to-accent bg-clip-text text-sm font-bold text-transparent">AI</span>
          </div>
        </Link>

        {/* Desktop search */}
        <form onSubmit={handleSearch} className="hidden flex-1 items-center gap-2 md:flex">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="h-10 pl-9 pr-24"
            />
            <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title={t('voiceSearch')}>
                <Mic className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title={t('imageSearch')}>
                <Camera className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="relative w-32">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={pin}
              onChange={(e) => handlePin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder={t('pincodePlaceholder')}
              className="h-10 pl-9"
              inputMode="numeric"
            />
          </div>
          <Button type="submit" className="h-10">
            <Search className="mr-1 h-4 w-4" /> {t('search')}
          </Button>
        </form>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={useLiveLocation} title={t('useLocation')} className="hidden sm:flex">
            <MapPin className="h-4 w-4" />
          </Button>
          <Link href="/wishlist" className="relative hidden sm:flex" title={t('wishlist')}>
            <Button variant="ghost" size="icon">
              <Heart className="h-4 w-4" />
              {wishlist.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {wishlist.length}
                </span>
              )}
            </Button>
          </Link>
          <Link href="/compare" className="relative hidden sm:flex" title={t('compare')}>
            <Button variant="ghost" size="icon">
              <Scale className="h-4 w-4" />
              {compare.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {compare.length}
                </span>
              )}
            </Button>
          </Link>

          {/* Notification bell */}
          <NotificationBell />

          {/* Language */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title={t('language')}>
                <Globe className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {LANGUAGES.map((l) => (
                <DropdownMenuItem
                  key={l.code}
                  onClick={() => setLang(l.code as Language)}
                  className={cn(lang === l.code && 'bg-accent/10 font-medium')}
                >
                  <span className="flex w-full items-center justify-between">
                    <span>{l.nativeLabel}</span>
                    <span className="text-xs text-muted-foreground">{l.label}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title={t('theme')}>
                {mounted ? (
                  theme === 'dark' ? <Moon className="h-4 w-4" /> : theme === 'light' ? <Sun className="h-4 w-4" /> : <Laptop className="h-4 w-4" />
                ) : <Sun className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme('light')}><Sun className="mr-2 h-4 w-4" /> Light</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}><Moon className="mr-2 h-4 w-4" /> Dark</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}><Laptop className="mr-2 h-4 w-4" /> System</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Link href="/dealer/register" className="hidden lg:block">
            <Button variant="outline" size="sm" className="ml-1">
              <Store className="mr-1.5 h-4 w-4" /> {t('becomeDealer')}
            </Button>
          </Link>

          {/* Auth */}
          {role === 'customer' ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="ml-1 hidden sm:flex">
                  <User className="mr-1.5 h-4 w-4" />
                  {customer?.full_name?.split(' ')[0] ?? 'Account'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => router.push('/customer/dashboard')}><LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/customer/settings')}><User className="mr-2 h-4 w-4" /> Profile</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/customer/favorites')}><Heart className="mr-2 h-4 w-4" /> Favorites</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/customer/search-history')}><Search className="mr-2 h-4 w-4" /> Search History</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/customer/enquiries')}><MessageSquare className="mr-2 h-4 w-4" /> Enquiries</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/customer/notifications')}><Bell className="mr-2 h-4 w-4" /> Notifications</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/customer/settings')}><Settings className="mr-2 h-4 w-4" /> Settings</DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-destructive"><LogOut className="mr-2 h-4 w-4" /> Sign Out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : role === 'dealer' || role === 'admin' ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="ml-1 hidden sm:flex">
                  {role === 'admin' ? <Shield className="mr-1.5 h-4 w-4" /> : <Store className="mr-1.5 h-4 w-4" />}
                  {role === 'admin' ? 'Admin' : dealer?.shop_name ?? 'Dealer'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {role === 'admin' && <DropdownMenuItem onClick={() => router.push('/admin')}><Shield className="mr-2 h-4 w-4" /> Admin Dashboard</DropdownMenuItem>}
                {role === 'dealer' && <DropdownMenuItem onClick={() => router.push('/dealer')}><Store className="mr-2 h-4 w-4" /> Dealer Dashboard</DropdownMenuItem>}
                <DropdownMenuItem onClick={handleLogout} className="text-destructive"><LogOut className="mr-2 h-4 w-4" /> Sign Out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="ml-1 hidden sm:flex">
                  <LogIn className="mr-1.5 h-4 w-4" /> Login / Sign Up
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push('/customer/login')}><User className="mr-2 h-4 w-4" /> Customer Login</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/customer/signup')}><User className="mr-2 h-4 w-4" /> Create Customer Account</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/dealer/login')}><Store className="mr-2 h-4 w-4" /> Dealer Login</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/admin/login')}><Shield className="mr-2 h-4 w-4" /> Admin Login</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-xs p-0">
              <SheetHeader className="px-5 pt-5">
                <SheetTitle className="text-left">Menu</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-3 p-5">
                <form onSubmit={handleSearch} className="flex flex-col gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchPlaceholder')} className="pl-9" />
                  </div>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={pin} onChange={(e) => handlePin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder={t('pincodePlaceholder')} className="pl-9" inputMode="numeric" />
                  </div>
                  <Button type="submit" className="w-full"><Search className="mr-1 h-4 w-4" /> {t('search')}</Button>
                </form>
                <nav className="flex flex-col gap-1">
                  {navLinks.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn('rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted', isActive(l.href) && 'bg-muted text-primary')}
                    >
                      {l.label}
                    </Link>
                  ))}
                </nav>
                <Link href="/wishlist" onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" className="w-full justify-start"><Heart className="mr-2 h-4 w-4" /> {t('wishlist')} ({wishlist.length})</Button>
                </Link>
                <Link href="/compare" onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" className="w-full justify-start"><Scale className="mr-2 h-4 w-4" /> {t('compare')} ({compare.length})</Button>
                </Link>
                <Link href="/dealer/register" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full"><Store className="mr-2 h-4 w-4" /> {t('becomeDealer')}</Button>
                </Link>
                {role === 'customer' ? (
                  <>
                    <Link href="/customer/dashboard" onClick={() => setMobileOpen(false)}><Button variant="outline" className="w-full justify-start"><LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard</Button></Link>
                    <Link href="/customer/favorites" onClick={() => setMobileOpen(false)}><Button variant="outline" className="w-full justify-start"><Heart className="mr-2 h-4 w-4" /> Favorites</Button></Link>
                    <Link href="/customer/enquiries" onClick={() => setMobileOpen(false)}><Button variant="outline" className="w-full justify-start"><MessageSquare className="mr-2 h-4 w-4" /> Enquiries</Button></Link>
                    <Link href="/customer/settings" onClick={() => setMobileOpen(false)}><Button variant="outline" className="w-full justify-start"><Settings className="mr-2 h-4 w-4" /> Settings</Button></Link>
                    <Button variant="outline" className="w-full" onClick={() => { handleLogout(); setMobileOpen(false); }}>
                      <LogOut className="mr-2 h-4 w-4" /> Sign Out
                    </Button>
                  </>
                ) : role ? (
                  <Button variant="outline" className="w-full" onClick={() => { handleLogout(); setMobileOpen(false); }}>
                    <LogOut className="mr-2 h-4 w-4" /> Sign Out ({role})
                  </Button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Link href="/customer/login" onClick={() => setMobileOpen(false)}>
                      <Button className="w-full"><User className="mr-2 h-4 w-4" /> Customer Login</Button>
                    </Link>
                    <Link href="/customer/signup" onClick={() => setMobileOpen(false)}>
                      <Button variant="outline" className="w-full"><User className="mr-2 h-4 w-4" /> Create Account</Button>
                    </Link>
                    <div className="flex gap-2">
                      <Link href="/dealer/login" onClick={() => setMobileOpen(false)} className="flex-1">
                        <Button variant="outline" className="w-full"><Store className="mr-2 h-4 w-4" /> Dealer</Button>
                      </Link>
                      <Link href="/admin/login" onClick={() => setMobileOpen(false)} className="flex-1">
                        <Button variant="ghost" className="w-full"><Shield className="mr-2 h-4 w-4" /> Admin</Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Desktop nav row */}
      <nav className="hidden border-t border-border/40 md:block">
        <div className="mx-auto flex max-w-7xl items-center gap-1 px-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scrollbar-hide">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'relative shrink-0 px-3 py-2.5 text-sm font-medium transition-colors hover:text-primary',
                  isActive(l.href) ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {l.label}
                {isActive(l.href) && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" />}
              </Link>
            ))}
          </div>
          <div className="ml-auto hidden shrink-0 items-center gap-2 lg:flex">
            {role !== 'dealer' && role !== 'admin' && (
              <Link href="/dealer/register" className="text-xs font-semibold text-primary hover:underline">
                Become a Dealer
              </Link>
            )}
            {location.label && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 text-primary" /> {location.label}
              </span>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}

function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let interval: ReturnType<typeof setInterval>;
    const load = async () => {
      try {
        const count = await fetchUnreadCount();
        setUnread(count);
      } catch { /* ignore */ }
    };
    load();
    interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Link href="/notifications" className="relative hidden sm:flex" title="Notifications">
      <Button variant="ghost" size="icon">
        <Bell className="h-4 w-4" />
        {mounted && unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Button>
    </Link>
  );
}
