'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/auth';
import type { Dealer } from '@/lib/types';
import { Save,Truck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type Module12Props = {
  dealer: Dealer;
  onRefreshDealer?: () => Promise<void>;
};

export function Module12DealerDelivery({ dealer, onRefreshDealer }: Module12Props) {
  const { updateDealerProfile } = useAuth();
  const [deliveryAvailable, setDeliveryAvailable] = useState(dealer.delivery_available ?? true);
  const [pickupAvailable, setPickupAvailable] = useState(dealer.pickup_available ?? true);
  const [radiusKm, setRadiusKm] = useState(String(dealer.home_delivery_radius_km || 10));
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await updateDealerProfile({
        delivery_available: deliveryAvailable,
        pickup_available: pickupAvailable,
        home_delivery_radius_km: parseFloat(radiusKm) || 10,
      });

      if (error) throw new Error(error);
      toast.success('Delivery and pickup preferences saved!');
      if (onRefreshDealer) await onRefreshDealer();
    } catch {
      toast.error('Failed to update delivery settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
          <Truck className="h-7 w-7 text-emerald-600" /> Delivery & Fulfillment Information
        </h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Set your doorstep fulfillment coverage radius, delivery terms & counter pickup availability
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card className="p-6 border-border/80 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div>
              <h3 className="text-sm font-bold text-foreground">Doorstep Delivery Options</h3>
              <p className="text-[11px] text-muted-foreground">Deliver directly to local buyer addresses</p>
            </div>
            <Switch
              checked={deliveryAvailable}
              onCheckedChange={setDeliveryAvailable}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Maximum Delivery Radius (in Kilometers)</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                value={radiusKm}
                onChange={(e) => setRadiusKm(e.target.value)}
                className="w-32 h-9 text-xs font-bold"
                min={1}
                max={50}
              />
              <span className="text-xs text-muted-foreground">
                Buyers within {radiusKm} km of your shop will see &quot;Home Delivery Available&quot;
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/60">
            <div>
              <h3 className="text-sm font-bold text-foreground">In-Store Counter Pickup</h3>
              <p className="text-[11px] text-muted-foreground">
                Allow buyers to inspect items and pay/collect directly at your store counter
              </p>
            </div>
            <Switch
              checked={pickupAvailable}
              onCheckedChange={setPickupAvailable}
            />
          </div>
        </Card>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={saving}
            className="font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md h-10 px-6"
          >
            <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Delivery Settings'}
          </Button>
        </div>
      </form>
    </div>
  );
}
