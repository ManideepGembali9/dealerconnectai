'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { Language, t as translate, LANGUAGES } from './i18n';
import type { AppSettings, Product, ThemePreset } from './types';
import { INITIAL_APP_SETTINGS } from './seed-data';
import { getDbAppSettings, saveDbAppSettings } from './firebase-db';

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
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
  addToCart: (product: Product, qty?: number, variant?: string) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, qty: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;

  // App Settings & Dynamic Theme
  appSettings: AppSettings;
  updateAppSettings: (settings: Partial<AppSettings>) => Promise<void>;
  setThemePreset: (preset: ThemePreset) => Promise<void>;
};

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');
  const [location, setLocationState] = useState<AppLocation>({ pinCode: null, label: null, lat: null, lng: null });
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [compare, setCompare] = useState<string[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);
  const [savedDealers, setSavedDealers] = useState<string[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>(INITIAL_APP_SETTINGS);

  // Apply theme class to document element
  const applyThemeClass = useCallback((themePreset: ThemePreset) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    // Remove all previous theme classes
    root.classList.remove(
      'theme-gold-navy',
      'theme-gold-black',
      'theme-green-white',
      'theme-black-white',
      'theme-corporate-blue',
      'theme-royal-purple',
      'theme-sunset-amber'
    );
    root.classList.add('theme-black-white');
  }, []);

  useEffect(() => {
    try {
      const sLang = localStorage.getItem('dc-lang') as Language | null;
      const sLoc = localStorage.getItem('dc-location');
      const sWish = localStorage.getItem('dc-wishlist');
      const sComp = localStorage.getItem('dc-compare');
      const sRecent = localStorage.getItem('dc-recent');
      const sDealers = localStorage.getItem('dc-saved-dealers');
      const sCart = localStorage.getItem('dc-cart');

      if (sLang && LANGUAGES.some((l) => l.code === sLang)) setLangState(sLang);
      if (sLoc) setLocationState(JSON.parse(sLoc));
      if (sWish) setWishlist(JSON.parse(sWish));
      if (sComp) setCompare(JSON.parse(sComp));
      if (sRecent) setRecentlyViewed(JSON.parse(sRecent));
      if (sDealers) setSavedDealers(JSON.parse(sDealers));
      if (sCart) setCart(JSON.parse(sCart));

      // Load App Settings from DB / local
      getDbAppSettings().then((settings) => {
        setAppSettings(settings);
        applyThemeClass(settings.theme_preset);
      });
    } catch {}

    const handleSettingsUpdated = (e: any) => {
      if (e.detail) {
        setAppSettings(e.detail);
        applyThemeClass(e.detail.theme_preset);
      }
    };
    window.addEventListener('dc-settings-updated', handleSettingsUpdated);
    return () => window.removeEventListener('dc-settings-updated', handleSettingsUpdated);
  }, [applyThemeClass]);

  const setLang = (l: Language) => {
    setLangState(l);
    try { localStorage.setItem('dc-lang', l); } catch {}
  };

  const setLocation = (l: AppLocation) => {
    setLocationState(l);
    try { localStorage.setItem('dc-location', JSON.stringify(l)); } catch {}
  };

  const toggleWishlist = (id: string) => {
    setWishlist((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem('dc-wishlist', JSON.stringify(next)); } catch {}
      return next;
    });
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
    setSavedDealers((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem('dc-saved-dealers', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // Cart operations
  const addToCart = (product: Product, qty = 1, variant?: string) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id && item.selectedVariant === variant);
      let updated: CartItem[];
      if (existing) {
        updated = prev.map((item) =>
          item.product.id === product.id && item.selectedVariant === variant
            ? { ...item, quantity: item.quantity + qty }
            : item
        );
      } else {
        updated = [...prev, { product, quantity: qty, selectedVariant: variant }];
      }
      try { localStorage.setItem('dc-cart', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const updated = prev.filter((item) => item.product.id !== productId);
      try { localStorage.setItem('dc-cart', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const updateCartQuantity = (productId: string, qty: number) => {
    setCart((prev) => {
      let updated: CartItem[];
      if (qty <= 0) {
        updated = prev.filter((item) => item.product.id !== productId);
      } else {
        updated = prev.map((item) =>
          item.product.id === productId ? { ...item, quantity: qty } : item
        );
      }
      try { localStorage.setItem('dc-cart', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const clearCart = () => {
    setCart([]);
    try { localStorage.removeItem('dc-cart'); } catch {}
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => {
    const price = item.product.discount_price && item.product.discount_price > 0
      ? item.product.discount_price
      : item.product.price;
    return sum + price * item.quantity;
  }, 0);

  // App Settings Updates
  const updateAppSettings = async (newSettings: Partial<AppSettings>) => {
    const saved = await saveDbAppSettings(newSettings);
    setAppSettings(saved);
    if (newSettings.theme_preset) {
      applyThemeClass(newSettings.theme_preset);
    }
  };

  const setThemePreset = async (preset: ThemePreset) => {
    applyThemeClass(preset);
    await updateAppSettings({ theme_preset: preset });
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
