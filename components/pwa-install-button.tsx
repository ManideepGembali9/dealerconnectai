'use client';

import { useEffect, useState } from 'react';
import { Download, Smartphone, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type PwaInstallButtonProps = {
  portalName: string;
  compact?: boolean;
  className?: string;
};

/**
 * Adaptive PWA Install trigger supporting Chromium beforeinstallprompt,
 * installed standalone detection, and iOS/Safari Add-to-Home-Screen guidance.
 */
export function PwaInstallButton({
  portalName,
  compact = false,
  className,
}: PwaInstallButtonProps) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosGuideOpen, setIosGuideOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((window.navigator as any).standalone);
    setInstalled(isStandalone);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  if (installed) {
    if (compact) return null;
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-xl border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground',
          className
        )}
      >
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> App Installed
      </span>
    );
  }

  const handleClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
      }
      setDeferredPrompt(null);
      return;
    }
    setIosGuideOpen(true);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        className={cn(
          'h-8 rounded-xl border-border text-xs font-bold gap-1.5',
          compact && 'px-2.5 text-[11px]',
          className
        )}
      >
        <Download className="h-3.5 w-3.5 shrink-0" />
        <span>{compact ? 'Install' : `Install ${portalName}`}</span>
      </Button>

      <Dialog open={iosGuideOpen} onOpenChange={setIosGuideOpen}>
        <DialogContent className="sm:max-w-sm rounded-3xl p-5 border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black">
              <Smartphone className="h-4 w-4 text-primary" /> Install {portalName}
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed pt-1">
              Add {portalName} to your home screen or desktop apps for a dedicated full-screen experience with independent session storage.
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-2 text-xs text-muted-foreground list-decimal pl-4">
            <li>
              <strong className="text-foreground">Android / Chrome / Edge:</strong> Open the browser menu (<span className="font-mono">&#8942;</span>) and tap <strong className="text-foreground">Install app</strong> or <strong className="text-foreground">Add to Home screen</strong>.
            </li>
            <li>
              <strong className="text-foreground">iPhone / iPad (Safari):</strong> Tap the <strong className="text-foreground">Share</strong> icon and choose <strong className="text-foreground">Add to Home Screen</strong>.
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
