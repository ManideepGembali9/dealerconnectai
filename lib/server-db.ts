import fs from 'fs';
import path from 'path';
import type {
  AppSettings,
  Brand,
  Category,
  Dealer,
  DealerApplication,
  Enquiry,
  ModerationLog,
  Notification,
  NotificationRecipientRole,
  Product,
  PushNotification,
  Review,
  ReviewReport,
} from './types';
import {
  INITIAL_APP_SETTINGS,
  INITIAL_BRANDS,
  INITIAL_CATEGORIES,
  INITIAL_DEALERS,
  INITIAL_PRODUCTS,
} from './seed-data';

export type PlatformSupportSettings = {
  supportPhone: string;
  supportEmail: string;
  supportWhatsApp: string;
  sessionTimeout: boolean;
  auditLogEnabled: boolean;
  updatedAt?: string;
};

export type DealerCredentialRecord = {
  dealerId: string;
  email: string;
  password: string;
  status: Dealer['status'];
};

export type RealtimeTopic =
  | 'enquiries'
  | 'reviews'
  | 'products'
  | 'dealers'
  | 'dealer_applications'
  | 'notifications'
  | 'moderation_logs'
  | 'categories'
  | 'brands'
  | 'settings';

export type RealtimeEvent = {
  id: string;
  topic: RealtimeTopic;
  action: 'created' | 'updated' | 'deleted' | 'status_changed' | 'moderated' | 'replied' | 'reset';
  recordId?: string;
  dealerId?: string | null;
  productId?: string | null;
  customerId?: string | null;
  customerEmail?: string | null;
  recipientRole?: 'customer' | 'dealer' | 'admin' | 'all';
  timestamp: string;
};

export type ServerDbState = {
  categories: Category[];
  brands: Brand[];
  dealers: Dealer[];
  dealerCredentials: Record<string, DealerCredentialRecord>;
  dealerApplications: DealerApplication[];
  products: Product[];
  enquiries: Enquiry[];
  reviews: Review[];
  reviewReports: ReviewReport[];
  moderationLogs: ModerationLog[];
  notifications: Notification[];
  pushNotifications: PushNotification[];
  platformSettings: PlatformSupportSettings;
  appSettings: AppSettings;
  updatedAt: number;
};

type RealtimeListener = (event: RealtimeEvent) => void;

const DATA_DIR = path.join(process.cwd(), '.dc-data');
const DB_FILE = path.join(DATA_DIR, 'runtime-db.json');

const globalStore = globalThis as unknown as {
  __dcServerDbState?: ServerDbState;
  __dcServerDbMtime?: number;
  __dcRealtimeSubscribers?: Set<RealtimeListener>;
};

const INITIAL_PLATFORM_SETTINGS: PlatformSupportSettings = {
  supportPhone: '+91 98480 12345',
  supportEmail: 'support@dealerconnect.ai',
  supportWhatsApp: '+91 98480 12345',
  sessionTimeout: true,
  auditLogEnabled: true,
};

function buildInitialReviews(): Review[] {
  return [
    {
      id: 'rev-1',
      dealer_id: 'dealer-1',
      product_id: 'prod-s24',
      target_type: 'product',
      customer_id: 'cust-seed-aditya',
      customer_email: 'aditya.varma@example.com',
      customer_name: 'Aditya Varma',
      rating: 5,
      quality_rating: 5,
      cleanliness_rating: 5,
      behavior_rating: 5,
      price_rating: 5,
      availability_rating: 5,
      delivery_rating: 5,
      comment: 'Genuine sealed Samsung S24 Ultra at the best local showroom price with zero markup!',
      dealer_response: 'Thank you Aditya! Glad you loved our doorstep warranty activation.',
      responded_at: new Date(Date.now() - 86400000).toISOString(),
      responded_by: 'Sri Krishna Electronics & Gadgets',
      is_verified_interaction: true,
      is_flagged: false,
      is_hidden: false,
      reports: [],
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      is_approved: true,
    },
    {
      id: 'rev-2',
      dealer_id: 'dealer-2',
      product_id: 'prod-lg-fridge',
      target_type: 'product',
      customer_id: 'cust-seed-pooja',
      customer_email: 'pooja.reddy@example.com',
      customer_name: 'Pooja Reddy',
      rating: 5,
      quality_rating: 5,
      cleanliness_rating: 5,
      behavior_rating: 5,
      price_rating: 4,
      availability_rating: 5,
      delivery_rating: 5,
      comment: 'Very polite staff and transparent pricing. Delivered on the same afternoon as promised.',
      dealer_response: null,
      responded_at: null,
      responded_by: null,
      is_verified_interaction: true,
      is_flagged: false,
      is_hidden: false,
      reports: [],
      created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      is_approved: true,
    },
  ];
}

