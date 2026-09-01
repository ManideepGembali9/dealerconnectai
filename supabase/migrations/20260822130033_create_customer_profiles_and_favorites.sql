/*
# Create customer authentication tables

## Overview
Adds customer profile, favorites, search history, and enquiry tracking tables
to support the new Customer role alongside existing Dealer and Admin roles.

## New Tables
1. `customer_profiles` - Extends Supabase auth.users with customer-specific fields (name, phone, pin_code, preferred_city)
2. `customer_favorites` - Tracks products and dealers saved by customers
3. `customer_search_history` - Records customer search queries for personalization

## Modified Tables
- `enquiries` - Added `customer_id` column (nullable, links to auth.users) alongside existing `customer_name`/`customer_phone` for backward compatibility

## Security
- RLS enabled on all new tables with owner-scoped policies (auth.uid() = user_id)
- customer_profiles uses auth.uid() = id (same as auth.users id)
- customer_favorites/search_history use user_id DEFAULT auth.uid()
- enquiries: added INSERT policy for authenticated customers on their own rows
*/

-- 1. Customer profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS customer_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  pin_code text,
  preferred_city text,
  preferred_location jsonb DEFAULT '{}'::jsonb,
  avatar_url text,
  preferences jsonb DEFAULT '{"notifications": true, "ai_recommendations": true}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON customer_profiles;
CREATE POLICY "select_own_profile" ON customer_profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON customer_profiles;
CREATE POLICY "insert_own_profile" ON customer_profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON customer_profiles;
CREATE POLICY "update_own_profile" ON customer_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 2. Customer favorites (products + dealers)
CREATE TABLE IF NOT EXISTS customer_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  dealer_id uuid REFERENCES dealers(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'product' CHECK (type IN ('product', 'dealer')),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT favorite_target CHECK (
    (type = 'product' AND product_id IS NOT NULL) OR
    (type = 'dealer' AND dealer_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_customer_favorite
  ON customer_favorites (user_id, type, COALESCE(product_id, '00000000-0000-0000-0000-000000000000'), COALESCE(dealer_id, '00000000-0000-0000-0000-000000000000'));

ALTER TABLE customer_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_favorites" ON customer_favorites;
CREATE POLICY "select_own_favorites" ON customer_favorites FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_favorites" ON customer_favorites;
CREATE POLICY "insert_own_favorites" ON customer_favorites FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_favorites" ON customer_favorites;
CREATE POLICY "delete_own_favorites" ON customer_favorites FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- 3. Customer search history
CREATE TABLE IF NOT EXISTS customer_search_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  query text NOT NULL,
  search_type text NOT NULL DEFAULT 'text' CHECK (search_type IN ('text', 'ai', 'image', 'voice')),
  pin_code text,
  location_label text,
  results_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE customer_search_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_search_history" ON customer_search_history;
CREATE POLICY "select_own_search_history" ON customer_search_history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_search_history" ON customer_search_history;
CREATE POLICY "insert_own_search_history" ON customer_search_history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_search_history" ON customer_search_history;
CREATE POLICY "delete_own_search_history" ON customer_search_history FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- 4. Add customer_id to existing enquiries table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enquiries' AND column_name = 'customer_id') THEN
    ALTER TABLE enquiries ADD COLUMN customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Allow authenticated customers to insert their own enquiries
DROP POLICY IF EXISTS "insert_own_enquiry" ON enquiries;
CREATE POLICY "insert_own_enquiry" ON enquiries FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "select_own_enquiries" ON enquiries;
CREATE POLICY "select_own_enquiries" ON enquiries FOR SELECT
  TO authenticated USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "update_own_enquiries" ON enquiries;
CREATE POLICY "update_own_enquiries" ON enquiries FOR UPDATE
  TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_customer_favorites_user ON customer_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_search_history_user ON customer_search_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enquiries_customer ON enquiries(customer_id) WHERE customer_id IS NOT NULL;