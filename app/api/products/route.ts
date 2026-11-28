import { NextResponse } from 'next/server';
import { getPortalAuthContext, unauthorizedResponse } from '@/lib/server-auth';
import {
  createNotificationInState,
  mutateServerDb,
  getServerDb,
  recordModerationLogInState,
} from '@/lib/server-db';
import type { Product } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dealerId = searchParams.get('dealerId');
  const masterOnly = searchParams.get('masterOnly') === 'true';
  const db = getServerDb();

  let list = db.products;
  if (masterOnly) {
    list = list.filter((p) => p.is_master);
  } else if (dealerId) {
    list = list.filter((p) => p.dealer_id === dealerId && !p.is_master);
  }

  return NextResponse.json({ products: list });
}

export async function POST(request: Request) {
  try {
    const auth = getPortalAuthContext(request);
    if (!auth.admin && !auth.dealer) {
      return unauthorizedResponse('Admin or Approved Dealer authentication required', 401);
    }

    const body = await request.json();
    const isMasterRequest = Boolean(body?.is_master);

    if (isMasterRequest && !auth.admin) {
      return unauthorizedResponse('Only Admins can create Master Catalog products', 403);
    }

    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const price = Number(body?.price);
    if (!name || !Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: 'Valid product name and positive price are required.' }, { status: 400 });
    }

    const assignedDealerId = isMasterRequest
      ? null
      : auth.dealer
        ? auth.dealer.dealerId
        : typeof body?.dealer_id === 'string'
          ? body.dealer_id.trim()
          : null;

    if (!isMasterRequest && !assignedDealerId) {
      return NextResponse.json({ error: 'Dealer shop ownership is required for shop listings.' }, { status: 400 });
    }
    if (!isMasterRequest && auth.dealer && body?.dealer_id && body.dealer_id !== auth.dealer.dealerId) {
      return unauthorizedResponse('Dealers cannot create listings for another dealer shop.', 403);
    }

    const result = mutateServerDb((state, emit) => {
      const nowIso = new Date().toISOString();
      const id =
        (typeof body?.id === 'string' && body.id.trim()) ||
        (isMasterRequest
          ? `master-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
          : `prod-${assignedDealerId}-${Date.now().toString(36)}`);

      const idx = state.products.findIndex((p) => p.id === id);
      if (idx >= 0 && !auth.admin) {
        const existingItem = state.products[idx];
        if (existingItem.is_master || existingItem.dealer_id !== assignedDealerId) {
          return { error: 'You cannot overwrite another dealer listing or a Master Catalog product.', status: 403 as const };
        }
      }
      const existingBase = idx >= 0 ? state.products[idx] : null;
      const qty =
        typeof body?.stock_qty === 'number'
          ? body.stock_qty
          : typeof body?.stock_quantity === 'number'
            ? body.stock_quantity
            : existingBase?.stock_qty ?? 10;

      const product: Product = {
        id,
        dealer_id: isMasterRequest ? null : assignedDealerId,
        name,
        slug:
          (typeof body?.slug === 'string' && body.slug.trim()) ||
          existingBase?.slug ||
          name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48) + `-${Date.now().toString(36)}`,
        brand_id: body?.brand_id ?? existingBase?.brand_id ?? null,
        category_id: body?.category_id ?? existingBase?.category_id ?? 'cat-electronics',
        model: body?.model ?? existingBase?.model ?? null,
        sku: body?.sku ?? existingBase?.sku ?? null,
        barcode: body?.barcode ?? existingBase?.barcode ?? null,
        description: body?.description ?? existingBase?.description ?? null,
        specifications: body?.specifications ?? existingBase?.specifications ?? {},
        features: Array.isArray(body?.features) ? body.features : existingBase?.features ?? [],
        price,
        discount_price: body?.discount_price !== undefined
          ? (body.discount_price ? Number(body.discount_price) : null)
          : (existingBase?.discount_price ?? null),
        color: body?.color ?? existingBase?.color ?? null,
        size: body?.size ?? existingBase?.size ?? null,
        weight: body?.weight ?? existingBase?.weight ?? null,
        material: body?.material ?? existingBase?.material ?? null,
        warranty: body?.warranty ?? existingBase?.warranty ?? null,
        delivery_available: body?.delivery_available ?? existingBase?.delivery_available ?? true,
        pickup_available: body?.pickup_available ?? existingBase?.pickup_available ?? true,
        return_policy: body?.return_policy ?? existingBase?.return_policy ?? null,
        tags: Array.isArray(body?.tags) ? body.tags : existingBase?.tags ?? [],
        images: Array.isArray(body?.images) && body.images.length > 0
          ? body.images
          : existingBase?.images ?? ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'],
        video_url: body?.video_url ?? existingBase?.video_url ?? null,
        stock_qty: qty,
        stock_quantity: qty,
        stock_status: body?.stock_status || existingBase?.stock_status || 'in_stock',
        is_featured: Boolean(body?.is_featured ?? existingBase?.is_featured),
        is_trending: Boolean(body?.is_trending ?? existingBase?.is_trending),
        is_master: isMasterRequest,
        is_active: body?.is_active !== undefined ? Boolean(body.is_active) : (existingBase?.is_active ?? true),
        short_description: body?.short_description ?? existingBase?.short_description ?? null,
        seo_title: body?.seo_title ?? existingBase?.seo_title ?? null,
        seo_description: body?.seo_description ?? existingBase?.seo_description ?? null,
        keywords: Array.isArray(body?.keywords) ? body.keywords : existingBase?.keywords ?? [],
        model_number: body?.model_number ?? existingBase?.model_number ?? null,
        ai_confidence: body?.ai_confidence ?? existingBase?.ai_confidence ?? 0.95,
        ai_status: body?.ai_status ?? existingBase?.ai_status ?? 'approved',
        subcategory_id: body?.subcategory_id ?? existingBase?.subcategory_id ?? null,
        variants: body?.variants ?? existingBase?.variants ?? {},
        view_count: typeof body?.view_count === 'number' ? body.view_count : (existingBase?.view_count ?? 0),
        search_count: typeof body?.search_count === 'number' ? body.search_count : (existingBase?.search_count ?? 0),
        ai_verified: Boolean(body?.ai_verified ?? existingBase?.ai_verified ?? true),
        ai_description: body?.ai_description ?? existingBase?.ai_description ?? null,
        ai_tags: Array.isArray(body?.ai_tags) ? body.ai_tags : existingBase?.ai_tags ?? [],
        moderation_status: body?.moderation_status ?? existingBase?.moderation_status ?? 'approved',
        rating: existingBase?.rating ?? 0,
        rating_count: existingBase?.rating_count ?? 0,
        created_at: existingBase?.created_at ?? nowIso,
        updated_at: nowIso,
      };

      if (idx >= 0) {
        state.products[idx] = product;
      } else {
        state.products = [product, ...state.products];
      }

      if (assignedDealerId) {
        const count = state.products.filter(
          (p) => p.dealer_id === assignedDealerId && !p.is_master && p.is_active !== false
        ).length;
        state.dealers = state.dealers.map((d) =>
          d.id === assignedDealerId ? { ...d, product_count: count, updated_at: nowIso } : d
        );

        createNotificationInState(state, {
          recipientId: 'admin',
          recipientRole: 'admin',
          type: 'product_update',
          title: idx >= 0 ? 'Dealer Updated Listing' : 'New Dealer Listing Published',
          message: `${auth.dealerRecord?.shop_name || assignedDealerId}: ${product.name} (₹${product.discount_price || product.price})`,
          productId: product.id,
          dealerId: assignedDealerId,
          relatedRecordId: product.id,
          linkUrl: '/admin?tab=04-products',
        });
      }

      if (isMasterRequest && auth.admin) {
        recordModerationLogInState(state, {
          action: idx >= 0 ? 'master_product_updated' : 'master_product_created',
          entityType: 'product',
          entityId: product.id,
          entityName: product.name,
          performedBy: auth.admin.email,
        });
      }

      emit({
        topic: 'products',
        action: idx >= 0 ? 'updated' : 'created',
        recordId: product.id,
        productId: product.id,
        dealerId: assignedDealerId,
      });
      if (assignedDealerId) {
        emit({ topic: 'dealers', action: 'updated', recordId: assignedDealerId, dealerId: assignedDealerId });
        emit({ topic: 'notifications', action: 'created', recordId: product.id, recipientRole: 'admin' });
      }

      return { product };
    });

    return NextResponse.json({ product: result.product }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save product';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = getPortalAuthContext(request);
    if (!auth.admin && !auth.dealer) {
      return unauthorizedResponse('Admin or Approved Dealer authentication required', 401);
    }

    const body = await request.json();
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    if (!id) {
      return NextResponse.json({ error: 'Product ID is required.' }, { status: 400 });
    }

    const result = mutateServerDb((state, emit) => {
      const idx = state.products.findIndex((p) => p.id === id);
      if (idx === -1) {
        return { error: 'Product not found', status: 404 as const };
      }

      const existing = state.products[idx];
      if (!auth.admin) {
        if (existing.is_master) {
          return { error: 'Dealers cannot modify Master Catalog products directly.', status: 403 as const };
        }
        if (!auth.dealer || existing.dealer_id !== auth.dealer.dealerId) {
          return { error: 'You can only update products belonging to your own showroom.', status: 403 as const };
        }
      }

      const nowIso = new Date().toISOString();
      const prevPrice = existing.discount_price ?? existing.price;
      const prevStock = existing.stock_status;

      const updated: Product = {
        ...existing,
        ...body,
        id: existing.id,
        dealer_id: existing.is_master ? null : existing.dealer_id,
        is_master: existing.is_master,
        updated_at: nowIso,
      };
      if (updated.price <= 0) {
        return { error: 'Product price must be greater than 0.', status: 400 as const };
      }

      state.products[idx] = updated;

      const nextEffectivePrice = updated.discount_price ?? updated.price;
      if (updated.dealer_id) {
        const count = state.products.filter(
          (p) => p.dealer_id === updated.dealer_id && !p.is_master && p.is_active !== false
        ).length;
        state.dealers = state.dealers.map((d) =>
          d.id === updated.dealer_id ? { ...d, product_count: count, updated_at: nowIso } : d
        );
      }

      if (auth.admin && existing.is_master) {
        recordModerationLogInState(state, {
          action: 'master_product_updated',
          entityType: 'product',
          entityId: updated.id,
          entityName: updated.name,
          performedBy: auth.admin.email,
        });
      }

      if (prevStock === 'out_of_stock' && updated.stock_status === 'in_stock') {
        createNotificationInState(state, {
          recipientId: 'admin',
          recipientRole: 'admin',
          type: 'in_stock',
          title: `Product Restocked: ${updated.name}`,
          message: `Stock is now In Stock`,
          productId: updated.id,
          dealerId: updated.dealer_id,
          relatedRecordId: updated.id,
          linkUrl: `/product/${updated.id}`,
        });
      } else if (nextEffectivePrice < prevPrice) {
        createNotificationInState(state, {
          recipientId: 'admin',
          recipientRole: 'admin',
          type: 'price_drop',
          title: `Price Dropped: ${updated.name}`,
          message: `₹${prevPrice} → ₹${nextEffectivePrice}`,
          productId: updated.id,
          dealerId: updated.dealer_id,
          relatedRecordId: updated.id,
          oldValue: `₹${prevPrice}`,
          newValue: `₹${nextEffectivePrice}`,
          linkUrl: `/product/${updated.id}`,
        });
      }

      emit({
        topic: 'products',
        action: 'updated',
        recordId: updated.id,
        productId: updated.id,
        dealerId: updated.dealer_id,
      });
      if (updated.dealer_id) {
        emit({ topic: 'dealers', action: 'updated', recordId: updated.dealer_id, dealerId: updated.dealer_id });
      }

      return { product: updated, status: 200 as const };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ product: result.product });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update product';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = getPortalAuthContext(request);
    if (!auth.admin && !auth.dealer) {
      return unauthorizedResponse('Admin or Approved Dealer authentication required', 401);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim() || '';
    if (!id) {
      return NextResponse.json({ error: 'Product ID is required.' }, { status: 400 });
    }

    const result = mutateServerDb((state, emit) => {
      const idx = state.products.findIndex((p) => p.id === id);
      if (idx === -1) {
        return { error: 'Product not found', status: 404 as const };
      }

      const existing = state.products[idx];
      if (!auth.admin) {
        if (existing.is_master) {
          return { error: 'Dealers cannot delete Admin Master Catalog products.', status: 403 as const };
        }
        if (!auth.dealer || existing.dealer_id !== auth.dealer.dealerId) {
          return { error: 'You can only remove products from your own shop.', status: 403 as const };
        }
      }

      state.products.splice(idx, 1);

      if (existing.dealer_id) {
        const count = state.products.filter(
          (p) => p.dealer_id === existing.dealer_id && !p.is_master && p.is_active !== false
        ).length;
        state.dealers = state.dealers.map((d) =>
          d.id === existing.dealer_id ? { ...d, product_count: count, updated_at: new Date().toISOString() } : d
        );
      }

      if (auth.admin) {
        recordModerationLogInState(state, {
          action: existing.is_master ? 'master_product_deleted' : 'product_deleted',
          entityType: 'product',
          entityId: existing.id,
          entityName: existing.name,
          performedBy: auth.admin.email,
        });
      }

      emit({
        topic: 'products',
        action: 'deleted',
        recordId: existing.id,
        productId: existing.id,
        dealerId: existing.dealer_id,
      });
      if (existing.dealer_id) {
        emit({ topic: 'dealers', action: 'updated', recordId: existing.dealer_id, dealerId: existing.dealer_id });
      }

      return { deleted: true, id: existing.id, status: 200 as const };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete product';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
