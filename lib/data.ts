import type { Product, Dealer, Category, Brand, Review } from './types';
import {
  getDbCategories,
  getDbBrands,
  getDbDealers,
  getDbDealerById,
  getDbProducts,
  getDbProductById,
  getDbReviews,
} from './firebase-db';
import { supabase } from './supabase';

export { supabase };

export async function fetchCategories(): Promise<Category[]> {
  try {
    return await getDbCategories();
  } catch {
    return [];
  }
}

export async function fetchBrands(): Promise<Brand[]> {
  try {
    return await getDbBrands();
  } catch {
    return [];
  }
}

export async function fetchDealersByPin(pin: string): Promise<Dealer[]> {
  try {
    const dealers = await getDbDealers();
    return dealers.filter((d) => d.pin_code === pin && d.status === 'approved');
  } catch {
    return [];
  }
}

export async function fetchApprovedDealers(limit?: number): Promise<Dealer[]> {
  try {
    const dealers = await getDbDealers();
    const approved = dealers.filter((d) => d.status === 'approved');
    return limit ? approved.slice(0, limit) : approved;
  } catch {
    return [];
  }
}

export async function fetchDealerById(id: string): Promise<Dealer | null> {
  try {
    return await getDbDealerById(id);
  } catch {
    return null;
  }
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
  try {
    let products = await getDbProducts(opts);
    if (opts?.pin) {
      const dealers = await fetchDealersByPin(opts.pin);
      const dealerIds = new Set(dealers.map((d) => d.id));
      products = products.filter((p) => p.dealer_id && dealerIds.has(p.dealer_id));
    }
    return products;
  } catch {
    return [];
  }
}

export async function fetchProductById(id: string): Promise<Product | null> {
  try {
    return await getDbProductById(id);
  } catch {
    return null;
  }
}

export async function fetchSimilarProducts(product: Product, limit = 8): Promise<Product[]> {
  try {
    if (!product.category_id) return [];
    const all = await getDbProducts();
    return all.filter((p) => p.category_id === product.category_id && p.id !== product.id).slice(0, limit);
  } catch {
    return [];
  }
}

export async function fetchProductsByName(name: string): Promise<Product[]> {
  try {
    return await getDbProducts({ search: name });
  } catch {
    return [];
  }
}

export async function fetchReviewsByDealer(dealerId: string): Promise<Review[]> {
  return fetchReviewsForDealer(dealerId, false);
}

export async function fetchReviewsForDealer(
  dealerId: string,
  includeHidden = false
): Promise<Review[]> {
  try {
    const all = await getDbReviews();
    return all
      .filter(
        (r) =>
          r.dealer_id === dealerId &&
          (includeHidden || (r.is_approved !== false && !r.is_hidden))
      )
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch {
    return [];
  }
}

export async function fetchReviewsForProduct(
  productId: string,
  _dealerId?: string | null
): Promise<{ reviews: Review[]; canReview: boolean; alreadyReviewed: boolean }> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/reviews?productId=${encodeURIComponent(productId)}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        return {
          reviews: (data.reviews || []) as Review[],
          canReview: Boolean(data.canReview),
          alreadyReviewed: Boolean(data.alreadyReviewed),
        };
      }
    } catch {
      // fall back to local getDbReviews
    }
  }
  const all = await getDbReviews();
  return {
    reviews: all
      .filter((r) => r.product_id === productId && r.is_approved !== false && !r.is_hidden)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    canReview: false,
    alreadyReviewed: false,
  };
}

export async function fetchAllDealers(): Promise<Dealer[]> {
  try {
    return await getDbDealers();
  } catch {
    return [];
  }
}

export async function fetchAllProducts(limit = 100): Promise<Product[]> {
  try {
    return await getDbProducts({ limit });
  } catch {
    return [];
  }
}

export async function fetchSearchLogs() {
  return [];
}
