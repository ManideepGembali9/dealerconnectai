'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import type { Dealer } from '@/lib/types';
import { KeyRound,LogOut,Settings,ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type Module14Props = {
  dealer: Dealer;
};

export function Module14DealerSettings({ dealer }: Module14Props) {
  const { changePassword, signOut } = useAuth();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPw) {
      toast.error('Please enter a new password');
      return;
    }
    if (newPw.length < 6) {
      toast.error('Dealer password must be at least 6 characters long');
      return;
    }
    if (newPw !== confirmPw) {
      toast.error('New passwords do not match');
      return;
    }

    setSaving(true);
    try {
      const { error } = await changePassword(newPw);
      if (error) throw new Error(error);
      toast.success('Dealer password updated successfully!');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <Settings className="h-7 w-7 text-emerald-600" /> Account Settings & Security
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Manage your dealer login credentials, merchant verification status & session
          </p>
        </div>

        <Button
          variant="destructive"
          onClick={async () => {
            await signOut();
            toast.info('Logged out from Dealer Console.');
          }}
          className="font-bold gap-1.5 self-start sm:self-auto"
        >
          <LogOut className="h-4 w-4" /> Dealer Logout
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Account Info */}
        <Card className="p-6 border-border/80 shadow-sm space-y-4">
          <div className="pb-3 border-b border-border/60 flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Merchant Verification Status
            </h3>
            <Badge variant="default" className="bg-emerald-600 text-white capitalize text-[10px]">
              {dealer.status} Dealer
            </Badge>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <Label className="text-xs font-semibold">Registered Email</Label>
              <Input
                value={dealer.email}
                disabled
                className="mt-1 h-9 text-xs opacity-75 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Dealership Unique ID</Label>
              <Input
                value={dealer.id}
                disabled
                className="mt-1 h-9 text-xs opacity-75 font-mono"
              />
            </div>
            {dealer.gst_number && (
              <div>
                <Label className="text-xs font-semibold">Registered GSTIN</Label>
                <Input
                  value={dealer.gst_number}
                  disabled
                  className="mt-1 h-9 text-xs opacity-75 font-mono"
                />
              </div>
            )}
          </div>
        </Card>

        {/* Change Password */}
        <Card className="p-6 border-border/80 shadow-sm space-y-4">
          <div className="pb-3 border-b border-border/60">
            <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
              <KeyRound className="h-4 w-4 text-emerald-600" /> Change Dealer Password
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Update password used for signing in to the merchant console
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
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
                <Label className="text-xs font-semibold">New Password</Label>
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
              disabled={saving}
              className="w-full h-9 font-bold mt-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? 'Updating Password...' : 'Save New Password'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
