'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Mail, Phone, MapPin, Save, Loader2, Bell, Lock, KeyRound, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export function CustomerSettingsClient() {
  const router = useRouter();
  const { role, customer, updateCustomerProfile, changePassword, loading: authLoading } = useAuth();
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', pin_code: '', preferred_city: '' });
  const [prefs, setPrefs] = useState({ notifications: true, in_stock_alerts: true });
  const [saving, setSaving] = useState(false);

  // Password change state
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!authLoading && role !== 'customer') {
      router.push('/customer/login');
      return;
    }
    if (customer) {
      setForm({
        full_name: customer.full_name || '',
        email: customer.email || '',
        phone: customer.phone ?? '',
        pin_code: customer.pin_code ?? '',
        preferred_city: customer.preferred_city ?? '',
      });
      setPrefs({
        notifications: Boolean((customer.preferences as any)?.notifications ?? true),
        in_stock_alerts: Boolean((customer.preferences as any)?.in_stock_alerts ?? true),
      });
    }
  }, [authLoading, role, customer, router]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    setSaving(true);
    try {
      const { error } = await updateCustomerProfile({
        full_name: form.full_name,
        phone: form.phone,
        pin_code: form.pin_code,
        preferred_city: form.preferred_city,
        preferences: prefs,
      });

      if (error) throw new Error(error);
      toast.success('Customer profile updated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordForm.newPassword) {
      toast.error('Please enter a new password');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await changePassword(passwordForm.newPassword);
      if (error) throw new Error(error);
      toast.success('Password changed successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setChangingPassword(false);
    }
  };

  if (authLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!customer) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customer Profile & Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your personal details, delivery addresses, and security
        </p>
      </div>

      {/* Profile Details Form */}
      <Card className="rounded-2xl border-border/70 p-6 shadow-sm">
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <h3 className="text-base font-bold flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Personal Information
          </h3>

          <div>
            <Label htmlFor="full_name" className="mb-1.5 block text-xs font-semibold">Full Name</Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                className="pl-9 rounded-xl text-sm"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="email" className="mb-1.5 block text-xs font-semibold">Email Address (Registered)</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="email" value={form.email} disabled className="pl-9 rounded-xl opacity-60 text-sm" />
            </div>
          </div>

          <div>
            <Label htmlFor="phone" className="mb-1.5 block text-xs font-semibold">Mobile Number</Label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                className="pl-9 rounded-xl text-sm"
                inputMode="numeric"
                placeholder="10-digit mobile number"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pin_code" className="mb-1.5 block text-xs font-semibold">PIN Code</Label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="pin_code"
                  value={form.pin_code}
                  onChange={(e) => setForm((p) => ({ ...p, pin_code: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  className="pl-9 rounded-xl text-sm"
                  inputMode="numeric"
                  placeholder="6-digit PIN"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="preferred_city" className="mb-1.5 block text-xs font-semibold">Preferred City</Label>
              <Input
                id="preferred_city"
                value={form.preferred_city}
                onChange={(e) => setForm((p) => ({ ...p, preferred_city: e.target.value }))}
                placeholder="e.g. Amalapuram"
                className="rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="border-t border-border/40 pt-4">
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Notification Preferences</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Price Drop & In-Stock Alerts</span>
                </div>
                <Switch
                  checked={prefs.notifications}
                  onCheckedChange={(v) => setPrefs((p) => ({ ...p, notifications: v }))}
                />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full rounded-xl font-bold shadow-md" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {saving ? 'Saving...' : 'Save Profile Details'}
          </Button>
        </form>
      </Card>

      {/* Security & Password Change */}
      <Card className="rounded-2xl border-border/70 p-6 shadow-sm">
        <form onSubmit={handleChangePassword} className="space-y-4">
          <h3 className="text-base font-bold flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> Security & Password
          </h3>
          <p className="text-xs text-muted-foreground">
            Change your password to keep your customer account secure.
          </p>

          <div>
            <Label htmlFor="current_password" className="mb-1.5 block text-xs font-semibold">Current Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="current_password"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                placeholder="Enter current password"
                className="pl-9 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="new_password" className="mb-1.5 block text-xs font-semibold">New Password</Label>
              <Input
                id="new_password"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                placeholder="At least 6 characters"
                className="rounded-xl text-sm"
                required
              />
            </div>
            <div>
              <Label htmlFor="confirm_password" className="mb-1.5 block text-xs font-semibold">Confirm New Password</Label>
              <Input
                id="confirm_password"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                placeholder="Re-enter new password"
                className="rounded-xl text-sm"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="outline"
            className="w-full rounded-xl font-semibold border-primary/40 hover:bg-primary/10 hover:text-primary"
            disabled={changingPassword}
          >
            {changingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            {changingPassword ? 'Updating Password...' : 'Update Password'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
