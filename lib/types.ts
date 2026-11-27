// ==========================================
// DealerConnect AI — Core Type Definitions
// Firebase-Powered Marketplace Architecture
// ==========================================

export type UserRole = 'customer' | 'dealer' | 'admin';

// ==================== 8 MAJOR CATEGORY GROUPS ====================

export type CategoryGroup = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
  category_count: number;
};

// ==================== 30 CATEGORIES ====================

export type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  group_id: string;
  group_name: string;
  description: string | null;
  sort_order: number;
  subcategories: string[];
  popular_searches?: string[];
  parent_id?: string | null;
  image_url?: string | null;
};

// ==================== BRAND ====================

export type Brand = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
};

// ==================== DEALER ====================

export type Dealer = {
  id: string;
  shop_name: string;
  description: string | null;
  owner_name: string;
  email: string;
  phone: string;
  whatsapp: string | null;
  address: string;
  village: string | null;
  city: string;
  district: string | null;
  state: string;
  pin_code: string;
  gst_number: string | null;
  logo_url: string | null;
  banner_url: string | null;
  map_lat: number | null;
  map_lng: number | null;
  working_hours: Record<string, string>;
  rating: number;
  rating_count: number;
  status: 'pending' | 'approved' | 'suspended' | 'blocked' | 'rejected';
  auth_user_id: string | null;
  business_category_id: string | null;
  delivery_available: boolean;
  pickup_available: boolean;
  home_delivery_radius_km: number;
  product_count: number;
  view_count: number;
  created_at: string;
  updated_at: string | null;
  approved_at: string | null;
  category?: Category | null;
};

// ==================== DEALER APPLICATION ====================

export type DealerApplicationStatus =
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'more_info_required';

export type DealerApplication = {
  id: string;
  customer_id: string;
  owner_name: string;
  phone: string;
  email: string;
  alt_phone?: string | null;
  shop_name: string;
  category_id?: string | null;
  category_name?: string | null;
  description?: string | null;
  logo_url?: string | null;
  images?: string[];
  address: string;
  village?: string | null;
  city: string;
  district?: string | null;
  state: string;
  pin_code: string;
  map_lat?: number | null;
  map_lng?: number | null;
  whatsapp?: string | null;
  opening_time?: string | null;
  closing_time?: string | null;
  delivery_available: boolean;
  delivery_details?: string | null;
  home_delivery_radius_km?: number | null;
  pickup_available?: boolean;
  gst_number?: string | null;
  status: DealerApplicationStatus;
  admin_remarks?: string | null;
  rejection_reason?: string | null;
  dealer_password?: string | null;
  created_at: string;
  updated_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
};

// ==================== PRODUCT ====================

export type Product = {
  id: string;
  dealer_id: string | null;
  name: string;
  slug: string;
  brand_id: string | null;
  category_id: string | null;
  model: string | null;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  specifications: Record<string, string>;
  features: string[];
  price: number;
  discount_price: number | null;
  color: string | null;
  size: string | null;
  weight: string | null;
  material: string | null;
  warranty: string | null;
  delivery_available: boolean;
  pickup_available: boolean;
  return_policy: string | null;
  tags: string[];
  images: string[];
  video_url: string | null;
  stock_qty: number;
  stock_status: 'in_stock' | 'limited' | 'out_of_stock' | 'restocking';
  is_featured: boolean;
  is_trending: boolean;
  is_master: boolean;
  is_active: boolean;
  short_description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  keywords: string[];
  model_number: string | null;
  ai_confidence: number;
  ai_status: 'pending' | 'generating' | 'generated' | 'approved' | 'failed';
  subcategory_id: string | null;
  subcategory_name?: string | null;
  variants: {
    sizes?: string[];
    colors?: string[];
    models?: string[];
  };
  view_count: number;
  search_count: number;
  ai_verified: boolean;
  ai_description: string | null;
  ai_tags: string[];
  moderation_status: 'pending' | 'approved' | 'rejected' | 'flagged';
  created_at: string;
  updated_at?: string | null;

  // UI convenience and backward compatibility fields
  title?: string;
  stock_quantity?: number;
  warranty_info?: string;
  rating?: number;
  rating_count?: number;

  dealer?: Dealer | null;
  category?: Category | null;
  subcategory?: Category | null;
  brand?: Brand | null;
};

// ==================== DEALER INVENTORY ====================

