'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminPushNotificationsTab } from '@/components/admin-push-notifications-tab';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiSync } from '@/lib/api-sync';
import { timeAgo } from '@/lib/format';
import { useRealtimeSync } from '@/lib/realtime-client';
import type { Notification } from '@/lib/types';
import { ArrowRight, Bell, Check, CheckCheck, MessageSquare, Star, Store, Trash2 } from 'lucide-react';

type Props = {
  onNavigateTab?: (tabId: string) => void;
};

export function Module11Notifications({ onNavigateTab }: Props) {
  const [adminAlerts, setAdminAlerts] = useState<Notification[]>([]);

  const loadAlerts = useCallback(async () => {
    try {
      const list = await apiSync.fetchNotifications('admin');
      setAdminAlerts(list || []);
    } catch {}
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  useRealtimeSync(
    ['notifications', 'enquiries', 'reviews', 'dealer_applications', 'products'],
    loadAlerts,
    { onReconnect: loadAlerts }
  );

  const handleMarkRead = async (id: string) => {
    await apiSync.markNotificationRead(id, 'admin').catch(() => {});
    setAdminAlerts((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const handleMarkAllRead = async () => {
    await apiSync.markAllNotificationsRead('admin').catch(() => {});
    setAdminAlerts((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleDelete = async (id: string) => {
    await apiSync.deleteNotification(id).catch(() => {});
    setAdminAlerts((prev) => prev.filter((n) => n.id !== id));
  };

  const handleOpenLink = async (n: Notification) => {
    if (!n.is_read) await handleMarkRead(n.id);
    if (n.link_url && n.link_url.includes('?tab=') && onNavigateTab) {
      const tab = n.link_url.split('?tab=')[1]?.split('&')[0];
      if (tab) {
        onNavigateTab(tab);
        return;
      }
    }
    if (n.type === 'new_enquiry' || n.type === 'enquiry_update') {
      onNavigateTab?.('08-enquiries');
    } else if (n.type === 'new_review' || n.type === 'review_update' || n.type === 'moderation_update') {
      onNavigateTab?.('09-reviews');
    } else if (n.type === 'dealer_application') {
      onNavigateTab?.('02-dealers');
    }
  };

  const unreadCount = adminAlerts.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      {/* Live Admin Activity Notification Feed */}
      <Card className="rounded-2xl border-border/70 p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/50">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" /> Admin Activity Alerts
              {unreadCount > 0 && (
                <Badge className="bg-primary text-primary-foreground text-[10px]">
                  {unreadCount} unread
                </Badge>
              )}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Real-time notifications for enquiries, reviews, dealer registrations, and reported content
            </p>
          </div>
          {unreadCount > 0 && (
            <Button size="sm" variant="outline" onClick={handleMarkAllRead} className="h-8 gap-1.5 text-xs rounded-xl">
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
        </div>

        {adminAlerts.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No live platform alerts yet. New enquiries, reviews, and applications appear here in real time.
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {adminAlerts.map((n) => (
              <div
                key={n.id}
                className={`rounded-xl border p-3 flex items-start gap-3 ${
                  !n.is_read ? 'border-primary/40 bg-primary/5' : 'border-border/60 bg-card'
                }`}
              >
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  {n.type === 'new_review' || n.type === 'moderation_update' ? (
                    <Star className="h-4 w-4 text-amber-500" />
                  ) : n.type === 'dealer_application' ? (
                    <Store className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <MessageSquare className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-foreground">{n.title}</p>
                    <span className="text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[11px] gap-1 px-2"
                      onClick={() => handleOpenLink(n)}
                    >
                      Inspect <ArrowRight className="h-3 w-3" />
                    </Button>
                    {!n.is_read && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[11px] gap-1 px-2"
                        onClick={() => handleMarkRead(n.id)}
                      >
                        <Check className="h-3 w-3" /> Mark read
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[11px] text-muted-foreground px-2"
                      onClick={() => handleDelete(n.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Broadcast Console */}
      <AdminPushNotificationsTab />
    </div>
  );
}