function buildInitialEnquiries(): Enquiry[] {
  const now = Date.now();
  return [
    {
      id: 'enq-1',
      customer_id: 'cust-seed-aditya',
      customer_email: 'aditya.varma@example.com',
      dealer_id: 'dealer-1',
      product_id: 'prod-s24',
      product_name: 'Samsung Galaxy S24 Ultra 5G',
      dealer_name: 'Sri Krishna Electronics & Gadgets',
      customer_name: 'Aditya Varma',
      customer_phone: '+91 98480 12345',
      message: 'Is the 256GB Titanium Gray variant available for pickup today evening?',
      channel: 'form',
      status: 'pending',
      conversation: [
        {
          id: 'msg-seed-1',
          sender_role: 'customer',
          sender_name: 'Aditya Varma',
          message: 'Is the 256GB Titanium Gray variant available for pickup today evening?',
          created_at: new Date(now - 3600000 * 2).toISOString(),
        },
      ],
      created_at: new Date(now - 3600000 * 2).toISOString(),
      updated_at: new Date(now - 3600000 * 2).toISOString(),
    },
    {
      id: 'enq-2',
      customer_id: 'cust-seed-pooja',
      customer_email: 'pooja.reddy@example.com',
      dealer_id: 'dealer-1',
      product_id: 'prod-bravia',
      product_name: 'Sony Bravia 55" 4K Ultra HD Smart LED Google TV',
      dealer_name: 'Sri Krishna Electronics & Gadgets',
      customer_name: 'Pooja Reddy',
      customer_phone: '+91 98480 67890',
      message: 'Can you provide free installation and wall mounting at Amalapuram Clock Tower area?',
      channel: 'whatsapp',
      status: 'responded',
      dealer_response: 'Yes ma’am! Free Sony technician wall mount is included within 24 hours of purchase.',
      responded_at: new Date(now - 3600000 * 4).toISOString(),
      responded_by: 'Sri Krishna Electronics & Gadgets',
      conversation: [
        {
          id: 'msg-seed-2a',
          sender_role: 'customer',
          sender_name: 'Pooja Reddy',
          message: 'Can you provide free installation and wall mounting at Amalapuram Clock Tower area?',
          created_at: new Date(now - 3600000 * 5).toISOString(),
        },
        {
          id: 'msg-seed-2b',
          sender_role: 'dealer',
          sender_name: 'Sri Krishna Electronics & Gadgets',
          message: 'Yes ma’am! Free Sony technician wall mount is included within 24 hours of purchase.',
          created_at: new Date(now - 3600000 * 4).toISOString(),
        },
      ],
      created_at: new Date(now - 3600000 * 5).toISOString(),
      updated_at: new Date(now - 3600000 * 4).toISOString(),
    },
    {
      id: 'enq-3',
      customer_id: 'cust-seed-rohan',
      customer_email: 'rohan.sharma@example.com',
      dealer_id: 'dealer-2',
      product_id: 'prod-drill',
      product_name: 'Bosch Cordless Hammer Drill Kit',
      dealer_name: 'Lakshmi Home Appliances & Furniture World',
      customer_name: 'Rohan Sharma',
      customer_phone: '+91 98480 34567',
      message: 'Need 3 kits with extra drill bit packs for commercial project.',
      channel: 'call',
      status: 'pending',
      conversation: [
        {
          id: 'msg-seed-3',
          sender_role: 'customer',
          sender_name: 'Rohan Sharma',
          message: 'Need 3 kits with extra drill bit packs for commercial project.',
          created_at: new Date(now - 86400000).toISOString(),
        },
      ],
      created_at: new Date(now - 86400000).toISOString(),
      updated_at: new Date(now - 86400000).toISOString(),
    },
  ];
}

