'use client';

import { useState, useEffect } from 'react';
import { Bell, ShieldCheck, MessageSquare, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getDbNotifications } from '@/lib/firebase-db';
import type { PushNotification, Dealer } from '@/lib/types';
import { timeAgo } from '@/lib/format';

type Module10Props = {
  dealer: Dealer;
};

export function Module10DealerNotifications({ dealer }: Module10Props) {
  const [notifications, setNotifications] = useState<PushNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const all = await getDbNotifications();
        // Filter for all or dealers
        const relevant = all.filter(
          (n) => n.target_audience === 'all' || n.target_audience === 'dealers'
        );
        setNotifications(relevant);
      } catch {}
      finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
          <Bell className="h-7 w-7 text-emerald-600" /> Notifications & Announcements
        </h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Platform announcements from Admin, customer lead alerts & store status notices
        </p>
      </div>

      <div className="space-y-3">
        {notifications.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground border-border/80">
            <Bell className="mx-auto h-8 w-8 opacity-40 mb-2" />
            No new notifications at this time.
          </Card>
        ) : (
          notifications.map((n) => (
            <Card
              key={n.id}
              className="p-4 border-border/80 flex items-start gap-3.5 shadow-sm hover:border-emerald-500/50 transition-colors"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 font-bold">
                <Bell className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-xs sm:text-sm text-foreground">{n.title}</h4>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {timeAgo(n.sent_at)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{n.body}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {n.sent_by || 'Admin'}
                  </Badge>
                  <span className="text-[10px] text-emerald-600 font-semibold">Delivered</span>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
