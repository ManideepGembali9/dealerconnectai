'use client';

import { Bell } from 'lucide-react';
import { AdminPushNotificationsTab } from '@/components/admin-push-notifications-tab';

export function Module11Notifications() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
          <Bell className="h-7 w-7 text-primary" /> Push Notifications & Announcements
        </h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Broadcast push notifications to customers, dealers, all platform users, or specific location segments
        </p>
      </div>

      <AdminPushNotificationsTab />
    </div>
  );
}
