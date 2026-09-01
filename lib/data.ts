import { supabase, type Product, type Dealer, type Category, type Brand, type Review } from './supabase';

export { supabase };

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function fetchBrands(): Promise<Brand[]> {
  const { data, error } = await supabase.from('brands').select('*').order('name');
  if (error) throw error;
  return data ?? [];
}

export async function fetchDealersByPin(pin: string): Promise<Dealer[]> {
  const { data, error } = await supabase
    .from('dealers')
    .select('*, category:business_category_id(*)')
    .eq('pin_code', pin)
    .eq('status', 'approved')
    .order('rating', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchApprovedDealers(limit?: number): Promise<Dealer[]> {
  let q = supabase
    .from('dealers')
    .select('*, category:business_category_id(*)')
    .eq('status', 'approved')
    .order('rating', { ascending: false });
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function fetchDealerById(id: string): Promise<Dealer | null> {
  const { data, error } = await supabase
    .from('dealers')
    .select('*, category:business_category_id(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchProducts(opts?: {
  categorySlug?: string;
  dealerId?: string;
  pin?: string;
  featured?: boolean;
  trending?: boolean;
  limit?: number;
  search?: string;
}): Promise<Product[]> {
  let q = supabase
    .from('products')
    .select('*, dealer:dealer_id(*, category:business_category_id(*)), category:category_id(*), brand:brand_id(*)')
    .eq('moderation_status', 'approved');
  if (opts?.categorySlug) {
    const { data: cat } = await supabase.from('categories').select('id').eq('slug', opts.categorySlug).maybeSingle();
    if (cat) q = q.eq('category_id', cat.id);
  }
  if (opts?.dealerId) q = q.eq('dealer_id', opts.dealerId);
  if (opts?.featured) q = q.eq('is_featured', true);
  if (opts?.trending) q = q.eq('is_trending', true);
  if (opts?.search) {
    q = q.or(`name.ilike.%${opts.search}%,description.ilike.%${opts.search}%,tags.cs.{${opts.search}}`);
  }
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw error;
  let products = data ?? [];
  if (opts?.pin) {
    const dealers = await fetchDealersByPin(opts.pin);
    const dealerIds = new Set(dealers.map((d) => d.id));
    products = products.filter((p) => p.dealer_id && dealerIds.has(p.dealer_id));
  }
  return products;
}

export async function fetchProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*, dealer:dealer_id(*, category:business_category_id(*)), category:category_id(*), brand:brand_id(*)')
    .eq('id', id)
    .eq('moderation_status', 'approved')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchSimilarProducts(product: Product, limit = 8): Promise<Product[]> {
  if (!product.category_id) return [];
  const { data, error } = await supabase
    .from('products')
    .select('*, dealer:dealer_id(*, category:business_category_id(*)), category:category_id(*), brand:brand_id(*)')
    .eq('category_id', product.category_id)
    .eq('moderation_status', 'approved')
    .neq('id', product.id)
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchProductsByName(name: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*, dealer:dealer_id(*, category:business_category_id(*)), category:category_id(*), brand:brand_id(*)')
    .eq('moderation_status', 'approved')
    .ilike('name', `%${name}%`);
  if (error) throw error;
  return data ?? [];
}

export async function fetchReviewsByDealer(dealerId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('dealer_id', dealerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchAllDealers(): Promise<Dealer[]> {
  const { data, error } = await supabase
    .from('dealers')
    .select('*, category:business_category_id(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchAllProducts(limit = 100): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*, dealer:dealer_id(*, category:business_category_id(*)), category:category_id(*), brand:brand_id(*)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchSearchLogs() {
  const { data, error } = await supabase
    .from('search_logs')
    .select('*, category:category_id(*)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}
