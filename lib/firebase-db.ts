import { db, auth as firebaseAuth, firebaseConfig } from './firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import type {
  Category,
  CategoryGroup,
  Brand,
  Dealer,
  Product,
  Review,
  Enquiry,
  AppSettings,
  PushNotification,
  CustomerProfile,
  CustomerFavorite,
  CustomerSearchHistory,
  Message,
  Notification,
  ModerationLog,
  DealerApplication,
  DealerApplicationStatus,
} from './types';
import {
  INITIAL_CATEGORIES,
  CATEGORY_GROUPS,
  INITIAL_BRANDS,
  INITIAL_DEALERS,
  INITIAL_PRODUCTS,
  INITIAL_APP_SETTINGS,
} from './seed-data';

// Local storage cache keys
const STORAGE_PREFIX = 'dc_db_';
const KEY_SETTINGS = `${STORAGE_PREFIX}app_settings`;
const KEY_CATEGORIES = `${STORAGE_PREFIX}categories`;
const KEY_BRANDS = `${STORAGE_PREFIX}brands`;
const KEY_DEALERS = `${STORAGE_PREFIX}dealers`;
const KEY_PRODUCTS = `${STORAGE_PREFIX}products`;
const KEY_NOTIFICATIONS = `${STORAGE_PREFIX}notifications`;
const KEY_MESSAGES = `${STORAGE_PREFIX}messages`;
const KEY_FAVORITES = `${STORAGE_PREFIX}favorites`;
const KEY_SEARCH_HISTORY = `${STORAGE_PREFIX}search_history`;
const KEY_REVIEWS = `${STORAGE_PREFIX}reviews`;
const KEY_MODERATION = `${STORAGE_PREFIX}moderation_logs`;
const KEY_ENQUIRIES = `${STORAGE_PREFIX}enquiries`;
const KEY_DEALER_APPLICATIONS = `${STORAGE_PREFIX}dealer_applications`;

// ==================== CROSS-APP REAL-TIME SYNC ====================
export function broadcastSync(
  type: 'products' | 'dealers' | 'categories' | 'brands' | 'enquiries' | 'settings',
  payload?: any
) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent('dc-sync-event', {
        detail: { type, payload, timestamp: Date.now() },
      })
    );
    window.dispatchEvent(new CustomEvent(`dc-${type}-updated`, { detail: payload }));
    localStorage.setItem(
      'dc_sync_signal',
      JSON.stringify({ type, timestamp: Date.now() })
    );
  } catch {}
}

function getLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setLocal<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

const isDemoFirebase =
  !process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
  firebaseConfig.apiKey?.startsWith('AIzaSyDemo') ||
  firebaseConfig.projectId === 'dealerconnectai';

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 2000): Promise<T> {
  // Catch any background failure to avoid unhandled rejection crashes
  promise.catch(() => {});
  let timer: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Firestore timeout')), timeoutMs);
  });
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    timeoutPromise,
  ]);
}

// ==================== APP SETTINGS ====================

export async function getDbAppSettings(): Promise<AppSettings> {
  const local = getLocal<AppSettings>(KEY_SETTINGS, INITIAL_APP_SETTINGS);
  if (typeof window === 'undefined' || isDemoFirebase) return local;

  try {
    const snap = await withTimeout(getDoc(doc(db, 'settings', 'app')));
    if (snap && snap.exists()) {
      const data = snap.data() as AppSettings;
      setLocal(KEY_SETTINGS, data);
      return data;
    }
  } catch {}
  return local;
}

export async function saveDbAppSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getDbAppSettings();
  const updated: AppSettings = {
    ...current,
    ...settings,
    updated_at: new Date().toISOString(),
  };
  setLocal(KEY_SETTINGS, updated);

  if (!isDemoFirebase) {
    try {
      await withTimeout(setDoc(doc(db, 'settings', 'app'), updated, { merge: true }), 3000);
    } catch {}
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dc-settings-updated', { detail: updated }));
  }

  return updated;
}

// ==================== CATEGORIES & GROUPS ====================

export async function getDbCategories(): Promise<Category[]> {
  const local = getLocal<Category[]>(KEY_CATEGORIES, INITIAL_CATEGORIES);
  if (typeof window === 'undefined' || isDemoFirebase) return local;

  try {
    const snap = await withTimeout(getDocs(collection(db, 'categories')));
    if (snap && !snap.empty) {
      const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Category));
      if (list.length >= INITIAL_CATEGORIES.length) {
        setLocal(KEY_CATEGORIES, list);
        return list;
      }
    }
  } catch {}
  return local;
}

export function getDbCategoryGroups(): CategoryGroup[] {
  return CATEGORY_GROUPS;
}

export async function saveDbCategory(category: Category): Promise<void> {
  const list = await getDbCategories();
  const index = list.findIndex((c) => c.id === category.id);
  const updated = index >= 0 ? list.map((c) => (c.id === category.id ? category : c)) : [...list, category];
  setLocal(KEY_CATEGORIES, updated);

  if (!isDemoFirebase) {
    try {
      await withTimeout(setDoc(doc(db, 'categories', category.id), category, { merge: true }), 3000);
    } catch {}
  }
}

// ==================== BRANDS ====================

