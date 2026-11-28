import { NextResponse } from 'next/server';
import { getPortalAuthContext, unauthorizedResponse } from '@/lib/server-auth';
import {
  createNotificationInState,
  mutateServerDb,
  getServerDb,
} from '@/lib/server-db';
import type { Enquiry, EnquiryStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = getPortalAuthContext(request);
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope');
  const requestedDealerId = searchParams.get('dealerId');
  const statusFilter = searchParams.get('status');
  const db = getServerDb();

  if (scope === 'admin') {
    if (!auth.admin) return unauthorizedResponse('Admin authorization required', 403);
    const list = statusFilter && statusFilter !== 'all'
      ? db.enquiries.filter((e) => (e.status || 'pending') === statusFilter)
      : db.enquiries;
    return NextResponse.json({ enquiries: list });
  }

  if (scope === 'dealer' || requestedDealerId) {
    if (auth.admin && requestedDealerId) {
      return NextResponse.json({
        enquiries: db.enquiries.filter((e) => e.dealer_id === requestedDealerId),
      });
    }
    if (!auth.dealer) {
      return unauthorizedResponse('Approved Dealer login required', 401);
    }
    if (requestedDealerId && requestedDealerId !== auth.dealer.dealerId) {
      return unauthorizedResponse('Cross-dealer enquiry access denied', 403);
    }
    let list = db.enquiries.filter((e) => e.dealer_id === auth.dealer!.dealerId);
    if (statusFilter && statusFilter !== 'all') {
      list = list.filter((e) => (e.status || 'pending') === statusFilter);
    }
    return NextResponse.json({ enquiries: list });
  }

  if (scope === 'customer') {
    if (!auth.customer) {
      return unauthorizedResponse('Customer login required to view private enquiries', 401);
    }
    const custId = auth.customer.sub;
    const custEmail = auth.customer.email.toLowerCase();
    let list = db.enquiries.filter(
      (e) =>
        e.customer_id === custId ||
        (e.customer_email && e.customer_email.toLowerCase() === custEmail)
    );
    if (statusFilter && statusFilter !== 'all') {
      list = list.filter((e) => (e.status || 'pending') === statusFilter);
    }
    return NextResponse.json({ enquiries: list });
  }

  if (!auth.admin && !auth.dealer && !auth.customer) {
    return unauthorizedResponse('Authentication required', 401);
  }

  const list = auth.admin
    ? db.enquiries
    : db.enquiries.filter((e) => {
        if (auth.dealer && e.dealer_id === auth.dealer.dealerId) return true;
        if (
          auth.customer &&
          (e.customer_id === auth.customer.sub ||
            (e.customer_email && e.customer_email.toLowerCase() === auth.customer.email.toLowerCase()))
        ) {
          return true;
        }
        return false;
      });

  return NextResponse.json({ enquiries: list });
}

