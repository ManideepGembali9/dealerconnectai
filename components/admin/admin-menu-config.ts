export type AdminMenuGroup = 'Core Operations' | 'Catalog & Stores' | 'Engagement & Moderation' | 'Intelligence & System';

export type AdminMenuItem = {
  id: string;
  number: string;
  title: string;
  shortDesc: string;
  iconName: string;
  group: AdminMenuGroup;
  enabled: boolean;
  locked?: boolean; // Cannot be disabled (prevents losing access to security & settings)
  order: number;
};

export const DEFAULT_ADMIN_MENU: AdminMenuItem[] = [
  {
    id: '01-dashboard',
    number: '01',
    title: 'Dashboard',
    shortDesc: 'Platform metrics, quick actions & system summary',
    iconName: 'LayoutDashboard',
    group: 'Core Operations',
    enabled: true,
    locked: true,
    order: 1,
  },
  {
    id: '02-dealers',
    number: '02',
    title: 'Dealer Management',
    shortDesc: 'Dealer onboarding, verifications & approvals',
    iconName: 'Store',
    group: 'Core Operations',
    enabled: true,
    order: 2,
  },
  {
    id: '03-customers',
    number: '03',
    title: 'Customer Management',
    shortDesc: 'User accounts, activity & customer statuses',
    iconName: 'Users',
    group: 'Core Operations',
    enabled: true,
    order: 3,
  },
  {
    id: '04-products',
    number: '04',
    title: 'Product Management',
    shortDesc: 'Master product catalog, AI tools & specs',
    iconName: 'Package',
    group: 'Catalog & Stores',
    enabled: true,
    order: 4,
  },
  {
    id: '05-categories',
    number: '05',
    title: 'Category Management',
    shortDesc: '8 major groups, 30 categories & hierarchy',
    iconName: 'FolderTree',
    group: 'Catalog & Stores',
    enabled: true,
    order: 5,
  },
  {
    id: '07-inventory',
    number: '06',
    title: 'Inventory Management',
    shortDesc: 'Cross-dealer stock, prices & availability',
    iconName: 'Boxes',
    group: 'Catalog & Stores',
    enabled: true,
    order: 6,
  },
  {
    id: '08-enquiries',
    number: '07',
    title: 'Customer Enquiries',
    shortDesc: 'Customer queries, quotes & showroom leads',
    iconName: 'MessageSquareText',
    group: 'Engagement & Moderation',
    enabled: true,
    order: 7,
  },
  {
    id: '15-dealer-leads',
    number: '08',
    title: 'Dealer Enquiry & Lead Management',
    shortDesc: 'Dealer-to-Admin support tickets & partner escalations',
    iconName: 'Headphones',
    group: 'Engagement & Moderation',
    enabled: true,
    order: 8,
  },
  {
    id: '09-reviews',
    number: '09',
    title: 'Reviews and Ratings',
    shortDesc: 'Multi-criteria customer feedback moderation',
    iconName: 'Star',
    group: 'Engagement & Moderation',
    enabled: true,
    order: 9,
  },
  {
    id: '10-homepage',
    number: '10',
    title: 'Homepage Management',
    shortDesc: 'Customer app sections, banners & ordering',
    iconName: 'PanelsTopLeft',
    group: 'Engagement & Moderation',
    enabled: true,
    order: 10,
  },
  {
    id: '11-notifications',
    number: '11',
    title: 'Notifications',
    shortDesc: 'Segmented push notifications & announcements',
    iconName: 'Bell',
    group: 'Engagement & Moderation',
    enabled: true,
    order: 11,
  },
  {
    id: '12-analytics',
    number: '12',
    title: 'Analytics and Reports',
    shortDesc: 'Live database charts, search trends & logs',
    iconName: 'BarChart3',
    group: 'Intelligence & System',
    enabled: true,
    order: 12,
  },
  {
    id: '13-customization',
    number: '13',
    title: 'App Customization',
    shortDesc: 'Branding, logos, themes & color schemes',
    iconName: 'Palette',
    group: 'Intelligence & System',
    enabled: true,
    order: 13,
  },
  {
    id: '14-settings',
    number: '14',
    title: 'Settings',
    shortDesc: 'Admin security, password & system preferences',
    iconName: 'Settings',
    group: 'Intelligence & System',
    enabled: true,
    locked: true,
    order: 14,
  },
];

const MENU_STORAGE_KEY = 'dc_admin_menu_arrangement_v1';

export function getStoredAdminMenu(): AdminMenuItem[] {
  if (typeof window === 'undefined') return DEFAULT_ADMIN_MENU;
  try {
    const raw = localStorage.getItem(MENU_STORAGE_KEY);
    if (!raw) return DEFAULT_ADMIN_MENU;
    const parsed = (JSON.parse(raw) as AdminMenuItem[]).filter((item) => item.id !== '06-brands');
    // Ensure all current items exist even if an older stored version has missing items
    const existingIds = new Set(parsed.map((item) => item.id));
    const merged = [...parsed];
    for (const def of DEFAULT_ADMIN_MENU) {
      if (!existingIds.has(def.id)) {
        merged.push({ ...def });
      } else {
        // Keep renamed titles up to date when defaults evolve
        const idx = merged.findIndex((m) => m.id === def.id);
        if (idx >= 0 && def.id === '08-enquiries') {
          merged[idx] = { ...merged[idx], title: def.title, shortDesc: def.shortDesc };
        }
      }
    }
    // Always keep locked items enabled
    return merged
      .filter((item) => item.id !== '06-brands')
      .map((item) => (item.locked ? { ...item, enabled: true } : item))
      .sort((a, b) => a.order - b.order);
  } catch {
    return DEFAULT_ADMIN_MENU;
  }
}

export function saveStoredAdminMenu(menu: AdminMenuItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(menu));
    window.dispatchEvent(new CustomEvent('dc-admin-menu-updated', { detail: menu }));
  } catch {}
}