export async function getDbBrands(): Promise<Brand[]> {
  let local = getLocal<Brand[]>(KEY_BRANDS, INITIAL_BRANDS);
  if (local.length < INITIAL_BRANDS.length) {
    const existingIds = new Set(local.map((b) => b.id));
    const missing = INITIAL_BRANDS.filter((b) => !existingIds.has(b.id));
    local = [...local, ...missing];
    setLocal(KEY_BRANDS, local);
  }
  if (typeof window === 'undefined' || isDemoFirebase) return local;

  try {
    const snap = await withTimeout(getDocs(collection(db, 'brands')));
    if (snap && !snap.empty) {
      const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Brand));
      setLocal(KEY_BRANDS, list);
      return list;
    }
  } catch {}
  return local;
}

// ==================== DEALERS ====================

export async function getDbDealers(): Promise<Dealer[]> {
  const local = getLocal<Dealer[]>(KEY_DEALERS, INITIAL_DEALERS);
  if (typeof window === 'undefined' || isDemoFirebase) return local;

  try {
    const snap = await withTimeout(getDocs(collection(db, 'dealers')));
    if (snap && !snap.empty) {
      const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Dealer));
      setLocal(KEY_DEALERS, list);
      return list;
    }
  } catch {}
  return local;
}

export async function getDbDealerById(id: string): Promise<Dealer | null> {
  const list = await getDbDealers();
  return list.find((d) => d.id === id) ?? null;
}

export async function saveDbDealer(dealer: Dealer): Promise<void> {
  const list = await getDbDealers();
  const index = list.findIndex((d) => d.id === dealer.id);
  const updated = index >= 0 ? list.map((d) => (d.id === dealer.id ? dealer : d)) : [...list, dealer];
  setLocal(KEY_DEALERS, updated);

  if (!isDemoFirebase) {
    try {
      await withTimeout(setDoc(doc(db, 'dealers', dealer.id), dealer, { merge: true }), 3000);
    } catch {}
  }

  broadcastSync('dealers', dealer);
}

export async function deleteDbDealer(id: string): Promise<void> {
  const list = await getDbDealers();
  const updated = list.filter((d) => d.id !== id);
  setLocal(KEY_DEALERS, updated);

  if (!isDemoFirebase) {
    try {
      await withTimeout(deleteDoc(doc(db, 'dealers', id)), 3000);
    } catch {}
  }

  broadcastSync('dealers', { id, deleted: true });
}

// ==================== PRODUCTS ====================

export async function getDbProducts(opts?: {
  categorySlug?: string;
  dealerId?: string;
  pin?: string;
  featured?: boolean;
  trending?: boolean;
  limit?: number;
  search?: string;
  includeUnapproved?: boolean;
}): Promise<Product[]> {
  let list = getLocal<Product[]>(KEY_PRODUCTS, INITIAL_PRODUCTS);
  if (list.length < INITIAL_PRODUCTS.length) {
    const existingIds = new Set(list.map((p) => p.id));
    const missing = INITIAL_PRODUCTS.filter((p) => !existingIds.has(p.id));
    list = [...list, ...missing];
    setLocal(KEY_PRODUCTS, list);
  }

  if (typeof window !== 'undefined' && !isDemoFirebase) {
    try {
      const snap = await withTimeout(getDocs(collection(db, 'products')));
      if (snap && !snap.empty) {
        list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Product));
        setLocal(KEY_PRODUCTS, list);
      }
    } catch {}
  }

  let filtered = [...list];

  if (opts?.categorySlug) {
    const categories = await getDbCategories();
    const cat = categories.find((c) => c.slug === opts.categorySlug);
    if (cat) filtered = filtered.filter((p) => p.category_id === cat.id);
  }

  if (opts?.dealerId) {
    filtered = filtered.filter((p) => p.dealer_id === opts.dealerId);
  } else if (!opts?.includeUnapproved) {
    // Customer browsing: only show approved, active products
    filtered = filtered.filter((p) => {
      if (p.moderation_status === 'pending' || p.moderation_status === 'rejected') return false;
      if (p.is_active === false) return false;
      return true;
    });
  }

  if (opts?.featured) {
    filtered = filtered.filter((p) => p.is_featured);
  }

  if (opts?.trending) {
    filtered = filtered.filter((p) => p.is_trending);
  }

  if (opts?.search) {
    const q = opts.search.toLowerCase().trim();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.tags && p.tags.some((t) => t.toLowerCase().includes(q))) ||
        (p.keywords && p.keywords.some((k) => k.toLowerCase().includes(q)))
    );
  }

  const [dealers, categories, brands] = await Promise.all([
    getDbDealers(),
    getDbCategories(),
    getDbBrands(),
  ]);

  filtered = filtered.map((p) => ({
    ...p,
    dealer: dealers.find((d) => d.id === p.dealer_id) ?? p.dealer ?? null,
    category: categories.find((c) => c.id === p.category_id) ?? p.category ?? null,
    brand: brands.find((b) => b.id === p.brand_id) ?? p.brand ?? null,
  }));

  if (opts?.limit) {
    filtered = filtered.slice(0, opts.limit);
  }

  return filtered;
}

export async function getDbProductById(id: string): Promise<Product | null> {
  const products = await getDbProducts();
  return products.find((p) => p.id === id) ?? null;
}

export async function saveDbProduct(product: Product): Promise<void> {
  const list = getLocal<Product[]>(KEY_PRODUCTS, INITIAL_PRODUCTS);
  const index = list.findIndex((p) => p.id === product.id);
  const updated = index >= 0 ? list.map((p) => (p.id === product.id ? product : p)) : [...list, product];
  setLocal(KEY_PRODUCTS, updated);

  if (!isDemoFirebase) {
    try {
      await withTimeout(setDoc(doc(db, 'products', product.id), product, { merge: true }), 3000);
    } catch {}
  }

  broadcastSync('products', product);
}

