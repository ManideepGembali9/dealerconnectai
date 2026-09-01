import { supabase, type Product, type ProductImage, type ModerationLog, type Dealer } from './supabase';
import { aiModerateImage, type AiModerationVerdict } from './ai';
import { createNotification } from './notifications';

export type ModerationAction =
  | 'ai_analyze' | 'ai_flag' | 'ai_approve'
  | 'admin_approve' | 'admin_reject' | 'admin_request_resubmit'
  | 'dealer_reupload' | 'dealer_comment'
  | 'product_published' | 'product_unpublished';

/**
 * Submit a new product image for AI moderation.
 * Creates a product_images record, runs AI analysis, logs the result,
 * and updates the product's moderation_status accordingly.
 */
export async function submitImageForModeration(
  productId: string,
  imageUrl: string,
  declaredName: string,
  category: string,
  dealerId: string,
  dealerName: string,
  existingImages: { url: string; productName: string }[] = [],
): Promise<{ image: ProductImage | null; verdict: AiModerationVerdict; error: string | null }> {
  // Get the current version count for this product
  const { count } = await supabase
    .from('product_images')
    .select('*', { count: 'exact', head: true })
    .eq('product_id', productId);

  const version = (count ?? 0) + 1;

  // Mark previous active images as inactive
  await supabase
    .from('product_images')
    .update({ is_active: false })
    .eq('product_id', productId)
    .eq('is_active', true);

  // Run AI moderation analysis
  const verdict = aiModerateImage(imageUrl, declaredName, category, existingImages);

  // Determine moderation status from verdict
  const moderationStatus =
    verdict.verdict === 'approved' ? 'ai_approved'
    : verdict.verdict === 'rejected' ? 'ai_flagged'
    : 'ai_flagged';

  // Insert the product_images record
  const { data: image, error } = await supabase
    .from('product_images')
    .insert({
      product_id: productId,
      image_url: imageUrl,
      version,
      ai_verdict: verdict.verdict,
      ai_confidence: verdict.confidence,
      ai_flags: verdict.flags,
      ai_detected_product: verdict.detectedProduct,
      ai_detected_brand: verdict.detectedBrand,
      ai_detected_category: verdict.detectedCategory,
      ai_detected_color: verdict.detectedColor,
      ai_description: verdict.description,
      ai_tags: verdict.tags,
      ai_warning: verdict.warning,
      moderation_status: moderationStatus,
    })
    .select('*')
    .maybeSingle();

  if (error) return { image: null, verdict, error: error.message };

  // Log the AI analysis action
  await logModerationAction({
    product_id: productId,
    product_image_id: image?.id ?? null,
    action: verdict.verdict === 'approved' ? 'ai_approve' : 'ai_flag',
    actor_type: 'ai',
    actor_id: 'ai-engine',
    actor_name: 'AI Moderation Engine',
    verdict: verdict.verdict,
    flags: verdict.flags,
    confidence: verdict.confidence,
    notes: verdict.summary,
    image_url: imageUrl,
    image_version: version,
    metadata: { detectedProduct: verdict.detectedProduct, detectedBrand: verdict.detectedBrand },
  });

  // Update product moderation_status
  const productStatus = verdict.verdict === 'approved' ? 'approved' : 'flagged';
  await supabase
    .from('products')
    .update({ moderation_status: productStatus })
    .eq('id', productId);

  // Log product status change
  if (productStatus === 'approved') {
    await logModerationAction({
      product_id: productId,
      action: 'product_published',
      actor_type: 'system',
      actor_id: 'system',
      actor_name: 'System',
      verdict: 'approved',
      notes: 'Product automatically published after AI approval.',
    });
  } else {
    await logModerationAction({
      product_id: productId,
      action: 'product_unpublished',
      actor_type: 'system',
      actor_id: 'system',
      actor_name: 'System',
      verdict: 'flagged',
      notes: 'Product held for review due to AI flags.',
    });
  }

  return { image, verdict, error: null };
}

/**
 * Admin approves a flagged image — overrides AI flags.
 */