function buildInitialDealerApplications(): DealerApplication[] {
  return [
    {
      id: 'APP-2026-8942',
      customer_id: 'cust-demo-app',
      owner_name: 'Surya Narayana',
      phone: '+91 98480 44556',
      email: 'surya.traders@dealerconnect.ai',
      alt_phone: '+91 98480 44557',
      shop_name: 'Surya Power Tools & Agricultural Mart',
      category_id: 'cat-hardware',
      category_name: 'Hardware & Tools',
      description: 'Authorized distributor of Bosch power tools, farm sprayers, high-pressure washers, and spare parts.',
      logo_url: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=300',
      images: ['https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800'],
      address: 'Main Bazaar, Near Rice Mill Center',
      village: null,
      city: 'Amalapuram',
      district: 'Dr. B.R. Ambedkar Konaseema',
      state: 'Andhra Pradesh',
      pin_code: '533201',
      map_lat: 16.5787,
      map_lng: 82.0061,
      whatsapp: '+919848044556',
      opening_time: '09:00 AM',
      closing_time: '09:00 PM',
      delivery_available: true,
      pickup_available: true,
      home_delivery_radius_km: 12,
      gst_number: '37CCCCC2222C1Z9',
      business_reg_number: 'UDYAM-AP-04-0012941',
      id_proof_url: '',
      shop_license_url: '',
      status: 'pending',
      created_at: new Date(Date.now() - 86400000 * 1.5).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1.5).toISOString(),
    },
  ];
}

function createSeedState(): ServerDbState {
  const dealers = INITIAL_DEALERS.map((d) => ({ ...d }));
  const dealerCredentials: Record<string, DealerCredentialRecord> = {};
  for (const d of dealers) {
    dealerCredentials[d.email.toLowerCase()] = {
      dealerId: d.id,
      email: d.email.toLowerCase(),
      password: process.env.DEALER_DEMO_PASSWORD || 'dealer123',
      status: d.status,
    };
  }

  const state: ServerDbState = {
    categories: INITIAL_CATEGORIES.map((c) => ({ ...c })),
    brands: INITIAL_BRANDS.map((b) => ({ ...b })),
    dealers,
    dealerCredentials,
    dealerApplications: buildInitialDealerApplications(),
    products: INITIAL_PRODUCTS.map((p) => ({ ...p })),
    enquiries: buildInitialEnquiries(),
    reviews: buildInitialReviews(),
    reviewReports: [],
    moderationLogs: [],
    notifications: [],
    pushNotifications: [],
    platformSettings: { ...INITIAL_PLATFORM_SETTINGS },
    appSettings: { ...INITIAL_APP_SETTINGS },
    updatedAt: Date.now(),
  };

  // Sync computed product/dealer metrics against real initial reviews where applicable
  recalculateRatingsInPlace(state, { recalculateAll: true });
  return state;
}

export function recalculateRatingsInPlace(
  state: ServerDbState,
  opts?: { productId?: string | null; dealerId?: string | null; recalculateAll?: boolean }
): void {
  const visibleReviews = state.reviews.filter((r) => r.is_approved !== false && !r.is_hidden);

  if (opts?.recalculateAll || opts?.productId) {
    const productIds = opts?.recalculateAll
      ? Array.from(new Set(state.products.map((p) => p.id)))
      : [opts?.productId!];

    for (const pid of productIds) {
      const targetReviews = visibleReviews.filter((r) => r.product_id === pid);
      const count = targetReviews.length;
      const avg = count > 0 ? Number((targetReviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / count).toFixed(1)) : 0;
      state.products = state.products.map((p) =>
        p.id === pid ? { ...p, rating: avg, rating_count: count } : p
      );
    }
  }

  if (opts?.recalculateAll || opts?.dealerId) {
    const dealerIds = opts?.recalculateAll
      ? Array.from(new Set(state.dealers.map((d) => d.id)))
      : [opts?.dealerId!];

    for (const did of dealerIds) {
      const targetReviews = visibleReviews.filter((r) => r.dealer_id === did);
      if (targetReviews.length > 0) {
        const count = targetReviews.length;
        const avg = Number((targetReviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / count).toFixed(1));
        state.dealers = state.dealers.map((d) =>
          d.id === did ? { ...d, rating: avg, rating_count: count } : d
        );
      } else {
        // When all reviews are removed/hidden for a dealer modified in runtime, reflect 0 accurate count
        // unless this is a clean initial seed with no review interaction history.
        const anyReviewsForDealer = state.reviews.some((r) => r.dealer_id === did);
        if (anyReviewsForDealer || !opts?.recalculateAll) {
          state.dealers = state.dealers.map((d) =>
            d.id === did ? { ...d, rating: 0, rating_count: 0 } : d
          );
        }
      }
    }
  }
}

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
    // fallback safely to memory if disk unavailable
  }
}

