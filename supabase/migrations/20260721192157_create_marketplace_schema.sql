/*
# DealerConnect AI - Marketplace Schema

## Overview
Creates the core schema for a local dealer marketplace where customers search
for products by name/PIN code/location and discover nearby dealers with stock
and pricing. Supports every category of local retail business (electronics,
grocery, fashion, medical, furniture, etc.).

## New Tables
1. `categories` - Master catalog of business/product categories (Electronics, Grocery, Fashion, Medical, etc.)
   - id (uuid pk), name (unique), slug (unique), icon (lucide icon name), description, sort_order, created_at
2. `brands` - Product brands
   - id (uuid pk), name (unique), slug, logo_url, created_at
3. `dealers` - Registered local shops/dealers
   - id (uuid pk), shop_name, owner_name, email (unique), phone, whatsapp, password_hash (placeholder),
     address, village, city, district, state, pin_code, gst_number, logo_url, banner_url, map_lat, map_lng,
     working_hours (jsonb), rating (numeric avg), rating_count, status (pending/approved/suspended/blocked),
     business_category_id (fk categories), delivery_available, pickup_available, home_delivery_radius_km,
     product_count (cached), view_count, created_at, approved_at
4. `products` - Inventory items listed by dealers (and master catalog entries)
   - id (uuid pk), dealer_id (fk dealers, nullable for master catalog), name, slug, brand_id (fk brands),
     category_id (fk categories), model, sku, barcode, description, specifications (jsonb), features (text[]),
     price, discount_price, color, size, weight, material, warranty, delivery_available, pickup_available,
     return_policy, tags (text[]), images (text[]), video_url, stock_qty, stock_status (in_stock/limited/out_of_stock/restocking),
     is_featured, is_trending, is_master (boolean - master catalog item not tied to a dealer),
     view_count, search_count, created_at
5. `reviews` - Customer reviews for dealers and products
   - id (uuid pk), dealer_id (fk dealers), product_id (fk products, nullable), customer_name, rating (1-5),
     quality_rating, cleanliness_rating, behavior_rating, price_rating, availability_rating, delivery_rating,
     comment, created_at
6. `enquiries` - Customer enquiries to dealers (click-to-call/whatsapp tracked)
   - id (uuid pk), dealer_id (fk dealers), product_id (fk products nullable), customer_name, customer_phone,
     message, channel (call/whatsapp/form), created_at
7. `search_logs` - Analytics for searches (term, pin_code, results_count)
   - id (uuid pk), query, pin_code, category_id (fk nullable), results_count, created_at

## Security
- This is a demo marketplace with no customer auth (search/browse is public).
- All tables use `TO anon, authenticated` policies so the anon-key frontend can read.
- Writes (reviews, enquiries, search_logs) are also open to anon for demo purposes.
- In production, dealer/admin writes would be scoped to authenticated roles with ownership checks.

## Notes
1. Schema is idempotent - safe to re-run.
2. Indexes added for pin_code, slug, category, brand, stock_status for fast lookups.
3. Uses gen_random_uuid() for all primary keys.
4. Numeric rating with rating_count for averaging.
5. jsonb columns for flexible specifications and working hours.
*/

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============ CATEGORIES ============
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  icon text NOT NULL DEFAULT 'Tag',
  description text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read_categories" ON categories;
CREATE POLICY "anon_read_categories" ON categories FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_write_categories" ON categories;
CREATE POLICY "anon_write_categories" ON categories FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============ BRANDS ============
CREATE TABLE IF NOT EXISTS brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL,
  logo_url text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read_brands" ON brands;
CREATE POLICY "anon_read_brands" ON brands FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_write_brands" ON brands;
CREATE POLICY "anon_write_brands" ON brands FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============ DEALERS ============
CREATE TABLE IF NOT EXISTS dealers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_name text NOT NULL,
  owner_name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text NOT NULL,
  whatsapp text,
  password_hash text NOT NULL DEFAULT 'demo',
  address text NOT NULL,
  village text,
  city text NOT NULL,
  district text,
  state text NOT NULL,
  pin_code text NOT NULL,
  gst_number text,
  logo_url text,
  banner_url text,
  map_lat double precision,
  map_lng double precision,
  working_hours jsonb DEFAULT '{}'::jsonb,
  rating numeric(2,1) NOT NULL DEFAULT 0,
  rating_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','suspended','blocked')),
  business_category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  delivery_available boolean NOT NULL DEFAULT false,
  pickup_available boolean NOT NULL DEFAULT true,
  home_delivery_radius_km numeric(4,1) NOT NULL DEFAULT 0,
  product_count int NOT NULL DEFAULT 0,
  view_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  approved_at timestamptz
);
ALTER TABLE dealers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read_dealers" ON dealers;
CREATE POLICY "anon_read_dealers" ON dealers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_write_dealers" ON dealers;
CREATE POLICY "anon_write_dealers" ON dealers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_dealers_pin_code ON dealers(pin_code);
CREATE INDEX IF NOT EXISTS idx_dealers_status ON dealers(status);
CREATE INDEX IF NOT EXISTS idx_dealers_category ON dealers(business_category_id);
CREATE INDEX IF NOT EXISTS idx_dealers_city ON dealers(city);

