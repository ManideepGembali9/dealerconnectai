'use client';

import { useState, useEffect } from 'react';
import { MapPin, Bell, Check, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/lib/providers';
import { toast } from 'sonner';

export function PermissionPrompt() {
  const { setLocation } = useApp();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const handled = localStorage.getItem('dc_permissions_handled');
      if (!handled) {
        // Slight delay on first launch for smooth entrance
        const timer = setTimeout(() => setOpen(true), 1200);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  const handleAllow = async () => {
    try {
      localStorage.setItem('dc_permissions_handled', 'true');
    } catch {}

    // Request Location
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            pinCode: null,
            label: 'Current Location',
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          toast.success('Location permission granted');
        },
        () => {
          // Default fallback
          setLocation({
            pinCode: '532440',
            label: 'Amalapuram (Demo)',
            lat: 16.9034,
            lng: 82.0175,
          });
        }
      );
    }

    // Request Notifications
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          toast.success('Notifications enabled');
        }
      } catch {}
    }

    setOpen(false);
  };

  const handleSkip = () => {
    try {
      localStorage.setItem('dc_permissions_handled', 'skipped');
    } catch {}
    setOpen(false);
    toast.info('You can enable location and notifications anytime in Profile Settings.');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all duration-300">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border/70 bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <h3 className="text-lg font-bold tracking-tight">Permissions</h3>
          </div>
          <button
            onClick={handleSkip}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Skip permissions"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          To provide the best shopping experience, DealerConnect AI requests permissions for location and alerts:
        </p>

        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/30 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">Nearby Shops & Prices</h4>
              <p className="text-xs text-muted-foreground">Find stores closest to you, check in-store stock, and get accurate doorstep delivery times.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/30 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">Price Drops & Dealer Replies</h4>
              <p className="text-xs text-muted-foreground">Receive instant alerts when products go on sale or when local dealers reply to your requests.</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <Button onClick={handleAllow} size="lg" className="w-full font-semibold shadow-md">
            <Check className="mr-2 h-4 w-4" /> Allow & Continue
          </Button>
          <Button onClick={handleSkip} variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-foreground">
            Skip for Now
          </Button>
        </div>
      </div>
    </div>
  );
}