function writeStateToDisk(state: ServerDbState): void {
  try {
    ensureDataDir();
    const tmpPath = `${DB_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(state), 'utf8');
    fs.renameSync(tmpPath, DB_FILE);
    const stat = fs.statSync(DB_FILE);
    globalStore.__dcServerDbMtime = stat.mtimeMs;
  } catch {
    // non-fatal fallback to in-memory state
  }
}

function loadStateFromDiskIfNewer(): void {
  try {
    if (!fs.existsSync(DB_FILE)) return;
    const stat = fs.statSync(DB_FILE);
    if (globalStore.__dcServerDbState && globalStore.__dcServerDbMtime && stat.mtimeMs <= globalStore.__dcServerDbMtime) {
      return;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<ServerDbState>;
    if (parsed && Array.isArray(parsed.dealers) && Array.isArray(parsed.products)) {
      const seed = createSeedState();
      globalStore.__dcServerDbState = {
        ...seed,
        ...parsed,
        dealerCredentials: { ...seed.dealerCredentials, ...(parsed.dealerCredentials || {}) },
        notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
        reviewReports: Array.isArray(parsed.reviewReports) ? parsed.reviewReports : [],
        moderationLogs: Array.isArray(parsed.moderationLogs) ? parsed.moderationLogs : [],
        pushNotifications: Array.isArray(parsed.pushNotifications) ? parsed.pushNotifications : [],
      };
      globalStore.__dcServerDbMtime = stat.mtimeMs;
    }
  } catch {
    // ignore corrupt/transient read and keep memory state
  }
}

export function getServerDb(): ServerDbState {
  loadStateFromDiskIfNewer();
  if (!globalStore.__dcServerDbState) {
    globalStore.__dcServerDbState = createSeedState();
    writeStateToDisk(globalStore.__dcServerDbState);
  }
  return globalStore.__dcServerDbState;
}

export function subscribeRealtimeEvents(listener: RealtimeListener): () => void {
  if (!globalStore.__dcRealtimeSubscribers) {
    globalStore.__dcRealtimeSubscribers = new Set();
  }
  globalStore.__dcRealtimeSubscribers.add(listener);
  return () => {
    globalStore.__dcRealtimeSubscribers?.delete(listener);
  };
}

export function emitRealtimeEvent(event: Omit<RealtimeEvent, 'id' | 'timestamp'>): void {
  const fullEvent: RealtimeEvent = {
    ...event,
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  globalStore.__dcRealtimeSubscribers?.forEach((listener) => {
    try {
      listener(fullEvent);
    } catch {
      // ignore disconnected listener
    }
  });
}

export function mutateServerDb<T>(
  mutator: (state: ServerDbState, emit: (event: Omit<RealtimeEvent, 'id' | 'timestamp'>) => void) => T
): T {
  const state = getServerDb();
  const pendingEvents: Array<Omit<RealtimeEvent, 'id' | 'timestamp'>> = [];
  const collectEmit = (event: Omit<RealtimeEvent, 'id' | 'timestamp'>) => {
    pendingEvents.push(event);
  };

  const result = mutator(state, collectEmit);
  state.updatedAt = Date.now();
  writeStateToDisk(state);

  for (const evt of pendingEvents) {
    emitRealtimeEvent(evt);
  }
  return result;
}

export function createNotificationInState(
  state: ServerDbState,
  input: {
    recipientId: string;
    recipientRole: NotificationRecipientRole;
    type: Notification['type'];
    title: string;
    message: string;
    productId?: string | null;
    dealerId?: string | null;
    relatedRecordId?: string | null;
    linkUrl?: string | null;
    productName?: string | null;
    dealerName?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
  }
): Notification | null {
  const normalizedRecipient = input.recipientId.trim().toLowerCase();
  const duplicate = state.notifications.find(
    (n) =>
      (n.recipient_id || n.customer_id || '').toLowerCase() === normalizedRecipient &&
      n.recipient_role === input.recipientRole &&
      n.type === input.type &&
      (input.relatedRecordId ? n.related_record_id === input.relatedRecordId : false) &&
      !n.is_read &&
      Date.now() - new Date(n.created_at).getTime() < 5000
  );
  if (duplicate) return duplicate;

  const notif: Notification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    customer_id: input.recipientRole === 'customer' ? input.recipientId : `${input.recipientRole}:${input.recipientId}`,
    recipient_id: input.recipientId,
    recipient_role: input.recipientRole,
    type: input.type,
    title: input.title,
    message: input.message,
    product_id: input.productId ?? null,
    dealer_id: input.dealerId ?? null,
    related_record_id: input.relatedRecordId ?? null,
    link_url: input.linkUrl ?? null,
    product_name: input.productName ?? null,
    dealer_name: input.dealerName ?? null,
    old_value: input.oldValue ?? null,
    new_value: input.newValue ?? null,
    pin_code: null,
    distance_km: null,
    is_read: false,
    created_at: new Date().toISOString(),
  };

  state.notifications = [notif, ...state.notifications].slice(0, 300);
  return notif;
}

export function recordModerationLogInState(
  state: ServerDbState,
  input: {
    action: string;
    entityType: ModerationLog['entity_type'];
    entityId: string;
    entityName?: string | null;
    performedBy: string;
    reason?: string | null;
    details?: Record<string, unknown>;
  }
): ModerationLog {
  const log: ModerationLog = {
    id: `mod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    product_id: input.entityType === 'product' ? input.entityId : null,
    product_image_id: null,
    action: input.action,
    actor_type: 'admin',
    actor_id: input.performedBy,
    actor_name: input.performedBy,
    verdict: input.action,
    flags: [],
    confidence: null,
    notes: input.reason ?? null,
    image_url: null,
    image_version: null,
    metadata: input.details ?? {},
    entity_type: input.entityType,
    entity_id: input.entityId,
    entity_name: input.entityName ?? null,
    performed_by: input.performedBy,
    reason: input.reason ?? null,
    details: input.details ?? {},
    created_at: new Date().toISOString(),
  };
  state.moderationLogs = [log, ...state.moderationLogs].slice(0, 500);
  return log;
}