export async function deleteDbProduct(id: string): Promise<void> {
  const list = getLocal<Product[]>(KEY_PRODUCTS, INITIAL_PRODUCTS);
  const updated = list.filter((p) => p.id !== id);
  setLocal(KEY_PRODUCTS, updated);

  if (!isDemoFirebase) {
    try {
      await withTimeout(deleteDoc(doc(db, 'products', id)), 3000);
    } catch {}
  }

  broadcastSync('products', { id, deleted: true });
}

// ==================== MESSAGES ====================

export async function getDbMessages(dealerId?: string, customerId?: string): Promise<Message[]> {
  let list = getLocal<Message[]>(KEY_MESSAGES, [
    {
      id: 'msg-welcome-1',
      customer_id: customerId || 'anon',
      dealer_id: 'dealer-1',
      sender_type: 'dealer',
      body: 'Hello! Welcome to Sri Krishna Electronics. Feel free to enquire about live product availability, warranty, or instant doorstep delivery.',
      product_id: 'prod-s24',
      image_url: null,
      is_read: true,
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
  ]);

  if (typeof window !== 'undefined' && !isDemoFirebase) {
    try {
      const snap = await withTimeout(getDocs(collection(db, 'messages')));
      if (snap && !snap.empty) {
        list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Message));
        setLocal(KEY_MESSAGES, list);
      }
    } catch {}
  }

  if (dealerId && customerId) {
    return list.filter((m) => m.dealer_id === dealerId && m.customer_id === customerId);
  }
  if (dealerId) {
    return list.filter((m) => m.dealer_id === dealerId);
  }
  if (customerId) {
    return list.filter((m) => m.customer_id === customerId);
  }
  return list;
}

export async function saveDbMessage(message: Omit<Message, 'id' | 'created_at'>): Promise<Message> {
  const newMsg: Message = {
    ...message,
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    created_at: new Date().toISOString(),
  };

  const list = getLocal<Message[]>(KEY_MESSAGES, []);
  const updated = [...list, newMsg];
  setLocal(KEY_MESSAGES, updated);

  if (!isDemoFirebase) {
    try {
      await withTimeout(setDoc(doc(db, 'messages', newMsg.id), newMsg), 3000);
    } catch {}
  }

  return newMsg;
}

export async function markDbMessagesRead(dealerId: string, customerId: string): Promise<void> {
  const list = getLocal<Message[]>(KEY_MESSAGES, []);
  const updated = list.map((m) =>
    m.dealer_id === dealerId && m.customer_id === customerId ? { ...m, is_read: true } : m
  );
  setLocal(KEY_MESSAGES, updated);
}

// ==================== NOTIFICATIONS ====================

export async function getDbNotifications(): Promise<PushNotification[]> {
  const local = getLocal<PushNotification[]>(KEY_NOTIFICATIONS, [
    {
      id: 'notif-welcome',
      title: 'Welcome to DealerConnect AI',
      body: 'Explore local stores, check live stock, and enjoy premium shopping right near you.',
      target_audience: 'all',
      target_user_ids: null,
      sent_by: 'Admin',
      sent_at: new Date().toISOString(),
      delivery_status: 'sent',
    },
    {
      id: 'notif-festive',
      title: 'Festive Offers in Your Neighborhood!',
      body: 'Get up to 30% OFF on 4K TVs and Inverter Refrigerators at verified local dealerships.',
      target_audience: 'all',
      target_user_ids: null,
      sent_by: 'Admin',
      sent_at: new Date(Date.now() - 7200000).toISOString(),
      delivery_status: 'sent',
    },
  ]);
  if (typeof window === 'undefined' || isDemoFirebase) return local;

  try {
    const snap = await withTimeout(getDocs(collection(db, 'push_notifications')));
    if (snap && !snap.empty) {
      const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as PushNotification));
      setLocal(KEY_NOTIFICATIONS, list);
      return list;
    }
  } catch {}
  return local;
}

export async function sendDbNotification(
  payload: Omit<PushNotification, 'id' | 'sent_at' | 'delivery_status'>
): Promise<PushNotification> {
  const newNotif: PushNotification = {
    ...payload,
    id: `notif-${Date.now()}`,
    sent_at: new Date().toISOString(),
    delivery_status: 'sent',
  };

  const current = await getDbNotifications();
  const updated = [newNotif, ...current];
  setLocal(KEY_NOTIFICATIONS, updated);

  if (!isDemoFirebase) {
    try {
      await withTimeout(setDoc(doc(db, 'push_notifications', newNotif.id), newNotif), 3000);
    } catch {}
  }

  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(newNotif.title, {
        body: newNotif.body,
        icon: '/icons/icon-192x192.png',
      });
    } catch {}
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dc-notification-sent', { detail: newNotif }));
  }

  return newNotif;
}

// ==================== CUSTOMER FAVORITES (WISHLIST) ====================

