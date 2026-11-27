'use client';

import { Store, Clock, RefreshCw, LogOut, Phone, ShieldCheck, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Dealer } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

type PendingProps = {
  dealer: Dealer;
  onRefresh: () => Promise<void>;
};

export function DealerPendingScreen({ dealer, onRefresh }: PendingProps) {
  const { signOut } = useAuth();

  const handleRefresh = async () => {
    toast.info('Checking admin approval status...');
    await onRefresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-amber-950/5 to-muted/40 p-4">
      <Card className="max-w-md w-full p-6 text-center border-border/80 shadow-2xl space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
          <Clock className="h-8 w-8 animate-pulse" />
        </div>

        <div>
          <Badge variant="outline" className="text-xs font-bold text-amber-600 border-amber-500/40">
            Status: Pending Approval
          </Badge>
          <h2 className="text-xl font-bold text-foreground mt-2">
            Application Under Admin Review
          </h2>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Thank you for registering <span className="font-semibold text-foreground">{dealer.shop_name}</span>. Your shop verification is currently being reviewed by the platform administrator.
          </p>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 text-xs text-left space-y-1.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Shop Name:</span>
            <span className="font-bold text-foreground">{dealer.shop_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Owner:</span>
            <span className="font-semibold text-foreground">{dealer.owner_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Location:</span>
            <span className="font-semibold text-foreground">
              {dealer.city}, PIN {dealer.pin_code}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Contact:</span>
            <span className="font-mono text-foreground">{dealer.phone}</span>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-left space-y-1">
          <span className="font-bold text-foreground flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-emerald-600" /> Need Expedited Verification?
          </span>
          <p className="text-[11px] text-muted-foreground">
            Contact the Administrator Helpdesk at{' '}
            <a href="tel:+919848012345" className="font-mono font-bold text-emerald-600 underline">
              +91 98480 12345
            </a>{' '}
            with your trade details.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-2">
          <Button
            onClick={handleRefresh}
            variant="outline"
            className="flex-1 font-semibold text-xs gap-1.5 h-9"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Check Status
          </Button>
          <Button
            onClick={async () => {
              await signOut();
              toast.info('Signed out');
            }}
            variant="ghost"
            className="flex-1 font-semibold text-xs gap-1.5 h-9 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign Out
          </Button>
        </div>
      </Card>
    </div>
  );
}