export async function POST(request: Request) {
  try {
    const auth = getPortalAuthContext(request);
    const body = await request.json();

    const dealerId = typeof body?.dealer_id === 'string' ? body.dealer_id.trim() : '';
    const productId = typeof body?.product_id === 'string' && body.product_id.trim() ? body.product_id.trim() : null;
    const channel = (body?.channel === 'call' || body?.channel === 'whatsapp' || body?.channel === 'form'
      ? body.channel
      : 'form') as Enquiry['channel'];
    const customerName = typeof body?.customer_name === 'string' ? body.customer_name.trim() : '';
    const customerPhone = typeof body?.customer_phone === 'string' ? body.customer_phone.trim() : '';
    const rawMessage = typeof body?.message === 'string' ? body.message.trim() : '';

    if (!dealerId) {
      return NextResponse.json({ error: 'Target dealer_id is required.' }, { status: 400 });
    }
    if (!customerName && channel === 'form') {
      return NextResponse.json({ error: 'Your name is required to send an enquiry.' }, { status: 400 });
    }
    if (channel === 'form' && customerPhone.replace(/\D/g, '').length < 10) {
      return NextResponse.json({ error: 'Please provide a valid 10-digit phone number.' }, { status: 400 });
    }
    if (channel === 'form' && rawMessage.length < 3) {
      return NextResponse.json({ error: 'Please include your enquiry message.' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const resolvedCustomerId = auth.customer?.sub || (typeof body?.customer_id === 'string' ? body.customer_id : null);
    const resolvedCustomerEmail =
      auth.customer?.email ||
      (typeof body?.customer_email === 'string' ? body.customer_email.trim().toLowerCase() : null);

    const result = mutateServerDb((state, emit) => {
      const dealer = state.dealers.find((d) => d.id === dealerId);
      if (!dealer || dealer.status !== 'approved') {
        return { error: 'Selected dealer showroom is unavailable or not approved.', status: 400 as const };
      }

      const product = productId ? state.products.find((p) => p.id === productId) : null;
      const enquiryId = `ENQ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const displayMessage = rawMessage || `Initiated ${channel} enquiry for ${product?.name || dealer.shop_name}`;
      const displayName = customerName || auth.customer?.email?.split('@')[0] || 'Shopper';

      const created: Enquiry = {
        id: enquiryId,
        customer_id: resolvedCustomerId,
        customer_email: resolvedCustomerEmail,
        dealer_id: dealer.id,
        product_id: product?.id ?? productId,
        product_name:
          (typeof body?.product_name === 'string' && body.product_name.trim()) ||
          product?.name ||
          null,
        dealer_name:
          (typeof body?.dealer_name === 'string' && body.dealer_name.trim()) ||
          dealer.shop_name,
        customer_name: displayName,
        customer_phone: customerPhone || 'N/A',
        message: displayMessage,
        channel,
        status: 'pending',
        dealer_response: null,
        responded_at: null,
        responded_by: null,
        admin_notes: null,
        conversation: [
          {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            sender_role: 'customer',
            sender_name: displayName,
            message: displayMessage,
            created_at: nowIso,
          },
        ],
        created_at: nowIso,
        updated_at: nowIso,
      };

      state.enquiries = [created, ...state.enquiries];

      if (created.product_id) {
        state.products = state.products.map((p) =>
          p.id === created.product_id
            ? { ...p, enquiry_count: Number(p.enquiry_count || 0) + 1 }
            : p
        );
      }

      // Notify Dealer
      createNotificationInState(state, {
        recipientId: dealer.id,
        recipientRole: 'dealer',
        type: 'new_enquiry',
        title: `New Enquiry (${created.id})`,
        message: `${displayName} enquired about ${created.product_name || dealer.shop_name}`,
        productId: created.product_id,
        dealerId: dealer.id,
        relatedRecordId: created.id,
        linkUrl: '/dealer?tab=08-enquiries',
        productName: created.product_name,
        dealerName: dealer.shop_name,
      });

      // Notify Admin
      createNotificationInState(state, {
        recipientId: 'admin',
        recipientRole: 'admin',
        type: 'new_enquiry',
        title: `New Customer Enquiry (${created.id})`,
        message: `${displayName} → ${dealer.shop_name}${created.product_name ? ` (${created.product_name})` : ''}`,
        productId: created.product_id,
        dealerId: dealer.id,
        relatedRecordId: created.id,
        linkUrl: '/admin?tab=08-enquiries',
        productName: created.product_name,
        dealerName: dealer.shop_name,
      });

      // Confirm to Customer if logged in
      if (resolvedCustomerId) {
        createNotificationInState(state, {
          recipientId: resolvedCustomerId,
          recipientRole: 'customer',
          type: 'enquiry_update',
          title: `Enquiry Sent to ${dealer.shop_name}`,
          message: `Reference ID ${created.id} is awaiting dealer response.`,
          productId: created.product_id,
          dealerId: dealer.id,
          relatedRecordId: created.id,
          linkUrl: '/customer/enquiries',
          productName: created.product_name,
          dealerName: dealer.shop_name,
        });
      }

      emit({
        topic: 'enquiries',
        action: 'created',
        recordId: created.id,
        dealerId: dealer.id,
        productId: created.product_id,
        customerId: resolvedCustomerId,
        customerEmail: resolvedCustomerEmail,
      });
      emit({
        topic: 'notifications',
        action: 'created',
        recordId: created.id,
        dealerId: dealer.id,
        recipientRole: 'dealer',
      });
      emit({
        topic: 'notifications',
        action: 'created',
        recordId: created.id,
        recipientRole: 'admin',
      });
      if (resolvedCustomerId) {
        emit({
          topic: 'notifications',
          action: 'created',
          recordId: created.id,
          customerId: resolvedCustomerId,
          customerEmail: resolvedCustomerEmail,
          recipientRole: 'customer',
        });
      }

      return { created, status: 201 as const };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ enquiry: result.created }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create enquiry';
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
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    if (!id) {
      return NextResponse.json({ error: 'Enquiry ID is required' }, { status: 400 });
    }

    const actorRole: 'admin' | 'dealer' | 'customer' =
      body?.actorRole === 'admin' && auth.admin
        ? 'admin'
        : body?.actorRole === 'dealer' && auth.dealer
          ? 'dealer'
          : body?.actorRole === 'customer' && auth.customer
            ? 'customer'
            : auth.admin
              ? 'admin'
              : auth.dealer
                ? 'dealer'
                : 'customer';

    const result = mutateServerDb((state, emit) => {
      const idx = state.enquiries.findIndex((e) => e.id === id);
      if (idx === -1) {
        return { error: 'Enquiry not found', status: 404 as const };
      }
      const existing = state.enquiries[idx];

      // Strict server-side authorization
      if (actorRole === 'dealer') {
        if (!auth.dealer || existing.dealer_id !== auth.dealer.dealerId) {
          return { error: 'You are not authorized to modify another dealer’s enquiry', status: 403 as const };
        }
      } else if (actorRole === 'customer') {
        const owns =
          auth.customer &&
          (existing.customer_id === auth.customer.sub ||
            (existing.customer_email &&
              existing.customer_email.toLowerCase() === auth.customer.email.toLowerCase()));
        if (!owns) {
          return { error: 'You are not authorized to update this customer enquiry', status: 403 as const };
        }
      } else if (!auth.admin) {
        return { error: 'Admin authorization required', status: 403 as const };
      }

      const nowIso = new Date().toISOString();
      const conversation = Array.isArray(existing.conversation)
        ? [...existing.conversation]
        : [
            ...(existing.message
              ? [
                  {
                    id: `msg-init-${existing.id}`,
                    sender_role: 'customer' as const,
                    sender_name: existing.customer_name || 'Customer',
                    message: existing.message,
                    created_at: existing.created_at,
                  },
                ]
              : []),
            ...(existing.dealer_response
              ? [
                  {
                    id: `msg-reply-${existing.id}`,
                    sender_role: 'dealer' as const,
                    sender_name: existing.responded_by || existing.dealer_name || 'Dealer',
                    message: existing.dealer_response,
                    created_at: existing.responded_at || existing.updated_at || existing.created_at,
                  },
                ]
              : []),
          ];

      const next: Enquiry = { ...existing };

      if (actorRole === 'customer') {
        const followUp = typeof body?.follow_up_message === 'string' ? body.follow_up_message.trim() : '';
        if (followUp) {
          conversation.push({
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            sender_role: 'customer',
            sender_name: existing.customer_name || auth.customer?.email || 'Customer',
            message: followUp,
            created_at: nowIso,
          });
          if (existing.status === 'resolved' || existing.status === 'closed') {
            next.status = 'pending';
          }
        }
        if (body?.status === 'resolved') {
          next.status = 'resolved';
        }
        next.conversation = conversation;
        next.updated_at = nowIso;

        if (existing.dealer_id) {
          createNotificationInState(state, {
            recipientId: existing.dealer_id,
            recipientRole: 'dealer',
            type: 'enquiry_update',
            title: followUp ? `Customer Reply on ${existing.id}` : `Enquiry ${existing.id} Marked Resolved`,
            message: followUp || `${existing.customer_name || 'Customer'} marked enquiry resolved.`,
            productId: existing.product_id,
            dealerId: existing.dealer_id,
            relatedRecordId: existing.id,
            linkUrl: '/dealer?tab=08-enquiries',
          });
        }
      } else if (actorRole === 'dealer') {
        const replyText =
          typeof body?.dealer_response === 'string' ? body.dealer_response.trim() : '';
        const allowedStatuses: EnquiryStatus[] = [
          'pending',
          'viewed',
          'responded',
          'resolved',
          'closed',
        ];
        const nextStatus =
          typeof body?.status === 'string' && allowedStatuses.includes(body.status as EnquiryStatus)
            ? (body.status as EnquiryStatus)
            : replyText
              ? 'responded'
              : existing.status;

        if (replyText) {
          next.dealer_response = replyText;
          next.responded_at = nowIso;
          next.responded_by = auth.dealerRecord?.shop_name || existing.dealer_name || 'Dealer';
          conversation.push({
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            sender_role: 'dealer',
            sender_name: next.responded_by,
            message: replyText,
            created_at: nowIso,
          });
        }
        next.status = nextStatus;
        next.conversation = conversation;
        next.updated_at = nowIso;

        if (existing.customer_id) {
          createNotificationInState(state, {
            recipientId: existing.customer_id,
            recipientRole: 'customer',
            type: 'enquiry_update',
            title: replyText
              ? `${next.responded_by || 'Dealer'} Replied (${existing.id})`
              : `Enquiry Status Updated: ${(nextStatus || 'updated').replace('_', ' ')}`,
            message: replyText || `Your enquiry ${existing.id} status is now ${nextStatus}.`,
            productId: existing.product_id,
            dealerId: existing.dealer_id,
            relatedRecordId: existing.id,
            linkUrl: '/customer/enquiries',
            productName: existing.product_name,
            dealerName: existing.dealer_name,
          });
        }

        createNotificationInState(state, {
          recipientId: 'admin',
          recipientRole: 'admin',
          type: 'enquiry_update',
          title: `Dealer Updated Enquiry ${existing.id}`,
          message: `${next.responded_by || existing.dealer_name || 'Dealer'} → ${nextStatus}${replyText ? `: "${replyText.slice(0, 60)}"` : ''}`,
          productId: existing.product_id,
          dealerId: existing.dealer_id,
          relatedRecordId: existing.id,
          linkUrl: '/admin?tab=08-enquiries',
        });
      } else {
        // Admin update
        if (typeof body?.admin_notes === 'string') {
          next.admin_notes = body.admin_notes;
        }
        if (typeof body?.status === 'string') {
          next.status = body.status as EnquiryStatus;
        }
        next.conversation = conversation;
        next.updated_at = nowIso;
      }

      state.enquiries[idx] = next;

      emit({
        topic: 'enquiries',
        action: body?.dealer_response ? 'replied' : 'status_changed',
        recordId: next.id,
        dealerId: next.dealer_id,
        productId: next.product_id,
        customerId: next.customer_id,
        customerEmail: next.customer_email,
      });

      if (next.customer_id) {
        emit({
          topic: 'notifications',
          action: 'created',
          recordId: next.id,
          customerId: next.customer_id,
          customerEmail: next.customer_email,
          recipientRole: 'customer',
        });
      }
      if (next.dealer_id) {
        emit({
          topic: 'notifications',
          action: 'created',
          recordId: next.id,
          dealerId: next.dealer_id,
          recipientRole: 'dealer',
        });
      }
      emit({
        topic: 'notifications',
        action: 'created',
        recordId: next.id,
        recipientRole: 'admin',
      });

      return { updated: next, status: 200 as const };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ enquiry: result.updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update enquiry';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
