'use client';

import { DealerCatalogClient } from '@/components/dealer-catalog-client';
import type { Dealer } from '@/lib/types';
import { Lock, PlusCircle, ShieldCheck } from 'lucide-react';

type Module04Props = {
  dealer: Dealer;
  onInventoryChanged?: () => Promise<void> | void;
};

export function Module04DealerAddProducts({ dealer, onInventoryChanged }: Module04Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
          <PlusCircle className="h-7 w-7 text-emerald-600" /> Add Master Catalog Products
        </h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Browse the Admin-approved master catalog and add verified products to your showroom inventory
        </p>
      </div>

      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 text-xs text-foreground flex items-start gap-2.5">
        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold flex items-center gap-1.5">
            Admin-Approved Master Catalog Only <Lock className="h-3 w-3 text-emerald-600" />
          </p>
          <p className="text-muted-foreground">
            Only products approved in the Admin Master Catalog can be added to your store. Pick an item below to list it immediately with your showroom price, discount, and live stock count.
          </p>
        </div>
      </div>

      <DealerCatalogClient dealer={dealer} onInventoryChanged={onInventoryChanged} />
    </div>
  );
}
