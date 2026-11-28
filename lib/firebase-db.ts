import { apiSync } from './api-sync';
import { getFirebaseDb } from './firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
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
  CustomerFavorite,
  CustomerSearchHistory,
  Message,
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
const KEY_CUSTOMER_NOTIFICATIONS = `${STORAGE_PREFIX}customer_notifications`;
const KEY_MESSAGES = `${STORAGE_PREFIX}messages`;
const KEY_FAVORITES = `${STORAGE_PREFIX}favorites`;
const KEY_SEARCH_HISTORY = `${STORAGE_PREFIX}search_history`;
const KEY_REVIEWS = `${STORAGE_PREFIX}reviews`;
const KEY_MODERATION = `${STORAGE_PREFIX}moderation_logs`;
const KEY_ENQUIRIES = `${STORAGE_PREFIX}enquiries`;
const KEY_DEALER_APPLICATIONS = `${STORAGE_PREFIX}dealer_applications`;
const KEY_PLATFORM_SETTINGS = `${STORAGE_PREFIX}platform_settings`;

// ==================== CROSS-APP REAL-TIME SYNC ====================
export function broadcastSync(
  type:
    | 'products'
    | 'dealers'
    | 'categories'
    | 'brands'
    | 'enquiries'
    | 'settings'
    | 'reviews'
    | 'customers'
    | 'notifications',
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

let firestoreBackoffUntil = 0;

function canTryFirestore(): boolean {
  return Date.now() >= firestoreBackoffUntil;
}

function noteFirestoreUnavailable(err: any): void {
  const msg = String(err?.message || '').toLowerCase();
  const code = String(err?.code || '').toLowerCase();
  if (msg.includes('timeout') || code === 'unavailable' || code === 'permission-denied') {
    firestoreBackoffUntil = Date.now() + 30000;
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 1000): Promise<T> {
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

async function readFirestoreCollection<T>(colName: string, timeoutMs = 1000): Promise<T[] | null> {
  const db = getFirebaseDb();
  if (!db || !canTryFirestore()) return null;
  try {
    const snap = await withTimeout(getDocs(collection(db, colName)), timeoutMs);
    if (snap && !snap.empty) {
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
    }
  } catch (err) {
    noteFirestoreUnavailable(err);
  }
  return null;
}

async function writeFirestoreDoc(
  colName: string,
  docId: string,
  data: any,
  merge = true,
  timeoutMs = 1000
): Promise<void> {
  const db = getFirebaseDb();
  if (!db || !canTryFirestore()) return;
  try {
    const ref = doc(db, colName, docId);
    await withTimeout(merge ? setDoc(ref, data, { merge: true }) : setDoc(ref, data), timeoutMs);
  } catch (err) {
    noteFirestoreUnavailable(err);
  }
}

async function deleteFirestoreDoc(colName: string, docId: string, timeoutMs = 1000): Promise<void> {
  const db = getFirebaseDb();
  if (!db || !canTryFirestore()) return;
  try {
    await withTimeout(deleteDoc(doc(db, colName, docId)), timeoutMs);
  } catch (err) {
    noteFirestoreUnavailable(err);
  }
}

// ==================== APP SETTINGS ====================

export async function getDbAppSettings(): Promise<AppSettings> {
  if (typeof window !== 'undefined') {
    try {
      const meta = await apiSync.fetchMetadata();
      if (meta?.appSettings) {
        setLocal(KEY_SETTINGS, meta.appSettings);
        return meta.appSettings;
      }
    } catch {}
  }
  const local = getLocal<AppSettings>(KEY_SETTINGS, INITIAL_APP_SETTINGS);
  const db = getFirebaseDb();
  if (!db) return local;

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
  if (typeof window !== 'undefined') {
    await apiSync.saveMetadata('app_settings', updated);
  }
  setLocal(KEY_SETTINGS, updated);
  await writeFirestoreDoc('settings', 'app', updated);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dc-settings-updated', { detail: updated }));
  }

  return updated;
}

// ==================== CATEGORIES & GROUPS ====================

export async function getDbCategories(): Promise<Category[]> {
  if (typeof window !== 'undefined') {
    try {
      const meta = await apiSync.fetchMetadata();
      if (Array.isArray(meta?.categories) && meta.categories.length > 0) {
        setLocal(KEY_CATEGORIES, meta.categories);
        return meta.categories;
      }
    } catch {}
  }
  const local = getLocal<Category[]>(KEY_CATEGORIES, INITIAL_CATEGORIES);
  const list = await readFirestoreCollection<Category>('categories');
  if (list && list.length >= INITIAL_CATEGORIES.length) {
    setLocal(KEY_CATEGORIES, list);
    return list;
  }
  return local;
}

export function getDbCategoryGroups(): CategoryGroup[] {
  return CATEGORY_GROUPS;
}

export async function saveDbCategory(category: Category): Promise<void> {
  if (typeof window !== 'undefined') {
    await apiSync.saveMetadata('category', category);
  }
  const list = getLocal<Category[]>(KEY_CATEGORIES, INITIAL_CATEGORIES);
  const index = list.findIndex((c) => c.id === category.id);
  const updated = index >= 0 ? list.map((c) => (c.id === category.id ? category : c)) : [...list, category];
  setLocal(KEY_CATEGORIES, updated);
  await writeFirestoreDoc('categories', category.id, category);
  broadcastSync('categories', category);
}

export async function deleteDbCategory(id: string): Promise<void> {
  if (typeof window !== 'undefined') {
    await apiSync.deleteMetadata('category', id);
  }
  const list = getLocal<Category[]>(KEY_CATEGORIES, INITIAL_CATEGORIES);
  const updated = list.filter((c) => c.id !== id);
  setLocal(KEY_CATEGORIES, updated);
  await deleteFirestoreDoc('categories', id);
  broadcastSync('categories', { id, deleted: true });
}

// ==================== BRANDS ====================

export async function getDbBrands(): Promise<Brand[]> {
  if (typeof window !== 'undefined') {
    try {
      const meta = await apiSync.fetchMetadata();
      if (Array.isArray(meta?.brands) && meta.brands.length > 0) {
        setLocal(KEY_BRANDS, meta.brands);
        return meta.brands;
      }
    } catch {}
  }
  let local = getLocal<Brand[]>(KEY_BRANDS, INITIAL_BRANDS);
  if (local.length === 0) {
    local = [...INITIAL_BRANDS];
    setLocal(KEY_BRANDS, local);
  }
  const remote = await readFirestoreCollection<Brand>('brands');
  if (remote) {
    setLocal(KEY_BRANDS, remote);
    return remote;
  }
  return local;
}

export async function saveDbBrand(brand: Brand): Promise<void> {
  const nextBrand: Brand = { ...brand, updated_at: new Date().toISOString() };
  if (typeof window !== 'undefined') {
    await apiSync.saveMetadata('brand', nextBrand);
  }
  const list = getLocal<Brand[]>(KEY_BRANDS, INITIAL_BRANDS);
  const index = list.findIndex((b) => b.id === brand.id);
  const updated = index >= 0 ? list.map((b) => (b.id === brand.id ? nextBrand : b)) : [nextBrand, ...list];
  setLocal(KEY_BRANDS, updated);
  await writeFirestoreDoc('brands', brand.id, nextBrand);
  broadcastSync('brands', nextBrand);
}

export async function deleteDbBrand(id: string): Promise<void> {
  if (typeof window !== 'undefined') {
    await apiSync.deleteMetadata('brand', id);
  }
  const list = getLocal<Brand[]>(KEY_BRANDS, INITIAL_BRANDS);
  const updated = list.filter((b) => b.id !== id);
  setLocal(KEY_BRANDS, updated);
  await deleteFirestoreDoc('brands', id);
  broadcastSync('brands', { id, deleted: true });
}

// ==================== PLATFORM SETTINGS ====================

export type PlatformSupportSettings = {
  supportPhone: string;
  supportEmail: string;
  supportWhatsApp: string;
  sessionTimeout: boolean;
  auditLogEnabled: boolean;
  updatedAt?: string;
};

const DEFAULT_PLATFORM_SETTINGS: PlatformSupportSettings = {
  supportPhone: '+91 98480 12345',
  supportEmail: 'support@dealerconnect.ai',
  supportWhatsApp: '+91 98480 12345',
  sessionTimeout: true,
  auditLogEnabled: true,
};

export function getDbPlatformSettings(): PlatformSupportSettings {
  return getLocal<PlatformSupportSettings>(KEY_PLATFORM_SETTINGS, DEFAULT_PLATFORM_SETTINGS);
}

export async function saveDbPlatformSettings(
  next: Partial<PlatformSupportSettings>
): Promise<PlatformSupportSettings> {
  const updated: PlatformSupportSettings = {
    ...getDbPlatformSettings(),
    ...next,
    updatedAt: new Date().toISOString(),
  };
  setLocal(KEY_PLATFORM_SETTINGS, updated);
  await writeFirestoreDoc('settings', 'platform', updated);
  broadcastSync('settings', updated);
  return updated;
}

// ==================== DEALERS ====================

export async function getDbDealers(): Promise<Dealer[]> {
  if (typeof window !== 'undefined') {
    try {
      const list = await apiSync.fetchDealers();
      setLocal(KEY_DEALERS, list);
      return list;
    } catch {}
  }
  const local = getLocal<Dealer[]>(KEY_DEALERS, INITIAL_DEALERS);
  const remote = await readFirestoreCollection<Dealer>('dealers');
  if (remote) {
    setLocal(KEY_DEALERS, remote);
    return remote;
  }
  return local;
}

export async function getDbDealerById(id: string): Promise<Dealer | null> {
  const list = await getDbDealers();
  return list.find((d) => d.id === id) ?? null;
}

export async function saveDbDealer(dealer: Dealer): Promise<void> {
  if (typeof window !== 'undefined') {
    const existingList = getLocal<Dealer[]>(KEY_DEALERS, INITIAL_DEALERS);
    const exists = existingList.some((d) => d.id === dealer.id);
    const saved = await apiSync.saveDealer(dealer, exists ? 'PATCH' : 'POST');
    dealer = saved || dealer;
  }
  const list = getLocal<Dealer[]>(KEY_DEALERS, INITIAL_DEALERS);
  const index = list.findIndex((d) => d.id === dealer.id);
  const updated = index >= 0 ? list.map((d) => (d.id === dealer.id ? dealer : d)) : [dealer, ...list];
  setLocal(KEY_DEALERS, updated);
  await writeFirestoreDoc('dealers', dealer.id, dealer);
  broadcastSync('dealers', dealer);
}

export async function deleteDbDealer(id: string): Promise<void> {
  if (typeof window !== 'undefined') {
    await apiSync.deleteDealer(id);
  }
  const list = getLocal<Dealer[]>(KEY_DEALERS, INITIAL_DEALERS);
  const updated = list.filter((d) => d.id !== id);
  setLocal(KEY_DEALERS, updated);
  await deleteFirestoreDoc('dealers', id);
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
  if (typeof window !== 'undefined') {
    try {
      const serverProducts = await apiSync.fetchProducts();
      list = serverProducts;
      setLocal(KEY_PRODUCTS, list);
    } catch {
      if (list.length < INITIAL_PRODUCTS.length) {
        const existingIds = new Set(list.map((p) => p.id));
        const missing = INITIAL_PRODUCTS.filter((p) => !existingIds.has(p.id));
        list = [...list, ...missing];
        setLocal(KEY_PRODUCTS, list);
      }
    }
  } else {
    const remote = await readFirestoreCollection<Product>('products');
    if (remote) {
      list = remote;
      setLocal(KEY_PRODUCTS, list);
    }
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
  let savedProduct = product;
  if (typeof window !== 'undefined') {
    savedProduct = await apiSync.saveProduct(product, false);
  }
  const list = getLocal<Product[]>(KEY_PRODUCTS, INITIAL_PRODUCTS);
  const index = list.findIndex((p) => p.id === savedProduct.id);
  const updated = index >= 0 ? list.map((p) => (p.id === savedProduct.id ? savedProduct : p)) : [savedProduct, ...list];
  setLocal(KEY_PRODUCTS, updated);
  await writeFirestoreDoc('products', savedProduct.id, savedProduct);
  broadcastSync('products', savedProduct);
}

export async function deleteDbProduct(id: string): Promise<void> {
  if (typeof window !== 'undefined') {
    await apiSync.deleteProduct(id);
  }
  const list = getLocal<Product[]>(KEY_PRODUCTS, INITIAL_PRODUCTS);
  const updated = list.filter((p) => p.id !== id);
  setLocal(KEY_PRODUCTS, updated);
  await deleteFirestoreDoc('products', id);
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

  const remote = await readFirestoreCollection<Message>('messages');
  if (remote) {
    list = remote;
    setLocal(KEY_MESSAGES, list);
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
  await writeFirestoreDoc('messages', newMsg.id, newMsg, false);
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
  if (typeof window !== 'undefined') {
    try {
      const serverList = await apiSync.fetchPushNotifications();
      setLocal(KEY_NOTIFICATIONS, serverList);
      return serverList;
    } catch {}
  }
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
  const remote = await readFirestoreCollection<PushNotification>('push_notifications');
  if (remote) {
    setLocal(KEY_NOTIFICATIONS, remote);
    return remote;
  }
  return local;
}

export async function sendDbNotification(
  payload: Omit<PushNotification, 'id' | 'sent_at' | 'delivery_status'>
): Promise<PushNotification> {
  let newNotif: PushNotification | null = null;
  if (typeof window !== 'undefined') {
    try {
      newNotif = await apiSync.sendPushNotification(payload);
    } catch {
      // ignore if non-admin internal fallback call
    }
  }
  if (!newNotif) {
    newNotif = {
      ...payload,
      id: `notif-${Date.now()}`,
      sent_at: new Date().toISOString(),
      delivery_status: 'sent',
    };
  }

  const current = getLocal<PushNotification[]>(KEY_NOTIFICATIONS, []);
  const updated = [newNotif, ...current.filter((n) => n.id !== newNotif!.id)];
  setLocal(KEY_NOTIFICATIONS, updated);
  await writeFirestoreDoc('push_notifications', newNotif.id, newNotif, false);

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
  const remote = await readFirestoreCollection<CustomerFavorite>('customer_favorites');
  if (remote) {
    setLocal(KEY_FAVORITES, remote);
    return remote.filter((f) => f.user_id === userId);
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
    await deleteFirestoreDoc('customer_favorites', target.id, 2000);
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
    await writeFirestoreDoc('customer_favorites', newFav.id, newFav, false, 2000);
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
  await writeFirestoreDoc('customer_search_history', newHistory.id, newHistory, false, 2000);
}

// ==================== REVIEWS ====================

export async function getDbReviews(opts?: {
  productId?: string;
  dealerId?: string;
  scope?: 'customer' | 'dealer' | 'admin';
}): Promise<Review[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await apiSync.fetchReviews(opts);
      const list = res.reviews || [];
      if (!opts?.productId && !opts?.dealerId && (!opts?.scope || opts.scope === 'admin')) {
        setLocal(KEY_REVIEWS, list);
      }
      return list;
    } catch {}
  }
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

export async function saveDbReview(review: Review): Promise<Review> {
  let saved = review;
  if (typeof window !== 'undefined') {
    const existingList = getLocal<Review[]>(KEY_REVIEWS, []);
    const exists = existingList.some((r) => r.id === review.id);
    if (exists) {
      saved = await apiSync.updateReview({
        id: review.id,
        action: review.is_hidden ? 'hide' : review.is_approved === false ? 'hide' : 'approve',
        reason: review.moderation_notes ?? undefined,
      });
    } else {
      saved = await apiSync.createReview({
        dealer_id: review.dealer_id,
        product_id: review.product_id,
        customer_name: review.customer_name,
        rating: review.rating,
        comment: review.comment || '',
        quality_rating: review.quality_rating,
      });
    }
  }
  const normalized: Review = {
    ...saved,
    is_approved: saved.is_approved ?? true,
  };
  const list = getLocal<Review[]>(KEY_REVIEWS, []);
  const updated = [normalized, ...list.filter((r) => r.id !== normalized.id)];
  setLocal(KEY_REVIEWS, updated);
  await writeFirestoreDoc('reviews', normalized.id, normalized, true, 2000);
  broadcastSync('reviews', normalized);
  return normalized;
}

export async function deleteDbReview(id: string): Promise<void> {
  if (typeof window !== 'undefined') {
    await apiSync.deleteReview(id);
  }
  const list = getLocal<Review[]>(KEY_REVIEWS, []);
  const updated = list.filter((r) => r.id !== id);
  setLocal(KEY_REVIEWS, updated);
  await deleteFirestoreDoc('reviews', id, 2000);
  broadcastSync('reviews', { id, deleted: true });
}

// ==================== ENQUIRIES ====================

const INITIAL_ENQUIRIES: Enquiry[] = [
  {
    id: 'enq-1',
    customer_id: 'demo-customer-1',
    customer_email: 'customer@demo.in',
    dealer_id: 'dealer-1',
    product_id: 'prod-s24',
    product_name: 'Samsung Galaxy S24 Ultra 5G',
    dealer_name: 'Sri Krishna Electronics',
    customer_name: 'Aditya Varma',
    customer_phone: '+91 98480 12345',
    message: 'Is Samsung Galaxy S24 Ultra in Titanium Gray available for immediate in-store pickup?',
    channel: 'whatsapp',
    status: 'responded',
    dealer_response: 'Yes! Titanium Gray 256GB is ready in stock for immediate showroom pickup and same-day delivery.',
    responded_at: new Date(Date.now() - 8 * 60000).toISOString(),
    responded_by: 'Sri Krishna Electronics',
    created_at: new Date(Date.now() - 15 * 60000).toISOString(),
  },
  {
    id: 'enq-2',
    customer_id: 'cust-102',
    customer_email: 'pooja.reddy@yahoo.com',
    dealer_id: 'dealer-1',
    product_id: 'prod-bravia',
    product_name: 'Sony Bravia 55" 4K Ultra HD Smart LED Google TV',
    dealer_name: 'Sri Krishna Electronics',
    customer_name: 'Pooja Reddy',
    customer_phone: '+91 98480 67890',
    message: 'Can you provide free wall-mount installation for the Sony Bravia 55 inch today?',
    channel: 'call',
    status: 'pending',
    created_at: new Date(Date.now() - 45 * 60000).toISOString(),
  },
  {
    id: 'enq-3',
    customer_id: 'cust-103',
    customer_email: 'rohan.sharma@gmail.com',
    dealer_id: 'dealer-2',
    product_id: 'prod-drill',
    product_name: 'Bosch Cordless Hammer Drill Kit',
    dealer_name: 'Konaseema Appliances & Hardware',
    customer_name: 'Rohan Sharma',
    customer_phone: '+91 98480 34567',
    message: 'Looking for Bosch hammer drill bit set. Do you have replacement warranty?',
    channel: 'form',
    status: 'pending',
    created_at: new Date(Date.now() - 120 * 60000).toISOString(),
  },
];

export async function getDbEnquiries(
  dealerId?: string,
  opts?: { customerId?: string; customerEmail?: string }
): Promise<Enquiry[]> {
  let list = getLocal<Enquiry[]>(KEY_ENQUIRIES, INITIAL_ENQUIRIES);
  if (typeof window !== 'undefined') {
    try {
      const scope = dealerId
        ? 'dealer'
        : opts?.customerId || opts?.customerEmail
          ? 'customer'
          : undefined;
      list = await apiSync.fetchEnquiries({ scope, dealerId });
      setLocal(KEY_ENQUIRIES, list);
    } catch {
      // keep fallback if unauthenticated
    }
  } else {
    const remote = await readFirestoreCollection<Enquiry>('enquiries');
    if (remote) {
      list = remote;
      setLocal(KEY_ENQUIRIES, list);
    }
  }

  const [dealers, products] = await Promise.all([
    getDbDealers(),
    getDbProducts({ includeUnapproved: true }),
  ]);

  let enriched = list
    .map((e) => {
      const dealer = e.dealer ?? (e.dealer_id ? dealers.find((d) => d.id === e.dealer_id) ?? null : null);
      const product = e.product ?? (e.product_id ? products.find((p) => p.id === e.product_id) ?? null : null);
      const rawStatus = (e.status || 'pending') as string;
      const status =
        rawStatus === 'new'
          ? 'pending'
          : rawStatus === 'contacted'
            ? 'responded'
            : rawStatus === 'completed'
              ? 'resolved'
              : (rawStatus as Enquiry['status']);
      return {
        ...e,
        status: status || 'pending',
        product_name: e.product_name || product?.name || null,
        dealer_name: e.dealer_name || dealer?.shop_name || null,
        dealer,
        product,
      };
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (dealerId) {
    enriched = enriched.filter((e) => e.dealer_id === dealerId);
  }
  if (opts?.customerId || opts?.customerEmail) {
    const cleanEmail = opts.customerEmail?.toLowerCase().trim();
    enriched = enriched.filter(
      (e) =>
        (opts.customerId && e.customer_id === opts.customerId) ||
        (cleanEmail && e.customer_email?.toLowerCase().trim() === cleanEmail)
    );
  }
  return enriched;
}

export async function saveDbEnquiry(
  enquiry: Partial<Enquiry> & {
    actorRole?: 'customer' | 'dealer' | 'admin';
    follow_up_message?: string;
  }
): Promise<Enquiry> {
  let savedFromServer: Enquiry | null = null;
  if (typeof window !== 'undefined') {
    if (enquiry.id) {
      savedFromServer = await apiSync.updateEnquiry({
        ...enquiry,
        id: enquiry.id,
      });
    } else {
      savedFromServer = await apiSync.createEnquiry(enquiry);
    }
  }

  const list = getLocal<Enquiry[]>(KEY_ENQUIRIES, INITIAL_ENQUIRIES);
  const existing = (savedFromServer?.id || enquiry.id)
    ? list.find((e) => e.id === (savedFromServer?.id || enquiry.id))
    : undefined;
  const nowIso = new Date().toISOString();

  const generatedId =
    savedFromServer?.id ||
    existing?.id ||
    enquiry.id ||
    `ENQ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

  const mergedRaw: Enquiry = savedFromServer || {
    id: generatedId,
    customer_id: enquiry.customer_id !== undefined ? enquiry.customer_id : existing?.customer_id ?? null,
    customer_email:
      enquiry.customer_email !== undefined
        ? enquiry.customer_email?.toLowerCase().trim() || null
        : existing?.customer_email ?? null,
    dealer_id: enquiry.dealer_id !== undefined ? enquiry.dealer_id : existing?.dealer_id ?? null,
    product_id: enquiry.product_id !== undefined ? enquiry.product_id : existing?.product_id ?? null,
    product_name: enquiry.product_name !== undefined ? enquiry.product_name : existing?.product_name ?? null,
    dealer_name: enquiry.dealer_name !== undefined ? enquiry.dealer_name : existing?.dealer_name ?? null,
    customer_name:
      enquiry.customer_name !== undefined ? enquiry.customer_name : existing?.customer_name || 'Customer',
    customer_phone:
      enquiry.customer_phone !== undefined ? enquiry.customer_phone : existing?.customer_phone || null,
    message: enquiry.message !== undefined ? enquiry.message : existing?.message || 'Product enquiry',
    channel: enquiry.channel || existing?.channel || 'form',
    status: enquiry.status || existing?.status || 'pending',
    dealer_response:
      enquiry.dealer_response !== undefined ? enquiry.dealer_response : existing?.dealer_response ?? null,
    responded_at: enquiry.responded_at !== undefined ? enquiry.responded_at : existing?.responded_at ?? null,
    responded_by: enquiry.responded_by !== undefined ? enquiry.responded_by : existing?.responded_by ?? null,
    admin_notes: enquiry.admin_notes !== undefined ? enquiry.admin_notes : existing?.admin_notes ?? null,
    created_at: existing?.created_at || enquiry.created_at || nowIso,
    updated_at: nowIso,
  };

  const updated = [mergedRaw, ...list.filter((e) => e.id !== mergedRaw.id)];
  setLocal(KEY_ENQUIRIES, updated);
  await writeFirestoreDoc('enquiries', mergedRaw.id, mergedRaw);
  broadcastSync('enquiries', mergedRaw);
  return mergedRaw;
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
  if (typeof window !== 'undefined') {
    try {
      const serverList = await apiSync.fetchDealerApplications();
      setLocal(KEY_DEALER_APPLICATIONS, serverList);
      return serverList;
    } catch {}
  }
  let list = getLocal<DealerApplication[]>(KEY_DEALER_APPLICATIONS, INITIAL_DEALER_APPLICATIONS);
  const remote = await readFirestoreCollection<DealerApplication>('dealer_applications', 3000);
  if (remote) {
    list = remote;
    setLocal(KEY_DEALER_APPLICATIONS, list);
  }
  return list;
}

export async function getDbDealerApplicationByCustomerId(customerId: string): Promise<DealerApplication | null> {
  const apps = await getDbDealerApplications();
  return apps.find((a) => a.customer_id === customerId) || null;
}

export async function saveDbDealerApplication(application: DealerApplication): Promise<DealerApplication> {
  let saved: DealerApplication | null = null;
  if (typeof window !== 'undefined') {
    saved = await apiSync.submitDealerApplication({
      ...application,
      dealer_password: application.dealer_password ?? undefined,
    });
  }
  if (!saved) {
    saved = {
      ...application,
      updated_at: new Date().toISOString(),
    };
  }

  let list = getLocal<DealerApplication[]>(KEY_DEALER_APPLICATIONS, INITIAL_DEALER_APPLICATIONS);
  const idx = list.findIndex(
    (a) => a.id === saved!.id || (saved!.customer_id && a.customer_id === saved!.customer_id)
  );
  if (idx >= 0) {
    list[idx] = saved;
  } else {
    list = [saved, ...list];
  }
  setLocal(KEY_DEALER_APPLICATIONS, list);
  await writeFirestoreDoc('dealer_applications', saved.id, saved);
  broadcastSync('dealers', saved);
  return saved;
}

export async function approveDbDealerApplication(
  appId: string,
  adminRemarks?: string
): Promise<{ success: boolean; dealerId?: string; error?: string }> {
  if (typeof window !== 'undefined') {
    const res = await apiSync.reviewDealerApplication(appId, 'approve', adminRemarks);
    if (res.dealer) {
      const dlList = getLocal<Dealer[]>(KEY_DEALERS, INITIAL_DEALERS);
      setLocal(KEY_DEALERS, [res.dealer, ...dlList.filter((d) => d.id !== res.dealer!.id)]);
    }
    const apps = getLocal<DealerApplication[]>(KEY_DEALER_APPLICATIONS, INITIAL_DEALER_APPLICATIONS);
    setLocal(
      KEY_DEALER_APPLICATIONS,
      apps.map((a) => (a.id === appId ? res.application : a))
    );
    broadcastSync('dealers', res.application);
    return { success: true, dealerId: res.dealer?.id };
  }
  return { success: false, error: 'Browser session required' };
}

export async function rejectDbDealerApplication(
  appId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  if (typeof window !== 'undefined') {
    const res = await apiSync.reviewDealerApplication(appId, 'reject', reason);
    const apps = getLocal<DealerApplication[]>(KEY_DEALER_APPLICATIONS, INITIAL_DEALER_APPLICATIONS);
    setLocal(
      KEY_DEALER_APPLICATIONS,
      apps.map((a) => (a.id === appId ? res.application : a))
    );
    broadcastSync('dealers', res.application);
    return { success: true };
  }
  return { success: false, error: 'Browser session required' };
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
  if (typeof window !== 'undefined') {
    const res = await apiSync.reviewDealerApplication(appId, 'under_review', remarks);
    const apps = getLocal<DealerApplication[]>(KEY_DEALER_APPLICATIONS, INITIAL_DEALER_APPLICATIONS);
    setLocal(
      KEY_DEALER_APPLICATIONS,
      apps.map((a) => (a.id === appId ? res.application : a))
    );
    broadcastSync('dealers', res.application);
    return { success: true };
  }
  return { success: false, error: 'Browser session required' };
}

// ============================================================
// FLUENT FIRESTORE QUERY BUILDER (Full compatibility adapter)
// ============================================================

function storageKeyForTable(tableName: string): string {
  if (tableName === 'notifications') return KEY_CUSTOMER_NOTIFICATIONS;
  if (tableName === 'push_notifications') return KEY_NOTIFICATIONS;
  return `${STORAGE_PREFIX}${tableName}`;
}

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
    then: (resolve: (val: { data: any; error: any; count?: number }) => any, reject?: (err: any) => any) => {
      return builder.execute().then(
        (data: any) => resolve({ data, error: null, count: data.length }),
        reject
      );
    },
    execute: async (): Promise<any[]> => {
      let items: any[] = [];
      if (tableName === 'products') items = await getDbProducts();
      else if (tableName === 'dealers') items = await getDbDealers();
      else if (tableName === 'categories') items = await getDbCategories();
      else if (tableName === 'brands') items = await getDbBrands();
      else if (tableName === 'messages') {
        const [msgs, dealers] = await Promise.all([getDbMessages(), getDbDealers()]);
        items = msgs.map((m) => ({
          ...m,
          dealer: m.dealer ?? dealers.find((d) => d.id === m.dealer_id) ?? null,
        }));
      } else if (tableName === 'push_notifications') {
        items = await getDbNotifications();
      } else if (tableName === 'notifications') {
        items = getLocal<any[]>(KEY_CUSTOMER_NOTIFICATIONS, []);
      } else if (tableName === 'reviews') {
        items = await getDbReviews();
      } else if (tableName === 'enquiries') {
        const [enqs, dealers, products] = await Promise.all([
          getDbEnquiries(),
          getDbDealers(),
          getDbProducts({ includeUnapproved: true }),
        ]);
        items = enqs.map((e: any) => ({
          ...e,
          dealer: e.dealer ?? dealers.find((d) => d.id === e.dealer_id) ?? null,
          product: e.product ?? products.find((p) => p.id === e.product_id) ?? null,
        }));
      } else if (tableName === 'dealer_applications') {
        items = await getDbDealerApplications();
      } else if (tableName === 'customer_favorites') {
        const favs = getLocal<any[]>(KEY_FAVORITES, []);
        const [dealers, products] = await Promise.all([
          getDbDealers(),
          getDbProducts({ includeUnapproved: true }),
        ]);
        items = favs.map((f: any) => ({
          ...f,
          dealer: f.dealer ?? (f.dealer_id ? dealers.find((d) => d.id === f.dealer_id) ?? null : null),
          product: f.product ?? (f.product_id ? products.find((p) => p.id === f.product_id) ?? null : null),
        }));
      } else if (tableName === 'customer_search_history') {
        items = getLocal(KEY_SEARCH_HISTORY, []);
      } else if (tableName === 'moderation_logs') {
        items = getLocal(KEY_MODERATION, []);
      } else {
        items = getLocal(storageKeyForTable(tableName), []);
      }

      const resolveCol = (obj: any, col: string) => {
        if (!col.includes('.')) return obj?.[col];
        return col.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), obj);
      };

      let res = [...items];
      for (const f of filterList) {
        if (f.op === '==' || !f.op) {
          res = res.filter((item) => resolveCol(item, f.col) === f.val);
        } else if (f.op === '!=') {
          res = res.filter((item) => resolveCol(item, f.col) !== f.val);
        } else if (f.op === 'in' && Array.isArray(f.val)) {
          res = res.filter((item) => f.val.includes(resolveCol(item, f.col)));
        } else if (f.op === 'ilike') {
          const cleanPattern = String(f.val).replace(/%/g, '').toLowerCase();
          res = res.filter((item) => String(resolveCol(item, f.col) || '').toLowerCase().includes(cleanPattern));
        } else if (f.op === 'contains') {
          res = res.filter((item) => {
            const arr = resolveCol(item, f.col);
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
      const items = (Array.isArray(data) ? data : [data]).map((item) => ({
        ...item,
        id: item.id || `id-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        created_at: item.created_at || new Date().toISOString(),
        is_read: item.is_read ?? false,
      }));
      const promise = (async () => {
        for (const item of items) {
          if (tableName === 'products') await saveDbProduct(item);
          else if (tableName === 'dealers') await saveDbDealer(item);
          else if (tableName === 'categories') await saveDbCategory(item);
          else if (tableName === 'brands') await saveDbBrand(item);
          else if (tableName === 'reviews') await saveDbReview(item);
          else if (tableName === 'messages') await saveDbMessage(item);
          else if (tableName === 'enquiries') await saveDbEnquiry(item);
          else if (tableName === 'dealer_applications') await saveDbDealerApplication(item);
          else if (tableName === 'notifications') {
            const list = getLocal<any[]>(KEY_CUSTOMER_NOTIFICATIONS, []);
            setLocal(KEY_CUSTOMER_NOTIFICATIONS, [item, ...list]);
            broadcastSync('notifications', item);
          } else if (tableName === 'customer_favorites') {
            const list = getLocal<any[]>(KEY_FAVORITES, []);
            setLocal(KEY_FAVORITES, [...list, item]);
          } else if (tableName === 'customer_search_history') {
            const list = getLocal<any[]>(KEY_SEARCH_HISTORY, []);
            setLocal(KEY_SEARCH_HISTORY, [...list, item]);
          } else {
            const key = storageKeyForTable(tableName);
            const list = getLocal<any[]>(key, []);
            setLocal(key, [...list, item]);
          }
        }
        return { data: items[0], error: null };
      })();

      const insertBuilder: any = {
        then: (resolve: any, reject?: any) => promise.then(resolve, reject),
        select: (_f?: string) => ({
          single: async () => promise.then(() => ({ data: items[0], error: null })),
          maybeSingle: async () => promise.then(() => ({ data: items[0], error: null })),
          then: (resolve: any, reject?: any) => promise.then(resolve, reject),
        }),
      };
      return insertBuilder;
    },
    upsert: (data: any, _opts?: any) => {
      const items = Array.isArray(data) ? data : [data];
      const promise = (async () => {
        const key = storageKeyForTable(tableName);
        for (const item of items) {
          if (!item.id) item.id = item.customer_id || `id-${Date.now()}`;
          const list = getLocal<any[]>(key, []);
          const normalizedEmail =
            tableName === 'customers' && typeof item.email === 'string'
              ? item.email.trim().toLowerCase()
              : '';
          const idx = list.findIndex(
            (x) =>
              x.id === item.id ||
              (item.customer_id && x.customer_id === item.customer_id) ||
              (normalizedEmail &&
                typeof x.email === 'string' &&
                x.email.trim().toLowerCase() === normalizedEmail)
          );
          const mergedItem =
            idx >= 0 ? { ...list[idx], ...item, id: list[idx].id || item.id } : item;
          if (idx >= 0) {
            list[idx] = mergedItem;
          } else {
            list.push(mergedItem);
          }

          const dedupedList = normalizedEmail
            ? list.filter((x, pos) => {
                const email = typeof x.email === 'string' ? x.email.trim().toLowerCase() : '';
                if (email !== normalizedEmail) return true;
                return pos === (idx >= 0 ? idx : list.length - 1);
              })
            : list;

          setLocal(key, dedupedList);
          await writeFirestoreDoc(tableName, mergedItem.id, mergedItem);
        }
        return { data: items[0], error: null };
      })();
      return promise;
    },
    update: (data: any) => {
      const updateFilters: Array<{ col: string; val: any }> = [];
      let cachedExec: Promise<{ error: any }> | null = null;

      const runUpdate = () => {
        if (!cachedExec) {
          cachedExec = (async () => {
            const matches = (item: any) => updateFilters.every((f) => item[f.col] === f.val);
            if (tableName === 'products') {
              const list = await getDbProducts({ includeUnapproved: true });
              for (const item of list) {
                if (matches(item)) await saveDbProduct({ ...item, ...data });
              }
            } else if (tableName === 'dealers') {
              const list = await getDbDealers();
              for (const item of list) {
                if (matches(item)) await saveDbDealer({ ...item, ...data });
              }
            } else if (tableName === 'categories') {
              const list = await getDbCategories();
              for (const item of list) {
                if (matches(item)) await saveDbCategory({ ...item, ...data });
              }
            } else if (tableName === 'brands') {
              const list = await getDbBrands();
              for (const item of list) {
                if (matches(item)) await saveDbBrand({ ...item, ...data });
              }
            } else if (tableName === 'reviews') {
              const list = await getDbReviews();
              for (const item of list) {
                if (matches(item)) await saveDbReview({ ...item, ...data });
              }
            } else if (tableName === 'messages') {
              const list = getLocal<any[]>(KEY_MESSAGES, []);
              setLocal(KEY_MESSAGES, list.map((m) => (matches(m) ? { ...m, ...data } : m)));
            } else if (tableName === 'enquiries') {
              const list = await getDbEnquiries();
              for (const item of list) {
                if (matches(item)) await saveDbEnquiry({ ...item, ...data });
              }
            } else if (tableName === 'notifications') {
              const list = getLocal<any[]>(KEY_CUSTOMER_NOTIFICATIONS, []);
              setLocal(KEY_CUSTOMER_NOTIFICATIONS, list.map((m) => (matches(m) ? { ...m, ...data } : m)));
              broadcastSync('notifications');
            } else if (tableName === 'dealer_applications') {
              const list = await getDbDealerApplications();
              for (const item of list) {
                if (matches(item)) await saveDbDealerApplication({ ...item, ...data });
              }
            } else {
              const key = storageKeyForTable(tableName);
              const list = getLocal<any[]>(key, []);
              setLocal(key, list.map((m) => (matches(m) ? { ...m, ...data } : m)));
            }
            return { error: null };
          })();
        }
        return cachedExec;
      };

      const chain: any = {
        eq: (col: string, val: any) => {
          updateFilters.push({ col, val });
          return chain;
        },
        select: () => ({
          single: async () => {
            await runUpdate();
            return { data, error: null };
          },
          maybeSingle: async () => {
            await runUpdate();
            return { data, error: null };
          },
          then: (resolve: any, reject?: any) => runUpdate().then(resolve, reject),
        }),
        then: (resolve: any, reject?: any) => runUpdate().then(resolve, reject),
      };
      return chain;
    },
    delete: () => {
      const deleteFilters: Array<{ col: string; val: any }> = [];
      let cachedExec: Promise<{ error: any }> | null = null;

      const runDelete = () => {
        if (!cachedExec) {
          cachedExec = (async () => {
            const matches = (item: any) => deleteFilters.every((f) => item[f.col] === f.val);
            if (tableName === 'products') {
              const list = await getDbProducts({ includeUnapproved: true });
              for (const item of list) {
                if (matches(item)) await deleteDbProduct(item.id);
              }
            } else if (tableName === 'dealers') {
              const list = await getDbDealers();
              for (const item of list) {
                if (matches(item)) await deleteDbDealer(item.id);
              }
            } else if (tableName === 'categories') {
              const list = await getDbCategories();
              for (const item of list) {
                if (matches(item)) await deleteDbCategory(item.id);
              }
            } else if (tableName === 'brands') {
              const list = await getDbBrands();
              for (const item of list) {
                if (matches(item)) await deleteDbBrand(item.id);
              }
            } else if (tableName === 'reviews') {
              const list = await getDbReviews();
              for (const item of list) {
                if (matches(item)) await deleteDbReview(item.id);
              }
            } else if (tableName === 'customer_favorites') {
              const list = getLocal<any[]>(KEY_FAVORITES, []);
              setLocal(KEY_FAVORITES, list.filter((x) => !matches(x)));
            } else {
              const key = storageKeyForTable(tableName);
              const list = getLocal<any[]>(key, []);
              setLocal(key, list.filter((x) => !matches(x)));
            }
            return { error: null };
          })();
        }
        return cachedExec;
      };

      const chain: any = {
        eq: (col: string, val: any) => {
          deleteFilters.push({ col, val });
          return chain;
        },
        then: (resolve: any, reject?: any) => runDelete().then(resolve, reject),
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
