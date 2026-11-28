import { NextResponse } from 'next/server';
import { getPortalAuthContext, unauthorizedResponse } from '@/lib/server-auth';
import {
  createNotificationInState,
  mutateServerDb,
  getServerDb,
  recalculateRatingsInPlace,
  recordModerationLogInState,
} from '@/lib/server-db';
import type { Review, ReviewReport } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = getPortalAuthContext(request);
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope');
  const productId = searchParams.get('productId');
  const dealerId = searchParams.get('dealerId');
  const db = getServerDb();

  if (scope === 'admin' || (auth.admin && !productId && !dealerId && !scope)) {
    if (!auth.admin) return unauthorizedResponse('Admin authorization required', 403);
    return NextResponse.json({
      reviews: db.reviews,
      reports: db.reviewReports,
      moderationLogs: db.moderationLogs.filter((m) => m.entity_type === 'review'),
    });
  }

  if (scope === 'dealer') {
    if (!auth.dealer) return unauthorizedResponse('Approved Dealer login required', 401);
    if (dealerId && dealerId !== auth.dealer.dealerId) {
      return unauthorizedResponse('Cross-dealer review management access denied', 403);
    }
    const list = db.reviews.filter((r) => r.dealer_id === auth.dealer!.dealerId);
    return NextResponse.json({ reviews: list });
  }

  if (scope === 'customer') {
    if (!auth.customer) return unauthorizedResponse('Customer login required', 401);
    const custId = auth.customer.sub;
    const custEmail = auth.customer.email.toLowerCase();
    const list = db.reviews.filter(
      (r) =>
        r.customer_id === custId ||
        (r.customer_email && r.customer_email.toLowerCase() === custEmail)
    );
    return NextResponse.json({ reviews: list });
  }

  // Public product or shop scoped listing (hidden reviews are visible only in scope=customer / scope=admin)
  let list = db.reviews.filter((r) => r.is_approved !== false && !r.is_hidden);

  if (productId) {
    list = list.filter((r) => r.product_id === productId);
  } else if (dealerId) {
    list = list.filter((r) => r.dealer_id === dealerId);
  }

  // Also return interaction verification status for active customer when querying productId/dealerId
  let canReview = false;
  let alreadyReviewed = false;
  if (auth.customer && (productId || dealerId)) {
    const custId = auth.customer.sub;
    const custEmail = auth.customer.email.toLowerCase();
    canReview = db.enquiries.some((e) => {
      const sameCustomer =
        e.customer_id === custId ||
        (e.customer_email && e.customer_email.toLowerCase() === custEmail);
      if (!sameCustomer) return false;
      if (productId) return e.product_id === productId;
      if (dealerId) return e.dealer_id === dealerId;
      return false;
    });

    alreadyReviewed = db.reviews.some((r) => {
      const sameCustomer =
        r.customer_id === custId ||
        (r.customer_email && r.customer_email.toLowerCase() === custEmail);
      if (!sameCustomer) return false;
      if (productId) return r.product_id === productId;
      return r.dealer_id === dealerId && r.target_type === 'dealer';
    });
  }

  return NextResponse.json({
    reviews: list,
    canReview,
    alreadyReviewed,
  });
}