export async function adminApproveImage(
  imageId: string,
  productId: string,
  adminEmail: string,
  notes: string,
): Promise<{ error: string | null }> {
  const { error: imgError } = await supabase
    .from('product_images')
    .update({
      moderation_status: 'admin_approved',
      admin_notes: notes,
      reviewed_by: adminEmail,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', imageId);

  if (imgError) return { error: imgError.message };

  await supabase.from('products').update({ moderation_status: 'approved' }).eq('id', productId);

  await logModerationAction({
    product_id: productId,
    product_image_id: imageId,
    action: 'admin_approve',
    actor_type: 'admin',
    actor_id: adminEmail,
    actor_name: adminEmail,
    verdict: 'approved',
    notes,
  });

  await logModerationAction({
    product_id: productId,
    action: 'product_published',
    actor_type: 'system',
    actor_id: 'system',
    actor_name: 'System',
    verdict: 'approved',
    notes: 'Product published after admin approval.',
  });

  return { error: null };
}

/**
 * Admin rejects an image — product stays unpublished.
 */
export async function adminRejectImage(
  imageId: string,
  productId: string,
  adminEmail: string,
  notes: string,
): Promise<{ error: string | null }> {
  const { error: imgError } = await supabase
    .from('product_images')
    .update({
      moderation_status: 'admin_rejected',
      admin_notes: notes,
      reviewed_by: adminEmail,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', imageId);

  if (imgError) return { error: imgError.message };

  await supabase.from('products').update({ moderation_status: 'rejected' }).eq('id', productId);

  await logModerationAction({
    product_id: productId,
    product_image_id: imageId,
    action: 'admin_reject',
    actor_type: 'admin',
    actor_id: adminEmail,
    actor_name: adminEmail,
    verdict: 'rejected',
    notes,
  });

  return { error: null };
}

/**
 * Admin requests resubmission — sets product back to flagged with a note.
 */
export async function adminRequestResubmit(
  imageId: string,
  productId: string,
  adminEmail: string,
  notes: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('product_images')
    .update({
      admin_notes: notes,
      reviewed_by: adminEmail,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', imageId);

  if (error) return { error: error.message };

  await supabase.from('products').update({ moderation_status: 'flagged' }).eq('id', productId);

  await logModerationAction({
    product_id: productId,
    product_image_id: imageId,
    action: 'admin_request_resubmit',
    actor_type: 'admin',
    actor_id: adminEmail,
    actor_name: adminEmail,
    verdict: 'flagged',
    notes,
  });

  return { error: null };
}

/**
 * Dealer re-uploads an image for a flagged product.
 * Creates a new image version, re-runs AI analysis, and logs the action.
 */
export async function dealerReuploadImage(
  productId: string,
  newImageUrl: string,
  declaredName: string,
  category: string,
  dealerId: string,
  dealerName: string,
  comment: string,
  existingImages: { url: string; productName: string }[] = [],
): Promise<{ image: ProductImage | null; verdict: AiModerationVerdict; error: string | null }> {
  // Mark old active image as inactive
  await supabase
    .from('product_images')
    .update({ is_active: false, dealer_comment: comment })
    .eq('product_id', productId)
    .eq('is_active', true);

  // Submit new image for AI moderation (this creates the new version)
  const result = await submitImageForModeration(
    productId,
    newImageUrl,
    declaredName,
    category,
    dealerId,
    dealerName,
    existingImages,
  );

  if (result.error) return result;

  // Log the dealer re-upload action
  await logModerationAction({
    product_id: productId,
    product_image_id: result.image?.id ?? null,
    action: 'dealer_reupload',
    actor_type: 'dealer',
    actor_id: dealerId,
    actor_name: dealerName,
    verdict: result.verdict.verdict,
    flags: result.verdict.flags,
    notes: comment,
    image_url: newImageUrl,
    image_version: result.image?.version,
  });

  // If AI approved the new image, notify dealer
  if (result.verdict.verdict === 'approved') {
    await createNotification({
      customer_id: `dealer-${dealerId}`,
      type: 'moderation_update',
      title: 'Image Approved',
      message: `Your re-uploaded image for "${declaredName}" was approved by AI. Product is now live.`,
      product_id: productId,
      product_name: declaredName,
    });
  }

  return result;
}

/**
 * Dealer adds a comment to a flagged image without re-uploading.
 */
export async function dealerAddComment(
  imageId: string,
  productId: string,
  dealerId: string,
  dealerName: string,
  comment: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('product_images')
    .update({ dealer_comment: comment })
    .eq('id', imageId);

  if (error) return { error: error.message };

  await logModerationAction({
    product_id: productId,
    product_image_id: imageId,
    action: 'dealer_comment',
    actor_type: 'dealer',
    actor_id: dealerId,
    actor_name: dealerName,
    notes: comment,
  });

  return { error: null };
}

/**
 * Fetch the full audit trail for a product (all image versions + all logs).
 */
export async function fetchProductModerationHistory(productId: string): Promise<{
  images: ProductImage[];
  logs: ModerationLog[];
}> {
  const [imagesRes, logsRes] = await Promise.all([
    supabase.from('product_images').select('*').eq('product_id', productId).order('version', { ascending: false }),
    supabase.from('moderation_logs').select('*').eq('product_id', productId).order('created_at', { ascending: false }),
  ]);

  return {
    images: (imagesRes.data as ProductImage[]) ?? [],
    logs: (logsRes.data as ModerationLog[]) ?? [],
  };
}

/**
 * Fetch all products pending moderation (flagged or pending status).
 */
export async function fetchModerationQueue(): Promise<(Product & {
  dealer?: Dealer | null;
  category?: { name: string; slug: string } | null;
  brand?: { name: string } | null;
})[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*, dealer:dealer_id(*, category:business_category_id(*)), category:category_id(*), brand:brand_id(*)')
    .in('moderation_status', ['pending', 'flagged', 'rejected'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch all flagged/pending images for the moderation queue.
 */
export async function fetchFlaggedImages(): Promise<(ProductImage & {
  product?: Product | null;
})[]> {
  const { data, error } = await supabase
    .from('product_images')
    .select('*, product:product_id(*)')
    .in('moderation_status', ['ai_flagged', 'admin_rejected', 'pending'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Generic moderation log inserter.
 */
async function logModerationAction(entry: {
  product_id: string | null;
  product_image_id?: string | null;
  action: ModerationAction;
  actor_type: 'ai' | 'admin' | 'dealer' | 'system';
  actor_id: string;
  actor_name: string;
  verdict?: string | null;
  flags?: string[];
  confidence?: number;
  notes?: string;
  image_url?: string;
  image_version?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await supabase.from('moderation_logs').insert({
    product_id: entry.product_id,
    product_image_id: entry.product_image_id ?? null,
    action: entry.action,
    actor_type: entry.actor_type,
    actor_id: entry.actor_id,
    actor_name: entry.actor_name,
    verdict: entry.verdict ?? null,
    flags: entry.flags ?? [],
    confidence: entry.confidence ?? null,
    notes: entry.notes ?? null,
    image_url: entry.image_url ?? null,
    image_version: entry.image_version ?? null,
    metadata: entry.metadata ?? {},
  });
}
