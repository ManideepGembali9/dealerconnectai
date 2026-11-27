'use client';

import { AdminCatalogClient } from '@/components/admin-catalog-client';
import { AdminDealerProductsReview } from '@/components/admin/admin-dealer-products-review';
import { Tabs,TabsContent,TabsList,TabsTrigger } from '@/components/ui/tabs';
import { Layers,Package,ShieldCheck } from 'lucide-react';
import { useState } from 'react';

export function Module04Products() {
  const [activeTab, setActiveTab] = useState<'master' | 'dealer-submissions'>('master');

  return (
    <div className="space-y-4">
      <div className="mb-2">
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
          <Package className="h-7 w-7 text-primary" /> Product & Catalog Management
        </h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Maintain central master catalog items, generate AI specs, and inspect/moderate dealer-submitted products
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="grid grid-cols-2 max-w-md h-10 p-1 bg-muted/60">
          <TabsTrigger
            value="master"
            className="text-xs font-bold gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground"
          >
            <Layers className="h-3.5 w-3.5 text-primary" /> Master Catalog
          </TabsTrigger>
          <TabsTrigger
            value="dealer-submissions"
            className="text-xs font-bold gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-amber-600" /> Dealer Submissions Review
          </TabsTrigger>
        </TabsList>

        <TabsContent value="master" className="focus-visible:outline-none">
          <AdminCatalogClient />
        </TabsContent>

        <TabsContent value="dealer-submissions" className="focus-visible:outline-none">
          <AdminDealerProductsReview />
        </TabsContent>
      </Tabs>
    </div>
  );
}
