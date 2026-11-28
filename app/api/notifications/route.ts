import { NextResponse } from 'next/server';
import { getPortalAuthContext, unauthorizedResponse } from '@/lib/server-auth';
import {
  createNotificationInState,
  getServerDb,
  mutateServerDb,
} from '@/lib/server-db';
import type { PushNotification } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = getPortalAuthContext(request);
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope');
  const db = getServerDb();

  if (scope === 'admin_push') {
    if (!auth.admin) return unauthorizedResponse('Admin authorization required', 403);
    return NextResponse.json({ pushNotifications: db.pushNotifications });
  }

  if (scope === 'admin') {
    if (!auth.admin) return unauthorizedResponse('Admin authorization required', 403);
    return NextResponse.json({
      notifications: db.notifications.filter((n) => n.recipient_role === 'admin'),
    });
  }

  if (scope === 'dealer') {
    if (!auth.dealer) return unauthorizedResponse('Dealer authorization required', 401);
    const dealerId = auth.dealer.dealerId;
    return NextResponse.json({
      notifications: db.notifications.filter(
        (n) => n.recipient_role === 'dealer' && n.recipient_id === dealerId
      ),
    });
  }

  if (scope === 'customer') {
    if (!auth.customer) return unauthorizedResponse('Customer login required', 401);
    const custId = auth.customer.sub;
    const custEmail = auth.customer.email.toLowerCase();
    return NextResponse.json({
      notifications: db.notifications.filter(
        (n) =>
          n.recipient_role === 'customer' &&
          (n.recipient_id === custId || n.recipient_id?.toLowerCase() === custEmail)
      ),
    });
  }

  if (!auth.admin && !auth.dealer && !auth.customer) {
    return NextResponse.json({ notifications: [] });
  }

  const combined = db.notifications.filter((n) => {
    if (n.recipient_role === 'admin' && auth.admin) return true;
    if (n.recipient_role === 'dealer' && auth.dealer && n.recipient_id === auth.dealer.dealerId) return true;
    if (
      n.recipient_role === 'customer' &&
      auth.customer &&
      (n.recipient_id === auth.customer.sub ||
        n.recipient_id?.toLowerCase() === auth.customer.email.toLowerCase())
    ) {
      return true;
    }
    return false;
  });

  return NextResponse.json({ notifications: combined });
}

export async function POST(request: Request) {
  try {
    const auth = getPortalAuthContext(request);
    if (!auth.admin) {
      return unauthorizedResponse('Only Admins can broadcast system push notifications.', 403);
    }

    const body = await request.json();
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const messageBody = typeof body?.body === 'string' ? body.body.trim() : '';
    const audience = (body?.target_audience || 'all') as PushNotification['target_audience'];

    if (!title || !messageBody) {
      return NextResponse.json({ error: 'Title and message body are required.' }, { status: 400 });
    }

    const result = mutateServerDb((state, emit) => {
      const push: PushNotification = {
        id: `push-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title,
        body: messageBody,
        target_audience: audience,
        target_user_ids: Array.isArray(body?.target_user_ids) ? body.target_user_ids : null,
        sent_by: auth.admin!.email,
        sent_at: new Date().toISOString(),
        delivery_status: 'sent',
      };

      state.pushNotifications = [push, ...state.pushNotifications];

      if (audience === 'all' || audience === 'dealers') {
        for (const d of state.dealers.filter((dl) => dl.status === 'approved')) {
          createNotificationInState(state, {
            recipientId: d.id,
            recipientRole: 'dealer',
            type: 'system',
            title,
            message: messageBody,
            dealerId: d.id,
            relatedRecordId: push.id,
            linkUrl: '/dealer?tab=10-notifications',
          });
        }
      }

      if (audience === 'specific' && Array.isArray(body?.target_user_ids)) {
        for (const uid of body.target_user_ids) {
          createNotificationInState(state, {
            recipientId: String(uid),
            recipientRole: 'customer',
            type: 'system',
            title,
            message: messageBody,
            relatedRecordId: push.id,
            linkUrl: '/customer/notifications',
          });
        }
      }

      emit({
        topic: 'notifications',
        action: 'created',
        recordId: push.id,
        recipientRole: audience === 'dealers' ? 'dealer' : 'all',
      });

      return { pushNotification: push };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send broadcast';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = getPortalAuthContext(request);
    if (!auth.admin && !auth.dealer && !auth.customer) {
      return unauthorizedResponse('Authentication required', 401);
    }

    const body = await request.json();
    const id = typeof body?.id === 'string' ? body.id.trim() : null;
    const markAll = Boolean(body?.markAll);
    const scope = typeof body?.scope === 'string' ? body.scope : null;

    const result = mutateServerDb((state, emit) => {
      const canTouch = (n: { recipient_role?: string; recipient_id?: string; customer_id: string }) => {
        if (scope && n.recipient_role && n.recipient_role !== scope) return false;
        if (n.recipient_role === 'admin') return Boolean(auth.admin);
        if (n.recipient_role === 'dealer') return Boolean(auth.dealer && n.recipient_id === auth.dealer.dealerId);
        if (n.recipient_role === 'customer') {
          return Boolean(
            auth.customer &&
              (n.recipient_id === auth.customer.sub ||
                n.recipient_id?.toLowerCase() === auth.customer.email.toLowerCase())
          );
        }
        return false;
      };

      state.notifications = state.notifications.map((n) => {
        if (!canTouch(n)) return n;
        if (markAll || (id && n.id === id)) {
          return { ...n, is_read: true };
        }
        return n;
      });

      emit({
        topic: 'notifications',
        action: 'updated',
        recordId: id || undefined,
        recipientRole: (scope as 'customer' | 'dealer' | 'admin') || 'all',
      });
      return { updated: true };
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update notifications';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = getPortalAuthContext(request);
    if (!auth.admin && !auth.dealer && !auth.customer) {
      return unauthorizedResponse('Authentication required', 401);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim() || '';
    if (!id) {
      return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 });
    }

    const result = mutateServerDb((state, emit) => {
      state.notifications = state.notifications.filter((n) => {
        if (n.id !== id) return true;
        if (n.recipient_role === 'admin' && auth.admin) return false;
        if (n.recipient_role === 'dealer' && auth.dealer && n.recipient_id === auth.dealer.dealerId) return false;
        if (
          n.recipient_role === 'customer' &&
          auth.customer &&
          (n.recipient_id === auth.customer.sub ||
            n.recipient_id?.toLowerCase() === auth.customer.email.toLowerCase())
        ) {
          return false;
        }
        return true;
      });
      emit({ topic: 'notifications', action: 'deleted', recordId: id });
      return { deleted: true };
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete notification';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