export type DealerInventory = {
  id: string;
  dealer_id: string;
  product_id: string;
  price: number;
  discount_price: number | null;
  stock_qty: number;
  stock_status: 'in_stock' | 'out_of_stock' | 'limited';
  available_colors: string[];
  available_sizes: string[];
  available_models: string[];
  condition: 'new' | 'used' | 'refurbished' | 'open_box';
  warranty: string | null;
  images: string[];
  delivery_available: boolean;
  pickup_available: boolean;
  offer_price: number | null;
  dealer_image_id: string | null;
  moderation_status: 'pending' | 'approved' | 'rejected' | 'flagged';
  is_active: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;

  product?: Product | null;
  dealer?: Dealer | null;
};

// ==================== PRODUCT IMAGE ====================

export type ProductImage = {
  id: string;
  product_id: string;
  image_url: string;
  version: number;
  ai_verdict: 'pending' | 'approved' | 'flagged' | 'rejected';
  ai_confidence: number;
  ai_flags: string[];
  ai_detected_product: string | null;
  ai_detected_brand: string | null;
  ai_detected_category: string | null;
  ai_detected_color: string | null;
  ai_description: string | null;
  ai_tags: string[] | null;
  ai_warning: string | null;
  moderation_status:
    | 'pending'
    | 'ai_approved'
    | 'ai_flagged'
    | 'admin_approved'
    | 'admin_rejected'
    | 'dealer_reuploaded';
  dealer_comment: string | null;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  is_active: boolean;
  created_at: string;
};

// ==================== MODERATION LOG ====================