export function verifyDealerLoginInServerDb(email: string, password: string): {
  ok: boolean;
  dealer?: Dealer;
  error?: string;
} {
  const state = getServerDb();
  const normalized = email.trim().toLowerCase();
  const dealer = state.dealers.find((d) => d.email.toLowerCase() === normalized);
  if (!dealer) {
    // Check if an unapproved application matches so we can return clear status message
    const pendingApp = state.dealerApplications.find((a) => a.email.toLowerCase() === normalized);
    if (pendingApp) {
      return {
        ok: false,
        error:
          pendingApp.status === 'rejected'
            ? `Your dealer application was rejected${pendingApp.rejection_reason ? `: ${pendingApp.rejection_reason}` : '.'}`
            : `Your dealer application is currently "${pendingApp.status}". Wait for Admin approval.`,
      };
    }
    return { ok: false, error: 'Dealer account not found. Apply via Own a Shop or check email.' };
  }

  if (dealer.status !== 'approved') {
    return {
      ok: false,
      error: `Dealer account is ${dealer.status}. Only Admin-approved dealers can sign in.`,
    };
  }

  const cred = state.dealerCredentials[normalized];
  const expectedPassword = cred?.password || process.env.DEALER_DEMO_PASSWORD || 'Dealer@123';
  const trimmedPw = password.trim();

  // Accept registered dealer password OR initial seed password (for default demo dealers without hardcoded secrets exposed in browser)
  if (!trimmedPw || trimmedPw !== expectedPassword) {
    return { ok: false, error: 'Invalid dealer password.' };
  }

  return { ok: true, dealer };
}