export async function getDbFavorites(userId: string): Promise<CustomerFavorite[]> {
  const local = getLocal<CustomerFavorite[]>(KEY_FAVORITES, []);
  const userFavorites = local.filter((f) => f.user_id === userId);

  if (typeof window !== 'undefined' && !isDemoFirebase) {
    try {
      const snap = await withTimeout(getDocs(collection(db, 'customer_favorites')));
      if (snap && !snap.empty) {
        const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as CustomerFavorite));
        setLocal(KEY_FAVORITES, list);
        return list.filter((f: any) => f.user_id === userId);
      }
    } catch {}
  }
  return userFavorites;
}

export async function toggleDbFavorite(
  userId: string,
  type: 'product' | 'dealer',
  targetId: string
): Promise<{ isFavorite: boolean }> {
  const list = getLocal<CustomerFavorite[]>(KEY_FAVORITES, []);
  const existingIndex = list.findIndex(
    (f) => f.user_id === userId && f.type === type && (type === 'product' ? f.product_id === targetId : f.dealer_id === targetId)
  );

  if (existingIndex >= 0) {
    const target = list[existingIndex];
    const updated = list.filter((_, i) => i !== existingIndex);
    setLocal(KEY_FAVORITES, updated);
    if (!isDemoFirebase) {
      try {
        await withTimeout(deleteDoc(doc(db, 'customer_favorites', target.id)), 2000);
      } catch {}
    }
    return { isFavorite: false };
  } else {
    const newFav: CustomerFavorite = {
      id: `fav-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      user_id: userId,
      type,
      product_id: type === 'product' ? targetId : null,
      dealer_id: type === 'dealer' ? targetId : null,
      created_at: new Date().toISOString(),
    };
    const updated = [...list, newFav];
    setLocal(KEY_FAVORITES, updated);
    if (!isDemoFirebase) {
      try {
        await withTimeout(setDoc(doc(db, 'customer_favorites', newFav.id), newFav), 2000);
      } catch {}
    }
    return { isFavorite: true };
  }
}

// ==================== SEARCH HISTORY ====================

export async function getDbSearchHistory(userId: string): Promise<CustomerSearchHistory[]> {
  const local = getLocal<CustomerSearchHistory[]>(KEY_SEARCH_HISTORY, []);
  return local.filter((h) => h.user_id === userId);
}

export async function saveDbSearchHistory(
  userId: string,
  queryText: string,
  options: {
    searchType?: 'text' | 'ai' | 'image' | 'voice';
    pinCode?: string | null;
    locationLabel?: string | null;
    resultsCount?: number;
  } = {}
): Promise<void> {
  const newHistory: CustomerSearchHistory = {
    id: `sh-${Date.now()}`,
    user_id: userId,
    query: queryText,
    search_type: options.searchType || 'text',
    pin_code: options.pinCode || null,
    location_label: options.locationLabel || null,
    results_count: options.resultsCount || 0,
    created_at: new Date().toISOString(),
  };

  const list = getLocal<CustomerSearchHistory[]>(KEY_SEARCH_HISTORY, []);
  const updated = [newHistory, ...list.filter((x) => x.query.toLowerCase() !== queryText.toLowerCase())].slice(0, 20);
  setLocal(KEY_SEARCH_HISTORY, updated);

  if (!isDemoFirebase) {
    try {
      await withTimeout(setDoc(doc(db, 'customer_search_history', newHistory.id), newHistory), 2000);
    } catch {}
  }
}

// ==================== REVIEWS ====================

export async function getDbReviews(): Promise<Review[]> {
  const local = getLocal<Review[]>(KEY_REVIEWS, [
    {
      id: 'rev-1',
      dealer_id: 'dealer-1',
      product_id: 'prod-s24',
      customer_name: 'Aditya Varma',
      rating: 5,
      quality_rating: 5,
      cleanliness_rating: 5,
      behavior_rating: 5,
      price_rating: 5,
      availability_rating: 5,
      delivery_rating: 5,
      comment: 'Excellent shop! Very transparent pricing and they provided instant doorstep delivery and live demo.',
      created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      is_approved: true,
    },
    {
      id: 'rev-2',
      dealer_id: 'dealer-2',
      product_id: 'prod-lg-fridge',
      customer_name: 'Pooja Reddy',
      rating: 5,
      quality_rating: 5,
      cleanliness_rating: 4,
      behavior_rating: 5,
      price_rating: 4,
      availability_rating: 5,
      delivery_rating: 5,
      comment: 'Genuine brand warranty card provided. Store owner was very courteous and helped with installation.',
      created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
      is_approved: true,
    },
  ]);
  return local;
}

export async function saveDbReview(review: Review): Promise<void> {
  const list = await getDbReviews();
  const updated = [review, ...list.filter((r) => r.id !== review.id)];
  setLocal(KEY_REVIEWS, updated);

  if (!isDemoFirebase) {
    try {
      await withTimeout(setDoc(doc(db, 'reviews', review.id), review, { merge: true }), 2000);
    } catch {}
  }
}

// ==================== ENQUIRIES ====================

const INITIAL_ENQUIRIES: Enquiry[] = [
  {
    id: 'enq-1',
    dealer_id: 'dealer-1',
    product_id: 'prod-s24',
    customer_name: 'Aditya Varma',
    customer_phone: '+91 98480 12345',
    message: 'Is Samsung Galaxy S24 Ultra in Titanium Gray available for immediate in-store pickup?',
    channel: 'whatsapp',
    created_at: new Date(Date.now() - 15 * 60000).toISOString(),
  },
  {
    id: 'enq-2',
    dealer_id: 'dealer-1',
    product_id: 'prod-bravia',
    customer_name: 'Pooja Reddy',
    customer_phone: '+91 98480 67890',
    message: 'Can you provide free wall-mount installation for the Sony Bravia 55 inch today?',
    channel: 'call',
    created_at: new Date(Date.now() - 45 * 60000).toISOString(),
  },
  {
    id: 'enq-3',
    dealer_id: 'dealer-2',
    product_id: 'prod-drill',
    customer_name: 'Rohan Sharma',
    customer_phone: '+91 98480 34567',
    message: 'Looking for Bosch hammer drill bit set. Do you have replacement warranty?',
    channel: 'form',
    created_at: new Date(Date.now() - 120 * 60000).toISOString(),
  },
];

export async function getDbEnquiries(dealerId?: string): Promise<Enquiry[]> {
  let list = getLocal<Enquiry[]>(KEY_ENQUIRIES, INITIAL_ENQUIRIES);
  if (typeof window !== 'undefined' && !isDemoFirebase) {
    try {
      const snap = await withTimeout(getDocs(collection(db, 'enquiries')));
      if (snap && !snap.empty) {
        list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Enquiry));
        setLocal(KEY_ENQUIRIES, list);
      }
    } catch {}
  }
  if (dealerId) {
    return list.filter((e) => e.dealer_id === dealerId);
  }
  return list;
}

export async function saveDbEnquiry(enquiry: Partial<Enquiry>): Promise<Enquiry> {
  const newEnq: Enquiry = {
    id: enquiry.id || `enq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    dealer_id: enquiry.dealer_id || null,
    product_id: enquiry.product_id || null,
    customer_name: enquiry.customer_name || 'Prospective Customer',
    customer_phone: enquiry.customer_phone || '+91 98480 99999',
    message: enquiry.message || 'Product enquiry',
    channel: enquiry.channel || 'form',
    created_at: enquiry.created_at || new Date().toISOString(),
  };

  const list = getLocal<Enquiry[]>(KEY_ENQUIRIES, INITIAL_ENQUIRIES);
  const idx = list.findIndex((e) => e.id === newEnq.id);
  const updated = idx >= 0 ? list.map((e) => (e.id === newEnq.id ? newEnq : e)) : [newEnq, ...list];
  setLocal(KEY_ENQUIRIES, updated);

  if (!isDemoFirebase) {
    try {
      await withTimeout(setDoc(doc(db, 'enquiries', newEnq.id), newEnq, { merge: true }), 3000);
    } catch {}
  }

  broadcastSync('enquiries', newEnq);
  return newEnq;
}

// ==================== DEALER APPLICATIONS ====================

const INITIAL_DEALER_APPLICATIONS: DealerApplication[] = [
  {
    id: 'APP-2026-8942',
    customer_id: 'cust-demo-1',
    owner_name: 'Suresh Raju',
    phone: '98480 54321',
    email: 'suresh.raju@example.com',
    alt_phone: '98480 54322',
    shop_name: 'Sri Venkateswara Mobile World',
    category_id: 'cat-mobiles',
    category_name: 'Mobiles & Tablets',
    description: 'Premier smartphone and accessories retail showroom in Amalapuram Main Road.',
    logo_url: 'https://images.unsplash.com/photo-1541888946425-d0fbb186f5f8?w=200',
    images: ['https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800'],
    address: 'Shop #4, Clock Tower Complex, Main Road',
    village: null,
    city: 'Amalapuram',
    district: 'Dr. B.R. Ambedkar Konaseema',
    state: 'Andhra Pradesh',
    pin_code: '533201',
    map_lat: 16.5787,
    map_lng: 82.0061,
    whatsapp: '9848054321',
    opening_time: '09:30 AM',
    closing_time: '09:30 PM',
    delivery_available: true,
    delivery_details: 'Free home delivery within 10 km radius',
    gst_number: '37AAAAA0000A1Z5',
    status: 'pending',
    admin_remarks: null,
    rejection_reason: null,
    dealer_password: 'dealer123',
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
];

export async function getDbDealerApplications(): Promise<DealerApplication[]> {
  let list = getLocal<DealerApplication[]>(KEY_DEALER_APPLICATIONS, INITIAL_DEALER_APPLICATIONS);
  if (typeof window !== 'undefined' && !isDemoFirebase) {
    try {
      const snap = await withTimeout(getDocs(collection(db, 'dealer_applications')), 3000);
      if (snap && !snap.empty) {
        list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as DealerApplication));
        setLocal(KEY_DEALER_APPLICATIONS, list);
      }
    } catch {}
  }
  return list;
}

