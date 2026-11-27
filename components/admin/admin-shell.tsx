'use client';

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
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  ChevronLeft,
  ChevronRight,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Package,
  Palette,
  PanelsTopLeft,
  Settings,
  Shield,
  Sliders,
  Star,
  Store,Users
} from 'lucide-react';
import Link from 'next/link';
import { useMemo,useState } from 'react';
import { getStoredAdminMenu,type AdminMenuItem } from './admin-menu-config';
import { LayoutNavigationManager } from './layout-navigation-manager';

// Icon mapping helper
function renderModuleIcon(iconName: string, className = 'h-4 w-4') {
  switch (iconName) {
    case 'LayoutDashboard': return <LayoutDashboard className={className} />;
    case 'Store': return <Store className={className} />;
    case 'Users': return <Users className={className} />;
    case 'Package': return <Package className={className} />;
    case 'FolderTree': return <FolderTree className={className} />;
    case 'Building2': return <Building2 className={className} />;
    case 'Boxes': return <Boxes className={className} />;
    case 'MessageSquareText': return <MessageSquareText className={className} />;
    case 'Star': return <Star className={className} />;
    case 'PanelsTopLeft': return <PanelsTopLeft className={className} />;
    case 'Bell': return <Bell className={className} />;
    case 'BarChart3': return <BarChart3 className={className} />;
    case 'Palette': return <Palette className={className} />;
    case 'Settings': return <Settings className={className} />;
    default: return <Package className={className} />;
  }
}

type AdminShellProps = {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  pendingDealersCount?: number;
  openEnquiriesCount?: number;
  children: React.ReactNode;
};

