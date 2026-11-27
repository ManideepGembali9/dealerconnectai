'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Bell, CheckCircle2, Globe, Monitor, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useApp } from '@/lib/providers';
import type { Language } from '@/lib/i18n';
import {
  getNotificationPrefs,
  setNotificationPrefs,
  subscribeToPush,
  updatePushPreferences,
} from '@/lib/notifications';
import { Switch } from '@/components/ui/switch';
import { LanguageSwitcher } from '@/components/language-switcher';
import { CustomerSubpageShell } from '@/components/profile/customer-subpage-shell';
import { cn } from '@/lib/utils';

const THEME_OPTIONS = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
] as const;

const FEATURED_LANGUAGES: Array<{ code: Language; short: string; label: string; native: string }> = [
  { code: 'en', short: 'EN', label: 'English', native: 'English' },
  { code: 'te', short: 'TE', label: 'Telugu', native: 'తెలుగు' },
  { code: 'hi', short: 'HI', label: 'Hindi', native: 'हिन्दी' },
  { code: 'ta', short: 'TA', label: 'Tamil', native: 'தமிழ்' },
];

export function CustomerPreferencesClient() {
  const { customer, updateCustomerProfile } = useAuth();
  const { lang, setLang } = useApp();
  const { theme, setTheme } = useTheme();

  const [mounted, setMounted] = useState(false);
  const [notifPrefs, setNotifState] = useState({ in_stock: true, price_drop: true, nearby: true });
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setNotifState(getNotificationPrefs());
  }, []);

  const handleThemeChange = (nextTheme: string) => {
    setTheme(nextTheme);
    setSavedMessage(`Theme preference updated to ${nextTheme}.`);
    toast.success(`Theme switched to ${nextTheme}`);
  };

  const handleLanguageChange = async (code: Language, label: string) => {
    setLang(code);
    if (customer) {
      await updateCustomerProfile({
        preferences: { ...(customer.preferences || {}), language: code },
      });
    }
    setSavedMessage(`Language updated to ${label}.`);
    toast.success(`Language changed to ${label}`);
  };

  const handleToggleNotification = async (
    key: 'in_stock' | 'price_drop' | 'nearby',
    value: boolean
  ) => {
    const next = { ...notifPrefs, [key]: value };
    setNotifState(next);
    setNotificationPrefs(next);
    await subscribeToPush(customer?.pin_code || undefined);
    await updatePushPreferences(next, customer?.pin_code || undefined);
    if (customer) {
      await updateCustomerProfile({
        preferences: {
          ...(customer.preferences || {}),
          notifications: next.in_stock || next.price_drop || next.nearby,
          in_stock_alerts: next.in_stock,
          price_drop_alerts: next.price_drop,
          nearby_alerts: next.nearby,
        },
      });
    }
    setSavedMessage('Notification preferences saved.');
  };

  return (
    <CustomerSubpageShell
      title="App Preferences"
      subtitle="Customize theme mode, display language, and store alert notifications."
      redirectPath="/customer/preferences"
    >
      {customer && (
        <div className="space-y-4">
          {savedMessage && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-3.5 text-xs text-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{savedMessage}</span>
            </div>
          )}

          {/* Theme Selector */}
          <div className="rounded-2xl border border-[#292929] bg-[#151515] p-5 space-y-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-[#FFFFFF]">Appearance Theme</h2>
              <p className="text-xs text-[#A0A0A0]">Choose Light, Dark, or match your device setting.</p>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {THEME_OPTIONS.map((opt) => {
                const IconComp = opt.icon;
                const active = mounted && theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleThemeChange(opt.id)}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-semibold transition-colors',
                      active
                        ? 'border-[#FFFFFF] bg-[#FFFFFF] text-[#0A0A0A]'
                        : 'border-[#292929] bg-[#202020] text-[#FFFFFF] hover:bg-[#292929]'
                    )}
                  >
                    <IconComp className="h-4 w-4" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Language Switcher */}
          <div className="rounded-2xl border border-[#292929] bg-[#151515] p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-0.5">
                <h2 className="text-sm font-bold text-[#FFFFFF] flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Language
                </h2>
                <p className="text-xs text-[#A0A0A0]">Select EN, TE, HI, TA or another supported language.</p>
              </div>
              <LanguageSwitcher className="h-8 border-[#292929] bg-[#202020] text-[#FFFFFF] hover:bg-[#292929]" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {FEATURED_LANGUAGES.map((item) => {
                const active = lang === item.code;
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => handleLanguageChange(item.code, item.label)}
                    className={cn(
                      'flex flex-col items-start rounded-xl border p-3 text-left transition-colors',
                      active
                        ? 'border-[#FFFFFF] bg-[#FFFFFF] text-[#0A0A0A]'
                        : 'border-[#292929] bg-[#202020] text-[#FFFFFF] hover:bg-[#292929]'
                    )}
                  >
                    <span className="text-[10px] font-bold opacity-75">{item.short}</span>
                    <span className="text-xs font-bold mt-0.5">{item.native}</span>
                    <span className="text-[10px] opacity-75">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notifications Toggles */}
          <div className="rounded-2xl border border-[#292929] bg-[#151515] divide-y divide-[#292929] overflow-hidden">
            <div className="p-4 flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#FFFFFF]" />
              <h2 className="text-sm font-bold text-[#FFFFFF]">Notifications</h2>
            </div>

            <div className="flex items-center justify-between gap-4 p-4">
              <div className="space-y-0.5">
                <p className="text-xs sm:text-sm font-semibold text-[#FFFFFF]">In-Stock Alerts</p>
                <p className="text-[11px] text-[#A0A0A0]">Notify when watched products restock locally.</p>
              </div>
              <Switch
                checked={notifPrefs.in_stock}
                onCheckedChange={(v) => handleToggleNotification('in_stock', v)}
              />
            </div>

            <div className="flex items-center justify-between gap-4 p-4">
              <div className="space-y-0.5">
                <p className="text-xs sm:text-sm font-semibold text-[#FFFFFF]">Price Drop Alerts</p>
                <p className="text-[11px] text-[#A0A0A0]">Get alerted when saved dealers lower offers.</p>
              </div>
              <Switch
                checked={notifPrefs.price_drop}
                onCheckedChange={(v) => handleToggleNotification('price_drop', v)}
              />
            </div>

            <div className="flex items-center justify-between gap-4 p-4">
              <div className="space-y-0.5">
                <p className="text-xs sm:text-sm font-semibold text-[#FFFFFF]">Nearby Store Updates</p>
                <p className="text-[11px] text-[#A0A0A0]">New verified shops & replies in your PIN area.</p>
              </div>
              <Switch
                checked={notifPrefs.nearby}
                onCheckedChange={(v) => handleToggleNotification('nearby', v)}
              />
            </div>
          </div>
        </div>
      )}
    </CustomerSubpageShell>
  );
}
