'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { Language, t as translate, LANGUAGES } from './i18n';

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}

// ---------- App context: language, location, wishlist, compare, recently viewed ----------

export type AppLocation = {
  pinCode: string | null;
  label: string | null;
  lat: number | null;
  lng: number | null;
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
};

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');
  const [location, setLocationState] = useState<AppLocation>({ pinCode: null, label: null, lat: null, lng: null });
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [compare, setCompare] = useState<string[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);
  const [savedDealers, setSavedDealers] = useState<string[]>([]);

  useEffect(() => {
    try {
      const sLang = localStorage.getItem('dc-lang') as Language | null;
      const sLoc = localStorage.getItem('dc-location');
      const sWish = localStorage.getItem('dc-wishlist');
      const sComp = localStorage.getItem('dc-compare');
      const sRecent = localStorage.getItem('dc-recent');
      const sDealers = localStorage.getItem('dc-saved-dealers');
      if (sLang && LANGUAGES.some((l) => l.code === sLang)) setLangState(sLang);
      if (sLoc) setLocationState(JSON.parse(sLoc));
      if (sWish) setWishlist(JSON.parse(sWish));
      if (sComp) setCompare(JSON.parse(sComp));
      if (sRecent) setRecentlyViewed(JSON.parse(sRecent));
      if (sDealers) setSavedDealers(JSON.parse(sDealers));
    } catch {}
  }, []);

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

  const t = (key: string) => translate(lang, key);

  return (
    <AppContext.Provider value={{ lang, setLang, t, location, setLocation, wishlist, toggleWishlist, compare, toggleCompare, clearCompare, recentlyViewed, addRecentlyViewed, savedDealers, toggleSavedDealer }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
