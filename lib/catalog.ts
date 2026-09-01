import { supabase, type Product, type DealerInventory, type Category, type Brand } from './supabase';
import { aiAnalyzeImage, aiGenerateProduct, productSimilarity, type AiGeneratedProduct } from './ai';

// ============================================================
// Admin Master Catalog CRUD
// ============================================================

export type CatalogProductInput = {
  name: string;
  slug?: string;
  brand_id?: string | null;
  category_id?: string | null;
  subcategory_id?: string | null;
  model?: string | null;
  sku?: string | null;
  barcode?: string | null;
  description?: string | null;
  specifications?: Record<string, string>;
  features?: string[];
  price: number;
  discount_price?: number | null;
  color?: string | null;
  size?: string | null;
  weight?: string | null;
  material?: string | null;
  warranty?: string | null;
  tags?: string[];
  images?: string[];
  video_url?: string | null;
  is_featured?: boolean;
  is_trending?: boolean;
  is_active?: boolean;
  variants?: { sizes?: string[]; colors?: string[]; models?: string[] };
};

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function createCatalogProduct(input: CatalogProductInput): Promise<{ product: Product | null; error: string | null }> {
  const slug = input.slug || slugify(input.name);
  const { data, error } = await supabase
    .from('products')
    .insert({
      name: input.name,
      slug,
      brand_id: input.brand_id ?? null,
      category_id: input.category_id ?? null,
      subcategory_id: input.subcategory_id ?? null,
      model: input.model ?? null,
      sku: input.sku ?? null,
      barcode: input.barcode ?? null,
      description: input.description ?? null,
      specifications: input.specifications ?? {},
      features: input.features ?? [],
      price: input.price,
      discount_price: input.discount_price ?? null,
      color: input.color ?? null,
      size: input.size ?? null,
      weight: input.weight ?? null,
      material: input.material ?? null,
      warranty: input.warranty ?? null,
      tags: input.tags ?? [],
      images: input.images ?? [],
      video_url: input.video_url ?? null,
      is_featured: input.is_featured ?? false,
      is_trending: input.is_trending ?? false,
      is_active: input.is_active ?? true,
      is_master: true,
      variants: input.variants ?? {},
      moderation_status: 'approved',
      stock_status: 'in_stock',
    })
    .select('*, category:category_id(*), brand:brand_id(*), subcategory:subcategory_id(*)')
    .maybeSingle();

  if (error) return { product: null, error: error.message };
  return { product: data as Product, error: null };
}

export async function updateCatalogProduct(id: string, input: Partial<CatalogProductInput>): Promise<{ error: string | null }> {
  const update: Record<string, unknown> = {};
  if (input.name !== undefined) { update.name = input.name; update.slug = input.slug || slugify(input.name); }
  if (input.brand_id !== undefined) update.brand_id = input.brand_id;
  if (input.category_id !== undefined) update.category_id = input.category_id;
  if (input.subcategory_id !== undefined) update.subcategory_id = input.subcategory_id;
  if (input.model !== undefined) update.model = input.model;
  if (input.sku !== undefined) update.sku = input.sku;
  if (input.barcode !== undefined) update.barcode = input.barcode;
  if (input.description !== undefined) update.description = input.description;
  if (input.specifications !== undefined) update.specifications = input.specifications;
  if (input.features !== undefined) update.features = input.features;
  if (input.price !== undefined) update.price = input.price;
  if (input.discount_price !== undefined) update.discount_price = input.discount_price;
  if (input.color !== undefined) update.color = input.color;
  if (input.size !== undefined) update.size = input.size;
  if (input.weight !== undefined) update.weight = input.weight;
  if (input.material !== undefined) update.material = input.material;
  if (input.warranty !== undefined) update.warranty = input.warranty;
  if (input.tags !== undefined) update.tags = input.tags;
  if (input.images !== undefined) update.images = input.images;
  if (input.video_url !== undefined) update.video_url = input.video_url;
  if (input.is_featured !== undefined) update.is_featured = input.is_featured;
  if (input.is_trending !== undefined) update.is_trending = input.is_trending;
  if (input.is_active !== undefined) update.is_active = input.is_active;
  if (input.variants !== undefined) update.variants = input.variants;

  const { error } = await supabase.from('products').update(update).eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteCatalogProduct(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  return { error: error?.message ?? null };
}

export async function toggleProductActive(id: string, active: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.from('products').update({ is_active: active }).eq('id', id);
  return { error: error?.message ?? null };
}

export async function fetchMasterCatalog(opts?: {
  search?: string;
  categorySlug?: string;
  brandId?: string;
  includeInactive?: boolean;
}): Promise<Product[]> {
  let q = supabase
    .from('products')
    .select('*, category:category_id(*), brand:brand_id(*), subcategory:subcategory_id(*)')
    .eq('is_master', true);

  if (!opts?.includeInactive) q = q.eq('is_active', true);
  if (opts?.categorySlug) q = q.eq('category.slug', opts.categorySlug);
  if (opts?.brandId) q = q.eq('brand_id', opts.brandId);
  if (opts?.search) q = q.ilike('name', `%${opts.search}%`);

  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw error;
  return (data as Product[]) ?? [];
}

export async function fetchMasterCatalogForAdmin(): Promise<Product[]> {
  return fetchMasterCatalog({ includeInactive: true });
}

export async function fetchCatalogProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*, category:category_id(*), brand:brand_id(*), subcategory:subcategory_id(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Product | null;
}

// ============================================================
// AI-powered product creation from image
// ============================================================

export async function analyzeImageForCatalog(imageUrl: string, declaredName?: string): Promise<{
  detectedProduct: string;
  detectedBrand: string | null;
  detectedCategory: string | null;
  description: string;
  tags: string[];
  suggestedPrice: number;
  confidence: number;
}> {
  const result = aiAnalyzeImage(imageUrl, declaredName);
  return {
    detectedProduct: result.detectedProduct,
    detectedBrand: result.detectedBrand,
    detectedCategory: result.detectedCategory,
    description: result.generatedDescription,
    tags: result.generatedTags,
    suggestedPrice: Math.round((result.confidence * 5000 + 500) / 50) * 50,
    confidence: result.confidence,
  };
}

// ============================================================
// Categories & Brands management
// ============================================================

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return (data as Category[]) ?? [];
}

