import { NextResponse } from 'next/server';
import { getPortalAuthContext, unauthorizedResponse } from '@/lib/server-auth';
import {
  createNotificationInState,
  getServerDb,
  mutateServerDb,
} from '@/lib/server-db';
import type {
  DealerEnquiryCategory,
  DealerEnquiryPriority,
  DealerEnquiryStatus,
  DealerSupportEnquiry,
} from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function sanitizeForDealer(item: DealerSupportEnquiry): DealerSupportEnquiry {
  const { internal_notes: _hidden, ...safe } = item;
  return { ...safe, internal_notes: null };
}

export async function GET(request: Request) {
  const auth = getPortalAuthContext(request);
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope');
  const db = getServerDb();

  if (scope === 'admin' || (auth.admin && scope !== 'dealer')) {
    if (!auth.admin) {
      return unauthorizedResponse('Admin authorization required for Dealer Lead Management', 403);
    }
    return NextResponse.json({
      dealerEnquiries: db.dealerEnquiries,
    });
  }

  if (auth.dealer) {
    const requestedDealerId = searchParams.get('dealerId');
    if (requestedDealerId && requestedDealerId !== auth.dealer.dealerId) {
      return unauthorizedResponse('Dealers cannot access another dealer’s support enquiries.', 403);
    }
    const mine = db.dealerEnquiries
      .filter((e) => e.dealer_id === auth.dealer!.dealerId)
      .map(sanitizeForDealer);
    return NextResponse.json({ dealerEnquiries: mine });
  }

  return unauthorizedResponse('Dealers or Admins only: Customers cannot access dealer support enquiries.', 403);
}

