'use client';

import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel,
  DropdownMenuSeparator,DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,SheetContent,SheetHeader,SheetTitle,SheetTrigger,
} from '@/components/ui/sheet';
import { useAuth } from '@/lib/auth';
import { useApp } from '@/lib/providers';
import type { Dealer } from '@/lib/types';
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  HelpCircle,
  LayoutDashboard,
  LogOut,Menu,
  MessageSquareText,
  Package,PlusCircle,
  Settings,
  Star,
  Store,
  Truck
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { DEALER_MENU_ITEMS,type DealerMenuItem } from './dealer-menu-config';

function renderDealerIcon(iconName: string, className = 'h-4 w-4') {
  switch (iconName) {
    case 'LayoutDashboard': return <LayoutDashboard className={className} />;
    case 'Store': return <Store className={className} />;
    case 'Package': return <Package className={className} />;
    case 'PlusCircle': return <PlusCircle className={className} />;
    case 'Boxes': return <Boxes className={className} />;
    case 'DollarSign': return <DollarSign className={className} />;
    case 'CheckCircle2': return <CheckCircle2 className={className} />;
    case 'MessageSquareText': return <MessageSquareText className={className} />;
    case 'Star': return <Star className={className} />;
    case 'Bell': return <Bell className={className} />;
    case 'BarChart3': return <BarChart3 className={className} />;
    case 'Truck': return <Truck className={className} />;
    case 'HelpCircle': return <HelpCircle className={className} />;
    case 'Settings': return <Settings className={className} />;
    case 'LogOut': return <LogOut className={className} />;
    default: return <Store className={className} />;
  }
}

type DealerShellProps = {
  dealer: Dealer;
  activeTab: string;
  onTabChange: (tabId: string) => void;
  pendingEnquiriesCount?: number;
  outOfStockCount?: number;
  children: React.ReactNode;
};