export async function getDbDealerApplicationByCustomerId(customerId: string): Promise<DealerApplication | null> {
  const apps = await getDbDealerApplications();
  return apps.find((a) => a.customer_id === customerId) || null;
}

export async function saveDbDealerApplication(application: DealerApplication): Promise<DealerApplication> {
  let list = await getDbDealerApplications();
  const idx = list.findIndex(
    (a) => a.id === application.id || (application.customer_id && a.customer_id === application.customer_id)
  );

  const saved: DealerApplication = {
    ...application,
    updated_at: new Date().toISOString(),
  };

  if (idx >= 0) {
    list[idx] = saved;
  } else {
    list = [saved, ...list];
  }
  setLocal(KEY_DEALER_APPLICATIONS, list);

  if (typeof window !== 'undefined' && !isDemoFirebase) {
    try {
      await withTimeout(setDoc(doc(db, 'dealer_applications', saved.id), saved, { merge: true }), 3000);
    } catch {}
  }

  // Notify admin about the new or updated application
  try {
    await sendDbNotification({
      title: '📝 Dealer Application Submitted',
      body: `"${saved.shop_name}" by ${saved.owner_name} (${saved.city}). App ID: ${saved.id}.`,
      target_audience: 'dealers',
      target_user_ids: ['admin'],
      sent_by: 'system',
    });
  } catch {}

  broadcastSync('dealers', saved);
  return saved;
}

