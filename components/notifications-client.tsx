'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Bell, BellRing, Check, CheckCheck, Trash2, Package, DollarSign, MapPin,
  Sparkles, Settings, RefreshCw, PackageCheck, TrendingDown, Store, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { type Notification } from '@/lib/supabase';
import {
  fetchNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification,
  subscribeToPush, unsubscribeFromPush, getPushSubscription, updatePushPreferences,
  getNotificationPrefs, setNotificationPrefs, getCustomerId,
} from '@/lib/notifications';
import { useApp } from '@/lib/providers';
import { timeAgo } from '@/lib/format';

export function NotificationsClient() {
  const { location } = useApp();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [subLoading, setSubLoading] = useState(true);
  const [prefs, setPrefs] = useState(getNotificationPrefs());
  const [updatingPrefs, setUpdatingPrefs] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const notifs = await fetchNotifications(100);
      setNotifications(notifs);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const checkSubscription = useCallback(async () => {
    try {
      const sub = await getPushSubscription();
      setSubscribed(!!sub);
    } catch (e) { console.error(e); }
    finally { setSubLoading(false); }
  }, []);

  useEffect(() => { loadNotifications(); checkSubscription(); }, [loadNotifications, checkSubscription]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleSubscribe = async () => {
    setSubLoading(true);
    try {
      const { subscribed: ok, error } = await subscribeToPush(location.pinCode ?? undefined);
      if (ok) {
        setSubscribed(true);
        toast.success('Push notifications enabled');
      } else {
        toast.error(error ?? 'Failed to subscribe');
      }
    } catch (e: any) {
      toast.error(e.message ?? 'Subscription failed');
    } finally { setSubLoading(false); }
  };

  const handleUnsubscribe = async () => {
    setSubLoading(true);
    try {
      await unsubscribeFromPush();
      setSubscribed(false);
      toast.success('Push notifications disabled');
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to unsubscribe');
    } finally { setSubLoading(false); }
  };

  const handlePrefChange = async (key: 'in_stock' | 'price_drop' | 'nearby', value: boolean) => {
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);
    setNotificationPrefs(newPrefs);
    setUpdatingPrefs(true);
    try {
      await updatePushPreferences(newPrefs, location.pinCode ?? undefined);
      toast.success('Preferences updated');
    } catch (e: any) {
      toast.error('Failed to sync preferences');
    } finally { setUpdatingPrefs(false); }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast.success('All notifications marked as read');
  };

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleDelete = async (id: string) => {
    await deleteNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const typeIcon = (type: Notification['type']) => {
    switch (type) {
      case 'in_stock': return <PackageCheck className="h-4 w-4 text-success" />;
      case 'price_drop': return <TrendingDown className="h-4 w-4 text-primary" />;
      case 'nearby_available': return <MapPin className="h-4 w-4 text-accent" />;
      case 'moderation_update': return <Sparkles className="h-4 w-4 text-warning" />;
      default: return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const typeColor = (type: Notification['type']) => {
    switch (type) {
      case 'in_stock': return 'border-l-success';
      case 'price_drop': return 'border-l-primary';
      case 'nearby_available': return 'border-l-accent';
      case 'moderation_update': return 'border-l-warning';
      default: return 'border-l-border';
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Bell className="h-6 w-6 text-primary" /> Notifications</h1>
          <p className="text-sm text-muted-foreground">Get alerts for stock changes, price drops, and nearby availability</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            <CheckCheck className="mr-1.5 h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      <Tabs defaultValue="feed">
        <TabsList>
          <TabsTrigger value="feed"><Bell className="mr-1.5 h-4 w-4" /> Feed {unreadCount > 0 && <Badge className="ml-1.5 bg-destructive text-destructive-foreground text-[10px]">{unreadCount}</Badge>}</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="mr-1.5 h-4 w-4" /> Settings</TabsTrigger>
        </TabsList>

        {/* Notification Feed */}
        <TabsContent value="feed" className="mt-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
          ) : notifications.length === 0 ? (
            <Card className="p-12 text-center">
              <Bell className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-semibold">No Notifications Yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Subscribe to push notifications and start watching products to receive alerts.</p>
              {!subscribed && (
                <Button className="mt-4" onClick={handleSubscribe} disabled={subLoading}>
                  <BellRing className="mr-1.5 h-4 w-4" /> Enable Notifications
                </Button>
              )}
            </Card>
          ) : (
            notifications.map((notif) => (
              <Card
                key={notif.id}
                className={cn(
                  'border-l-4 p-4 transition-colors',
                  typeColor(notif.type),
                  !notif.is_read && 'bg-primary/[0.02]',
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0">{typeIcon(notif.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn('text-sm font-medium', !notif.is_read && 'font-bold')}>{notif.title}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(notif.created_at)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{notif.message}</p>

                    {(notif.old_value || notif.new_value) && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        {notif.old_value && <Badge variant="outline" className="text-muted-foreground">{notif.old_value}</Badge>}
                        {notif.old_value && notif.new_value && <span className="text-muted-foreground">&rarr;</span>}
                        {notif.new_value && <Badge className="bg-primary/15 text-primary">{notif.new_value}</Badge>}
                      </div>
                    )}

                    <div className="mt-2 flex items-center gap-3">
                      {notif.product_id && (
                        <Link href={`/product/${notif.product_id}`} className="text-xs text-primary hover:underline">
                          View product
                        </Link>
                      )}
                      {notif.dealer_id && (
                        <Link href={`/dealer/${notif.dealer_id}`} className="text-xs text-primary hover:underline">
                          View shop
                        </Link>
                      )}
                      {!notif.is_read && (
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => handleMarkRead(notif.id)}>
                          <Check className="mr-1 h-3 w-3" /> Mark read
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive hover:text-destructive" onClick={() => handleDelete(notif.id)}>
                        <Trash2 className="mr-1 h-3 w-3" /> Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings" className="mt-4 space-y-4">
          {/* Push subscription */}
          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><BellRing className="h-5 w-5 text-primary" /> Push Notifications</h3>
            <p className="mt-1 text-sm text-muted-foreground">Enable browser push notifications to receive real-time alerts on this device.</p>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', subscribed ? 'bg-success/10' : 'bg-muted')}>
                  {subscribed ? <Check className="h-5 w-5 text-success" /> : <Bell className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div>
                  <p className="text-sm font-medium">{subscribed ? 'Notifications Enabled' : 'Not Subscribed'}</p>
                  <p className="text-xs text-muted-foreground">
                    {subscribed ? `Receiving alerts on this device${location.pinCode ? ` · PIN: ${location.pinCode}` : ''}` : 'Click to enable push notifications'}
                  </p>
                </div>
              </div>
              <Button
                variant={subscribed ? 'outline' : 'default'}
                size="sm"
                onClick={subscribed ? handleUnsubscribe : handleSubscribe}
                disabled={subLoading}
              >
                {subLoading ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> : subscribed ? <X className="mr-1.5 h-4 w-4" /> : <BellRing className="mr-1.5 h-4 w-4" />}
                {subscribed ? 'Disable' : 'Enable'}
              </Button>
            </div>
          </Card>

          {/* Preferences */}
          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Settings className="h-5 w-5 text-primary" /> Notification Preferences</h3>
            <p className="mt-1 text-sm text-muted-foreground">Choose which types of alerts you want to receive.</p>
            <div className="mt-4 space-y-4">
              <PrefRow
                icon={<PackageCheck className="h-5 w-5 text-success" />}
                title="In-Stock Alerts"
                description="Get notified when a watched product comes back in stock"
                checked={prefs.in_stock}
                onChange={(v) => handlePrefChange('in_stock', v)}
              />
              <PrefRow
                icon={<TrendingDown className="h-5 w-5 text-primary" />}
                title="Price Drop Alerts"
                description="Get notified when a watched product's price drops"
                checked={prefs.price_drop}
                onChange={(v) => handlePrefChange('price_drop', v)}
              />
              <PrefRow
                icon={<MapPin className="h-5 w-5 text-accent" />}
                title="Nearby Availability"
                description="Get notified when products become available at shops near your PIN code"
                checked={prefs.nearby}
                onChange={(v) => handlePrefChange('nearby', v)}
              />
            </div>
            {updatingPrefs && <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><RefreshCw className="h-3 w-3 animate-spin" /> Syncing preferences...</p>}
          </Card>

          {/* Location */}
          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><MapPin className="h-5 w-5 text-primary" /> Location for Nearby Alerts</h3>
            <p className="mt-1 text-sm text-muted-foreground">Set your PIN code to receive nearby availability notifications.</p>
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="secondary" className="text-sm">{location.pinCode ?? 'Not set'}</Badge>
              {location.label && <span className="text-sm text-muted-foreground">{location.label}</span>}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Set your PIN code in the header search bar to update.</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PrefRow({ icon, title, description, checked, onChange }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">{icon}</div>
        <div>
          <Label className="text-sm font-medium">{title}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