export function DealerShell({
  dealer,
  activeTab,
  onTabChange,
  pendingEnquiriesCount = 0,
  outOfStockCount = 0,
  children,
}: DealerShellProps) {
  const { signOut } = useAuth();
  const { lang } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const activeItem = DEALER_MENU_ITEMS.find((m) => m.id === activeTab) || DEALER_MENU_ITEMS[0];
  const activeTitle = activeItem?.translations?.[lang] || activeItem?.translations?.['en'] || activeItem?.title || 'Dashboard';

  const handleSelectTab = async (item: DealerMenuItem) => {
    if (item.id === '15-logout') {
      await signOut('dealer');
      return;
    }
    onTabChange(item.id);
    setDrawerOpen(false);
  };

  const handleLogout = async () => {
    await signOut('dealer');
  };

  return (
    <div className="flex h-screen md:h-[100dvh] w-full overflow-hidden bg-background text-foreground antialiased">
      {/* ======================================================== */}
      {/* 1. DESKTOP LEFT SIDEBAR                                    */}
      {/* ======================================================== */}
      <aside
        className={`hidden md:flex flex-col h-full shrink-0 border-r border-border/80 bg-card/60 backdrop-blur transition-all duration-200 z-30 ${
          collapsed ? 'w-20' : 'w-64 lg:w-72'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-border/70">
          {!collapsed ? (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/20">
                <Store className="h-5 w-5" />
              </div>
              <div className="flex flex-col leading-tight truncate">
                <span className="font-black text-sm tracking-tight text-foreground truncate">
                  {dealer.shop_name}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                  Dealer Portal
                </span>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold">
              <Store className="h-5 w-5" />
            </div>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCollapsed(!collapsed)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hidden lg:flex"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* 15 Ordered Navigation Items */}
        <div
          className="flex-1 min-h-0 overflow-y-auto scroll-smooth scrollbar-hide px-3 py-4 space-y-1 touch-pan-y"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {DEALER_MENU_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            const isLogout = item.id === '15-logout';
            const displayTitle = item.translations?.[lang] || item.translations?.['en'] || item.title;
            const hasBadge =
              (item.id === '08-enquiries' && pendingEnquiriesCount > 0) ||
              (item.id === '07-stock' && outOfStockCount > 0);
            const badgeCount =
              item.id === '08-enquiries' ? pendingEnquiriesCount : outOfStockCount;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectTab(item)}
                title={collapsed ? `${item.number}. ${displayTitle}` : undefined}
                className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : isLogout
                    ? 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                }`}
              >
                {/* Number Prefix */}
                <span
                  className={`font-mono text-[11px] font-bold shrink-0 ${
                    isActive
                      ? 'text-white'
                      : 'text-muted-foreground/80 group-hover:text-emerald-600'
                  }`}
                >
                  {item.number}
                </span>

                {/* Icon */}
                <span className="shrink-0">{renderDealerIcon(item.iconName, 'h-4 w-4')}</span>

                {/* Title */}
                {!collapsed && <span className="flex-1 text-left truncate">{displayTitle}</span>}

                {/* Alert Badge */}
                {hasBadge && (
                  <span
                    className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                      isActive
                        ? 'bg-white text-emerald-600'
                        : 'bg-destructive text-destructive-foreground animate-pulse'
                    }`}
                  >
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-border/70 space-y-2">
          {!collapsed ? (
            <div className="flex items-center justify-between p-2 rounded-xl bg-muted/40 border border-border/50 text-xs">
              <div className="truncate">
                <span className="font-bold text-foreground block truncate">
                  {dealer.owner_name}
                </span>
                <span className="text-[10px] text-muted-foreground truncate block font-mono">
                  {dealer.phone}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleLogout}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex justify-center">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleLogout}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* ======================================================== */}
      {/* 2. MAIN APPLICATION CONTENT AREA                          */}
      {/* ======================================================== */}
      <div className="flex flex-1 flex-col h-full min-h-0 min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="flex h-16 shrink-0 items-center justify-between px-4 sm:px-6 border-b border-border/80 bg-card/40 backdrop-blur z-20">
          {/* Mobile hamburger & Active Title */}
          <div className="flex items-center gap-3">
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="md:hidden h-9 w-9 p-0 rounded-xl"
                  aria-label="Open Navigation Drawer"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0 flex flex-col">
                <SheetHeader className="p-4 border-b border-border/70 text-left">
                  <SheetTitle className="flex items-center gap-2 text-base font-black">
                    <Store className="h-5 w-5 text-emerald-600" /> {dealer.shop_name}
                  </SheetTitle>
                  <p className="text-[11px] text-muted-foreground">
                    Dealer Merchant Management Console
                  </p>
                </SheetHeader>

                <div
                  className="flex-1 min-h-0 overflow-y-auto scroll-smooth scrollbar-hide p-3 space-y-1 touch-pan-y"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  {DEALER_MENU_ITEMS.map((item) => {
                    const isActive = activeTab === item.id;
                    const isLogout = item.id === '15-logout';
                    const displayTitle = item.translations?.[lang] || item.translations?.['en'] || item.title;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectTab(item)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                          isActive
                            ? 'bg-emerald-600 text-white font-bold shadow-sm'
                            : isLogout
                            ? 'text-destructive hover:bg-destructive/10'
                            : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                        }`}
                      >
                        <span className="font-mono text-[11px] font-bold shrink-0">
                          {item.number}
                        </span>
                        {renderDealerIcon(item.iconName, 'h-4 w-4 shrink-0')}
                        <span className="flex-1 text-left truncate">{displayTitle}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="p-4 border-t border-border/70">
                  <Button
                    variant="destructive"
                    onClick={handleLogout}
                    className="w-full text-xs font-bold gap-2 h-9"
                  >
                    <LogOut className="h-4 w-4" /> Dealer Logout
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            {/* Breadcrumb Title */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs font-bold px-2 py-0.5">
                {activeItem?.number || '01'}
              </Badge>
              <h2 className="text-base font-bold text-foreground sm:text-lg">
                {activeTitle}
              </h2>
            </div>
          </div>

          {/* Right Topbar Controls */}
          <div className="flex items-center gap-2 sm:gap-3">

            <LanguageSwitcher className="h-9 px-2.5 text-xs" />
            <ThemeToggle />

            <Link href={`/dealer/${dealer.id}`} target="_blank" className="hidden sm:inline-flex">
              <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs text-muted-foreground">
                Public Showroom <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </Link>

            {/* Dealer Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2 px-2.5 rounded-xl border-border/80"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-xs">
                    {dealer.shop_name.charAt(0)}
                  </div>
                  <span className="hidden sm:inline text-xs font-bold truncate max-w-[120px]">
                    {dealer.shop_name}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-xs font-bold leading-none">{dealer.shop_name}</p>
                    <p className="text-[11px] leading-none text-muted-foreground">{dealer.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onTabChange('02-profile')}
                  className="text-xs cursor-pointer"
                >
                  <Store className="mr-2 h-4 w-4" /> Shop Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onTabChange('14-settings')}
                  className="text-xs cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" /> Account Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-xs text-destructive cursor-pointer font-semibold"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Scrollable Module Area (Fully Functional Smooth Mouse Wheel, Touchpad & Finger Touch) */}
        <main
          className="flex-1 min-h-0 overflow-y-auto scroll-smooth scrollbar-hide p-4 pb-24 sm:p-6 md:pb-10 lg:p-8 overscroll-contain touch-pan-y"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>

        {/* Mobile App Bottom Quick Navigation Bar (< 768px) */}
        <nav
          aria-label="Dealer Mobile Navigation"
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="flex items-center justify-around px-1 py-1.5">
            {[
              { id: '01-dashboard', label: 'Home', icon: LayoutDashboard },
              { id: '03-products', label: 'Products', icon: Package, badge: outOfStockCount },
              { id: '08-enquiries', label: 'Leads', icon: MessageSquareText, badge: pendingEnquiriesCount },
              { id: '13-support', label: 'Support', icon: HelpCircle },
            ].map((item) => {
              const IconComp = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onTabChange(item.id);
                    setDrawerOpen(false);
                  }}
                  className={`relative flex flex-1 flex-col items-center justify-center py-1 transition-all active:scale-95 ${
                    isActive ? 'text-emerald-600 font-black' : 'text-muted-foreground'
                  }`}
                >
                  <div className="relative">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                        isActive ? 'bg-emerald-600 text-white shadow-xs' : ''
                      }`}
                    >
                      <IconComp className="h-4 w-4" />
                    </div>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-black text-destructive-foreground">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span className="mt-0.5 text-[10px] leading-none truncate">{item.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex flex-1 flex-col items-center justify-center py-1 text-muted-foreground active:scale-95"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl">
                <Menu className="h-4 w-4" />
              </div>
              <span className="mt-0.5 text-[10px] leading-none">Menu</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