export async function approveDbDealerApplication(
  appId: string,
  adminRemarks?: string
): Promise<{ success: boolean; dealerId?: string; error?: string }> {
  const apps = await getDbDealerApplications();
  const app = apps.find((a) => a.id === appId);
  if (!app) return { success: false, error: 'Application not found' };

  app.status = 'approved';
  app.admin_remarks = adminRemarks || 'Approved by Administrator. Welcome to DealerConnect AI Merchant Console!';
  app.reviewed_at = new Date().toISOString();
  app.reviewed_by = 'admin';

  // Create or activate Dealer entity in the database
  const dealerId = `dealer-${app.id.replace(/\D/g, '') || Date.now()}`;
  const newDealer: Dealer = {
    id: dealerId,
    shop_name: app.shop_name,
    owner_name: app.owner_name,
    description: app.description || `Verified local shop in ${app.city}. Authorized dealer.`,
    email: app.email.toLowerCase().trim(),
    phone: app.phone.trim(),
    whatsapp: app.whatsapp?.trim() || app.phone.trim(),
    address: app.address,
    village: app.village || null,
    city: app.city,
    district: app.district || null,
    state: app.state,
    pin_code: app.pin_code,
    gst_number: app.gst_number || null,
    logo_url: app.logo_url || 'https://images.unsplash.com/photo-1541888946425-d0fbb186f5f8?w=200',
    banner_url: (app.images && app.images[0]) || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800',
    map_lat: app.map_lat || 16.5787,
    map_lng: app.map_lng || 82.0061,
    working_hours: {
      mon: `${app.opening_time || '9:00 AM'} - ${app.closing_time || '9:00 PM'}`,
      tue: `${app.opening_time || '9:00 AM'} - ${app.closing_time || '9:00 PM'}`,
      wed: `${app.opening_time || '9:00 AM'} - ${app.closing_time || '9:00 PM'}`,
      thu: `${app.opening_time || '9:00 AM'} - ${app.closing_time || '9:00 PM'}`,
      fri: `${app.opening_time || '9:00 AM'} - ${app.closing_time || '9:00 PM'}`,
      sat: `${app.opening_time || '9:00 AM'} - ${app.closing_time || '9:00 PM'}`,
      sun: '10:00 AM - 6:00 PM',
    },
    rating: 5.0,
    rating_count: 1,
    status: 'approved',
    auth_user_id: app.customer_id,
    business_category_id: app.category_id || null,
    delivery_available: app.delivery_available,
    pickup_available: true,
    home_delivery_radius_km: 15,
    product_count: 0,
    view_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    approved_at: new Date().toISOString(),
  };

  await saveDbDealer(newDealer);

  // Set password credentials for dealer login
  const pw = app.dealer_password || 'dealer123';
  if (typeof window !== 'undefined') {
    localStorage.setItem(`dc-dealer-pw-${dealerId}`, pw);
    localStorage.setItem(`dc-dealer-pw-${app.email.toLowerCase().trim()}`, pw);
  }

  await saveDbDealerApplication(app);

  try {
    await sendDbNotification({
      title: '🎉 Dealership Application Approved!',
      body: `Congratulations! Your shop "${app.shop_name}" has been approved. You can now log into the Dealer App with your email ${app.email}.`,
      target_audience: 'specific',
      target_user_ids: [app.customer_id],
      sent_by: 'admin',
    });
  } catch {}

  return { success: true, dealerId };
}

export async function rejectDbDealerApplication(
  appId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const apps = await getDbDealerApplications();
  const app = apps.find((a) => a.id === appId);
  if (!app) return { success: false, error: 'Application not found' };

  app.status = 'rejected';
  app.rejection_reason = reason;
  app.reviewed_at = new Date().toISOString();
  app.reviewed_by = 'admin';

  await saveDbDealerApplication(app);

  try {
    await sendDbNotification({
      title: '⚠️ Dealership Application Status Update',
      body: `Your application for "${app.shop_name}" was reviewed: ${reason}. You may update and resubmit your details from My Profile.`,
      target_audience: 'specific',
      target_user_ids: [app.customer_id],
      sent_by: 'admin',
    });
  } catch {}

  return { success: true };
}

export async function updateDbDealerApplicationStatus(
  appId: string,
  status: DealerApplicationStatus,
  remarks?: string
): Promise<{ success: boolean; error?: string }> {
  if (status === 'approved') {
    return approveDbDealerApplication(appId, remarks);
  }
  if (status === 'rejected') {
    return rejectDbDealerApplication(appId, remarks || 'Application does not meet dealer requirements.');
  }

  const apps = await getDbDealerApplications();
  const app = apps.find((a) => a.id === appId);
  if (!app) return { success: false, error: 'Application not found' };

  app.status = status;
  if (remarks) app.admin_remarks = remarks;
  app.updated_at = new Date().toISOString();

  await saveDbDealerApplication(app);

  if (status === 'more_info_required') {
    try {
      await sendDbNotification({
        title: '📋 More Information Required for Dealer Application',
        body: `Admin requested additional details for "${app.shop_name}": ${remarks || 'Please check and update your application details.'}`,
        target_audience: 'specific',
        target_user_ids: [app.customer_id],
        sent_by: 'admin',
      });
    } catch {}
  }

  return { success: true };
}