export async function fetchBrands(): Promise<Brand[]> {
  const { data, error } = await supabase.from('brands').select('*').order('name', { ascending: true });
  if (error) throw error;
  return (data as Brand[]) ?? [];
}

export async function createCategory(name: string, icon: string = 'Tag', parentId?: string | null): Promise<{ category: Category | null; error: string | null }> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ name, slug: slugify(name), icon, parent_id: parentId ?? null })
    .select('*')
    .maybeSingle();
  if (error) return { category: null, error: error.message };
  return { category: data as Category, error: null };
}

export async function createBrand(name: string, logoUrl?: string): Promise<{ brand: Brand | null; error: string | null }> {
  const { data, error } = await supabase
    .from('brands')
    .insert({ name, slug: slugify(name), logo_url: logoUrl ?? null })
    .select('*')
    .maybeSingle();
  if (error) return { brand: null, error: error.message };
  return { brand: data as Brand, error: null };
}

// ============================================================
// Dealer Inventory Management
// ============================================================

export type DealerInventoryInput = {
  product_id: string;
  price: number;
  discount_price?: number | null;
  stock_qty: number;
  stock_status?: 'in_stock' | 'out_of_stock' | 'limited';
  available_colors?: string[];
  available_sizes?: string[];
  available_models?: string[];
  condition?: 'new' | 'used' | 'refurbished' | 'open_box';
  warranty?: string | null;
  images?: string[];
};

export async function addProductToInventory(
  dealerId: string,
  input: DealerInventoryInput,
): Promise<{ inventory: DealerInventory | null; error: string | null }> {
  const { data, error } = await supabase
    .from('dealer_inventory')
    .insert({
      dealer_id: dealerId,
      product_id: input.product_id,
      price: input.price,
      discount_price: input.discount_price ?? null,
      stock_qty: input.stock_qty,
      stock_status: input.stock_status ?? (input.stock_qty > 0 ? 'in_stock' : 'out_of_stock'),
      available_colors: input.available_colors ?? [],
      available_sizes: input.available_sizes ?? [],
      available_models: input.available_models ?? [],
      condition: input.condition ?? 'new',
      warranty: input.warranty ?? null,
      images: input.images ?? [],
      is_active: true,
      moderation_status: 'approved',
    })
    .select('*, product:product_id(*), dealer:dealer_id(*)')
    .maybeSingle();

  if (error) return { inventory: null, error: error.message };

  // Update dealer's product_count
  const { count } = await supabase
    .from('dealer_inventory')
    .select('*', { count: 'exact', head: true })
    .eq('dealer_id', dealerId)
    .eq('is_active', true);
  await supabase.from('dealers').update({ product_count: count ?? 0 }).eq('id', dealerId);

  return { inventory: data as DealerInventory, error: null };
}

