'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiSync } from '@/lib/api-sync';
import { getDbNotifications } from '@/lib/firebase-db';
import { timeAgo } from '@/lib/format';
import { useRealtimeSync } from '@/lib/realtime-client';
import type { Dealer, Notification, PushNotification } from '@/lib/types';
import { ArrowRight, Bell, Check, CheckCheck, Megaphone, MessageSquare, Star, Store, Trash2 } from 'lucide-react';

type Props = {
  dealer: Dealer;
  onNavigateTab?: (tabId: string) => void;
};

export function Module10DealerNotifications({ dealer, onNavigateTab }: Props) {
  const [dealerNotifs, setDealerNotifs] = useState<Notification[]>([]);
  const [broadcasts, setBroadcasts] = useState<PushNotification[]>([]);

  const loadNotifications = useCallback(async () => {
    try {
      const [personal, allPush] = await Promise.all([
        apiSync.fetchNotifications('dealer').catch(() => [] as Notification[]),
        getDbNotifications().catch(() => [] as PushNotification[]),
      ]);
      setDealerNotifs(personal || []);
      const filteredBroadcast = (allPush || []).filter(
        (n) => n.target_audience === 'all' || n.target_audience === 'dealers'
      );
      setBroadcasts(filteredBroadcast);
    } catch {}
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useRealtimeSync(['notifications', 'enquiries', 'reviews', 'dealer_applications'], loadNotifications, {
    onReconnect: loadNotifications,
  });

  const handleMarkRead = async (id: string) => {
    await apiSync.markNotificationRead(id, 'dealer').catch(() => {});
    setDealerNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const handleMarkAllRead = async () => {
    await apiSync.markAllNotificationsRead('dealer').catch(() => {});
    setDealerNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleDelete = async (id: string) => {
    await apiSync.deleteNotification(id).catch(() => {});
    setDealerNotifs((prev) => prev.filter((n) => n.id !== id));
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
    } else if (n.type === 'new_review' || n.type === 'review_update') {
      onNavigateTab?.('09-reviews');
    }
  };

  const unreadCount = dealerNotifs.filter((n) => !n.is_read).length;

  const renderIcon = (type: Notification['type']) => {
    if (type === 'new_enquiry' || type === 'enquiry_update') {
      return <MessageSquare className="h-4 w-4 text-primary" />;
    }
    if (type === 'new_review' || type === 'review_update') {
      return <Star className="h-4 w-4 text-amber-500" />;
    }
    return <Store className="h-4 w-4 text-emerald-600" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-black text-foreground flex items-center gap-2">
            <Bell className="h-5 w-5 text-emerald-600" /> Notifications &amp; Activity ({dealer.shop_name})
            {unreadCount > 0 && (
              <Badge className="bg-emerald-600 text-white text-[10px]">{unreadCount} new</Badge>
            )}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Instant alerts for new customer enquiries, product reviews, and admin updates
          </p>
        </div>

        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={handleMarkAllRead} className="h-8 gap-1.5 text-xs rounded-xl">
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </Button>
        )}
      </div>

      {/* Real-time Dealer Inbox */}
      <div className="space-y-2.5">
        {dealerNotifs.length === 0 ? (
          <Card className="p-8 text-center rounded-2xl border-border/80">
            <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-semibold text-muted-foreground">No new dealer alerts yet.</p>
          </Card>
        ) : (
          dealerNotifs.map((n) => (
            <Card
              key={n.id}
              className={`p-4 rounded-2xl border-border/80 flex items-start gap-3 transition-colors ${
                !n.is_read ? 'border-emerald-500/40 bg-emerald-500/5' : ''
              }`}
            >
              <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                {renderIcon(n.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-sm text-foreground">{n.title}</p>
                  <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(n.created_at)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] gap-1 rounded-lg"
                    onClick={() => handleOpenLink(n)}
                  >
                    View <ArrowRight className="h-3 w-3" />
                  </Button>
                  {!n.is_read && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px] gap-1"
                      onClick={() => handleMarkRead(n.id)}
                    >
                      <Check className="h-3 w-3" /> Mark read
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px] text-muted-foreground"
                    onClick={() => handleDelete(n.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Platform Broadcasts */}
      {broadcasts.length > 0 && (
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Platform Announcements
          </h3>
          {broadcasts.map((n) => (
            <Card key={n.id} className="p-4 rounded-2xl border-border/80 flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Megaphone className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-sm text-foreground">{n.title}</p>
                  <Badge variant="outline" className="text-[10px]">
                    {n.target_audience}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</p>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  From: <span className="font-semibold">{n.sent_by || 'Admin'}</span> • {timeAgo(n.sent_at)}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