export async function POST(request: Request) {
  try {
    const auth = getPortalAuthContext(request);
    if (!auth.customer) {
      return unauthorizedResponse('Please sign in to your Customer account to submit a review.', 401);
    }

    const body = await request.json();
    const productId = typeof body?.product_id === 'string' && body.product_id.trim() ? body.product_id.trim() : null;
    const dealerId = typeof body?.dealer_id === 'string' && body.dealer_id.trim() ? body.dealer_id.trim() : null;
    const targetType: 'product' | 'dealer' = productId ? 'product' : 'dealer';
    const rating = Number(body?.rating);
    const comment = typeof body?.comment === 'string' ? body.comment.trim() : '';

    if (!productId && !dealerId) {
      return NextResponse.json({ error: 'Product ID or Dealer ID is required.' }, { status: 400 });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Please select a valid star rating from 1 to 5.' }, { status: 400 });
    }
    if (comment.length < 5 || comment.length > 1200) {
      return NextResponse.json({ error: 'Review comment must be between 5 and 1200 characters.' }, { status: 400 });
    }

    const customerId = auth.customer.sub;
    const customerEmail = auth.customer.email.toLowerCase();
    const customerName =
      (typeof body?.customer_name === 'string' && body.customer_name.trim()) ||
      auth.customer.email.split('@')[0] ||
      'Customer';

    const result = mutateServerDb((state, emit) => {
      const product = productId ? state.products.find((p) => p.id === productId) : null;
      const resolvedDealerId = dealerId || product?.dealer_id || null;
      const dealer = resolvedDealerId ? state.dealers.find((d) => d.id === resolvedDealerId) : null;

      if (!dealer && !product) {
        return { error: 'Target product or shop was not found.', status: 404 as const };
      }

      // Duplicate prevention: one review per customer per target (product OR shop)
      const existingDup = state.reviews.find((r) => {
        const sameCust =
          r.customer_id === customerId ||
          (r.customer_email && r.customer_email.toLowerCase() === customerEmail);
        if (!sameCust) return false;
        if (targetType === 'product') return r.product_id === productId;
        return r.dealer_id === resolvedDealerId && (r.target_type === 'dealer' || !r.product_id);
      });
      if (existingDup) {
        return {
          error: 'You have already submitted a review for this item. Please edit your existing review instead.',
          status: 409 as const,
        };
      }

      // Verified interaction check: customer must have sent an enquiry for this product or dealer
      const hasInteraction = state.enquiries.some((e) => {
        const sameCust =
          e.customer_id === customerId ||
          (e.customer_email && e.customer_email.toLowerCase() === customerEmail);
        if (!sameCust) return false;
        if (productId && e.product_id === productId) return true;
        if (resolvedDealerId && e.dealer_id === resolvedDealerId) return true;
        return false;
      });

      if (!hasInteraction) {
        return {
          error: 'Verified interaction required: Send an enquiry to this shop/product before posting a review.',
          status: 403 as const,
        };
      }

      const nowIso = new Date().toISOString();
      const created: Review = {
        id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        dealer_id: resolvedDealerId,
        product_id: productId,
        target_type: targetType,
        customer_id: customerId,
        customer_email: customerEmail,
        customer_name: customerName,
        rating,
        quality_rating: Number(body?.quality_rating) || rating,
        cleanliness_rating: Number(body?.cleanliness_rating) || null,
        behavior_rating: Number(body?.behavior_rating) || null,
        price_rating: Number(body?.price_rating) || null,
        availability_rating: Number(body?.availability_rating) || null,
        delivery_rating: Number(body?.delivery_rating) || null,
        comment,
        dealer_response: null,
        responded_at: null,
        responded_by: null,
        is_verified_interaction: true,
        is_flagged: false,
        is_hidden: false,
        reports: [],
        created_at: nowIso,
        updated_at: nowIso,
        is_approved: true,
      };

      state.reviews = [created, ...state.reviews];
      recalculateRatingsInPlace(state, {
        productId: productId,
        dealerId: resolvedDealerId,
      });

      if (resolvedDealerId) {
        createNotificationInState(state, {
          recipientId: resolvedDealerId,
          recipientRole: 'dealer',
          type: 'new_review',
          title: `New ${rating}★ Review Received`,
          message: `${customerName} reviewed ${product?.name || dealer?.shop_name || 'your shop'}: "${comment.slice(0, 80)}"`,
          productId,
          dealerId: resolvedDealerId,
          relatedRecordId: created.id,
          linkUrl: '/dealer?tab=09-reviews',
          productName: product?.name ?? null,
          dealerName: dealer?.shop_name ?? null,
        });
      }

      createNotificationInState(state, {
        recipientId: 'admin',
        recipientRole: 'admin',
        type: 'new_review',
        title: `New Customer Review (${rating}★)`,
        message: `${customerName} rated ${product?.name || dealer?.shop_name || 'listing'}: "${comment.slice(0, 70)}"`,
        productId,
        dealerId: resolvedDealerId,
        relatedRecordId: created.id,
        linkUrl: '/admin?tab=09-reviews',
      });

      emit({
        topic: 'reviews',
        action: 'created',
        recordId: created.id,
        dealerId: resolvedDealerId,
        productId,
        customerId,
        customerEmail,
      });
      emit({
        topic: 'products',
        action: 'updated',
        recordId: productId || undefined,
        productId,
        dealerId: resolvedDealerId,
      });
      emit({
        topic: 'dealers',
        action: 'updated',
        recordId: resolvedDealerId || undefined,
        dealerId: resolvedDealerId,
      });
      if (resolvedDealerId) {
        emit({
          topic: 'notifications',
          action: 'created',
          recordId: created.id,
          dealerId: resolvedDealerId,
          recipientRole: 'dealer',
        });
      }
      emit({
        topic: 'notifications',
        action: 'created',
        recordId: created.id,
        recipientRole: 'admin',
      });

      return { created, status: 201 as const };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ review: result.created }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to submit review';
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
    const action = typeof body?.action === 'string' ? body.action.trim() : '';
    if (!id || !action) {
      return NextResponse.json({ error: 'Review ID and action are required.' }, { status: 400 });
    }

    const result = mutateServerDb((state, emit) => {
      const idx = state.reviews.findIndex((r) => r.id === id);
      if (idx === -1) {
        return { error: 'Review not found', status: 404 as const };
      }

      const existing = state.reviews[idx];
      const nowIso = new Date().toISOString();
      const next: Review = { ...existing };

      if (action === 'edit') {
        const isOwner =
          auth.customer &&
          (existing.customer_id === auth.customer.sub ||
            (existing.customer_email &&
              existing.customer_email.toLowerCase() === auth.customer.email.toLowerCase()));
        if (!isOwner) {
          return { error: 'You can only edit your own review.', status: 403 as const };
        }
        const nextRating = Number(body?.rating);
        const nextComment = typeof body?.comment === 'string' ? body.comment.trim() : '';
        if (!Number.isInteger(nextRating) || nextRating < 1 || nextRating > 5) {
          return { error: 'Rating must be between 1 and 5.', status: 400 as const };
        }
        if (nextComment.length < 5) {
          return { error: 'Review comment must be at least 5 characters.', status: 400 as const };
        }
        next.rating = nextRating;
        next.comment = nextComment;
        next.updated_at = nowIso;
        state.reviews[idx] = next;

        recalculateRatingsInPlace(state, {
          productId: next.product_id,
          dealerId: next.dealer_id,
        });

        if (next.dealer_id) {
          createNotificationInState(state, {
            recipientId: next.dealer_id,
            recipientRole: 'dealer',
            type: 'review_update',
            title: `Customer Edited Review (${nextRating}★)`,
            message: `${next.customer_name} updated their review: "${nextComment.slice(0, 70)}"`,
            productId: next.product_id,
            dealerId: next.dealer_id,
            relatedRecordId: next.id,
            linkUrl: '/dealer?tab=09-reviews',
          });
        }
      } else if (action === 'report') {
        if (!auth.customer && !(auth.dealer && existing.dealer_id === auth.dealer.dealerId)) {
          return { error: 'Sign in as a customer or owning dealer to report a review.', status: 401 as const };
        }
        const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
        if (reason.length < 3) {
          return { error: 'Please specify a reason for reporting this review.', status: 400 as const };
        }
        const report: ReviewReport = {
          id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          review_id: existing.id,
          reporter_id: auth.customer?.sub || auth.dealer?.dealerId || 'user',
          reporter_name:
            auth.dealerRecord?.shop_name ||
            auth.customer?.email.split('@')[0] ||
            'Shopper',
          reason,
          created_at: nowIso,
        };
        state.reviewReports = [report, ...state.reviewReports];
        next.reports = [...(existing.reports || []), report];
        next.is_flagged = true;
        next.updated_at = nowIso;
        state.reviews[idx] = next;

        createNotificationInState(state, {
          recipientId: 'admin',
          recipientRole: 'admin',
          type: 'moderation_update',
          title: `Review Reported for Moderation`,
          message: `Review by ${existing.customer_name} reported: "${reason.slice(0, 70)}"`,
          productId: existing.product_id,
          dealerId: existing.dealer_id,
          relatedRecordId: existing.id,
          linkUrl: '/admin?tab=09-reviews',
        });
      } else if (action === 'dealer_reply' || action === 'delete_dealer_reply') {
        if (!auth.dealer || existing.dealer_id !== auth.dealer.dealerId) {
          return { error: 'Dealers can only reply to reviews on their own shop or products.', status: 403 as const };
        }
        if (action === 'delete_dealer_reply') {
          next.dealer_response = null;
          next.responded_at = null;
          next.responded_by = null;
        } else {
          const replyText = typeof body?.dealer_response === 'string' ? body.dealer_response.trim() : '';
          if (replyText.length < 2) {
            return { error: 'Reply message cannot be empty.', status: 400 as const };
          }
          next.dealer_response = replyText;
          next.responded_at = nowIso;
          next.responded_by = auth.dealerRecord?.shop_name || 'Dealer';
        }
        next.updated_at = nowIso;
        state.reviews[idx] = next;

        if (action === 'dealer_reply' && existing.customer_id) {
          createNotificationInState(state, {
            recipientId: existing.customer_id,
            recipientRole: 'customer',
            type: 'dealer_reply',
            title: `${next.responded_by} replied to your review`,
            message: next.dealer_response!.slice(0, 120),
            productId: existing.product_id,
            dealerId: existing.dealer_id,
            relatedRecordId: existing.id,
            linkUrl: existing.product_id ? `/product/${existing.product_id}` : `/dealer/${existing.dealer_id}`,
          });
        }
      } else if (
        action === 'approve' ||
        action === 'flag' ||
        action === 'hide' ||
        action === 'restore'
      ) {
        if (!auth.admin) {
          return { error: 'Admin authorization required for review moderation.', status: 403 as const };
        }
        const reason = typeof body?.reason === 'string' ? body.reason.trim() : null;
        if (action === 'approve' || action === 'restore') {
          next.is_approved = true;
          next.is_hidden = false;
          next.is_flagged = false;
        } else if (action === 'flag') {
          next.is_flagged = true;
        } else if (action === 'hide') {
          next.is_hidden = true;
          next.is_approved = false;
        }
        next.moderation_notes = reason;
        next.moderated_at = nowIso;
        next.moderated_by = auth.admin.email;
        next.updated_at = nowIso;
        state.reviews[idx] = next;

        recalculateRatingsInPlace(state, {
          productId: next.product_id,
          dealerId: next.dealer_id,
        });

        recordModerationLogInState(state, {
          action: `review_${action}`,
          entityType: 'review',
          entityId: next.id,
          entityName: `${next.customer_name} (${next.rating}★)`,
          performedBy: auth.admin.email,
          reason,
          details: { productId: next.product_id, dealerId: next.dealer_id },
        });

        if (next.customer_id) {
          createNotificationInState(state, {
            recipientId: next.customer_id,
            recipientRole: 'customer',
            type: 'moderation_update',
            title:
              action === 'hide'
                ? 'Your review was hidden by moderation'
                : action === 'restore' || action === 'approve'
                  ? 'Your review is visible'
                  : 'Review under moderation review',
            message: reason || `Admin moderation action: ${action}`,
            productId: next.product_id,
            dealerId: next.dealer_id,
            relatedRecordId: next.id,
            linkUrl: '/customer/reviews',
          });
        }
        if (next.dealer_id) {
          createNotificationInState(state, {
            recipientId: next.dealer_id,
            recipientRole: 'dealer',
            type: 'moderation_update',
            title: `Admin ${action}ed review by ${next.customer_name}`,
            message: reason || `Moderation updated visibility/status (${action}).`,
            productId: next.product_id,
            dealerId: next.dealer_id,
            relatedRecordId: next.id,
            linkUrl: '/dealer?tab=09-reviews',
          });
        }
      } else {
        return { error: `Unsupported review action: ${action}`, status: 400 as const };
      }

      emit({
        topic: 'reviews',
        action: action === 'dealer_reply' ? 'replied' : action === 'edit' ? 'updated' : 'moderated',
        recordId: next.id,
        dealerId: next.dealer_id,
        productId: next.product_id,
        customerId: next.customer_id,
        customerEmail: next.customer_email,
      });
      emit({
        topic: 'products',
        action: 'updated',
        recordId: next.product_id || undefined,
        productId: next.product_id,
        dealerId: next.dealer_id,
      });
      emit({
        topic: 'dealers',
        action: 'updated',
        recordId: next.dealer_id || undefined,
        dealerId: next.dealer_id,
      });
      if (action === 'approve' || action === 'flag' || action === 'hide' || action === 'restore') {
        emit({ topic: 'moderation_logs', action: 'created', recordId: next.id });
      }
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
      emit({ topic: 'notifications', action: 'created', recordId: next.id, recipientRole: 'admin' });

      return { review: next, status: 200 as const };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ review: result.review });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update review';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = getPortalAuthContext(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim() || '';
    if (!id) {
      return NextResponse.json({ error: 'Review ID is required.' }, { status: 400 });
    }

    if (!auth.customer && !auth.admin) {
      return unauthorizedResponse('Customer login required to delete your review.', 401);
    }

    const result = mutateServerDb((state, emit) => {
      const idx = state.reviews.findIndex((r) => r.id === id);
      if (idx === -1) {
        return { error: 'Review not found', status: 404 as const };
      }

      const existing = state.reviews[idx];
      const isCustomerOwner =
        auth.customer &&
        (existing.customer_id === auth.customer.sub ||
          (existing.customer_email &&
            existing.customer_email.toLowerCase() === auth.customer.email.toLowerCase()));

      if (!isCustomerOwner) {
        // Admins must preserve audit history via hide rather than silent delete
        if (auth.admin) {
          const updated: Review = {
            ...existing,
            is_hidden: true,
            is_approved: false,
            moderated_at: new Date().toISOString(),
            moderated_by: auth.admin.email,
          };
          state.reviews[idx] = updated;
          recalculateRatingsInPlace(state, { productId: existing.product_id, dealerId: existing.dealer_id });
          recordModerationLogInState(state, {
            action: 'review_hide',
            entityType: 'review',
            entityId: existing.id,
            entityName: existing.customer_name,
            performedBy: auth.admin.email,
            reason: 'Hidden via moderation action',
          });
          emit({ topic: 'reviews', action: 'moderated', recordId: existing.id, productId: existing.product_id, dealerId: existing.dealer_id });
          emit({ topic: 'moderation_logs', action: 'created', recordId: existing.id });
          return { hidden: true, review: updated, status: 200 as const };
        }
        return { error: 'You can only delete your own review.', status: 403 as const };
      }

      state.reviews.splice(idx, 1);
      recalculateRatingsInPlace(state, {
        productId: existing.product_id,
        dealerId: existing.dealer_id,
      });

      if (existing.dealer_id) {
        createNotificationInState(state, {
          recipientId: existing.dealer_id,
          recipientRole: 'dealer',
          type: 'review_update',
          title: `Review Removed by Customer`,
          message: `${existing.customer_name} deleted their review.`,
          productId: existing.product_id,
          dealerId: existing.dealer_id,
          relatedRecordId: existing.id,
          linkUrl: '/dealer?tab=09-reviews',
        });
      }

      emit({
        topic: 'reviews',
        action: 'deleted',
        recordId: existing.id,
        dealerId: existing.dealer_id,
        productId: existing.product_id,
      });
      emit({
        topic: 'products',
        action: 'updated',
        recordId: existing.product_id || undefined,
        productId: existing.product_id,
        dealerId: existing.dealer_id,
      });
      emit({
        topic: 'dealers',
        action: 'updated',
        recordId: existing.dealer_id || undefined,
        dealerId: existing.dealer_id,
      });

      return { deleted: true, status: 200 as const };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete review';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