-- ============ PRODUCTS ============
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid REFERENCES dealers(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  brand_id uuid REFERENCES brands(id) ON DELETE SET NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  model text,
  sku text,
  barcode text,
  description text,
  specifications jsonb DEFAULT '{}'::jsonb,
  features text[] DEFAULT '{}',
  price numeric(12,2) NOT NULL DEFAULT 0,
  discount_price numeric(12,2),
  color text,
  size text,
  weight text,
  material text,
  warranty text,
  delivery_available boolean NOT NULL DEFAULT false,
  pickup_available boolean NOT NULL DEFAULT true,
  return_policy text,
  tags text[] DEFAULT '{}',
  images text[] DEFAULT '{}',
  video_url text,
  stock_qty int NOT NULL DEFAULT 0,
  stock_status text NOT NULL DEFAULT 'in_stock' CHECK (stock_status IN ('in_stock','limited','out_of_stock','restocking')),
  is_featured boolean NOT NULL DEFAULT false,
  is_trending boolean NOT NULL DEFAULT false,
  is_master boolean NOT NULL DEFAULT false,
  view_count int NOT NULL DEFAULT 0,
  search_count int NOT NULL DEFAULT 0,
  ai_verified boolean NOT NULL DEFAULT false,
  ai_description text,
  ai_tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read_products" ON products;
CREATE POLICY "anon_read_products" ON products FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_write_products" ON products;
CREATE POLICY "anon_write_products" ON products FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_dealer ON products(dealer_id);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock_status);
CREATE INDEX IF NOT EXISTS idx_products_search ON products USING gin (to_tsvector('english', name || ' ' || COALESCE(description,'')));
CREATE INDEX IF NOT EXISTS idx_products_tags ON products USING gin (tags);

-- ============ REVIEWS ============
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid REFERENCES dealers(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  quality_rating int CHECK (quality_rating >= 1 AND quality_rating <= 5),
  cleanliness_rating int CHECK (cleanliness_rating >= 1 AND cleanliness_rating <= 5),
  behavior_rating int CHECK (behavior_rating >= 1 AND behavior_rating <= 5),
  price_rating int CHECK (price_rating >= 1 AND price_rating <= 5),
  availability_rating int CHECK (availability_rating >= 1 AND availability_rating <= 5),
  delivery_rating int CHECK (delivery_rating >= 1 AND delivery_rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read_reviews" ON reviews;
CREATE POLICY "anon_read_reviews" ON reviews FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_write_reviews" ON reviews;
CREATE POLICY "anon_write_reviews" ON reviews FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_reviews_dealer ON reviews(dealer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);

-- ============ ENQUIRIES ============
CREATE TABLE IF NOT EXISTS enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid REFERENCES dealers(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  customer_name text,
  customer_phone text,
  message text,
  channel text NOT NULL DEFAULT 'form' CHECK (channel IN ('call','whatsapp','form')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read_enquiries" ON enquiries;
CREATE POLICY "anon_read_enquiries" ON enquiries FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_write_enquiries" ON enquiries;
CREATE POLICY "anon_write_enquiries" ON enquiries FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_enquiries_dealer ON enquiries(dealer_id);

-- ============ SEARCH_LOGS ============
CREATE TABLE IF NOT EXISTS search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  pin_code text,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  results_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE search_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read_search_logs" ON search_logs;
CREATE POLICY "anon_read_search_logs" ON search_logs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_write_search_logs" ON search_logs;
CREATE POLICY "anon_write_search_logs" ON search_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_search_logs_query ON search_logs(query);
CREATE INDEX IF NOT EXISTS idx_search_logs_pin ON search_logs(pin_code);
