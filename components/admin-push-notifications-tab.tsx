'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getDbNotifications,sendDbNotification } from '@/lib/firebase-db';
import { timeAgo } from '@/lib/format';
import type { PushNotification } from '@/lib/supabase';
import { Bell,CheckCircle2,Clock,Loader2,Send,ShieldCheck } from 'lucide-react';
import { useEffect,useState } from 'react';
import { toast } from 'sonner';

export function AdminPushNotificationsTab() {
  const [notifications, setNotifications] = useState<PushNotification[]>([]);
  const [sending, setSending] = useState(false);

  const [form, setForm] = useState({
    title: '',
    body: '',
    target_audience: 'all' as 'all' | 'customers' | 'dealers' | 'specific',
    specific_user: '',
  });

  const loadNotifications = async () => {
    try {
      const data = await getDbNotifications();
      setNotifications(data);
    } catch {}
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('Please enter both title and message body');
      return;
    }

    setSending(true);
    try {
      const newNotif = await sendDbNotification({
        title: form.title.trim(),
        body: form.body.trim(),
        target_audience: form.target_audience,
        target_user_ids: form.target_audience === 'specific' && form.specific_user ? [form.specific_user] : null,
        sent_by: 'Admin Command Center',
      });

      setNotifications((prev) => [newNotif, ...prev]);
      setForm({ title: '', body: '', target_audience: 'all', specific_user: '' });
      toast.success(`Push notification sent to ${form.target_audience.replace('_', ' ')}!`);
    } catch {
      toast.error('Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. COMPOSE NOTIFICATION */}
      <Card className="rounded-2xl border-border/70 p-6 shadow-sm">
        <form onSubmit={handleSend} className="space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-border/40">
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" /> Push Notification Broadcast Center
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Send real-time alerts directly to customers and local dealers
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-semibold gap-1 text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> Admin Control
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">Notification Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Mega Weekend Electronics Sale in Amalapuram"
                className="rounded-xl text-sm"
                required
              />
            </div>

            <div>
              <Label className="mb-1.5 block text-xs font-semibold">Target Audience</Label>
              <Select
                value={form.target_audience}
                onValueChange={(val: any) => setForm((p) => ({ ...p, target_audience: val }))}
              >
                <SelectTrigger className="rounded-xl text-sm">
                  <SelectValue placeholder="Select Audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">👥 All Users (Customers & Dealers)</SelectItem>
                  <SelectItem value="customers">🛍️ All Customers Only</SelectItem>
                  <SelectItem value="dealers">🏪 All Verified Dealers Only</SelectItem>
                  <SelectItem value="specific">🎯 Specific User ID / Email</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.target_audience === 'specific' && (
              <div className="sm:col-span-2">
                <Label className="mb-1.5 block text-xs font-semibold">Target User ID or Email</Label>
                <Input
                  value={form.specific_user}
                  onChange={(e) => setForm((p) => ({ ...p, specific_user: e.target.value }))}
                  placeholder="e.g. user-123 or customer@dealerconnect.ai"
                  className="rounded-xl text-sm"
                  required
                />
              </div>
            )}

            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-xs font-semibold">Message Body</Label>
              <Textarea
                value={form.body}
                onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
                placeholder="Write message details (up to 200 characters)..."
                rows={3}
                className="rounded-xl text-sm"
                required
              />
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full rounded-xl font-bold shadow-md" disabled={sending}>
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {sending ? 'Dispatching...' : 'Broadcast Push Notification Now'}
          </Button>
        </form>
      </Card>

      {/* 2. SENT NOTIFICATIONS LOG */}
      <Card className="rounded-2xl border-border/70 p-6 shadow-sm overflow-hidden">
        <h3 className="text-base font-bold mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> Dispatched Notifications History
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/30">
              <tr>
                <th className="px-3.5 py-2.5 text-left font-bold text-xs">Title & Content</th>
                <th className="px-3.5 py-2.5 text-left font-bold text-xs">Audience</th>
                <th className="px-3.5 py-2.5 text-left font-bold text-xs">Sender</th>
                <th className="px-3.5 py-2.5 text-left font-bold text-xs">Sent At</th>
                <th className="px-3.5 py-2.5 text-right font-bold text-xs">Status</th>
              </tr>
            </thead>
            <tbody>
              {notifications.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground text-xs">
                    No push notifications sent yet.
                  </td>
                </tr>
              ) : (
                notifications.map((n) => (
                  <tr key={n.id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                    <td className="px-3.5 py-3">
                      <p className="font-semibold text-xs text-foreground">{n.title}</p>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">{n.body}</p>
                    </td>
                    <td className="px-3.5 py-3">
                      <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                        {n.target_audience}
                      </Badge>
                    </td>
                    <td className="px-3.5 py-3 text-xs text-muted-foreground">{n.sent_by || 'Admin'}</td>
                    <td className="px-3.5 py-3 text-xs text-muted-foreground">{timeAgo(n.sent_at)}</td>
                    <td className="px-3.5 py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Sent
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
