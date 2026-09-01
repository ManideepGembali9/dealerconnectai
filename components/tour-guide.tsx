'use client';

import { useState, useEffect } from 'react';
import { Sparkles, X, ChevronRight, Search, MapPin, Scale, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/lib/providers';

const STEPS = [
  { icon: Search, key: 'tourStep1' },
  { icon: MapPin, key: 'tourStep2' },
  { icon: Scale, key: 'tourStep3' },
  { icon: MessageCircle, key: 'tourStep4' },
];

export function TourGuide() {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      const seen = localStorage.getItem('dc-tour-seen');
      if (!seen) {
        const timer = setTimeout(() => setOpen(true), 1200);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  const close = () => {
    setOpen(false);
    try { localStorage.setItem('dc-tour-seen', '1'); } catch {}
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else close();
  };

  if (!open) return null;

  const Icon = STEPS[step].icon;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-slide-up">
        <div className="relative bg-gradient-to-br from-primary to-accent p-6 text-primary-foreground">
          <button onClick={close} className="absolute right-4 top-4 text-primary-foreground/80 hover:text-primary-foreground">
            <X className="h-5 w-5" />
          </button>
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
            <Sparkles className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold">{t('tourTitle')}</h2>
          <p className="mt-1 text-sm text-primary-foreground/80">Let's take a quick 4-step tour</p>
        </div>
        <div className="p-6">
          <div className="mb-5 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Icon className="h-6 w-6" />
            </div>
            <p className="pt-2 text-sm text-foreground">{t(STEPS[step].key)}</p>
          </div>
          <div className="mb-5 flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-muted'}`}
              />
            ))}
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={close}>{t('tourSkip')}</Button>
            <Button onClick={next}>
              {step < STEPS.length - 1 ? t('tourNext') : t('tourDone')}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
