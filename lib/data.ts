import type { Product, Dealer, Category, Brand, Review } from './types';
import {
  getDbCategories,
  getDbBrands,
  getDbDealers,
  getDbDealerById,
  getDbProducts,
  getDbProductById,
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
  return [
    {
      id: 'rev-1',
      dealer_id: dealerId,
      product_id: null,
      customer_name: 'Aditya Varma',
      rating: 5,
      quality_rating: 5,
      cleanliness_rating: 5,
      behavior_rating: 5,
      price_rating: 5,
      availability_rating: 5,
      delivery_rating: 5,
      comment: 'Excellent shop! Very transparent pricing, and they gave instant demo and doorstep delivery.',
      created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      id: 'rev-2',
      dealer_id: dealerId,
      product_id: null,
      customer_name: 'Pooja Reddy',
      rating: 5,
      quality_rating: 5,
      cleanliness_rating: 4,
      behavior_rating: 5,
      price_rating: 4,
      availability_rating: 5,
      delivery_rating: 5,
      comment: 'Genuine brand warranty provided. Owner was courteous and explained all specs thoroughly.',
      created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    },
  ];
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
