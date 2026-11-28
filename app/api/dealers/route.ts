import { NextResponse } from 'next/server';
import { getPortalAuthContext, unauthorizedResponse } from '@/lib/server-auth';
import {
  createNotificationInState,
  getServerDb,
  mutateServerDb,
  recordModerationLogInState,
} from '@/lib/server-db';
import type { Dealer } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = getPortalAuthContext(request);
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope');
  const db = getServerDb();

  if (scope === 'admin' || auth.admin) {
    if (!auth.admin) return unauthorizedResponse('Admin authorization required', 403);
    return NextResponse.json({ dealers: db.dealers });
  }

  return NextResponse.json({
    dealers: db.dealers.filter(
      (d) => d.status === 'approved' || (auth.dealer && d.id === auth.dealer.dealerId)
    ),
  });
}

export async function POST(request: Request) {
  try {
    const auth = getPortalAuthContext(request);
    if (!auth.admin) {
      return unauthorizedResponse('Only Admins can directly register or upsert dealer profiles.', 403);
    }

    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const shopName = typeof body?.shop_name === 'string' ? body.shop_name.trim() : '';
    if (!email || !shopName) {
      return NextResponse.json({ error: 'Shop name and email are required.' }, { status: 400 });
    }

    const result = mutateServerDb((state, emit) => {
      const nowIso = new Date().toISOString();
      const id =
        (typeof body?.id === 'string' && body.id.trim()) ||
        `dealer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const idx = state.dealers.findIndex((d) => d.id === id);

      const dealer: Dealer = {
        ...(idx >= 0 ? state.dealers[idx] : {}),
        id,
        shop_name: shopName,
        description: body?.description ?? null,
        owner_name: body?.owner_name || 'Shop Owner',
        email,
        phone: body?.phone || '+91 98480 00000',
        whatsapp: body?.whatsapp ?? null,
        address: body?.address || 'Main Road',
        village: body?.village ?? null,
        city: body?.city || 'Amalapuram',
        district: body?.district || 'Konaseema',
        state: body?.state || 'Andhra Pradesh',
        pin_code: body?.pin_code || '533201',
        gst_number: body?.gst_number ?? null,
        logo_url: body?.logo_url ?? null,
        banner_url: body?.banner_url ?? null,
        map_lat: typeof body?.map_lat === 'number' ? body.map_lat : 16.5787,
        map_lng: typeof body?.map_lng === 'number' ? body.map_lng : 82.0061,
        working_hours: body?.working_hours || { mon_sat: '09:00 AM - 09:00 PM', sun: '10:00 AM - 02:00 PM' },
        rating: idx >= 0 ? state.dealers[idx].rating : 0,
        rating_count: idx >= 0 ? state.dealers[idx].rating_count : 0,
        status: body?.status || 'approved',
        auth_user_id: body?.auth_user_id || `user-${id}`,
        business_category_id: body?.business_category_id ?? null,
        delivery_available: body?.delivery_available !== false,
        pickup_available: body?.pickup_available !== false,
        home_delivery_radius_km: Number(body?.home_delivery_radius_km) || 10,
        product_count: idx >= 0 ? state.dealers[idx].product_count : 0,
        view_count: idx >= 0 ? state.dealers[idx].view_count : 0,
        created_at: idx >= 0 ? state.dealers[idx].created_at : nowIso,
        updated_at: nowIso,
        approved_at: body?.status === 'approved' ? nowIso : (idx >= 0 ? state.dealers[idx].approved_at : null),
      };

      if (idx >= 0) {
        state.dealers[idx] = dealer;
      } else {
        state.dealers = [dealer, ...state.dealers];
      }

      if (body?.password && typeof body.password === 'string') {
        state.dealerCredentials[email] = {
          dealerId: dealer.id,
          email,
          password: body.password.trim(),
          status: dealer.status,
        };
      } else if (state.dealerCredentials[email]) {
        state.dealerCredentials[email].status = dealer.status;
      }

      recordModerationLogInState(state, {
        action: idx >= 0 ? 'dealer_updated' : 'dealer_created',
        entityType: 'dealer',
        entityId: dealer.id,
        entityName: dealer.shop_name,
        performedBy: auth.admin!.email,
      });

      emit({ topic: 'dealers', action: idx >= 0 ? 'updated' : 'created', recordId: dealer.id, dealerId: dealer.id });
      emit({ topic: 'moderation_logs', action: 'created', recordId: dealer.id });
      return { dealer };
    });

    return NextResponse.json({ dealer: result.dealer }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save dealer';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = getPortalAuthContext(request);
    if (!auth.admin && !auth.dealer) {
      return unauthorizedResponse('Admin or Dealer authentication required', 401);
    }

    const body = await request.json();
    const targetId = typeof body?.id === 'string' && body.id.trim()
      ? body.id.trim()
      : auth.dealer?.dealerId || '';

    if (!targetId) {
      return NextResponse.json({ error: 'Dealer ID is required.' }, { status: 400 });
    }

    if (!auth.admin && (!auth.dealer || targetId !== auth.dealer.dealerId)) {
      return unauthorizedResponse('Dealers can only update their own showroom settings.', 403);
    }

    const result = mutateServerDb((state, emit) => {
      const idx = state.dealers.findIndex((d) => d.id === targetId);
      if (idx === -1) {
        return { error: 'Dealer not found', status: 404 as const };
      }

      const existing = state.dealers[idx];
      const nowIso = new Date().toISOString();

      const updated: Dealer = auth.admin
        ? {
            ...existing,
            ...body,
            id: existing.id,
            rating: existing.rating,
            rating_count: existing.rating_count,
            updated_at: nowIso,
          }
        : {
            ...existing,
            shop_name: typeof body?.shop_name === 'string' && body.shop_name.trim() ? body.shop_name.trim() : existing.shop_name,
            description: body?.description !== undefined ? body.description : existing.description,
            owner_name: typeof body?.owner_name === 'string' && body.owner_name.trim() ? body.owner_name.trim() : existing.owner_name,
            phone: typeof body?.phone === 'string' && body.phone.trim() ? body.phone.trim() : existing.phone,
            whatsapp: body?.whatsapp !== undefined ? body.whatsapp : existing.whatsapp,
            address: typeof body?.address === 'string' && body.address.trim() ? body.address.trim() : existing.address,
            city: typeof body?.city === 'string' && body.city.trim() ? body.city.trim() : existing.city,
            district: typeof body?.district === 'string' && body.district.trim() ? body.district.trim() : existing.district,
            state: typeof body?.state === 'string' && body.state.trim() ? body.state.trim() : existing.state,
            pin_code: typeof body?.pin_code === 'string' && body.pin_code.trim() ? body.pin_code.trim() : existing.pin_code,
            working_hours: body?.working_hours || existing.working_hours,
            delivery_available: typeof body?.delivery_available === 'boolean' ? body.delivery_available : existing.delivery_available,
            pickup_available: typeof body?.pickup_available === 'boolean' ? body.pickup_available : existing.pickup_available,
            home_delivery_radius_km: typeof body?.home_delivery_radius_km === 'number' ? body.home_delivery_radius_km : existing.home_delivery_radius_km,
            logo_url: body?.logo_url !== undefined ? body.logo_url : existing.logo_url,
            banner_url: body?.banner_url !== undefined ? body.banner_url : existing.banner_url,
            updated_at: nowIso,
          };

      state.dealers[idx] = updated;

      if (auth.admin && body?.status && body.status !== existing.status) {
        const emailKey = updated.email.toLowerCase();
        if (state.dealerCredentials[emailKey]) {
          state.dealerCredentials[emailKey].status = updated.status;
        }
        recordModerationLogInState(state, {
          action: `dealer_${updated.status}`,
          entityType: 'dealer',
          entityId: updated.id,
          entityName: updated.shop_name,
          performedBy: auth.admin.email,
        });
        createNotificationInState(state, {
          recipientId: updated.id,
          recipientRole: 'dealer',
          type: 'moderation_update',
          title: `Shop Status Changed to ${updated.status}`,
          message: `Administrator updated your showroom status to ${updated.status}.`,
          dealerId: updated.id,
          relatedRecordId: updated.id,
          linkUrl: '/dealer',
        });
      }

      emit({ topic: 'dealers', action: 'updated', recordId: updated.id, dealerId: updated.id });
      return { dealer: updated, status: 200 as const };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ dealer: result.dealer });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update dealer';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = getPortalAuthContext(request);
    if (!auth.admin) {
      return unauthorizedResponse('Only Admins can remove dealer accounts.', 403);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim() || '';
    if (!id) {
      return NextResponse.json({ error: 'Dealer ID is required.' }, { status: 400 });
    }

    const result = mutateServerDb((state, emit) => {
      const idx = state.dealers.findIndex((d) => d.id === id);
      if (idx === -1) {
        return { error: 'Dealer not found', status: 404 as const };
      }
      const existing = state.dealers[idx];
      state.dealers.splice(idx, 1);
      // Remove only dealer listings, NEVER delete Admin master products
      state.products = state.products.filter((p) => p.dealer_id !== id || p.is_master);

      recordModerationLogInState(state, {
        action: 'dealer_deleted',
        entityType: 'dealer',
        entityId: existing.id,
        entityName: existing.shop_name,
        performedBy: auth.admin!.email,
      });

      emit({ topic: 'dealers', action: 'deleted', recordId: existing.id, dealerId: existing.id });
      emit({ topic: 'products', action: 'deleted', dealerId: existing.id });
      emit({ topic: 'moderation_logs', action: 'created', recordId: existing.id });
      return { deleted: true, status: 200 as const };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete dealer';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
