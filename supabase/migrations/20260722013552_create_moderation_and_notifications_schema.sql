/*
# Moderation, AI Image Detection & Push Notifications Schema

## Overview
Adds four new tables and one column to support:
1. AI image moderation for dealer-uploaded product images (duplicate/fake/mismatch detection)
2. Moderation audit trail (image versions, AI verdicts, admin/dealer actions, timestamps)
3. Customer push notification subscriptions (in-stock, price drop, nearby availability alerts)
4. Notification records for the customer notification feed

## New Tables
- `product_images` — Versioned image audit trail. Each row = one image upload attempt.
- `moderation_logs` — Audit trail for every moderation action (AI, admin, dealer).
- `push_subscriptions` — Web Push API subscriptions per customer (browser UUID).
- `notifications` — Customer-facing notification records with read/unread status.

## Modified Tables
- `products` — Added `moderation_status` column (default 'approved' so existing products stay visible).

## Security
- All tables use `TO anon, authenticated` policies (no customer auth).
- RLS enabled on every new table.
*/

-- ============================================================
-- 1. Add moderation_status column to products
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'moderation_status'
  ) THEN
    ALTER TABLE products ADD COLUMN moderation_status text NOT NULL DEFAULT 'approved';
    ALTER TABLE products ADD CONSTRAINT products_moderation_status_check
      CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'flagged'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_moderation_status ON products(moderation_status);

-- ============================================================
-- 2. product_images table
-- ============================================================
CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  ai_verdict text NOT NULL DEFAULT 'pending',
  ai_confidence numeric DEFAULT 0,
  ai_flags text[] NOT NULL DEFAULT '{}',
  ai_detected_product text,
  ai_detected_brand text,
  ai_detected_category text,
  ai_detected_color text,
  ai_description text,
  ai_tags text[],
  ai_warning text,
  moderation_status text NOT NULL DEFAULT 'pending',
  dealer_comment text,
  admin_notes text,
  reviewed_by text,
  reviewed_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_moderation ON product_images(moderation_status);
CREATE INDEX IF NOT EXISTS idx_product_images_active ON product_images(is_active);

DROP POLICY IF EXISTS "anon_select_product_images" ON product_images;
CREATE POLICY "anon_select_product_images" ON product_images FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_product_images" ON product_images;
CREATE POLICY "anon_insert_product_images" ON product_images FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_product_images" ON product_images;
CREATE POLICY "anon_update_product_images" ON product_images FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_product_images" ON product_images;
CREATE POLICY "anon_delete_product_images" ON product_images FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- 3. moderation_logs table
-- ============================================================
CREATE TABLE IF NOT EXISTS moderation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  product_image_id uuid REFERENCES product_images(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_type text NOT NULL,
  actor_id text,
  actor_name text,
  verdict text,
  flags text[] NOT NULL DEFAULT '{}',
  confidence numeric,
  notes text,
  image_url text,
  image_version integer,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE moderation_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_moderation_logs_product_id ON moderation_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_image_id ON moderation_logs(product_image_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_action ON moderation_logs(action);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_created ON moderation_logs(created_at DESC);

DROP POLICY IF EXISTS "anon_select_moderation_logs" ON moderation_logs;
CREATE POLICY "anon_select_moderation_logs" ON moderation_logs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_moderation_logs" ON moderation_logs;
CREATE POLICY "anon_insert_moderation_logs" ON moderation_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_moderation_logs" ON moderation_logs;
CREATE POLICY "anon_update_moderation_logs" ON moderation_logs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_moderation_logs" ON moderation_logs;
CREATE POLICY "anon_delete_moderation_logs" ON moderation_logs FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- 4. push_subscriptions table
-- ============================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id text NOT NULL,
  endpoint text NOT NULL,
  subscription jsonb NOT NULL,
  preferences jsonb NOT NULL DEFAULT '{"in_stock": true, "price_drop": true, "nearby": true}',
  pin_code text,
  product_ids text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_push_subs_customer_id ON push_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_active ON push_subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_push_subs_pin_code ON push_subscriptions(pin_code);

DROP POLICY IF EXISTS "anon_select_push_subs" ON push_subscriptions;
CREATE POLICY "anon_select_push_subs" ON push_subscriptions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_push_subs" ON push_subscriptions;
CREATE POLICY "anon_insert_push_subs" ON push_subscriptions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_push_subs" ON push_subscriptions;
CREATE POLICY "anon_update_push_subs" ON push_subscriptions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_push_subs" ON push_subscriptions;
CREATE POLICY "anon_delete_push_subs" ON push_subscriptions FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- 5. notifications table
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id text NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  dealer_id uuid REFERENCES dealers(id) ON DELETE CASCADE,
  product_name text,
  dealer_name text,
  old_value text,
  new_value text,
  pin_code text,
  distance_km numeric,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_notifications_customer_id ON notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(customer_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(customer_id, created_at DESC);

DROP POLICY IF EXISTS "anon_select_notifications" ON notifications;
CREATE POLICY "anon_select_notifications" ON notifications FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_notifications" ON notifications;
CREATE POLICY "anon_insert_notifications" ON notifications FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_notifications" ON notifications;
CREATE POLICY "anon_update_notifications" ON notifications FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_notifications" ON notifications;
CREATE POLICY "anon_delete_notifications" ON notifications FOR DELETE
  TO anon, authenticated USING (true);
