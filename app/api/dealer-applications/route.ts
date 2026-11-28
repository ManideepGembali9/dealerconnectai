import { NextResponse } from 'next/server';
import { getPortalAuthContext, unauthorizedResponse } from '@/lib/server-auth';
import {
  createNotificationInState,
  getServerDb,
  mutateServerDb,
  recordModerationLogInState,
} from '@/lib/server-db';
import type { Dealer, DealerApplication } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = getPortalAuthContext(request);
  if (!auth.admin && !auth.customer) {
    return unauthorizedResponse('Authentication required', 401);
  }

  const db = getServerDb();
  if (auth.admin) {
    return NextResponse.json({ applications: db.dealerApplications });
  }

  const custId = auth.customer!.sub;
  const custEmail = auth.customer!.email.toLowerCase();
  const mine = db.dealerApplications.filter(
    (a) => a.customer_id === custId || a.email.toLowerCase() === custEmail
  );
  return NextResponse.json({ applications: mine });
}

export async function POST(request: Request) {
  try {
    const auth = getPortalAuthContext(request);
    const body = await request.json();

    const shopName = typeof body?.shop_name === 'string' ? body.shop_name.trim() : '';
    const ownerName = typeof body?.owner_name === 'string' ? body.owner_name.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
    const rawPassword = typeof body?.dealer_password === 'string' ? body.dealer_password.trim() : '';

    if (!shopName || !ownerName || !email || !phone) {
      return NextResponse.json(
        { error: 'Shop name, owner name, email, and phone are required.' },
        { status: 400 }
      );
    }

    const customerId = auth.customer?.sub || (typeof body?.customer_id === 'string' ? body.customer_id : 'cust-default');
    const nowIso = new Date().toISOString();
    const appId =
      (typeof body?.id === 'string' && body.id.trim()) ||
      `APP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const result = mutateServerDb((state, emit) => {
      const existingIdx = state.dealerApplications.findIndex(
        (a) => a.id === appId || a.email.toLowerCase() === email
      );
      const app: DealerApplication = {
        id: existingIdx >= 0 ? state.dealerApplications[existingIdx].id : appId,
        customer_id: customerId,
        owner_name: ownerName,
        phone,
        email,
        alt_phone: body?.alt_phone ?? null,
        shop_name: shopName,
        category_id: body?.category_id ?? null,
        category_name: body?.category_name ?? null,
        description: body?.description ?? null,
        logo_url: body?.logo_url ?? null,
        images: Array.isArray(body?.images) ? body.images : [],
        address: body?.address || '',
        village: body?.village ?? null,
        city: body?.city || 'Amalapuram',
        district: body?.district || 'Konaseema',
        state: body?.state || 'Andhra Pradesh',
        pin_code: body?.pin_code || '533201',
        map_lat: typeof body?.map_lat === 'number' ? body.map_lat : 16.5787,
        map_lng: typeof body?.map_lng === 'number' ? body.map_lng : 82.0061,
        whatsapp: body?.whatsapp ?? phone,
        opening_time: body?.opening_time || '09:00 AM',
        closing_time: body?.closing_time || '09:00 PM',
        delivery_available: body?.delivery_available !== false,
        pickup_available: body?.pickup_available !== false,
        home_delivery_radius_km: Number(body?.home_delivery_radius_km) || 10,
        gst_number: body?.gst_number ?? null,
        business_reg_number: body?.business_reg_number ?? null,
        id_proof_url: body?.id_proof_url ?? null,
        shop_license_url: body?.shop_license_url ?? null,
        status: 'pending',
        rejection_reason: null,
        reviewed_by: null,
        reviewed_at: null,
        dealer_id: existingIdx >= 0 ? state.dealerApplications[existingIdx].dealer_id ?? null : null,
        created_at: existingIdx >= 0 ? state.dealerApplications[existingIdx].created_at : nowIso,
        updated_at: nowIso,
      };

      if (existingIdx >= 0) {
        state.dealerApplications[existingIdx] = app;
      } else {
        state.dealerApplications = [app, ...state.dealerApplications];
      }

      if (rawPassword) {
        state.dealerCredentials[email] = {
          dealerId: `dealer-${app.id.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          email,
          password: rawPassword,
          status: 'pending',
        };
      }

      createNotificationInState(state, {
        recipientId: 'admin',
        recipientRole: 'admin',
        type: 'dealer_application',
        title: `New Shop Application: ${shopName}`,
        message: `${ownerName} (${cityOrFallback(app.city)}) applied for Dealer approval (${app.id}).`,
        relatedRecordId: app.id,
        linkUrl: '/admin?tab=02-dealers',
        dealerName: shopName,
      });

      if (customerId) {
        createNotificationInState(state, {
          recipientId: customerId,
          recipientRole: 'customer',
          type: 'dealer_application',
          title: `Dealer Application Received (${app.id})`,
          message: `${shopName} is pending Admin verification.`,
          relatedRecordId: app.id,
          linkUrl: '/dealer/register',
          dealerName: shopName,
        });
      }

      emit({
        topic: 'dealer_applications',
        action: existingIdx >= 0 ? 'updated' : 'created',
        recordId: app.id,
        customerId,
        customerEmail: email,
      });
      emit({
        topic: 'notifications',
        action: 'created',
        recordId: app.id,
        recipientRole: 'admin',
      });
      if (customerId) {
        emit({
          topic: 'notifications',
          action: 'created',
          recordId: app.id,
          customerId,
          customerEmail: email,
          recipientRole: 'customer',
        });
      }

      return { application: app };
    });

    return NextResponse.json({ application: result.application }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to submit application';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function cityOrFallback(city?: string | null) {
  return city?.trim() || 'Local Area';
}