export async function POST(request: Request) {
  try {
    const auth = getPortalAuthContext(request);
    if (!auth.dealer || !auth.dealerRecord) {
      return unauthorizedResponse('Only approved dealers can submit Dealer-to-Admin support enquiries.', 403);
    }

    const body = await request.json();
    const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : '';
    const category = (body?.category || 'platform_issue') as DealerEnquiryCategory;
    const priority = (body?.priority || 'medium') as DealerEnquiryPriority;
    const attachmentUrl = typeof body?.attachment_url === 'string' && body.attachment_url.trim()
      ? body.attachment_url.trim()
      : null;

    if (subject.length < 3) {
      return NextResponse.json({ error: 'Please provide an enquiry subject (min 3 characters).' }, { status: 400 });
    }
    if (description.length < 10) {
      return NextResponse.json({ error: 'Please provide detailed description (min 10 characters).' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const dealer = auth.dealerRecord;

    const created = mutateServerDb((state, emit) => {
      const id = `DENQ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
      const record: DealerSupportEnquiry = {
        id,
        dealer_id: dealer.id,
        dealer_name: dealer.owner_name,
        shop_name: dealer.shop_name,
        dealer_email: dealer.email,
        subject,
        category,
        priority,
        description,
        attachment_url: attachmentUrl,
        status: 'new',
        assigned_to: null,
        internal_notes: null,
        conversation: [
          {
            id: `dmsg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            sender_role: 'dealer',
            sender_name: `${dealer.shop_name} (${dealer.owner_name})`,
            message: description,
            attachment_url: attachmentUrl,
            created_at: nowIso,
          },
        ],
        first_responded_at: null,
        resolved_at: null,
        created_at: nowIso,
        updated_at: nowIso,
      };

      state.dealerEnquiries = [record, ...state.dealerEnquiries];

      createNotificationInState(state, {
        recipientId: 'admin',
        recipientRole: 'admin',
        type: 'new_enquiry',
        title: `Dealer Lead: ${subject} (${id})`,
        message: `${dealer.shop_name} submitted a ${priority} priority ${category.replace('_', ' ')} enquiry.`,
        dealerId: dealer.id,
        relatedRecordId: id,
        linkUrl: '/admin?tab=15-dealer-leads',
        dealerName: dealer.shop_name,
      });

      emit({
        topic: 'dealer_enquiries',
        action: 'created',
        recordId: id,
        dealerId: dealer.id,
      });
      emit({
        topic: 'notifications',
        action: 'created',
        recordId: id,
        recipientRole: 'admin',
      });

      return record;
    });

    return NextResponse.json({ dealerEnquiry: sanitizeForDealer(created) }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create dealer enquiry';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = getPortalAuthContext(request);
    if (!auth.admin && !auth.dealer) {
      return unauthorizedResponse('Dealer or Admin authorization required.', 403);
    }

    const body = await request.json();
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    if (!id) {
      return NextResponse.json({ error: 'Enquiry ID is required.' }, { status: 400 });
    }

    const actorRole: 'admin' | 'dealer' =
      body?.actorRole === 'admin' && auth.admin
        ? 'admin'
        : body?.actorRole === 'dealer' && auth.dealer
          ? 'dealer'
          : auth.admin
            ? 'admin'
            : 'dealer';

    const result = mutateServerDb((state, emit) => {
      const idx = state.dealerEnquiries.findIndex((e) => e.id === id);
      if (idx === -1) {
        return { error: 'Dealer support enquiry not found.', status: 404 as const };
      }

      const existing = state.dealerEnquiries[idx];
      if (actorRole === 'dealer' && (!auth.dealer || existing.dealer_id !== auth.dealer.dealerId)) {
        return { error: 'You cannot access or update another dealer’s support enquiry.', status: 403 as const };
      }

      const nowIso = new Date().toISOString();
      const next: DealerSupportEnquiry = {
        ...existing,
        conversation: [...(existing.conversation || [])],
        updated_at: nowIso,
      };

      const replyText = typeof body?.message === 'string' ? body.message.trim() : '';
      const attachmentUrl = typeof body?.attachment_url === 'string' && body.attachment_url.trim()
        ? body.attachment_url.trim()
        : null;

      if (actorRole === 'dealer') {
        if (replyText) {
          next.conversation.push({
            id: `dmsg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            sender_role: 'dealer',
            sender_name: auth.dealerRecord?.shop_name || existing.shop_name,
            message: replyText,
            attachment_url: attachmentUrl,
            created_at: nowIso,
          });
          if (next.status === 'waiting_for_dealer' || next.status === 'responded') {
            next.status = 'open';
          }
        }
        if (body?.status === 'closed' || body?.status === 'open') {
          next.status = body.status;
          if (body.status === 'open') next.resolved_at = null;
        }

        createNotificationInState(state, {
          recipientId: 'admin',
          recipientRole: 'admin',
          type: 'enquiry_update',
          title: replyText ? `Dealer Replied on ${existing.id}` : `Dealer ${next.status} ${existing.id}`,
          message: replyText || `${existing.shop_name} changed enquiry status to ${next.status}.`,
          dealerId: existing.dealer_id,
          relatedRecordId: existing.id,
          linkUrl: '/admin?tab=15-dealer-leads',
        });
      } else {
        // Admin controls
        const allowedStatuses: DealerEnquiryStatus[] = [
          'new',
          'open',
          'in_progress',
          'waiting_for_dealer',
          'responded',
          'resolved',
          'closed',
        ];
        if (typeof body?.assigned_to === 'string') {
          next.assigned_to = body.assigned_to.trim() || null;
        }
        if (typeof body?.internal_notes === 'string') {
          next.internal_notes = body.internal_notes;
        }
        if (replyText) {
          next.conversation.push({
            id: `dmsg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            sender_role: 'admin',
            sender_name: auth.admin!.email,
            message: replyText,
            attachment_url: attachmentUrl,
            created_at: nowIso,
          });
          if (!next.first_responded_at) {
            next.first_responded_at = nowIso;
          }
          if (!body?.status) {
            next.status = 'responded';
          }
        }
        if (typeof body?.status === 'string' && allowedStatuses.includes(body.status as DealerEnquiryStatus)) {
          next.status = body.status as DealerEnquiryStatus;
          if (next.status === 'resolved' || next.status === 'closed') {
            next.resolved_at = nowIso;
          } else {
            next.resolved_at = null;
          }
        }

        createNotificationInState(state, {
          recipientId: existing.dealer_id,
          recipientRole: 'dealer',
          type: 'enquiry_update',
          title: replyText ? `Admin Replied on ${existing.id}` : `Support Lead ${existing.id}: ${next.status}`,
          message: replyText || `Admin updated your support request status to "${next.status.replace('_', ' ')}".`,
          dealerId: existing.dealer_id,
          relatedRecordId: existing.id,
          linkUrl: '/dealer?tab=13-support',
        });
      }

      state.dealerEnquiries[idx] = next;

      emit({
        topic: 'dealer_enquiries',
        action: replyText ? 'replied' : 'status_changed',
        recordId: next.id,
        dealerId: next.dealer_id,
      });
      emit({
        topic: 'notifications',
        action: 'created',
        recordId: next.id,
        dealerId: next.dealer_id,
        recipientRole: actorRole === 'dealer' ? 'admin' : 'dealer',
      });

      return { updated: next, status: 200 as const };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      dealerEnquiry: auth.admin ? result.updated : sanitizeForDealer(result.updated),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update dealer enquiry';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