// ============================================================
// FLUENT FIRESTORE QUERY BUILDER (Full compatibility adapter)
// ============================================================

export function createFirebaseQueryBuilder(tableName: string) {
  let filterList: Array<{ col: string; val: any; op?: string }> = [];
  let sortField: string | null = null;
  let sortAsc = true;
  let limitCount: number | null = null;

  const builder: any = {
    select: (_fields?: string, _opts?: any) => builder,
    eq: (col: string, val: any) => {
      filterList.push({ col, val, op: '==' });
      return builder;
    },
    neq: (col: string, val: any) => {
      filterList.push({ col, val, op: '!=' });
      return builder;
    },
    in: (col: string, vals: any[]) => {
      filterList.push({ col, val: vals, op: 'in' });
      return builder;
    },
    ilike: (col: string, val: string) => {
      filterList.push({ col, val, op: 'ilike' });
      return builder;
    },
    contains: (col: string, val: any) => {
      filterList.push({ col, val, op: 'contains' });
      return builder;
    },
    order: (field: string, opts?: { ascending?: boolean }) => {
      sortField = field;
      sortAsc = opts?.ascending ?? true;
      return builder;
    },
    limit: (n: number) => {
      limitCount = n;
      return builder;
    },
    maybeSingle: async () => {
      const res = await builder.execute();
      return { data: res[0] ?? null, error: null };
    },
    single: async () => {
      const res = await builder.execute();
      return { data: res[0] ?? null, error: null };
    },
    then: (resolve: (val: { data: any; error: any; count?: number }) => any) => {
      return builder.execute().then((data: any) => resolve({ data, error: null, count: data.length }));
    },
    execute: async (): Promise<any[]> => {
      let items: any[] = [];
      if (tableName === 'products') items = await getDbProducts();
      else if (tableName === 'dealers') items = await getDbDealers();
      else if (tableName === 'categories') items = await getDbCategories();
      else if (tableName === 'brands') items = await getDbBrands();
      else if (tableName === 'messages') items = await getDbMessages();
      else if (tableName === 'notifications' || tableName === 'push_notifications') items = await getDbNotifications();
      else if (tableName === 'reviews') items = await getDbReviews();
      else if (tableName === 'enquiries') items = await getDbEnquiries();
      else if (tableName === 'dealer_applications') items = await getDbDealerApplications();
      else if (tableName === 'customer_favorites') items = getLocal(KEY_FAVORITES, []);
      else if (tableName === 'customer_search_history') items = getLocal(KEY_SEARCH_HISTORY, []);
      else if (tableName === 'moderation_logs') items = getLocal(KEY_MODERATION, []);
      else items = getLocal(`${STORAGE_PREFIX}${tableName}`, []);

      let res = [...items];
      for (const f of filterList) {
        if (f.op === '==' || !f.op) {
          res = res.filter((item) => item[f.col] === f.val);
        } else if (f.op === '!=') {
          res = res.filter((item) => item[f.col] !== f.val);
        } else if (f.op === 'in' && Array.isArray(f.val)) {
          res = res.filter((item) => f.val.includes(item[f.col]));
        } else if (f.op === 'ilike') {
          const cleanPattern = String(f.val).replace(/%/g, '').toLowerCase();
          res = res.filter((item) => String(item[f.col] || '').toLowerCase().includes(cleanPattern));
        } else if (f.op === 'contains') {
          res = res.filter((item) => {
            const arr = item[f.col];
            if (Array.isArray(arr)) {
              return Array.isArray(f.val) ? f.val.some((v) => arr.includes(v)) : arr.includes(f.val);
            }
            return false;
          });
        }
      }

      if (sortField) {
        res.sort((a, b) => {
          const valA = a[sortField!];
          const valB = b[sortField!];
          if (valA < valB) return sortAsc ? -1 : 1;
          if (valA > valB) return sortAsc ? 1 : -1;
          return 0;
        });
      }

      if (limitCount) {
        res = res.slice(0, limitCount);
      }

      return res;
    },
    insert: (data: any) => {
      const items = Array.isArray(data) ? data : [data];
      const promise = (async () => {
        for (const item of items) {
          if (!item.id) item.id = `id-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          if (tableName === 'products') await saveDbProduct(item);
          else if (tableName === 'dealers') await saveDbDealer(item);
          else if (tableName === 'messages') await saveDbMessage(item);
          else if (tableName === 'enquiries') await saveDbEnquiry(item);
          else if (tableName === 'dealer_applications') await saveDbDealerApplication(item);
          else if (tableName === 'customer_favorites') {
            const list = getLocal<any[]>(KEY_FAVORITES, []);
            setLocal(KEY_FAVORITES, [...list, item]);
          } else if (tableName === 'customer_search_history') {
            const list = getLocal<any[]>(KEY_SEARCH_HISTORY, []);
            setLocal(KEY_SEARCH_HISTORY, [...list, item]);
          } else {
            const list = getLocal<any[]>(`${STORAGE_PREFIX}${tableName}`, []);
            setLocal(`${STORAGE_PREFIX}${tableName}`, [...list, item]);
          }
        }
        return { data: items[0], error: null };
      })();

      const insertBuilder: any = promise;
      insertBuilder.select = (_f?: string) => ({
        single: async () => ({ data: items[0], error: null }),
        maybeSingle: async () => ({ data: items[0], error: null }),
        then: (resolve: any) => promise.then(resolve),
      });
      return insertBuilder;
    },
    upsert: (data: any, _opts?: any) => {
      const items = Array.isArray(data) ? data : [data];
      const promise = (async () => {
        for (const item of items) {
          if (!item.id) item.id = item.customer_id || `id-${Date.now()}`;
          const list = getLocal<any[]>(`${STORAGE_PREFIX}${tableName}`, []);
          const idx = list.findIndex((x) => x.id === item.id || (item.customer_id && x.customer_id === item.customer_id));
          if (idx >= 0) list[idx] = { ...list[idx], ...item };
          else list.push(item);
          setLocal(`${STORAGE_PREFIX}${tableName}`, list);
        }
        return { data: items[0], error: null };
      })();
      return promise;
    },
    update: (data: any) => {
      const chain: any = {
        eq: (col: string, val: any) => {
          const promise = (async () => {
            if (tableName === 'products') {
              const list = await getDbProducts();
              for (const item of list) {
                if (item[col as keyof Product] === val) {
                  await saveDbProduct({ ...item, ...data });
                }
              }
            } else if (tableName === 'dealers') {
              const list = await getDbDealers();
              for (const item of list) {
                if (item[col as keyof Dealer] === val) {
                  await saveDbDealer({ ...item, ...data });
                }
              }
            } else if (tableName === 'messages') {
              const list = getLocal<any[]>(KEY_MESSAGES, []);
              const updated = list.map((m) => (m[col] === val ? { ...m, ...data } : m));
              setLocal(KEY_MESSAGES, updated);
            } else if (tableName === 'enquiries') {
              const list = await getDbEnquiries();
              for (const item of list) {
                if ((item as any)[col] === val) {
                  await saveDbEnquiry({ ...item, ...data });
                }
              }
            } else if (tableName === 'dealer_applications') {
              const list = await getDbDealerApplications();
              for (const item of list) {
                if ((item as any)[col] === val) {
                  await saveDbDealerApplication({ ...item, ...data });
                }
              }
            } else {
              const list = getLocal<any[]>(`${STORAGE_PREFIX}${tableName}`, []);
              const updated = list.map((m) => (m[col] === val ? { ...m, ...data } : m));
              setLocal(`${STORAGE_PREFIX}${tableName}`, updated);
            }
            return { error: null };
          })();

          const chainedUpdate: any = promise;
          chainedUpdate.eq = (nextCol: string, nextVal: any) => chain.eq(nextCol, nextVal);
          chainedUpdate.select = () => ({
            single: async () => ({ data, error: null }),
            maybeSingle: async () => ({ data, error: null }),
            then: (resolve: any) => promise.then(resolve),
          });
          return chainedUpdate;
        },
      };
      return chain;
    },
    delete: () => {
      const chain: any = {
        eq: (col: string, val: any) => {
          const promise = (async () => {
            if (tableName === 'products') {
              const list = await getDbProducts();
              for (const item of list) {
                if (item[col as keyof Product] === val) await deleteDbProduct(item.id);
              }
            } else if (tableName === 'dealers') {
              const list = await getDbDealers();
              for (const item of list) {
                if (item[col as keyof Dealer] === val) await deleteDbDealer(item.id);
              }
            } else if (tableName === 'customer_favorites') {
              const list = getLocal<any[]>(KEY_FAVORITES, []);
              setLocal(KEY_FAVORITES, list.filter((x) => x[col] !== val));
            } else {
              const list = getLocal<any[]>(`${STORAGE_PREFIX}${tableName}`, []);
              setLocal(`${STORAGE_PREFIX}${tableName}`, list.filter((x) => x[col] !== val));
            }
            return { error: null };
          })();

          const chainedDelete: any = promise;
          chainedDelete.eq = (nextCol: string, nextVal: any) => chain.eq(nextCol, nextVal);
          return chainedDelete;
        },
      };
      return chain;
    },
  };

  return builder;
}

// ============================================================
// FIREBASE CLIENT ADAPTER
// ============================================================

export const firebaseDb: any = {
  from: (table: string) => createFirebaseQueryBuilder(table),
  auth: {
    resetPasswordForEmail: async (_email: string) => {
      return { error: null };
    },
  },
  storage: {
    from: (_bucket: string) => ({
      upload: async (fileName: string, file: File | Blob) => {
        try {
          const reader = new FileReader();
          return new Promise((resolve) => {
            reader.onload = () => {
              const base64 = reader.result as string;
              if (typeof window !== 'undefined') {
                localStorage.setItem(`dc_upload_${fileName}`, base64);
              }
              resolve({ error: null });
            };
            reader.onerror = () => resolve({ error: new Error('Failed to read file') });
            reader.readAsDataURL(file);
          });
        } catch {
          return { error: null };
        }
      },
      getPublicUrl: (fileName: string) => {
        let publicUrl = 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=500';
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem(`dc_upload_${fileName}`);
          if (saved) publicUrl = saved;
        }
        return { data: { publicUrl } };
      },
    }),
  },
};
