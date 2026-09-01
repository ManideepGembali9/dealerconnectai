'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Store, ArrowLeft, Check, Upload, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { fetchCategories, supabase } from '@/lib/data';
import { useEffect } from 'react';
import type { Category } from '@/lib/supabase';
import { toast } from 'sonner';

export function DealerRegisterClient() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    shop_name: '', owner_name: '', email: '', phone: '', whatsapp: '', password: '',
    address: '', village: '', city: '', district: '', state: '', pin_code: '',
    gst_number: '', business_category_id: '', logo_url: '', banner_url: '',
    map_lat: '', map_lng: '', home_delivery_radius_km: '5',
    delivery_available: true, pickup_available: true,
  });

  useEffect(() => {
    (async () => {
      try {
        const cats = await fetchCategories();
        setCategories(cats);
      } catch (e) { console.error(e); }
    })();
  }, []);

  const handleChange = (k: string, v: any) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.shop_name || !form.owner_name || !form.email || !form.phone || !form.address || !form.city || !form.state || !form.pin_code) {
      toast.error('Please fill all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('dealers').insert({
        shop_name: form.shop_name,
        owner_name: form.owner_name,
        email: form.email,
        phone: form.phone,
        whatsapp: form.whatsapp || null,
        password_hash: form.password || 'demo',
        address: form.address,
        village: form.village || null,
        city: form.city,
        district: form.district || null,
        state: form.state,
        pin_code: form.pin_code,
        gst_number: form.gst_number || null,
        business_category_id: form.business_category_id || null,
        logo_url: form.logo_url || null,
        banner_url: form.banner_url || null,
        map_lat: form.map_lat ? parseFloat(form.map_lat) : null,
        map_lng: form.map_lng ? parseFloat(form.map_lng) : null,
        home_delivery_radius_km: parseFloat(form.home_delivery_radius_km) || 0,
        delivery_available: form.delivery_available,
        pickup_available: form.pickup_available,
        status: 'pending',
        working_hours: { mon: '9:00-21:00', tue: '9:00-21:00', wed: '9:00-21:00', thu: '9:00-21:00', fri: '9:00-21:00', sat: '9:00-21:00', sun: '10:00-18:00' },
      });
      if (error) throw error;
      setSubmitted(true);
      toast.success('Registration submitted! Awaiting admin approval.');
    } catch (e: any) {
      toast.error(e.message ?? 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 px-4 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success"><Check className="h-8 w-8" /></div>
        <h1 className="text-xl font-bold">Registration Submitted!</h1>
        <p className="text-sm text-muted-foreground">Your shop registration is now pending admin approval. You'll be able to access the dealer dashboard once approved.</p>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href="/">Back to home</Link></Button>
          <Button asChild><Link href="/dealer/register">Register another</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/" className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Back to home</Link>
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground"><Store className="h-7 w-7" /></div>
        <h1 className="text-2xl font-bold">Register Your Shop</h1>
        <p className="mt-1 text-sm text-muted-foreground">Join DealerConnect AI and reach thousands of nearby customers</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6">
          <h2 className="mb-4 text-base font-semibold">Shop Information</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Shop Name *" value={form.shop_name} onChange={(v) => handleChange('shop_name', v)} required />
            <Field label="Owner Name *" value={form.owner_name} onChange={(v) => handleChange('owner_name', v)} required />
            <Field label="Email *" type="email" value={form.email} onChange={(v) => handleChange('email', v)} required />
            <Field label="Phone *" value={form.phone} onChange={(v) => handleChange('phone', v)} required />
            <Field label="WhatsApp" value={form.whatsapp} onChange={(v) => handleChange('whatsapp', v)} />
            <Field label="Password" type="password" value={form.password} onChange={(v) => handleChange('password', v)} />
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-sm font-medium">Business Category</Label>
              <Select value={form.business_category_id} onValueChange={(v) => handleChange('business_category_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select your business type" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-base font-semibold">Shop Address</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-sm font-medium">Address *</Label>
              <Textarea value={form.address} onChange={(e) => handleChange('address', e.target.value)} placeholder="Full shop address" rows={2} required />
            </div>
            <Field label="Village / Area" value={form.village} onChange={(v) => handleChange('village', v)} />
            <Field label="City *" value={form.city} onChange={(v) => handleChange('city', v)} required />
            <Field label="District" value={form.district} onChange={(v) => handleChange('district', v)} />
            <Field label="State *" value={form.state} onChange={(v) => handleChange('state', v)} required />
            <Field label="PIN Code *" value={form.pin_code} onChange={(v) => handleChange('pin_code', v.replace(/\D/g, '').slice(0, 6))} required />
            <Field label="GST Number" value={form.gst_number} onChange={(v) => handleChange('gst_number', v)} />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-base font-semibold">Location & Delivery</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Map Latitude" value={form.map_lat} onChange={(v) => handleChange('map_lat', v)} placeholder="e.g. 16.9034" />
            <Field label="Map Longitude" value={form.map_lng} onChange={(v) => handleChange('map_lng', v)} placeholder="e.g. 82.0175" />
            <Field label="Home Delivery Radius (km)" type="number" value={form.home_delivery_radius_km} onChange={(v) => handleChange('home_delivery_radius_km', v)} />
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.delivery_available} onChange={(e) => handleChange('delivery_available', e.target.checked)} className="h-4 w-4 rounded" /> Home Delivery</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.pickup_available} onChange={(e) => handleChange('pickup_available', e.target.checked)} className="h-4 w-4 rounded" /> Store Pickup</label>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-base font-semibold">Shop Images</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Shop Logo URL" value={form.logo_url} onChange={(v) => handleChange('logo_url', v)} placeholder="https://..." />
            <Field label="Shop Banner URL" value={form.banner_url} onChange={(v) => handleChange('banner_url', v)} placeholder="https://..." />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Tip: Use a Pexels image URL for demo purposes.</p>
        </Card>

        <div className="flex items-center justify-between rounded-lg border border-warning/30 bg-warning/5 p-4">
          <p className="text-sm text-muted-foreground"><Badge className="mr-2 bg-warning/15 text-warning">Note</Badge> Your registration will be reviewed by our admin team before activation.</p>
          <Button type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Registration'}</Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, required }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm font-medium">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} />
    </div>
  );
}
