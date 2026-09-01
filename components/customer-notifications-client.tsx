'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bell, Check, Package, Store, TrendingUp, BellOff } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/format';

export function CustomerNotificationsClient() {
  const router = useRouter();
  const { role, customer, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && role !== 'customer') { router.push('/customer/login'); return; }
    if (customer) loadNotifications();
  }, [authLoading, role, customer]);

  const loadNotifications = async () => {
    if (!customer) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setNotifications(data ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const markAsRead = async (id: string) => {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    } catch { /* ignore */ }
  };

  const markAllRead = async () => {
    if (!customer) return;
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('customer_id', customer.id).eq('is_read', false);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch { /* ignore */ }
  };

  if (authLoading || loading) {
    return <div className="mx-auto max-w-4xl px-4 py-20 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }
  if (!customer) return null;

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const typeIcon = (type: string) => {
    if (type === 'in_stock') return <Package className="h-4 w-4 text-success" />;
    if (type === 'price_drop') return <TrendingUp className="h-4 w-4 text-primary" />;
    if (type === 'nearby_available') return <Store className="h-4 w-4 text-accent" />;
    return <Bell className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">{unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}</p>
        </div>
        {unreadCount > 0 && <Button variant="outline" size="sm" onClick={markAllRead}><Check className="mr-2 h-4 w-4" /> Mark all read</Button>}
      </div>

      {notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card key={n.id} className={`flex items-start gap-3 p-4 ${!n.is_read ? 'border-primary/30 bg-primary/5' : ''}`}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">{typeIcon(n.type)}</div>
              <div className="flex-1">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-sm text-muted-foreground">{n.message}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{timeAgo(n.created_at)}</span>
                  {!n.is_read && <Badge className="bg-primary/15 text-primary text-[10px]">New</Badge>}
                </div>
              </div>
              {!n.is_read && <Button size="sm" variant="ghost" onClick={() => markAsRead(n.id)} className="shrink-0">Mark read</Button>}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <BellOff className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No notifications yet. You&apos;ll be notified about dealer responses, price changes, and new products near you.</p>
        </Card>
      )}
    </div>
  );
}
