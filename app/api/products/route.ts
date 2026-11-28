import { NextResponse } from 'next/server';
import { getPortalAuthContext, unauthorizedResponse } from '@/lib/server-auth';
import {
  createNotificationInState,
  getServerDb,
  mutateServerDb,
  recordModerationLogInState,
} from '@/lib/server-db';
import type { Product } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function resolveStockStatus(qty: number, requested?: string | null, threshold = 5): Product['stock_status'] {
  if (qty <= 0) return 'out_of_stock';
  if (requested === 'out_of_stock') return 'out_of_stock';
  if (requested === 'limited' || qty <= threshold) return 'limited';
  return 'in_stock';
}

export async function GET(request: Request) {
  const auth = getPortalAuthContext(request);
  const { searchParams } = new URL(request.url);
  const dealerId = searchParams.get('dealerId')?.trim() || null;
  const masterOnly = searchParams.get('masterOnly') === 'true';
  const includeUnapproved = searchParams.get('includeUnapproved') === 'true';
  const scope = searchParams.get('scope');
  const db = getServerDb();

  const approvedDealerIds = new Set(
    db.dealers.filter((d) => d.status === 'approved').map((d) => d.id)
  );

  let list = db.products;

  if (masterOnly) {
    list = list.filter((p) => {
      if (!p.is_master) return false;
      if (includeUnapproved && auth.admin) return true;
      return p.is_active !== false && p.moderation_status === 'approved';
    });
  } else if (dealerId) {
    const canSeeDealerPrivate =
      Boolean(auth.admin) || Boolean(auth.dealer && auth.dealer.dealerId === dealerId);
    list = list.filter((p) => {
      if (p.dealer_id !== dealerId) return false;
      if (includeUnapproved && canSeeDealerPrivate) return true;
      return (
        p.moderation_status === 'approved' &&
        p.is_active !== false &&
        approvedDealerIds.has(p.dealer_id)
      );
    });
  } else if (scope === 'public') {
    list = list.filter(
      (p) =>
        Boolean(p.dealer_id) &&
        p.moderation_status === 'approved' &&
        p.is_active !== false &&
        approvedDealerIds.has(p.dealer_id!)
    );
  } else if (auth.admin && includeUnapproved) {
    list = db.products;
  } else if (auth.dealer && includeUnapproved) {
    list = db.products.filter(
      (p) =>
        p.is_master ||
        p.dealer_id === auth.dealer!.dealerId ||
        (Boolean(p.dealer_id) &&
          p.moderation_status === 'approved' &&
          p.is_active !== false &&
          approvedDealerIds.has(p.dealer_id!))
    );
  } else {
    // Public browsing or unprivileged caller without explicit masterOnly
    list = list.filter(
      (p) =>
        Boolean(p.dealer_id) &&
        p.moderation_status === 'approved' &&
        p.is_active !== false &&
        approvedDealerIds.has(p.dealer_id!)
    );
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
      return unauthorizedResponse('Only Admins can create Master Catalog products.', 403);
    }

    if (!auth.admin && auth.dealerRecord && auth.dealerRecord.status !== 'approved') {
      return unauthorizedResponse('Only Admin-approved dealers can submit products.', 403);
    }

    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const price = Number(body?.price);
    if (!name || (!isMasterRequest && (!Number.isFinite(price) || price <= 0)) || (isMasterRequest && (!Number.isFinite(price) || price < 0))) {
      return NextResponse.json({ error: 'Valid product name and valid selling price are required.' }, { status: 400 });
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

    const masterProductId =
      typeof body?.master_product_id === 'string' && body.master_product_id.trim()
        ? body.master_product_id.trim()
        : null;

    const result = mutateServerDb((state, emit) => {
      const nowIso = new Date().toISOString();
      const requestedId = typeof body?.id === 'string' && body.id.trim() ? body.id.trim() : null;
      const id =
        requestedId ||
        (isMasterRequest
          ? `master-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
          : `prod-${assignedDealerId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`);

      const idx = state.products.findIndex((p) => p.id === id);

      if (!isMasterRequest && assignedDealerId) {
        const duplicate = state.products.find((p) => {
          if (p.dealer_id !== assignedDealerId) return false;
          if (idx >= 0 && p.id === id) return false;
          if (masterProductId && (p.master_product_id === masterProductId || p.id === `prod-${assignedDealerId}-${masterProductId}`)) {
            return true;
          }
          return p.name.trim().toLowerCase() === name.toLowerCase();
        });
        if (duplicate) {
          return {
            error: `Duplicate listing: "${duplicate.name}" is already in your showroom.`,
            status: 409 as const,
          };
        }
      }

      if (idx >= 0 && !auth.admin) {
        const existingItem = state.products[idx];
        if ((existingItem.is_master && !existingItem.dealer_id) || existingItem.dealer_id !== assignedDealerId) {
          return { error: 'You cannot overwrite another dealer listing or a Master Catalog product.', status: 403 as const };
        }
        if (body?.from_catalogue) {
          return { error: `Duplicate listing: "${existingItem.name}" is already in your showroom.`, status: 409 as const };
        }
      }

      const existingBase = idx >= 0 ? state.products[idx] : null;
      const qtyRaw =
        typeof body?.stock_qty === 'number'
          ? body.stock_qty
          : typeof body?.stock_quantity === 'number'
            ? body.stock_quantity
            : existingBase?.stock_qty ?? 10;
      const qty = Math.max(0, Math.floor(qtyRaw));
      const dealerThreshold =
        Number(body?.low_stock_threshold ?? existingBase?.low_stock_threshold ?? auth.dealerRecord?.low_stock_threshold ?? 5) || 5;

      // Resolve brand_name or matching brand_id
      const rawBrandName = typeof body?.brand_name === 'string' && body.brand_name.trim() ? body.brand_name.trim() : null;
      let resolvedBrandId: string | null = body?.brand_id ?? existingBase?.brand_id ?? null;
      if (!resolvedBrandId && rawBrandName) {
        const matchedBrand = state.brands.find((b) => b.name.toLowerCase() === rawBrandName.toLowerCase());
        if (matchedBrand) resolvedBrandId = matchedBrand.id;
      }

      // CRITICAL SECURITY & APPROVAL LIFECYCLE ENFORCEMENT:
      // All Dealer-created/submitted products MUST start in 'pending' state until Admin approves.
      const enforcedModerationStatus: Product['moderation_status'] = auth.admin
        ? (body?.moderation_status ?? existingBase?.moderation_status ?? 'approved')
        : 'pending';

      const discountVal =
        body?.discount_price !== undefined
          ? body.discount_price
            ? Number(body.discount_price)
            : null
          : existingBase?.discount_price ?? null;

      const actorEmail = auth.admin?.email || auth.dealer?.email || 'dealer';
      const initialPriceEntry = {
        old_price: price,
        new_price: price,
        old_discount: discountVal,
        new_discount: discountVal,
        changed_at: nowIso,
        changed_by: actorEmail,
      };

      const product: Product = {
        id,
        dealer_id: isMasterRequest ? null : assignedDealerId,
        master_product_id: isMasterRequest ? null : masterProductId ?? existingBase?.master_product_id ?? null,
        name,
        slug:
          (typeof body?.slug === 'string' && body.slug.trim()) ||
          existingBase?.slug ||
          name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48) + `-${Date.now().toString(36)}`,
        brand_id: resolvedBrandId,
        brand_name: rawBrandName ?? existingBase?.brand_name ?? null,
        category_id: body?.category_id ?? existingBase?.category_id ?? 'cat-electronics',
        model: body?.model ?? existingBase?.model ?? null,
        sku: body?.sku ?? existingBase?.sku ?? null,
        barcode: body?.barcode ?? existingBase?.barcode ?? null,
        description: body?.description ?? existingBase?.description ?? null,
        specifications: body?.specifications ?? existingBase?.specifications ?? {},
        features: Array.isArray(body?.features) ? body.features : existingBase?.features ?? [],
        price,
        discount_price: discountVal,
        color: body?.color ?? existingBase?.color ?? null,
        size: body?.size ?? existingBase?.size ?? null,
        weight: body?.weight ?? existingBase?.weight ?? null,
        material: body?.material ?? existingBase?.material ?? null,
        warranty: body?.warranty ?? existingBase?.warranty ?? null,
        delivery_available: body?.delivery_available ?? existingBase?.delivery_available ?? true,
        pickup_available: body?.pickup_available ?? existingBase?.pickup_available ?? true,
        return_policy: body?.return_policy ?? existingBase?.return_policy ?? null,
        tags: Array.isArray(body?.tags) ? body.tags : existingBase?.tags ?? [],
        images:
          Array.isArray(body?.images) && body.images.length > 0
            ? body.images
            : existingBase?.images ?? ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'],
        video_url: body?.video_url ?? existingBase?.video_url ?? null,
        stock_qty: qty,
        stock_quantity: qty,
        low_stock_threshold: dealerThreshold,
        stock_status: resolveStockStatus(qty, body?.stock_status, dealerThreshold),
        is_featured: auth.admin ? Boolean(body?.is_featured ?? existingBase?.is_featured) : false,
        is_trending: auth.admin ? Boolean(body?.is_trending ?? existingBase?.is_trending) : false,
        is_master: isMasterRequest,
        is_active: auth.admin ? (body?.is_active !== undefined ? Boolean(body.is_active) : true) : true,
        short_description: body?.short_description ?? existingBase?.short_description ?? null,
        seo_title: body?.seo_title ?? existingBase?.seo_title ?? null,
        seo_description: body?.seo_description ?? existingBase?.seo_description ?? null,
        keywords: Array.isArray(body?.keywords) ? body.keywords : existingBase?.keywords ?? [],
        model_number: body?.model_number ?? existingBase?.model_number ?? null,
        ai_confidence: body?.ai_confidence ?? existingBase?.ai_confidence ?? 0.95,
        ai_status: body?.ai_status ?? existingBase?.ai_status ?? 'approved',
        subcategory_id: body?.subcategory_id ?? existingBase?.subcategory_id ?? null,
        variants: body?.variants ?? existingBase?.variants ?? {},
        view_count: typeof body?.view_count === 'number' ? body.view_count : existingBase?.view_count ?? 0,
        search_count: typeof body?.search_count === 'number' ? body.search_count : existingBase?.search_count ?? 0,
        enquiry_count: typeof body?.enquiry_count === 'number' ? body.enquiry_count : existingBase?.enquiry_count ?? 0,
        ai_verified: Boolean(body?.ai_verified ?? existingBase?.ai_verified ?? true),
        ai_description: body?.ai_description ?? existingBase?.ai_description ?? null,
        ai_tags: Array.isArray(body?.ai_tags) ? body.ai_tags : existingBase?.ai_tags ?? [],
        moderation_status: enforcedModerationStatus,
        rejection_reason: null,
        admin_info_request: null,
        price_history: existingBase?.price_history ? existingBase.price_history : [initialPriceEntry],
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
        const approvedCount = state.products.filter(
          (p) => p.dealer_id === assignedDealerId && p.moderation_status === 'approved' && p.is_active !== false
        ).length;
        state.dealers = state.dealers.map((d) =>
          d.id === assignedDealerId ? { ...d, product_count: approvedCount, updated_at: nowIso } : d
        );

        createNotificationInState(state, {
          recipientId: 'admin',
          recipientRole: 'admin',
          type: 'product_update',
          title:
            enforcedModerationStatus === 'pending'
              ? `Pending Product Review: ${product.name}`
              : `Dealer Product Updated: ${product.name}`,
          message: `${auth.dealerRecord?.shop_name || assignedDealerId} submitted "${product.name}" (₹${product.discount_price || product.price}) for approval.`,
          productId: product.id,
          dealerId: assignedDealerId,
          relatedRecordId: product.id,
          linkUrl: '/admin?tab=04-products',
        });

        recordModerationLogInState(state, {
          action: enforcedModerationStatus === 'pending' ? 'product_submitted' : 'product_saved',
          entityType: 'product',
          entityId: product.id,
          entityName: product.name,
          performedBy: actorEmail,
          details: { dealer_id: assignedDealerId, master_product_id: product.master_product_id },
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
        emit({ topic: 'moderation_logs', action: 'created', recordId: product.id });
      }

      return { product, status: 201 as const };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

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

    // Bulk Stock Update mode for owning Dealer or Admin
    if (Array.isArray(body?.bulkUpdates)) {
      const updatesInput = body.bulkUpdates as Array<{
        id: string;
        stock_qty?: number;
        stock_status?: Product['stock_status'];
        low_stock_threshold?: number;
      }>;
      if (updatesInput.length === 0) {
        return NextResponse.json({ error: 'No bulk stock updates supplied.' }, { status: 400 });
      }

      const bulkRes = mutateServerDb((state, emit) => {
        const nowIso = new Date().toISOString();
        const touchedProducts: Product[] = [];

        for (const item of updatesInput) {
          const idx = state.products.findIndex((p) => p.id === item.id);
          if (idx === -1) continue;
          const existing = state.products[idx];
          if (!auth.admin) {
            if ((existing.is_master && !existing.dealer_id) || !auth.dealer || existing.dealer_id !== auth.dealer.dealerId) {
              return { error: 'Forbidden: bulk update contains a product outside your showroom.', status: 403 as const };
            }
          }
          const nextQty = typeof item.stock_qty === 'number' ? Math.max(0, Math.floor(item.stock_qty)) : existing.stock_qty;
          const threshold =
            typeof item.low_stock_threshold === 'number'
              ? Math.max(1, Math.floor(item.low_stock_threshold))
              : existing.low_stock_threshold ?? auth.dealerRecord?.low_stock_threshold ?? 5;
          const nextStatus = resolveStockStatus(nextQty, item.stock_status, threshold);
          const nextProd: Product = {
            ...existing,
            stock_qty: nextQty,
            stock_quantity: nextQty,
            low_stock_threshold: threshold,
            stock_status: nextStatus,
            updated_at: nowIso,
          };
          state.products[idx] = nextProd;
          touchedProducts.push(nextProd);
          emit({
            topic: 'products',
            action: 'updated',
            recordId: nextProd.id,
            productId: nextProd.id,
            dealerId: nextProd.dealer_id,
          });
        }

        return { products: touchedProducts, status: 200 as const };
      });

      if ('error' in bulkRes) {
        return NextResponse.json({ error: bulkRes.error }, { status: bulkRes.status });
      }
      return NextResponse.json({ products: bulkRes.products });
    }

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
        if (existing.is_master && !existing.dealer_id) {
          return { error: 'Dealers cannot modify Master Catalog products directly.', status: 403 as const };
        }
        if (!auth.dealer || existing.dealer_id !== auth.dealer.dealerId) {
          return { error: 'You can only update products belonging to your own showroom.', status: 403 as const };
        }
        if (body?.moderation_status === 'approved' && existing.moderation_status !== 'approved') {
          return { error: 'Dealers cannot self-approve products. An Administrator must approve listings.', status: 403 as const };
        }
      }

      const nowIso = new Date().toISOString();
      const prevPrice = existing.discount_price ?? existing.price;
      const prevStock = existing.stock_status;
      const prevMod = existing.moderation_status;

      // Strip internal client helpers
      const {
        submittingDealer: _sd,
        dealer: _dl,
        category: _cat,
        brand: _br,
        resubmit,
        action: modAction,
        reason: modReason,
        master_product_id: reqMasterId,
        ...cleanBody
      } = body;

      let updated: Product;
      if (auth.admin) {
        updated = {
          ...existing,
          ...cleanBody,
          id: existing.id,
          dealer_id: existing.is_master && !existing.dealer_id ? null : (cleanBody.dealer_id ?? existing.dealer_id),
          is_master: existing.is_master,
          updated_at: nowIso,
        };

        if (modAction === 'approve') {
          updated.moderation_status = 'approved';
          updated.is_active = true;
          updated.rejection_reason = null;
          updated.admin_info_request = null;
        } else if (modAction === 'reject') {
          updated.moderation_status = 'rejected';
          updated.is_active = false;
          updated.rejection_reason = typeof modReason === 'string' && modReason.trim() ? modReason.trim() : (updated.rejection_reason || 'Rejected by Administrator');
        } else if (modAction === 'request_info') {
          updated.moderation_status = 'flagged';
          updated.admin_info_request = typeof modReason === 'string' && modReason.trim() ? modReason.trim() : 'Additional product specifications or images requested.';
        } else if (modAction === 'link_master' && typeof reqMasterId === 'string' && reqMasterId.trim()) {
          const master = state.products.find((p) => p.id === reqMasterId.trim() && p.is_master);
          if (!master) {
            return { error: 'Selected Master Catalog product not found.', status: 404 as const };
          }
          updated.master_product_id = master.id;
          updated.brand_id = master.brand_id ?? updated.brand_id;
          updated.category_id = master.category_id ?? updated.category_id;
          if (body?.syncMasterDetails) {
            updated.name = master.name;
            updated.images = master.images.length ? master.images : updated.images;
            updated.specifications = Object.keys(master.specifications || {}).length ? master.specifications : updated.specifications;
          }
        }
      } else {
        // Dealer safe update path
        const isLinkedMaster = Boolean(existing.master_product_id);
        const qtyRaw =
          typeof cleanBody.stock_qty === 'number'
            ? cleanBody.stock_qty
            : typeof cleanBody.stock_quantity === 'number'
              ? cleanBody.stock_quantity
              : existing.stock_qty;
        const nextQty = Math.max(0, Math.floor(qtyRaw));
        const threshold =
          typeof cleanBody.low_stock_threshold === 'number'
            ? Math.max(1, Math.floor(cleanBody.low_stock_threshold))
            : existing.low_stock_threshold ?? auth.dealerRecord?.low_stock_threshold ?? 5;

        const nextPrice = cleanBody.price !== undefined ? Number(cleanBody.price) : existing.price;
        const nextDiscount =
          cleanBody.discount_price !== undefined
            ? cleanBody.discount_price
              ? Number(cleanBody.discount_price)
              : null
            : existing.discount_price;

        updated = {
          ...existing,
          name: !isLinkedMaster && typeof cleanBody.name === 'string' && cleanBody.name.trim() ? cleanBody.name.trim() : existing.name,
          model: !isLinkedMaster && cleanBody.model !== undefined ? cleanBody.model : existing.model,
          category_id: !isLinkedMaster && cleanBody.category_id ? cleanBody.category_id : existing.category_id,
          brand_id: !isLinkedMaster && cleanBody.brand_id !== undefined ? cleanBody.brand_id : existing.brand_id,
          brand_name: !isLinkedMaster && cleanBody.brand_name !== undefined ? cleanBody.brand_name : existing.brand_name,
          description: !isLinkedMaster && cleanBody.description !== undefined ? cleanBody.description : existing.description,
          specifications: !isLinkedMaster && cleanBody.specifications ? cleanBody.specifications : existing.specifications,
          images: !isLinkedMaster && Array.isArray(cleanBody.images) && cleanBody.images.length > 0 ? cleanBody.images : existing.images,
          price: nextPrice,
          discount_price: nextDiscount,
          stock_qty: nextQty,
          stock_quantity: nextQty,
          low_stock_threshold: threshold,
          stock_status: resolveStockStatus(nextQty, cleanBody.stock_status, threshold),
          warranty: cleanBody.warranty !== undefined ? cleanBody.warranty : existing.warranty,
          color: cleanBody.color !== undefined ? cleanBody.color : existing.color,
          return_policy: cleanBody.return_policy !== undefined ? cleanBody.return_policy : existing.return_policy,
          delivery_available: typeof cleanBody.delivery_available === 'boolean' ? cleanBody.delivery_available : existing.delivery_available,
          pickup_available: typeof cleanBody.pickup_available === 'boolean' ? cleanBody.pickup_available : existing.pickup_available,
          is_active: typeof cleanBody.is_active === 'boolean' ? cleanBody.is_active : existing.is_active,
          moderation_status: resubmit ? 'pending' : existing.moderation_status,
          rejection_reason: resubmit ? null : existing.rejection_reason,
          admin_info_request: resubmit ? null : existing.admin_info_request,
          updated_at: nowIso,
        };
      }

      if (!Number.isFinite(updated.price) || (updated.price <= 0 && !updated.is_master)) {
        return { error: 'Product price must be greater than 0.', status: 400 as const };
      }

      // Sync quantity fields cleanly
      if (typeof updated.stock_qty === 'number') {
        updated.stock_quantity = updated.stock_qty;
      }

      // Append to price_history if price/discount changed
      const priceChanged =
        updated.price !== existing.price ||
        (updated.discount_price ?? null) !== (existing.discount_price ?? null);
      if (priceChanged) {
        const actor = auth.admin?.email || auth.dealer?.email || 'system';
        const history = Array.isArray(existing.price_history) ? existing.price_history : [];
        updated.price_history = [
          {
            old_price: existing.price,
            new_price: updated.price,
            old_discount: existing.discount_price ?? null,
            new_discount: updated.discount_price ?? null,
            changed_at: nowIso,
            changed_by: actor,
          },
          ...history,
        ].slice(0, 30);
      }

      state.products[idx] = updated;

      const nextEffectivePrice = updated.discount_price ?? updated.price;
      if (updated.dealer_id) {
        const count = state.products.filter(
          (p) => p.dealer_id === updated.dealer_id && p.moderation_status === 'approved' && p.is_active !== false
        ).length;
        state.dealers = state.dealers.map((d) =>
          d.id === updated.dealer_id ? { ...d, product_count: count, updated_at: nowIso } : d
        );
      }

      // Resubmit notification to Admin
      if (resubmit && updated.dealer_id && !auth.admin) {
        recordModerationLogInState(state, {
          action: 'product_resubmitted',
          entityType: 'product',
          entityId: updated.id,
          entityName: updated.name,
          performedBy: auth.dealer?.email || 'dealer',
          details: { dealer_id: updated.dealer_id },
        });
        createNotificationInState(state, {
          recipientId: 'admin',
          recipientRole: 'admin',
          type: 'product_update',
          title: `Product Resubmitted: ${updated.name}`,
          message: `${auth.dealerRecord?.shop_name || updated.dealer_id} updated and resubmitted "${updated.name}" for review.`,
          productId: updated.id,
          dealerId: updated.dealer_id,
          relatedRecordId: updated.id,
          linkUrl: '/admin?tab=04-products',
        });
        emit({ topic: 'notifications', action: 'created', recordId: updated.id, recipientRole: 'admin' });
        emit({ topic: 'moderation_logs', action: 'created', recordId: updated.id });
      }

      // Admin Moderation Notifications & Audit Logs
      if (auth.admin && updated.dealer_id && (prevMod !== updated.moderation_status || modAction)) {
        const modLogAction =
          updated.moderation_status === 'approved'
            ? 'product_approved'
            : updated.moderation_status === 'rejected'
              ? 'product_rejected'
              : modAction === 'request_info' || updated.moderation_status === 'flagged'
                ? 'product_info_requested'
                : modAction === 'link_master'
                  ? 'product_linked_master'
                  : 'product_moderated';

        recordModerationLogInState(state, {
          action: modLogAction,
          entityType: 'product',
          entityId: updated.id,
          entityName: updated.name,
          performedBy: auth.admin.email,
          reason: updated.rejection_reason || updated.admin_info_request || (typeof modReason === 'string' ? modReason : null),
          details: { dealer_id: updated.dealer_id, status: updated.moderation_status },
        });

        if (updated.moderation_status === 'approved') {
          createNotificationInState(state, {
            recipientId: updated.dealer_id,
            recipientRole: 'dealer',
            type: 'product_approved',
            title: `Product Approved: ${updated.name}`,
            message: `Your listing "${updated.name}" is now live in the Customer App!`,
            productId: updated.id,
            dealerId: updated.dealer_id,
            relatedRecordId: updated.id,
            linkUrl: '/dealer?tab=03-products',
          });
        } else if (updated.moderation_status === 'rejected') {
          createNotificationInState(state, {
            recipientId: updated.dealer_id,
            recipientRole: 'dealer',
            type: 'product_rejected',
            title: `Product Rejected: ${updated.name}`,
            message: `Reason: ${updated.rejection_reason || 'Please review specs and resubmit.'}`,
            productId: updated.id,
            dealerId: updated.dealer_id,
            relatedRecordId: updated.id,
            linkUrl: '/dealer?tab=03-products',
          });
        } else if (updated.moderation_status === 'flagged') {
          createNotificationInState(state, {
            recipientId: updated.dealer_id,
            recipientRole: 'dealer',
            type: 'moderation_update',
            title: `Info Requested: ${updated.name}`,
            message: updated.admin_info_request || 'Admin requested additional product details.',
            productId: updated.id,
            dealerId: updated.dealer_id,
            relatedRecordId: updated.id,
            linkUrl: '/dealer?tab=03-products',
          });
        }

        emit({
          topic: 'notifications',
          action: 'created',
          recordId: updated.id,
          dealerId: updated.dealer_id,
          recipientRole: 'dealer',
        });
        emit({ topic: 'moderation_logs', action: 'created', recordId: updated.id });
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
          message: `Stock is now In Stock (${updated.stock_qty} units)`,
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
        if (existing.is_master && !existing.dealer_id) {
          return { error: 'Dealers cannot delete Admin Master Catalog products.', status: 403 as const };
        }
        if (!auth.dealer || existing.dealer_id !== auth.dealer.dealerId) {
          return { error: 'You can only remove products from your own shop.', status: 403 as const };
        }
      }

      const oldDealerId = existing.dealer_id;

      // Preserve legacy seeded Master Catalog template if a dealer removes a seeded dual item
      if (!auth.admin && existing.is_master && existing.dealer_id) {
        state.products[idx] = {
          ...existing,
          dealer_id: null,
          updated_at: new Date().toISOString(),
        };
      } else {
        state.products.splice(idx, 1);
      }

      if (oldDealerId) {
        const count = state.products.filter(
          (p) => p.dealer_id === oldDealerId && p.moderation_status === 'approved' && p.is_active !== false
        ).length;
        state.dealers = state.dealers.map((d) =>
          d.id === oldDealerId ? { ...d, product_count: count, updated_at: new Date().toISOString() } : d
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
        emit({ topic: 'moderation_logs', action: 'created', recordId: existing.id });
      }

      emit({
        topic: 'products',
        action: 'deleted',
        recordId: existing.id,
        productId: existing.id,
        dealerId: oldDealerId,
      });
      if (oldDealerId) {
        emit({ topic: 'dealers', action: 'updated', recordId: oldDealerId, dealerId: oldDealerId });
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
