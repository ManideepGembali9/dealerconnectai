'use client';

import { Palette } from 'lucide-react';
import { AdminAppControlTab } from '@/components/admin-app-control-tab';

export function Module13Customization() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
          <Palette className="h-7 w-7 text-primary" /> Application Customization & Theming
        </h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Customize brand appearance, color palettes, dark/light modes, languages & visual themes across Customer and Dealer applications
        </p>
      </div>

      <AdminAppControlTab />
    </div>
  );
}