export async function updateDealerInventory(
  id: string,
  input: Partial<DealerInventoryInput>,
): Promise<{ error: string | null }> {
  const update: Record<string, unknown> = {};
  if (input.price !== undefined) update.price = input.price;
  if (input.discount_price !== undefined) update.discount_price = input.discount_price;
  if (input.stock_qty !== undefined) update.stock_qty = input.stock_qty;
  if (input.stock_status !== undefined) update.stock_status = input.stock_status;
  if (input.available_colors !== undefined) update.available_colors = input.available_colors;
  if (input.available_sizes !== undefined) update.available_sizes = input.available_sizes;
  if (input.available_models !== undefined) update.available_models = input.available_models;
  if (input.condition !== undefined) update.condition = input.condition;
  if (input.warranty !== undefined) update.warranty = input.warranty;
  if (input.images !== undefined) update.images = input.images;

  update.updated_at = new Date().toISOString();

  const { error } = await supabase.from('dealer_inventory').update(update).eq('id', id);
  return { error: error?.message ?? null };
}

export async function removeDealerInventory(id: string, dealerId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('dealer_inventory').delete().eq('id', id).eq('dealer_id', dealerId);
  if (error) return { error: error.message };

  // Update dealer's product_count
  const { count } = await supabase
    .from('dealer_inventory')
    .select('*', { count: 'exact', head: true })
    .eq('dealer_id', dealerId)
    .eq('is_active', true);
  await supabase.from('dealers').update({ product_count: count ?? 0 }).eq('id', dealerId);

  return { error: null };
}

export async function toggleInventoryActive(id: string, active: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.from('dealer_inventory').update({ is_active: active, updated_at: new Date().toISOString() }).eq('id', id);
  return { error: error?.message ?? null };
}

export async function fetchDealerInventory(dealerId: string): Promise<DealerInventory[]> {
  const { data, error } = await supabase
    .from('dealer_inventory')
    .select('*, product:product_id(*, category:category_id(*), brand:brand_id(*)), dealer:dealer_id(*)')
    .eq('dealer_id', dealerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as DealerInventory[]) ?? [];
}

export async function fetchDealerInventoryForProduct(productId: string): Promise<DealerInventory[]> {
  const { data, error } = await supabase
    .from('dealer_inventory')
    .select('*, product:product_id(*), dealer:dealer_id(*)')
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('price', { ascending: true });
  if (error) throw error;
  return (data as DealerInventory[]) ?? [];
}

/**
 * Check which products a dealer already has in their inventory.
 * Returns a Set of product_ids.
 */
export async function fetchDealerInventoryProductIds(dealerId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('dealer_inventory')
    .select('product_id')
    .eq('dealer_id', dealerId);
  if (error) return new Set();
  return new Set((data ?? []).map((r) => r.product_id));
}

// ============================================================
// Analytics: most selected / most searched products
// ============================================================

export async function fetchCatalogAnalytics(): Promise<{
  totalProducts: number;
  activeProducts: number;
  totalListings: number;
  topSelected: { product: Product; listingCount: number }[];
  topSearched: Product[];
}> {
  const [prodRes, activeRes, listingRes] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_master', true),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_master', true).eq('is_active', true),
    supabase.from('dealer_inventory').select('*', { count: 'exact', head: true }).eq('is_active', true),
  ]);

  // Top selected: count dealer_inventory per product
  const { data: listingCounts } = await supabase
    .from('dealer_inventory')
    .select('product_id, product:product_id(*, category:category_id(*), brand:brand_id(*))')
    .eq('is_active', true);

  const productCounts = new Map<string, { product: Product; count: number }>();
  for (const row of (listingCounts as any[]) ?? []) {
    const pid = row.product_id as string;
    const prod = (Array.isArray(row.product) ? row.product[0] : row.product) as Product;
    const existing = productCounts.get(pid);
    if (existing) existing.count++;
    else productCounts.set(pid, { product: prod, count: 1 });
  }
  const topSelected = Array.from(productCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((v) => ({ product: v.product, listingCount: v.count }));

  // Top searched
  const { data: searched } = await supabase
    .from('products')
    .select('*, category:category_id(*), brand:brand_id(*)')
    .eq('is_master', true)
    .order('search_count', { ascending: false })
    .limit(10);

  return {
    totalProducts: prodRes.count ?? 0,
    activeProducts: activeRes.count ?? 0,
    totalListings: listingRes.count ?? 0,
    topSelected,
    topSearched: (searched as Product[]) ?? [],
  };
}

