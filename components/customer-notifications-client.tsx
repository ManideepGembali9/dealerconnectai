'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';
import {
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/notifications';
import { Bell, BellOff, Check, Package, Store, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export function CustomerNotificationsClient() {
  const router = useRouter();
  const { customerAuthenticated, customer, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    if (!customer) return;
    setLoading(true);
    try {
      const data = await fetchNotifications(100, {
        id: customer.id,
        email: customer.email,
      });
      setNotifications(data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [customer]);

  useEffect(() => {
    if (!authLoading && !customerAuthenticated) { router.push('/customer/login'); return; }
    if (customer) {
      loadNotifications();
      const handleSync = () => loadNotifications();
      window.addEventListener('dc-sync-event', handleSync);
      window.addEventListener('dc-notification-sent', handleSync);
      window.addEventListener('storage', handleSync);
      return () => {
        window.removeEventListener('dc-sync-event', handleSync);
        window.removeEventListener('dc-notification-sent', handleSync);
        window.removeEventListener('storage', handleSync);
      };
    }
  }, [authLoading, customerAuthenticated, customer, router, loadNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    } catch { /* ignore */ }
  };

  const markAllRead = async () => {
    if (!customer) return;
    try {
      await markAllNotificationsRead({ id: customer.id, email: customer.email });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch { /* ignore */ }
  };

  const handleDismiss = async (id: string) => {
    await deleteNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
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
            <Card key={n.id} className={`flex flex-col sm:flex-row sm:items-start gap-3 p-4 ${!n.is_read ? 'border-primary/30 bg-primary/5' : ''}`}>
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">{typeIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  <p className="text-sm text-muted-foreground break-words">{n.message}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{timeAgo(n.created_at)}</span>
                    {!n.is_read && <Badge className="bg-primary/15 text-primary text-[10px]">New</Badge>}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-1 shrink-0">
                {!n.is_read && <Button size="sm" variant="ghost" onClick={() => markAsRead(n.id)}>Mark read</Button>}
                <Button size="sm" variant="ghost" onClick={() => handleDismiss(n.id)} className="text-xs text-muted-foreground">Dismiss</Button>
              </div>
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