export type ModerationLog = {
  id: string;
  product_id: string | null;
  product_image_id: string | null;
  action: string;
  actor_type: 'ai' | 'admin' | 'dealer' | 'system';
  actor_id: string | null;
  actor_name: string | null;
  verdict: string | null;
  flags: string[];
  confidence: number | null;
  notes: string | null;
  image_url: string | null;
  image_version: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

// ==================== PUSH SUBSCRIPTION ====================

export type PushSubscription = {
  id: string;
  customer_id: string;
  endpoint: string;
  subscription: Record<string, unknown>;
  preferences: {
    in_stock: boolean;
    price_drop: boolean;
    nearby: boolean;
  };
  pin_code: string | null;
  product_ids: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// ==================== NOTIFICATION ====================

export type Notification = {
  id: string;
  customer_id: string;
  type: 'in_stock' | 'price_drop' | 'nearby_available' | 'moderation_update' | 'system';
  title: string;
  message: string;
  product_id: string | null;
  dealer_id: string | null;
  product_name: string | null;
  dealer_name: string | null;
  old_value: string | null;
  new_value: string | null;
  pin_code: string | null;
  distance_km: number | null;
  is_read: boolean;
  created_at: string;
};

// ==================== REVIEW ====================

export type Review = {
  id: string;
  dealer_id: string | null;
  product_id: string | null;
  customer_name: string;
  rating: number;
  quality_rating: number | null;
  cleanliness_rating: number | null;
  behavior_rating: number | null;
  price_rating: number | null;
  availability_rating: number | null;
  delivery_rating: number | null;
  comment: string | null;
  created_at: string;
  is_approved?: boolean;
};

// ==================== ENQUIRY ====================

export type Enquiry = {
  id: string;
  dealer_id: string | null;
  product_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  message: string | null;
  channel: 'call' | 'whatsapp' | 'form';
  created_at: string;
};

// ==================== SEARCH LOG ====================

export type SearchLog = {
  id: string;
  query: string;
  pin_code: string | null;
  category_id: string | null;
  results_count: number;
  created_at: string;
};

// ==================== MESSAGE ====================

export type Message = {
  id: string;
  customer_id: string;
  dealer_id: string;
  sender_type: 'customer' | 'dealer';
  body: string;
  product_id: string | null;
  image_url: string | null;
  is_read: boolean;
  created_at: string;

  dealer?: Dealer | null;
};

// ==================== CUSTOMER PROFILE ====================

export type CustomerProfile = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  pin_code: string | null;
  preferred_city: string | null;
  preferred_location: Record<string, unknown>;
  avatar_url: string | null;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

// ==================== CUSTOMER FAVORITE ====================

export type CustomerFavorite = {
  id: string;
  user_id: string;
  product_id: string | null;
  dealer_id: string | null;
  type: 'product' | 'dealer';
  created_at: string;

  product?: Product | null;
  dealer?: Dealer | null;
};

// ==================== CUSTOMER SEARCH HISTORY ====================

export type CustomerSearchHistory = {
  id: string;
  user_id: string;
  query: string;
  search_type: 'text' | 'ai' | 'image' | 'voice';
  pin_code: string | null;
  location_label: string | null;
  results_count: number;
  created_at: string;
};

// ==================== APP SETTINGS & THEMES ====================

export type ThemePreset =
  | 'gold-navy'
  | 'gold-black'
  | 'blue'
  | 'green-white'
  | 'black-white'
  | 'royal-purple'
  | 'sunset'
  | 'emerald'
  | 'ocean'
  | 'navy-light'
  | 'gold-sand';

export type HomepageSection = {
  id: string;
  type: 'header' | 'search' | 'location' | 'categories' | 'trending' | 'offers' | 'nearby' | 'dealers' | 'recommended' | 'recent' | 'banner' | 'products' | 'text' | 'image';
  title: string;
  subtitle?: string;
  enabled: boolean;
  sort_order: number;
  config?: Record<string, unknown>;
};

export type AppSettings = {
  id: number;
  app_name: string;
  tagline: string | null;
  logo_url: string | null;
  icon_emoji: string | null;
  theme_preset: ThemePreset;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  background_color: string | null;
  homepage_config: {
    sections: HomepageSection[];
    banners: { id: string; image_url: string; title: string; subtitle: string; link: string; enabled: boolean }[];
    headings: Record<string, string>;
    descriptions: Record<string, string>;
  } | null;
  seo_config: {
    meta_title: string | null;
    meta_description: string | null;
    keywords: string[];
    og_image_url: string | null;
  } | null;
  notification_config: {
    enable_push: boolean;
    default_audience: 'all' | 'customers' | 'dealers';
  } | null;
  pwa_config: {
    short_name: string | null;
    display: 'standalone' | 'fullscreen' | 'minimal-ui';
    theme_color: string | null;
    background_color: string | null;
  } | null;
  updated_at: string;
  updated_by: string | null;
};

// ==================== PUSH NOTIFICATION ====================

export type PushNotification = {
  id: string;
  title: string;
  body: string;
  target_audience: 'all' | 'customers' | 'dealers' | 'specific';
  target_user_ids: string[] | null;
  sent_by: string | null;
  sent_at: string;
  delivery_status: 'pending' | 'sent' | 'failed';
};

// ==================== USER PUSH SUBSCRIPTION ====================

export type UserPushSubscription = {
  id: string;
  user_id: string;
  fcm_token: string | null;
  device_type: 'web' | 'android' | 'ios' | null;
  created_at: string;
  is_active: boolean;
};

// ==================== STRICT COLOR PALETTE ====================
// Dark Navy: #2C2F3F
// Golden Yellow: #E6B045
// Light Lemon Yellow: #FAF283
// Golden Sand: #EDC65A
// White: #FFFFFF
// Soft Gold: #F3DA6C

export const APP_COLORS = {
  darkNavy: '#2C2F3F',
  goldenYellow: '#E6B045',
  lemonYellow: '#FAF283',
  goldenSand: '#EDC65A',
  white: '#FFFFFF',
  softGold: '#F3DA6C',
} as const;

export const THEME_PRESETS: Record<
  string,
  {
    label: string;
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
    card: string;
    darkBg: string;
    darkFg: string;
    darkCard: string;
  }
> = {
  'gold-navy': {
    label: 'Dark Navy & Golden Yellow',
    primary: '40 78% 59%', // #E6B045
    secondary: '44 80% 64%', // #EDC65A
    accent: '49 84% 69%', // #F3DA6C
    background: '0 0% 100%', // #FFFFFF
    foreground: '231 18% 21%', // #2C2F3F
    card: '0 0% 100%',
    darkBg: '231 18% 21%', // #2C2F3F
    darkFg: '0 0% 100%', // #FFFFFF
    darkCard: '231 18% 25%',
  },
  'gold-black': {
    label: 'Luxury Gold & Navy',
    primary: '40 78% 59%',
    secondary: '44 80% 64%',
    accent: '49 84% 69%',
    background: '231 18% 21%',
    foreground: '0 0% 100%',
    card: '231 18% 25%',
    darkBg: '231 18% 21%',
    darkFg: '0 0% 100%',
    darkCard: '231 18% 25%',
  },
};