// ============================================================
// AI-Powered Product Creation from name only
// ============================================================

export type AiProductCreateInput = {
  name: string;
  imageUrl?: string | null;
};

export type AiProductCreateResult = {
  product: Product | null;
  generated: AiGeneratedProduct | null;
  error: string | null;
};

export async function checkDuplicateProduct(name: string): Promise<{ similar: Product[] | null }> {
  const { data, error } = await supabase
    .from('products')
    .select('*, category:category_id(*), brand:brand_id(*)')
    .eq('is_master', true);
  if (error || !data) return { similar: null };
  const products = data as Product[];
  const similar = products.filter((p) => productSimilarity(p.name, name) >= 0.5);
  return { similar: similar.length > 0 ? similar : null };
}

export async function createProductWithAI(input: AiProductCreateInput): Promise<AiProductCreateResult> {
  const generated = aiGenerateProduct(input.name);
  const slug = slugify(input.name);

  // Try to match category and brand from existing records
  let categoryId: string | null = null;
  let brandId: string | null = null;

  if (generated.category) {
    const { data: cats } = await supabase.from('categories').select('id, name').ilike('name', `%${generated.category}%`).limit(1);
    if (cats && cats.length > 0) categoryId = cats[0].id;
  }
  if (generated.brand) {
    const { data: brands } = await supabase.from('brands').select('id, name').ilike('name', `%${generated.brand}%`).limit(1);
    if (brands && brands.length > 0) brandId = brands[0].id;
  }

  const insertData: Record<string, unknown> = {
    name: generated.name,
    slug,
    brand_id: brandId,
    category_id: categoryId,
    description: generated.description,
    short_description: generated.short_description,
    specifications: generated.specifications,
    features: generated.features,
    model_number: generated.model_number,
    keywords: generated.keywords,
    tags: generated.tags,
    seo_title: generated.seo_title,
    seo_description: generated.seo_description,
    price: 0,
    images: input.imageUrl ? [input.imageUrl] : [],
    is_master: true,
    is_active: false,
    ai_verified: true,
    ai_description: generated.description,
    ai_tags: generated.tags,
    ai_confidence: generated.confidence,
    ai_status: 'generated',
    moderation_status: 'pending',
    stock_status: 'in_stock',
    variants: {},
  };

  const { data, error } = await supabase
    .from('products')
    .insert(insertData)
    .select('*, category:category_id(*), brand:brand_id(*), subcategory:subcategory_id(*)')
    .maybeSingle();

  if (error) return { product: null, generated: null, error: error.message };
  return { product: data as Product, generated, error: null };
}

export async function bulkCreateProductsWithAI(
  names: string[],
  onProgress?: (completed: number, total: number, name: string, success: boolean) => void,
): Promise<{ results: { name: string; product: Product | null; error: string | null }[] }> {
  const results: { name: string; product: Product | null; error: string | null }[] = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i].trim();
    if (!name) { onProgress?.(i + 1, names.length, name, false); continue; }
    try {
      const { product, error } = await createProductWithAI({ name });
      results.push({ name, product, error });
      onProgress?.(i + 1, names.length, name, !error);
    } catch (e: any) {
      results.push({ name, product: null, error: e.message ?? 'Failed' });
      onProgress?.(i + 1, names.length, name, false);
    }
  }
  return { results };
}

export async function regenerateProductAI(id: string): Promise<{ generated: AiGeneratedProduct | null; error: string | null }> {
  const { data: product, error: fetchError } = await supabase.from('products').select('name').eq('id', id).maybeSingle();
  if (fetchError || !product) return { generated: null, error: 'Product not found' };

  const generated = aiGenerateProduct(product.name);

  let categoryId: string | null = null;
  let brandId: string | null = null;
  if (generated.category) {
    const { data: cats } = await supabase.from('categories').select('id, name').ilike('name', `%${generated.category}%`).limit(1);
    if (cats && cats.length > 0) categoryId = cats[0].id;
  }
  if (generated.brand) {
    const { data: brands } = await supabase.from('brands').select('id, name').ilike('name', `%${generated.brand}%`).limit(1);
    if (brands && brands.length > 0) brandId = brands[0].id;
  }

  const { error } = await supabase.from('products').update({
    description: generated.description,
    short_description: generated.short_description,
    specifications: generated.specifications,
    features: generated.features,
    model_number: generated.model_number,
    keywords: generated.keywords,
    tags: generated.tags,
    seo_title: generated.seo_title,
    seo_description: generated.seo_description,
    brand_id: brandId,
    category_id: categoryId,
    ai_description: generated.description,
    ai_tags: generated.tags,
    ai_confidence: generated.confidence,
    ai_status: 'generated',
  }).eq('id', id);

  if (error) return { generated: null, error: error.message };
  return { generated, error: null };
}