export async function PATCH(request: Request) {
  try {
    const auth = getPortalAuthContext(request);
    if (!auth.admin) {
      return unauthorizedResponse('Only Admins can review, approve, or reject dealer applications.', 403);
    }

    const body = await request.json();
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    const action = typeof body?.action === 'string' ? body.action.trim() : '';
    if (!id || !action) {
      return NextResponse.json({ error: 'Application ID and action are required.' }, { status: 400 });
    }

    const result = mutateServerDb((state, emit) => {
      const idx = state.dealerApplications.findIndex((a) => a.id === id);
      if (idx === -1) {
        return { error: 'Dealer application not found', status: 404 as const };
      }

      const app = state.dealerApplications[idx];
      const nowIso = new Date().toISOString();
      const emailKey = app.email.toLowerCase();

      if (action === 'approve') {
        const dealerId = app.dealer_id || `dealer-${Date.now().toString(36)}`;
        const newDealer: Dealer = {
          id: dealerId,
          shop_name: app.shop_name,
          description: app.description ?? null,
          owner_name: app.owner_name,
          email: app.email,
          phone: app.phone,
          whatsapp: app.whatsapp ?? app.phone,
          address: app.address,
          village: app.village ?? null,
          city: app.city,
          district: app.district || 'Konaseema',
          state: app.state || 'Andhra Pradesh',
          pin_code: app.pin_code,
          gst_number: app.gst_number ?? null,
          logo_url: app.logo_url ?? null,
          banner_url: app.images?.[0] ?? null,
          map_lat: app.map_lat ?? 16.5787,
          map_lng: app.map_lng ?? 82.0061,
          working_hours: {
            mon_sat: `${app.opening_time || '09:00 AM'} - ${app.closing_time || '09:00 PM'}`,
            sun: '10:00 AM - 02:00 PM',
          },
          rating: 0,
          rating_count: 0,
          status: 'approved',
          auth_user_id: app.customer_id || `user-${dealerId}`,
          business_category_id: app.category_id ?? null,
          delivery_available: app.delivery_available ?? true,
          pickup_available: app.pickup_available ?? true,
          home_delivery_radius_km: app.home_delivery_radius_km ?? 10,
          product_count: 0,
          view_count: 0,
          created_at: app.created_at,
          updated_at: nowIso,
          approved_at: nowIso,
        };

        const dIdx = state.dealers.findIndex(
          (d) => d.id === dealerId || d.email.toLowerCase() === emailKey
        );
        if (dIdx >= 0) {
          state.dealers[dIdx] = { ...state.dealers[dIdx], ...newDealer, id: state.dealers[dIdx].id };
          newDealer.id = state.dealers[dIdx].id;
        } else {
          state.dealers = [newDealer, ...state.dealers];
        }

        const existingCred = state.dealerCredentials[emailKey];
        state.dealerCredentials[emailKey] = {
          dealerId: newDealer.id,
          email: emailKey,
          password: existingCred?.password || process.env.DEALER_DEMO_PASSWORD || 'dealer123',
          status: 'approved',
        };

        const updatedApp: DealerApplication = {
          ...app,
          status: 'approved',
          dealer_id: newDealer.id,
          rejection_reason: null,
          reviewed_by: auth.admin!.email,
          reviewed_at: nowIso,
          updated_at: nowIso,
        };
        state.dealerApplications[idx] = updatedApp;

        recordModerationLogInState(state, {
          action: 'dealer_application_approved',
          entityType: 'dealer',
          entityId: newDealer.id,
          entityName: newDealer.shop_name,
          performedBy: auth.admin!.email,
          details: { applicationId: app.id },
        });

        if (app.customer_id) {
          createNotificationInState(state, {
            recipientId: app.customer_id,
            recipientRole: 'customer',
            type: 'dealer_application',
            title: `Shop Approved! Welcome ${app.shop_name}`,
            message: 'Your dealer application has been approved. Sign in to the Dealer Portal now.',
            dealerId: newDealer.id,
            relatedRecordId: app.id,
            linkUrl: '/dealer/login',
            dealerName: newDealer.shop_name,
          });
        }
        createNotificationInState(state, {
          recipientId: newDealer.id,
          recipientRole: 'dealer',
          type: 'dealer_application',
          title: `Showroom Activated: ${newDealer.shop_name}`,
          message: 'You can now manage inventory, pricing, and respond to customer enquiries.',
          dealerId: newDealer.id,
          relatedRecordId: app.id,
          linkUrl: '/dealer',
        });

        emit({
          topic: 'dealer_applications',
          action: 'status_changed',
          recordId: app.id,
          customerId: app.customer_id,
          customerEmail: emailKey,
          dealerId: newDealer.id,
        });
        emit({ topic: 'dealers', action: 'created', recordId: newDealer.id, dealerId: newDealer.id });
        emit({ topic: 'moderation_logs', action: 'created', recordId: newDealer.id });
        if (app.customer_id) {
          emit({
            topic: 'notifications',
            action: 'created',
            recordId: app.id,
            customerId: app.customer_id,
            customerEmail: emailKey,
            recipientRole: 'customer',
          });
        }

        return { application: updatedApp, dealer: newDealer, status: 200 as const };
      }

      if (action === 'reject' || action === 'under_review') {
        const reason = typeof body?.reason === 'string' ? body.reason.trim() : null;
        const nextStatus = action === 'reject' ? 'rejected' : 'under_review';
        const updatedApp: DealerApplication = {
          ...app,
          status: nextStatus,
          rejection_reason: reason,
          reviewed_by: auth.admin!.email,
          reviewed_at: nowIso,
          updated_at: nowIso,
        };
        state.dealerApplications[idx] = updatedApp;

        if (state.dealerCredentials[emailKey]) {
          state.dealerCredentials[emailKey].status = nextStatus === 'rejected' ? 'rejected' : 'pending';
        }

        recordModerationLogInState(state, {
          action: `dealer_application_${nextStatus}`,
          entityType: 'dealer',
          entityId: app.id,
          entityName: app.shop_name,
          performedBy: auth.admin!.email,
          reason,
        });

        if (app.customer_id) {
          createNotificationInState(state, {
            recipientId: app.customer_id,
            recipientRole: 'customer',
            type: 'dealer_application',
            title:
              nextStatus === 'rejected'
                ? `Application Needs Changes (${app.id})`
                : `Application Under Review (${app.id})`,
            message: reason || `Admin updated application status to ${nextStatus.replace('_', ' ')}.`,
            relatedRecordId: app.id,
            linkUrl: '/dealer/register',
            dealerName: app.shop_name,
          });
          emit({
            topic: 'notifications',
            action: 'created',
            recordId: app.id,
            customerId: app.customer_id,
            customerEmail: emailKey,
            recipientRole: 'customer',
          });
        }

        emit({
          topic: 'dealer_applications',
          action: 'status_changed',
          recordId: app.id,
          customerId: app.customer_id,
          customerEmail: emailKey,
        });
        emit({ topic: 'moderation_logs', action: 'created', recordId: app.id });
        return { application: updatedApp, status: 200 as const };
      }

      return { error: `Unsupported action: ${action}`, status: 400 as const };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to process dealer application';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
