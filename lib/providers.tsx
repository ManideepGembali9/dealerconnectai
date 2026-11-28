'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { toast } from 'sonner';
import { Language, t as translate, LANGUAGES } from './i18n';
import type { AppSettings, Product, ThemePreset } from './types';
import { INITIAL_APP_SETTINGS } from './seed-data';
import {
  getDbAppSettings,
  getDbFavorites,
  saveDbAppSettings,
  toggleDbFavorite,
} from './firebase-db';
import { useRealtimeSync } from './realtime-client';

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}

// ---------- Dynamic Theme Engine ----------

const PRESET_COLOR_MAP: Record<
  ThemePreset,
  {
    primary: string;
    secondary: string;
    accent: string;
    background?: string;
    header?: string;
    navigation?: string;
  }
> = {
  'black-white': {
    primary: '#171717',
    secondary: '#f4f4f5',
    accent: '#ececed',
  },
  'gold-navy': {
    primary: '#d4a017',
    secondary: '#1e293b',
    accent: '#fef3c7',
    header: '#0f172a',
    navigation: '#0f172a',
  },
  'gold-black': {
    primary: '#eab308',
    secondary: '#18181b',
    accent: '#fef08a',
  },
  blue: {
    primary: '#2563eb',
    secondary: '#eff6ff',
    accent: '#dbeafe',
  },
  'green-white': {
    primary: '#16a34a',
    secondary: '#f0fdf4',
    accent: '#dcfce7',
  },
  'royal-purple': {
    primary: '#7c3aed',
    secondary: '#f5f3ff',
    accent: '#ede9fe',
  },
  sunset: {
    primary: '#ea580c',
    secondary: '#fff7ed',
    accent: '#ffedd5',
  },
  emerald: {
    primary: '#059669',
    secondary: '#ecfdf5',
    accent: '#d1fae5',
  },
  ocean: {
    primary: '#0284c7',
    secondary: '#f0f9ff',
    accent: '#e0f2fe',
  },
  'navy-light': {
    primary: '#1d4ed8',
    secondary: '#f8fafc',
    accent: '#e2e8f0',
  },
  'gold-sand': {
    primary: '#b45309',
    secondary: '#fffbeb',
    accent: '#fef3c7',
  },
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function hexToHslString(hex: string): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function contrastForegroundHsl(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '0 0% 98%';
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.62 ? '0 0% 9%' : '0 0% 98%';
}

function applyThemeToDocument(settings: AppSettings) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const themeClasses = Array.from(root.classList).filter((c) => c.startsWith('theme-'));
  themeClasses.forEach((c) => root.classList.remove(c));

  const preset = settings.theme_preset || 'black-white';
  root.classList.add(`theme-${preset}`);
  root.setAttribute('data-theme-preset', preset);

  const presetDef = PRESET_COLOR_MAP[preset] || PRESET_COLOR_MAP['black-white'];
  const custom = settings.custom_colors || {};

  const primaryHex = custom.button || custom.primary || settings.primary_color || presetDef.primary;
  const secondaryHex = custom.secondary || settings.secondary_color || presetDef.secondary;
  const accentHex = custom.accent || settings.accent_color || presetDef.accent;
  const headerHex = custom.header || presetDef.header || null;
  const navHex = custom.navigation || presetDef.navigation || null;

  const isDefaultMonochrome =
    preset === 'black-white' &&
    !custom.primary &&
    !custom.secondary &&
    !custom.accent &&
    !custom.button &&
    !custom.header &&
    !custom.navigation &&
    (!settings.primary_color || settings.primary_color === INITIAL_APP_SETTINGS.primary_color);

  const vars = [
    '--primary',
    '--primary-foreground',
    '--ring',
    '--secondary',
    '--secondary-foreground',
    '--accent',
    '--accent-foreground',
    '--dc-header-bg',
    '--dc-nav-bg',
    '--dc-primary-hex',
  ];

  if (isDefaultMonochrome) {
    vars.forEach((v) => root.style.removeProperty(v));
  } else {
    const primaryHsl = hexToHslString(primaryHex);
    const secondaryHsl = hexToHslString(secondaryHex);
    const accentHsl = hexToHslString(accentHex);

    if (primaryHsl) {
      root.style.setProperty('--primary', primaryHsl);
      root.style.setProperty('--primary-foreground', contrastForegroundHsl(primaryHex));
      root.style.setProperty('--ring', primaryHsl);
      root.style.setProperty('--dc-primary-hex', primaryHex);
    }
    if (secondaryHsl) {
      root.style.setProperty('--secondary', secondaryHsl);
      root.style.setProperty('--secondary-foreground', contrastForegroundHsl(secondaryHex));
    }
    if (accentHsl) {
      root.style.setProperty('--accent', accentHsl);
      root.style.setProperty('--accent-foreground', contrastForegroundHsl(accentHex));
    }
    if (headerHex) {
      root.style.setProperty('--dc-header-bg', headerHex);
    } else {
      root.style.removeProperty('--dc-header-bg');
    }
    if (navHex) {
      root.style.setProperty('--dc-nav-bg', navHex);
    } else {
      root.style.removeProperty('--dc-nav-bg');
    }
  }

  // Apply Admin default appearance only if user has not manually chosen one
  try {
    const savedUserTheme = localStorage.getItem('theme');
    if (!savedUserTheme && settings.default_appearance && settings.default_appearance !== 'system') {
      if (settings.default_appearance === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  } catch {}
}

// ---------- App context: language, location, wishlist, compare, cart, appSettings ----------

export type AppLocation = {
  pinCode: string | null;
  label: string | null;
  lat: number | null;
  lng: number | null;
};

export type CartItem = {
  product: Product;
  quantity: number;
  selectedVariant?: string;
};

type AppContextType = {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string) => string;
  location: AppLocation;
  setLocation: (l: AppLocation) => void;
  wishlist: string[];
  toggleWishlist: (id: string) => void;
  compare: string[];
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
  recentlyViewed: string[];
  addRecentlyViewed: (id: string) => void;
  savedDealers: string[];
  toggleSavedDealer: (id: string) => void;

  // Cart
  cart: CartItem[];
  addToCart: (product: Product, qty?: number, variant?: string) => boolean;
  removeFromCart: (productId: string, variant?: string) => void;
  updateCartQuantity: (productId: string, qty: number, variant?: string) => void;
  syncCartProducts: (liveProducts: Product[]) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;

  // App Settings & Dynamic Theme
  appSettings: AppSettings;
  updateAppSettings: (settings: Partial<AppSettings>) => Promise<void>;
  setThemePreset: (preset: ThemePreset) => Promise<void>;
};

const AppContext = createContext<AppContextType | null>(null);

function safeReadLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function getActiveCustomerId(): string | null {
  try {
    const wrapped = safeReadLocal<{ profile?: { id?: string }; expiresAt?: number }>('dc_session_customer');
    if (wrapped?.profile?.id) {
      if (wrapped.expiresAt && Date.now() > wrapped.expiresAt) return null;
      return wrapped.profile.id;
    }
    const legacy = safeReadLocal<{ id?: string }>('dc-auth-customer');
    return legacy?.id || null;
  } catch {
    return null;
  }
}

function getScopedStorageKey(base: 'dc-wishlist' | 'dc-cart' | 'dc-saved-dealers', customerId: string | null): string {
  return customerId ? `${base}-${customerId}` : base;
}

function mergeUniqueIds(...groups: Array<string[] | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    for (const id of group) {
      if (typeof id === 'string' && id && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  return out;
}

function mergeCartLists(primary: CartItem[] | null | undefined, secondary: CartItem[] | null | undefined): CartItem[] {
  const merged: CartItem[] = [];
  const pushOrMerge = (item: CartItem) => {
    if (!item?.product?.id) return;
    const idx = merged.findIndex(
      (x) => x.product.id === item.product.id && x.selectedVariant === item.selectedVariant
    );
    const maxQty =
      typeof item.product.stock_qty === 'number' && item.product.stock_qty > 0
        ? item.product.stock_qty
        : 99;
    if (idx >= 0) {
      const nextQty = Math.min(maxQty, Math.max(merged[idx].quantity, item.quantity));
      merged[idx] = { ...merged[idx], product: item.product, quantity: nextQty };
    } else {
      merged.push({ ...item, quantity: Math.max(1, Math.min(maxQty, item.quantity || 1)) });
    }
  };
  (primary || []).forEach(pushOrMerge);
  (secondary || []).forEach(pushOrMerge);
  return merged;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');
  const [location, setLocationState] = useState<AppLocation>({ pinCode: null, label: null, lat: null, lng: null });
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [compare, setCompare] = useState<string[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);
  const [savedDealers, setSavedDealers] = useState<string[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>(INITIAL_APP_SETTINGS);

  const loadAccountState = useCallback(async (cid: string | null) => {
    setActiveCustomerId(cid);
    const wKey = getScopedStorageKey('dc-wishlist', cid);
    const cKey = getScopedStorageKey('dc-cart', cid);
    const dKey = getScopedStorageKey('dc-saved-dealers', cid);

    if (cid) {
      const guestWish = safeReadLocal<string[]>('dc-wishlist');
      const guestCart = safeReadLocal<CartItem[]>('dc-cart');
      const guestDealers = safeReadLocal<string[]>('dc-saved-dealers');

      const scopedWish = safeReadLocal<string[]>(wKey);
      const scopedCart = safeReadLocal<CartItem[]>(cKey);
      const scopedDealers = safeReadLocal<string[]>(dKey);

      let dbWish: string[] = [];
      let dbDealers: string[] = [];
      try {
        const favs = await getDbFavorites(cid);
        dbWish = favs.filter((f) => f.type === 'product' && f.product_id).map((f) => f.product_id as string);
        dbDealers = favs.filter((f) => f.type === 'dealer' && f.dealer_id).map((f) => f.dealer_id as string);
      } catch { }

      const mergedWish = mergeUniqueIds(scopedWish, guestWish, dbWish);
      const mergedDealers = mergeUniqueIds(scopedDealers, guestDealers, dbDealers);
      const mergedCart = mergeCartLists(scopedCart, guestCart);

      try {
        localStorage.setItem(wKey, JSON.stringify(mergedWish));
        localStorage.setItem(dKey, JSON.stringify(mergedDealers));
        localStorage.setItem(cKey, JSON.stringify(mergedCart));
        if (guestWish && guestWish.length > 0) localStorage.removeItem('dc-wishlist');
        if (guestCart && guestCart.length > 0) localStorage.removeItem('dc-cart');
        if (guestDealers && guestDealers.length > 0) localStorage.removeItem('dc-saved-dealers');
      } catch { }

      setWishlist(mergedWish);
      setSavedDealers(mergedDealers);
      setCart(mergedCart);
    } else {
      const guestWish = mergeUniqueIds(safeReadLocal<string[]>('dc-wishlist'));
      const guestDealers = mergeUniqueIds(safeReadLocal<string[]>('dc-saved-dealers'));
      const guestCart = mergeCartLists(safeReadLocal<CartItem[]>('dc-cart'), []);
      setWishlist(guestWish);
      setSavedDealers(guestDealers);
      setCart(guestCart);
    }
  }, []);

  const refreshSettingsFromServer = useCallback(async () => {
    try {
      const settings = await getDbAppSettings();
      setAppSettings(settings);
      applyThemeToDocument(settings);
    } catch {}
  }, []);

  useRealtimeSync(['settings'], refreshSettingsFromServer, {
    onReconnect: refreshSettingsFromServer,
  });

  useEffect(() => {
    try {
      const sLang = localStorage.getItem('dc-lang') as Language | null;
      const sLoc = safeReadLocal<AppLocation>('dc-location');
      const sComp = safeReadLocal<string[]>('dc-compare');
      const sRecent = safeReadLocal<string[]>('dc-recent');

      if (sLang && LANGUAGES.some((l) => l.code === sLang)) setLangState(sLang);
      if (sLoc) setLocationState(sLoc);
      if (sComp) setCompare(sComp);
      if (sRecent) setRecentlyViewed(sRecent);

      loadAccountState(getActiveCustomerId());

      getDbAppSettings().then((settings) => {
        setAppSettings(settings);
        applyThemeToDocument(settings);
      });
    } catch {}

    const handleSettingsUpdated = (e: Event) => {
      const detail = (e as CustomEvent)?.detail as AppSettings | undefined;
      if (detail) {
        setAppSettings(detail);
        applyThemeToDocument(detail);
      }
    };
    const handleCustomerAuthChanged = (e: Event) => {
      const nextCid = (e as CustomEvent)?.detail?.customer?.id || getActiveCustomerId();
      loadAccountState(nextCid || null);
    };
    const handleStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'dc_session_customer' || e.key === 'dc-auth-customer') {
        loadAccountState(getActiveCustomerId());
      }
    };
    window.addEventListener('dc-settings-updated', handleSettingsUpdated);
    window.addEventListener('dc-customer-session-changed', handleCustomerAuthChanged);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('dc-settings-updated', handleSettingsUpdated);
      window.removeEventListener('dc-customer-session-changed', handleCustomerAuthChanged);
      window.removeEventListener('storage', handleStorage);
    };
  }, [loadAccountState]);

  const setLang = (l: Language) => {
    setLangState(l);
    try { localStorage.setItem('dc-lang', l); } catch {}
  };

  const setLocation = (l: AppLocation) => {
    setLocationState(l);
    try { localStorage.setItem('dc-location', JSON.stringify(l)); } catch {}
  };

  const toggleWishlist = (id: string) => {
    const cid = activeCustomerId ?? getActiveCustomerId();
    const wKey = getScopedStorageKey('dc-wishlist', cid);
    setWishlist((prev) => {
      const exists = prev.includes(id);
      const next = exists
        ? prev.filter((x) => x !== id)
        : mergeUniqueIds(prev, [id]);
      try { localStorage.setItem(wKey, JSON.stringify(next)); } catch {}
      return next;
    });
    if (cid) {
      toggleDbFavorite(cid, 'product', id).catch(() => {});
    }
  };

  const toggleCompare = (id: string) => {
    setCompare((prev) => {
      let next: string[];
      if (prev.includes(id)) next = prev.filter((x) => x !== id);
      else if (prev.length >= 4) next = [...prev.slice(1), id];
      else next = [...prev, id];
      try { localStorage.setItem('dc-compare', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const clearCompare = () => {
    setCompare([]);
    try { localStorage.removeItem('dc-compare'); } catch {}
  };

  const addRecentlyViewed = (id: string) => {
    setRecentlyViewed((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 12);
      try { localStorage.setItem('dc-recent', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const toggleSavedDealer = (id: string) => {
    const cid = activeCustomerId ?? getActiveCustomerId();
    const dKey = getScopedStorageKey('dc-saved-dealers', cid);
    setSavedDealers((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : mergeUniqueIds(prev, [id]);
      try { localStorage.setItem(dKey, JSON.stringify(next)); } catch {}
      return next;
    });
    if (cid) {
      toggleDbFavorite(cid, 'dealer', id).catch(() => {});
    }
  };

  const addToCart = (product: Product, qty = 1, variant?: string): boolean => {
    if (
      product.stock_status === 'out_of_stock' ||
      (typeof product.stock_qty === 'number' && product.stock_qty <= 0)
    ) {
      toast.error(`${product.name} is currently out of stock`);
      return false;
    }

    const cid = activeCustomerId ?? getActiveCustomerId();
    const cKey = getScopedStorageKey('dc-cart', cid);
    const maxQty =
      typeof product.stock_qty === 'number' && product.stock_qty > 0
        ? product.stock_qty
        : 99;

    let addedOk = true;
    setCart((prev) => {
      const existing = prev.find(
        (item) => item.product.id === product.id && item.selectedVariant === variant
      );
      let updated: CartItem[];
      if (existing) {
        if (existing.quantity >= maxQty) {
          toast.info(`Maximum available stock (${maxQty}) already in cart`);
          addedOk = false;
          return prev;
        }
        const nextQty = Math.min(maxQty, existing.quantity + qty);
        updated = prev.map((item) =>
          item.product.id === product.id && item.selectedVariant === variant
            ? { ...item, product, quantity: nextQty }
            : item
        );
      } else {
        updated = [
          ...prev,
          { product, quantity: Math.max(1, Math.min(maxQty, qty)), selectedVariant: variant },
        ];
      }
      try { localStorage.setItem(cKey, JSON.stringify(updated)); } catch {}
      return updated;
    });
    return addedOk;
  };

  const removeFromCart = (productId: string, variant?: string) => {
    const cid = activeCustomerId ?? getActiveCustomerId();
    const cKey = getScopedStorageKey('dc-cart', cid);
    setCart((prev) => {
      const updated = prev.filter((item) =>
        variant !== undefined
          ? !(item.product.id === productId && item.selectedVariant === variant)
          : item.product.id !== productId
      );
      try { localStorage.setItem(cKey, JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const updateCartQuantity = (productId: string, qty: number, variant?: string) => {
    const cid = activeCustomerId ?? getActiveCustomerId();
    const cKey = getScopedStorageKey('dc-cart', cid);
    setCart((prev) => {
      let updated: CartItem[];
      if (qty <= 0) {
        updated = prev.filter((item) =>
          variant !== undefined
            ? !(item.product.id === productId && item.selectedVariant === variant)
            : item.product.id !== productId
        );
      } else {
        updated = prev.map((item) => {
          const matches =
            variant !== undefined
              ? item.product.id === productId && item.selectedVariant === variant
              : item.product.id === productId;
          if (!matches) return item;

          if (item.product.stock_status === 'out_of_stock' && qty > item.quantity) {
            toast.error(`${item.product.name} is currently out of stock`);
            return item;
          }
          const maxQty =
            typeof item.product.stock_qty === 'number' && item.product.stock_qty > 0
              ? item.product.stock_qty
              : 99;
          if (qty > maxQty) {
            toast.info(`Only ${maxQty} unit${maxQty > 1 ? 's' : ''} available in store`);
            return { ...item, quantity: maxQty };
          }
          return { ...item, quantity: qty };
        });
      }
      try { localStorage.setItem(cKey, JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const syncCartProducts = useCallback(
    (liveProducts: Product[]) => {
      if (!liveProducts || liveProducts.length === 0) return;
      const byId = new Map(liveProducts.map((p) => [p.id, p]));
      const cid = activeCustomerId ?? getActiveCustomerId();
      const cKey = getScopedStorageKey('dc-cart', cid);
      setCart((prev) => {
        if (prev.length === 0) return prev;
        let changed = false;
        const updated = prev.map((item) => {
          const fresh = byId.get(item.product.id);
          if (!fresh) return item;
          const maxQty =
            typeof fresh.stock_qty === 'number' && fresh.stock_qty > 0
              ? fresh.stock_qty
              : item.quantity;
          const clampedQty =
            fresh.stock_status === 'out_of_stock'
              ? item.quantity
              : Math.min(item.quantity, maxQty);
          if (
            fresh.price !== item.product.price ||
            fresh.discount_price !== item.product.discount_price ||
            fresh.stock_status !== item.product.stock_status ||
            fresh.stock_qty !== item.product.stock_qty ||
            clampedQty !== item.quantity
          ) {
            changed = true;
          }
          return { ...item, product: fresh, quantity: clampedQty };
        });
        if (!changed) return prev;
        try { localStorage.setItem(cKey, JSON.stringify(updated)); } catch {}
        return updated;
      });
    },
    [activeCustomerId]
  );

  const clearCart = () => {
    const cid = activeCustomerId ?? getActiveCustomerId();
    const cKey = getScopedStorageKey('dc-cart', cid);
    setCart([]);
    try { localStorage.removeItem(cKey); } catch {}
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => {
    const price = item.product.discount_price && item.product.discount_price > 0
      ? item.product.discount_price
      : item.product.price;
    return sum + price * item.quantity;
  }, 0);

  const updateAppSettings = async (newSettings: Partial<AppSettings>) => {
    const saved = await saveDbAppSettings(newSettings);
    setAppSettings(saved);
    applyThemeToDocument(saved);
  };

  const setThemePreset = async (preset: ThemePreset) => {
    const presetColors = PRESET_COLOR_MAP[preset] || PRESET_COLOR_MAP['black-white'];
    const merged: AppSettings = {
      ...appSettings,
      theme_preset: preset,
      primary_color: presetColors.primary,
      secondary_color: presetColors.secondary,
      accent_color: presetColors.accent,
      custom_colors: null,
    };
    setAppSettings(merged);
    applyThemeToDocument(merged);
    await updateAppSettings({
      theme_preset: preset,
      primary_color: presetColors.primary,
      secondary_color: presetColors.secondary,
      accent_color: presetColors.accent,
      custom_colors: null,
    });
  };

  const t = (key: string) => translate(lang, key);

  return (
    <AppContext.Provider
      value={{
        lang,
        setLang,
        t,
        location,
        setLocation,
        wishlist,
        toggleWishlist,
        compare,
        toggleCompare,
        clearCompare,
        recentlyViewed,
        addRecentlyViewed,
        savedDealers,
        toggleSavedDealer,
        cart,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        syncCartProducts,
        clearCart,
        cartCount,
        cartTotal,
        appSettings,
        updateAppSettings,
        setThemePreset,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
