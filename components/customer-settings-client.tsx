'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Mail, Phone, MapPin, Save, Loader2, Bell, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function CustomerSettingsClient() {
  const router = useRouter();
  const { role, customer, refreshCustomer, loading: authLoading } = useAuth();
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', pin_code: '', preferred_city: '' });
  const [prefs, setPrefs] = useState({ notifications: true, ai_recommendations: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && role !== 'customer') { router.push('/customer/login'); return; }
    if (customer) {
      setForm({
        full_name: customer.full_name,
        email: customer.email,
        phone: customer.phone ?? '',
        pin_code: customer.pin_code ?? '',
        preferred_city: customer.preferred_city ?? '',
      });
      setPrefs({
        notifications: Boolean(customer.preferences?.notifications ?? true),
        ai_recommendations: Boolean(customer.preferences?.ai_recommendations ?? true),
      });
    }
  }, [authLoading, role, customer]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('customer_profiles')
        .update({
          full_name: form.full_name,
          phone: form.phone,
          pin_code: form.pin_code,
          preferred_city: form.preferred_city,
          preferences: prefs,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customer.id);

      if (error) throw error;
      await refreshCustomer();
      toast.success('Profile updated successfully');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return <div className="mx-auto max-w-2xl px-4 py-20 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }
  if (!customer) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold">Settings & Profile</h1>
      <p className="mb-6 text-sm text-muted-foreground">Update your personal information and preferences</p>

      <Card className="p-6">
        <form onSubmit={handleSave} className="space-y-4">
          <h3 className="text-sm font-semibold">Personal Information</h3>

          <div>
            <Label htmlFor="full_name" className="mb-1.5 block text-sm">Full Name</Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} className="pl-9" />
            </div>
          </div>

          <div>
            <Label htmlFor="email" className="mb-1.5 block text-sm">Email (read-only)</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={form.email} disabled className="pl-9 opacity-60" />
            </div>
          </div>

          <div>
            <Label htmlFor="phone" className="mb-1.5 block text-sm">Mobile Number</Label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} className="pl-9" inputMode="numeric" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pin_code" className="mb-1.5 block text-sm">PIN Code</Label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={form.pin_code} onChange={(e) => setForm((p) => ({ ...p, pin_code: e.target.value.replace(/\D/g, '').slice(0, 6) }))} className="pl-9" inputMode="numeric" />
              </div>
            </div>
            <div>
              <Label htmlFor="preferred_city" className="mb-1.5 block text-sm">Preferred City</Label>
              <Input value={form.preferred_city} onChange={(e) => setForm((p) => ({ ...p, preferred_city: e.target.value }))} placeholder="e.g. Mumbai" />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="mb-3 text-sm font-semibold">Preferences</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Push Notifications</span>
                </div>
                <Switch checked={prefs.notifications} onCheckedChange={(v) => setPrefs((p) => ({ ...p, notifications: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">AI Recommendations</span>
                </div>
                <Switch checked={prefs.ai_recommendations} onCheckedChange={(v) => setPrefs((p) => ({ ...p, ai_recommendations: v }))} />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
