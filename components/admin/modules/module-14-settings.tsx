'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/auth';
import { getDbPlatformSettings, saveDbPlatformSettings } from '@/lib/firebase-db';
import {
  KeyRound,
  LogOut,
  Phone,
  Save,
  Settings, Shield
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export function Module14Settings() {
  const { changePassword, signOut } = useAuth();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  // Platform support details persisted in DB
  const [supportPhone, setSupportPhone] = useState('+91 98480 12345');
  const [supportEmail, setSupportEmail] = useState('support@dealerconnect.ai');
  const [supportWhatsApp, setSupportWhatsApp] = useState('+91 98480 12345');
  const [sessionTimeout, setSessionTimeout] = useState(true);
  const [auditLogEnabled, setAuditLogEnabled] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [pwFeedback, setPwFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [settingsFeedback, setSettingsFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const saved = getDbPlatformSettings();
    setSupportPhone(saved.supportPhone);
    setSupportEmail(saved.supportEmail);
    setSupportWhatsApp(saved.supportWhatsApp);
    setSessionTimeout(saved.sessionTimeout);
    setAuditLogEnabled(saved.auditLogEnabled);
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwFeedback(null);
    if (!newPw) {
      setPwFeedback({ type: 'error', text: 'Please enter a new password' });
      toast.error('Please enter a new password');
      return;
    }
    if (newPw.length < 6) {
      setPwFeedback({ type: 'error', text: 'Admin password must be at least 6 characters' });
      toast.error('Admin password must be at least 6 characters');
      return;
    }
    if (newPw !== confirmPw) {
      setPwFeedback({ type: 'error', text: 'New passwords do not match' });
      toast.error('New passwords do not match');
      return;
    }
    if (currentPw.trim()) {
      const storedPw = localStorage.getItem('dc-admin-custom-password') || 'admin123';
      if (currentPw !== storedPw) {
        setPwFeedback({ type: 'error', text: 'Current admin password is incorrect' });
        toast.error('Current admin password is incorrect');
        return;
      }
    }

    setSavingPw(true);
    try {
      const { error } = await changePassword(newPw, 'admin');
      if (error) throw new Error(error);
      setPwFeedback({ type: 'success', text: 'Admin master password updated successfully!' });
      toast.success('Admin master password updated successfully!');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err: any) {
      const msg = err.message || 'Failed to update password';
      setPwFeedback({ type: 'error', text: msg });
      toast.error(msg);
    } finally {
      setSavingPw(false);
    }
  };

  const handleSavePlatformSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsFeedback(null);
    try {
      await saveDbPlatformSettings({
        supportPhone: supportPhone.trim() || '+91 98480 12345',
        supportEmail: supportEmail.trim() || 'support@dealerconnect.ai',
        supportWhatsApp: supportWhatsApp.trim() || supportPhone.trim(),
        sessionTimeout,
        auditLogEnabled,
      });
      setSettingsFeedback({ type: 'success', text: 'Platform security & support settings saved and synchronized!' });
      toast.success('General platform and support preferences saved!');
    } catch (err: any) {
      const msg = err?.message || 'Failed to save platform settings';
      setSettingsFeedback({ type: 'error', text: msg });
      toast.error(msg);
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <Settings className="h-7 w-7 text-primary" /> Platform & Admin Settings
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Administrator credentials, security policies, support contact info & session maintenance
          </p>
        </div>

        <Button
          variant="destructive"
          onClick={async () => {
            await signOut('admin');
          }}
          className="font-bold gap-1.5 self-start sm:self-auto"
        >
          <LogOut className="h-4 w-4" /> Admin Logout
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Administrator Profile Card */}
        <Card className="p-6 border-border/80 shadow-sm space-y-4">
          <div className="pb-3 border-b border-border/60 flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" /> Super Admin Account
            </h3>
            <Badge variant="outline" className="text-[10px] font-semibold text-emerald-600">
              Active Root Access
            </Badge>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <Label className="text-xs font-semibold">Authorized Admin Email</Label>
              <Input
                value="admin@dealerconnect.ai"
                disabled
                className="mt-1 h-9 text-xs opacity-70 font-mono"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Primary Super Administrator role with full platform database permissions.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <div>
                <span className="font-semibold text-foreground block">Session Security Timeout</span>
                <span className="text-[10px] text-muted-foreground">
                  Automatically invalidate dormant admin sessions after 24 hours
                </span>
              </div>
              <Switch checked={sessionTimeout} onCheckedChange={setSessionTimeout} />
            </div>

            <div className="pt-2 flex items-center justify-between">
              <div>
                <span className="font-semibold text-foreground block">Admin Audit Logging</span>
                <span className="text-[10px] text-muted-foreground">
                  Record all product deletions, dealer verifications & banner changes
                </span>
              </div>
              <Switch checked={auditLogEnabled} onCheckedChange={setAuditLogEnabled} />
            </div>
          </div>
        </Card>

        {/* Change Master Password Form */}
        <Card className="p-6 border-border/80 shadow-sm space-y-4">
          <div className="pb-3 border-b border-border/60">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" /> Update Master Password
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Securely update your admin sign-in password
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
            {pwFeedback && (
              <div
                className={`rounded-lg border px-3 py-2 text-xs font-semibold ${pwFeedback.type === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-destructive/30 bg-destructive/10 text-destructive'
                  }`}
              >
                {pwFeedback.text}
              </div>
            )}
            {pwFeedback && (
              <div
                className={`rounded-lg border px-3 py-2 text-xs font-semibold ${pwFeedback.type === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-destructive/30 bg-destructive/10 text-destructive'
                  }`}
              >
                {pwFeedback.text}
              </div>
            )}
            <div>
              <Label className="text-xs font-semibold">Current Password</Label>
              <Input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="Enter current password"
                className="mt-1 h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">New Master Password</Label>
                <Input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="Min 6 characters"
                  className="mt-1 h-9 text-xs"
                  required
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Confirm Password</Label>
                <Input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="Confirm password"
                  className="mt-1 h-9 text-xs"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={savingPw}
              className="w-full h-9 font-bold mt-2"
            >
              {savingPw ? 'Updating Password...' : 'Save New Master Password'}
            </Button>
          </form>
        </Card>
      </div>

      {/* General Platform Support & Privacy Settings */}
      <Card className="p-6 border-border/80 shadow-sm space-y-4">
        <div className="pb-3 border-b border-border/60">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" /> Public Platform Support Information
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Contact information presented to buyers and dealers across the mobile and web apps
          </p>
        </div>

        <form onSubmit={handleSavePlatformSettings} className="space-y-4 text-xs">
          {settingsFeedback && (
            <div
              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${settingsFeedback.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-destructive/30 bg-destructive/10 text-destructive'
                }`}
            >
              {settingsFeedback.text}
            </div>
          )}
          {settingsFeedback && (
            <div
              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${settingsFeedback.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-destructive/30 bg-destructive/10 text-destructive'
                }`}
            >
              {settingsFeedback.text}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-semibold">Helpline Phone Number</Label>
              <Input
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                placeholder="+91 98480 12345"
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Support Email Address</Label>
              <Input
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder="support@dealerconnect.ai"
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Official WhatsApp Line</Label>
              <Input
                value={supportWhatsApp}
                onChange={(e) => setSupportWhatsApp(e.target.value)}
                placeholder="+91 98480 12345"
                className="mt-1 h-9 text-xs"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button type="submit" disabled={savingSettings} className="font-semibold gap-1.5 h-9">
              <Save className="h-4 w-4" /> {savingSettings ? 'Saving...' : 'Save Support Settings'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