export function AdminShell({
  activeTab,
  onTabChange,
  pendingDealersCount = 0,
  openEnquiriesCount = 0,
  children,
}: AdminShellProps) {
  const { signOut } = useAuth();
  const [menuItems, setMenuItems] = useState<AdminMenuItem[]>(() => getStoredAdminMenu());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [layoutManagerOpen, setLayoutManagerOpen] = useState(false);

  // Visible items filtered and sorted
  const visibleMenuItems = useMemo(() => {
    return menuItems
      .filter((item) => item.enabled)
      .sort((a, b) => a.order - b.order);
  }, [menuItems]);

  // Grouped visible items
  const groupedMenu = useMemo(() => {
    const groups: Record<string, AdminMenuItem[]> = {
      'Core Operations': [],
      'Catalog & Stores': [],
      'Engagement & Moderation': [],
      'Intelligence & System': [],
    };
    visibleMenuItems.forEach((item) => {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    });
    return groups;
  }, [visibleMenuItems]);

  const activeItem = useMemo(() => {
    return menuItems.find((i) => i.id === activeTab) || menuItems[0];
  }, [menuItems, activeTab]);

  const handleSelectTab = (tabId: string) => {
    onTabChange(tabId);
    setMobileDrawerOpen(false);
  };

  const handleLogout = async () => {
    await signOut('admin');
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground antialiased">
      {/* ======================================================== */}
      {/* 1. DESKTOP LEFT SIDEBAR                                    */}
      {/* ======================================================== */}
      <aside
        className={`hidden md:flex flex-col h-full shrink-0 border-r border-border/80 bg-card/60 backdrop-blur transition-all duration-200 z-30 ${
          sidebarCollapsed ? 'w-20' : 'w-64 lg:w-72'
        }`}
      >
        {/* Sidebar Brand Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-border/70">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20">
                <Shield className="h-5 w-5" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="font-black text-sm tracking-tight text-foreground truncate">
                  DealerConnect AI
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-primary">
                  Admin Control Center
                </span>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold">
              <Shield className="h-5 w-5" />
            </div>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hidden lg:flex"
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Sidebar Numbered Navigation List */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-3 py-4 space-y-6">
          {Object.entries(groupedMenu).map(([groupTitle, items]) => {
            if (items.length === 0) return null;
            return (
              <div key={groupTitle} className="space-y-1">
                {!sidebarCollapsed && (
                  <h4 className="px-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground/80 mb-1.5">
                    {groupTitle}
                  </h4>
                )}

                {items.map((item) => {
                  const isActive = activeTab === item.id;
                  const hasBadge =
                    (item.id === '02-dealers' && pendingDealersCount > 0) ||
                    (item.id === '08-enquiries' && openEnquiriesCount > 0);
                  const badgeCount =
                    item.id === '02-dealers' ? pendingDealersCount : openEnquiriesCount;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectTab(item.id)}
                      title={sidebarCollapsed ? `${item.number}. ${item.title}` : undefined}
                      className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                      }`}
                    >
                      {/* Number Prefix badge */}
                      <span
                        className={`font-mono text-[11px] font-bold shrink-0 ${
                          isActive
                            ? 'text-primary-foreground/90'
                            : 'text-muted-foreground/80 group-hover:text-primary'
                        }`}
                      >
                        {item.number}
                      </span>

                      {/* Icon */}
                      <span className="shrink-0">
                        {renderModuleIcon(item.iconName, 'h-4 w-4')}
                      </span>

                      {/* Title */}
                      {!sidebarCollapsed && (
                        <span className="flex-1 text-left truncate">{item.title}</span>
                      )}

                      {/* Urgent Notification Badges */}
                      {hasBadge && (
                        <span
                          className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                            isActive
                              ? 'bg-primary-foreground text-primary'
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
            );
          })}
        </div>

        {/* Sidebar Footer: Layout Manager & Admin Profile */}
        <div className="p-3 border-t border-border/70 space-y-2">
          {!sidebarCollapsed ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLayoutManagerOpen(true)}
                className="w-full justify-start text-xs font-semibold gap-2 h-9"
              >
                <Sliders className="h-3.5 w-3.5 text-primary" /> Customize Layout
              </Button>

              <div className="flex items-center justify-between p-2 rounded-xl bg-muted/40 border border-border/50 text-xs">
                <div className="truncate">
                  <span className="font-bold text-foreground block truncate">Super Admin</span>
                  <span className="text-[10px] text-muted-foreground truncate block">
                    admin@dealerconnect.ai
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
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLayoutManagerOpen(true)}
                className="h-8 w-8 p-0"
                title="Customize Layout"
              >
                <Sliders className="h-4 w-4 text-primary" />
              </Button>
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
      <div className="flex flex-1 flex-col h-full min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center justify-between px-4 sm:px-6 border-b border-border/80 bg-card/40 backdrop-blur z-20">
          {/* Mobile hamburger menu & active title */}
          <div className="flex items-center gap-3">
            {/* Mobile Navigation Drawer Trigger */}
            <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="md:hidden h-9 w-9 p-0 rounded-xl"
                  aria-label="Open Navigation"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0 flex flex-col">
                <SheetHeader className="p-4 border-b border-border/70 text-left">
                  <SheetTitle className="flex items-center gap-2 text-base font-black">
                    <Shield className="h-5 w-5 text-primary" /> Admin Control Center
                  </SheetTitle>
                  <p className="text-[11px] text-muted-foreground">
                    DealerConnect AI System Modules
                  </p>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto scrollbar-hide p-3 space-y-4">
                  {Object.entries(groupedMenu).map(([groupTitle, items]) => {
                    if (items.length === 0) return null;
                    return (
                      <div key={groupTitle} className="space-y-1">
                        <h4 className="px-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground/80 mb-1">
                          {groupTitle}
                        </h4>
                        {items.map((item) => {
                          const isActive = activeTab === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleSelectTab(item.id)}
                              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                                isActive
                                  ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                              }`}
                            >
                              <span className="font-mono text-[11px] shrink-0 font-bold">
                                {item.number}
                              </span>
                              {renderModuleIcon(item.iconName, 'h-4 w-4 shrink-0')}
                              <span className="flex-1 text-left truncate">{item.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 border-t border-border/70 space-y-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setMobileDrawerOpen(false);
                      setLayoutManagerOpen(true);
                    }}
                    className="w-full text-xs font-semibold gap-2 h-9"
                  >
                    <Sliders className="h-4 w-4 text-primary" /> Customize Layout
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleLogout}
                    className="w-full text-xs font-bold gap-2 h-9"
                  >
                    <LogOut className="h-4 w-4" /> Admin Logout
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            {/* Breadcrumb Module Indicator */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs font-bold px-2 py-0.5">
                {activeItem?.number || '01'}
              </Badge>
              <h2 className="text-base font-bold text-foreground sm:text-lg">
                {activeItem?.title || 'Dashboard'}
              </h2>
            </div>
          </div>

          {/* Right Topbar Actions */}
          <div className="flex items-center gap-2 sm:gap-3">

            <Button
              variant="outline"
              size="sm"
              onClick={() => setLayoutManagerOpen(true)}
              className="hidden lg:flex h-9 gap-1.5 text-xs font-semibold"
            >
              <Sliders className="h-3.5 w-3.5 text-primary" /> Arrange Modules
            </Button>

            <Link href="/" target="_blank" className="hidden sm:inline-flex">
              <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs text-muted-foreground">
                Customer App <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </Link>

            {/* Admin Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2 px-2.5 rounded-xl border-border/80"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">
                    A
                  </div>
                  <span className="hidden sm:inline text-xs font-bold">Admin</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-xs font-bold leading-none">Super Administrator</p>
                    <p className="text-[11px] leading-none text-muted-foreground">
                      admin@dealerconnect.ai
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleSelectTab('14-settings')}
                  className="text-xs cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" /> System Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLayoutManagerOpen(true)}
                  className="text-xs cursor-pointer"
                >
                  <Sliders className="mr-2 h-4 w-4" /> Layout Manager
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

        {/* Scrollable Module Content Area */}
        <main
          className="flex-1 min-h-0 overflow-y-auto scroll-smooth scrollbar-hide p-4 pb-24 sm:p-6 md:pb-8 lg:p-8 overscroll-contain touch-pan-y"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>

        {/* Mobile App Bottom Quick Navigation Bar (< 768px) */}
        <nav
          aria-label="Admin Mobile Navigation"
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="flex items-center justify-around px-1 py-1.5">
            {[
              { id: '01-dashboard', label: 'Overview', icon: LayoutDashboard },
              { id: '02-dealers', label: 'Dealers', icon: Store, badge: pendingDealersCount },
              { id: '04-products', label: 'Products', icon: Package },
              { id: '08-enquiries', label: 'Enquiries', icon: MessageSquareText, badge: openEnquiriesCount },
            ].map((item) => {
              const IconComp = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectTab(item.id)}
                  className={`relative flex flex-1 flex-col items-center justify-center py-1 transition-all active:scale-95 ${
                    isActive ? 'text-primary font-black' : 'text-muted-foreground'
                  }`}
                >
                  <div className="relative">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                        isActive ? 'bg-primary text-primary-foreground shadow-xs' : ''
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
              onClick={() => setMobileDrawerOpen(true)}
              className="flex flex-1 flex-col items-center justify-center py-1 text-muted-foreground active:scale-95"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl">
                <Menu className="h-4 w-4" />
              </div>
              <span className="mt-0.5 text-[10px] leading-none">Modules</span>
            </button>
          </div>
        </nav>
      </div>

      {/* Global Layout & Navigation Manager Modal */}
      <LayoutNavigationManager
        open={layoutManagerOpen}
        onOpenChange={setLayoutManagerOpen}
        menuItems={menuItems}
        onUpdateMenu={(newItems) => setMenuItems(newItems)}
      />
    </div>
  );
}