export async function approveProduct(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('products').update({
    is_active: true,
    ai_status: 'approved',
    moderation_status: 'approved',
  }).eq('id', id);
  return { error: error?.message ?? null };
}

export async function updateProductImage(id: string, imageUrl: string): Promise<{ error: string | null }> {
  const { data: product } = await supabase.from('products').select('images').eq('id', id).maybeSingle();
  const existingImages = (product as any)?.images ?? [];
  const { error } = await supabase.from('products').update({
    images: [imageUrl, ...existingImages],
  }).eq('id', id);
  return { error: error?.message ?? null };
}

// ============================================================
// Quick Add - one-click dealer inventory
// ============================================================

export async function quickAddToInventory(
  dealerId: string,
  productId: string,
): Promise<{ inventory: DealerInventory | null; error: string | null }> {
  // Check if already exists
  const { data: existing } = await supabase
    .from('dealer_inventory')
    .select('id')
    .eq('dealer_id', dealerId)
    .eq('product_id', productId)
    .maybeSingle();

  if (existing) {
    // Re-activate if inactive
    const { data, error } = await supabase
      .from('dealer_inventory')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', (existing as any).id)
      .select('*, product:product_id(*), dealer:dealer_id(*)')
      .maybeSingle();
    if (error) return { inventory: null, error: error.message };
    return { inventory: data as DealerInventory, error: null };
  }

  const { data, error } = await supabase
    .from('dealer_inventory')
    .insert({
      dealer_id: dealerId,
      product_id: productId,
      price: 0,
      stock_qty: 0,
      stock_status: 'in_stock',
      available_colors: [],
      available_sizes: [],
      available_models: [],
      condition: 'new',
      warranty: null,
      images: [],
      delivery_available: false,
      pickup_available: false,
      is_active: true,
      moderation_status: 'approved',
    })
    .select('*, product:product_id(*), dealer:dealer_id(*)')
    .maybeSingle();

  if (error) return { inventory: null, error: error.message };

  const { count } = await supabase
    .from('dealer_inventory')
    .select('*', { count: 'exact', head: true })
    .eq('dealer_id', dealerId)
    .eq('is_active', true);
  await supabase.from('dealers').update({ product_count: count ?? 0 }).eq('id', dealerId);

  return { inventory: data as DealerInventory, error: null };
}

export async function bulkQuickAddToInventory(
  dealerId: string,
  productIds: string[],
): Promise<{ added: number; errors: string[] }> {
  let added = 0;
  const errors: string[] = [];

  for (const productId of productIds) {
    const { error } = await quickAddToInventory(dealerId, productId);
    if (error) errors.push(error);
    else added++;
  }

  return { added, errors };
}

// ============================================================
// AI-powered fuzzy search for products (partial names, misspellings)
// ============================================================

export async function aiSearchCatalog(query: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*, category:category_id(*), brand:brand_id(*), subcategory:subcategory_id(*)')
    .eq('is_master', true)
    .eq('is_active', true);

  if (error || !data) return [];

  const products = data as Product[];
  const q = query.toLowerCase().trim();
  if (!q) return products;

  return products
    .map((p) => {
      const haystack = `${p.name} ${p.brand?.name ?? ''} ${p.category?.name ?? ''} ${p.tags.join(' ')} ${p.keywords?.join(' ') ?? ''} ${p.model_number ?? ''} ${p.model ?? ''}`.toLowerCase();
      let score = 0;
      const qTokens = q.split(/\s+/).filter(Boolean);
      for (const token of qTokens) {
        if (p.name.toLowerCase().includes(token)) score += 5;
        if (haystack.includes(token)) score += 2;
        if (p.brand?.name?.toLowerCase().includes(token)) score += 3;
        if (p.keywords?.some((k) => k.includes(token))) score += 2;
      }
      if (productSimilarity(p.name, query) > 0.3) score += 4;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.p);
}
