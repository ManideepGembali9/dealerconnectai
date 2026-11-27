'use client';

import { useState } from 'react';
import {
  Store, MapPin, Phone, Mail, Clock, Truck, Save, Loader2,
  Image as ImageIcon, CheckCircle2, MessageSquare, Globe
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ImagePicker } from '@/components/ui/image-picker';
import type { Dealer } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

type Module02Props = {
  dealer: Dealer;
  onRefreshDealer?: () => Promise<void>;
};

const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

export function Module02DealerProfile({ dealer, onRefreshDealer }: Module02Props) {
  const { updateDealerProfile } = useAuth();
  const [form, setForm] = useState({
    shop_name: dealer.shop_name || '',
    owner_name: dealer.owner_name || '',
    email: dealer.email || '',
    phone: dealer.phone || '',
    whatsapp: dealer.whatsapp || '',
    address: dealer.address || '',
    city: dealer.city || '',
    state: dealer.state || '',
    pin_code: dealer.pin_code || '',
    description: dealer.description || '',
    logo_url: dealer.logo_url || '',
    banner_url: dealer.banner_url || '',
    map_lat: dealer.map_lat ? String(dealer.map_lat) : '16.5746',
    map_lng: dealer.map_lng ? String(dealer.map_lng) : '82.0062',
    delivery_available: dealer.delivery_available ?? true,
    pickup_available: dealer.pickup_available ?? true,
    home_delivery_radius_km: String(dealer.home_delivery_radius_km || 10),
    working_hours: dealer.working_hours || {
      mon: '9:00 AM - 9:00 PM',
      tue: '9:00 AM - 9:00 PM',
      wed: '9:00 AM - 9:00 PM',
      thu: '9:00 AM - 9:00 PM',
      fri: '9:00 AM - 9:00 PM',
      sat: '9:00 AM - 9:00 PM',
      sun: '10:00 AM - 6:00 PM',
    },
  });
  const [saving, setSaving] = useState(false);

  const handleHourChange = (dayKey: string, val: string) => {
    setForm((prev) => ({
      ...prev,
      working_hours: {
        ...prev.working_hours,
        [dayKey]: val,
      },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.shop_name.trim() || !form.phone.trim() || !form.address.trim()) {
      toast.error('Please fill in required fields (Shop Name, Phone, Address)');
      return;
    }

    setSaving(true);
    try {
      const { error } = await updateDealerProfile({
        shop_name: form.shop_name.trim(),
        owner_name: form.owner_name.trim(),
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim() || form.phone.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pin_code: form.pin_code.trim(),
        description: form.description.trim(),
        logo_url: form.logo_url.trim() || null,
        banner_url: form.banner_url.trim() || null,
        map_lat: parseFloat(form.map_lat) || null,
        map_lng: parseFloat(form.map_lng) || null,
        delivery_available: form.delivery_available,
        pickup_available: form.pickup_available,
        home_delivery_radius_km: parseFloat(form.home_delivery_radius_km) || 10,
        working_hours: form.working_hours,
      });

      if (error) throw new Error(error);
      toast.success('Shop profile updated successfully!');
      if (onRefreshDealer) await onRefreshDealer();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save shop profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <Store className="h-7 w-7 text-emerald-600" /> My Shop Profile
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Manage your store information, map coordinates, opening hours, contact lines & fulfillment options
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Shop Identity */}
        <Card className="p-6 border-border/80 shadow-sm space-y-4">
          <div className="pb-3 border-b border-border/60">
            <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Store className="h-4 w-4 text-emerald-600" /> Store Identification & Description
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Public store details presented to local customers
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <Label className="text-xs font-semibold">Store / Shop Name *</Label>
              <Input
                value={form.shop_name}
                onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
                className="mt-1.5 h-9 text-xs"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Owner / Proprietor Name *</Label>
              <Input
                value={form.owner_name}
                onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                className="mt-1.5 h-9 text-xs"
                required
              />
            </div>
          </div>

          <div className="text-xs">
            <Label className="text-xs font-semibold">Store Bio & Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Authorized showroom offering brand new electronics, live demonstrations & genuine warranty..."
              className="mt-1.5 text-xs min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 rounded-xl border border-border bg-card">
              <ImagePicker
                value={form.logo_url}
                onChange={(url) => setForm({ ...form, logo_url: url })}
                label="Shop Logo"
                description="Upload from device gallery or paste logo URL"
              />
            </div>
            <div className="p-3 rounded-xl border border-border bg-card">
              <ImagePicker
                value={form.banner_url}
                onChange={(url) => setForm({ ...form, banner_url: url })}
                label="Storefront Banner Photo"
                description="Upload from device gallery or paste banner URL"
              />
            </div>
          </div>
        </Card>

        {/* Contact & Map Coordinates */}
        <Card className="p-6 border-border/80 shadow-sm space-y-4">
          <div className="pb-3 border-b border-border/60">
            <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
              <MapPin className="h-4 w-4 text-emerald-600" /> Physical Location & Contact Channels
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Accurate coordinates power distance calculations on the customer map
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <Label className="text-xs font-semibold">Contact Phone Number *</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1.5 h-9 text-xs"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">WhatsApp Number (For instant buyer inquiries)</Label>
              <Input
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                className="mt-1.5 h-9 text-xs"
              />
            </div>
          </div>

          <div className="text-xs">
            <Label className="text-xs font-semibold">Full Street Address *</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="mt-1.5 h-9 text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <Label className="text-xs font-semibold">City</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="mt-1.5 h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">State</Label>
              <Input
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="mt-1.5 h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Postal PIN Code</Label>
              <Input
                value={form.pin_code}
                onChange={(e) => setForm({ ...form, pin_code: e.target.value })}
                className="mt-1.5 h-9 text-xs font-mono font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <Label className="text-xs font-semibold">Google Maps Latitude</Label>
              <Input
                value={form.map_lat}
                onChange={(e) => setForm({ ...form, map_lat: e.target.value })}
                placeholder="16.5746"
                className="mt-1.5 h-9 text-xs font-mono"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Google Maps Longitude</Label>
              <Input
                value={form.map_lng}
                onChange={(e) => setForm({ ...form, map_lng: e.target.value })}
                placeholder="82.0062"
                className="mt-1.5 h-9 text-xs font-mono"
              />
            </div>
          </div>
        </Card>

        {/* Operating Hours */}
        <Card className="p-6 border-border/80 shadow-sm space-y-4">
          <div className="pb-3 border-b border-border/60">
            <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Clock className="h-4 w-4 text-emerald-600" /> Store Opening & Closing Hours
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Let neighborhood buyers know when your shop is open for physical visits
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {DAYS.map((day) => (
              <div key={day.key} className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border/40">
                <span className="font-semibold text-foreground w-28">{day.label}</span>
                <Input
                  value={form.working_hours[day.key] || '9:00 AM - 9:00 PM'}
                  onChange={(e) => handleHourChange(day.key, e.target.value)}
                  className="h-8 text-xs w-48 text-right font-mono"
                />
              </div>
            ))}
          </div>
        </Card>

        {/* Fulfillment Options */}
        <Card className="p-6 border-border/80 shadow-sm space-y-4">
          <div className="pb-3 border-b border-border/60">
            <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Truck className="h-4 w-4 text-emerald-600" /> Fulfillment & Service Radius
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Configure delivery terms and store pickup availability
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-foreground block">Doorstep Delivery Service</span>
                <span className="text-[11px] text-muted-foreground">
                  Provide direct home delivery to nearby customer pin codes
                </span>
              </div>
              <Switch
                checked={form.delivery_available}
                onCheckedChange={(checked) => setForm({ ...form, delivery_available: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-foreground block">In-Store Pickup Available</span>
                <span className="text-[11px] text-muted-foreground">
                  Allow customers to place queries and inspect/collect products at your counter
                </span>
              </div>
              <Switch
                checked={form.pickup_available}
                onCheckedChange={(checked) => setForm({ ...form, pickup_available: checked })}
              />
            </div>

            <div className="max-w-xs">
              <Label className="text-xs font-semibold">Home Delivery Radius (Kilometers)</Label>
              <Input
                type="number"
                value={form.home_delivery_radius_km}
                onChange={(e) => setForm({ ...form, home_delivery_radius_km: e.target.value })}
                className="mt-1.5 h-9 text-xs w-32 font-bold"
                min={1}
                max={50}
              />
            </div>
          </div>
        </Card>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={saving}
            className="font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md h-10 px-6"
          >
            <Save className="h-4 w-4" /> {saving ? 'Saving Profile...' : 'Save Shop Profile'}
          </Button>
        </div>
      </form>
    </div>
  );
}
