/*
# Master Catalog & Dealer Inventory Schema

## Overview
Transforms the marketplace from dealer-created products to an admin-owned master catalog
with dealer inventory entries. Admins create and manage the canonical product list;
dealers select products from the catalog and specify their own stock, pricing, and variants.

## New Tables
- `dealer_inventory` — Links a dealer to a master product with dealer-specific pricing,
  stock, condition, warranty, colors, sizes, and store-specific images. Each row represents
  one dealer's offering of a catalog product.

## Modified Tables
- `products` — Added `is_active` (boolean, default true) for enable/disable,
  `subcategory_id` (uuid, nullable, self-referencing categories for subcategories),
  `variants` (jsonb) for variant definitions (size options, color options, model options).

## Security
- `dealer_inventory` uses `TO anon, authenticated` policies (no customer auth).
- RLS enabled on `dealer_inventory`.

## Important Notes
1. The existing `products.is_master` column (already present) distinguishes admin catalog
   products (is_master = true) from any legacy dealer-created products (is_master = false).
2. The `products.dealer_id` column is already nullable — master catalog products have
   dealer_id = null; dealer inventory entries link via the new `dealer_inventory` table.
3. `subcategory_id` references `categories(id)` to allow hierarchical category organization
   without a separate subcategories table.
4. The `variants` jsonb column stores variant definitions like:
   { "sizes": ["S","M","L"], "colors": ["Red","Blue"], "models": ["Base","Pro"] }
*/

-- ============================================================
-- 1. Add columns to products table
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE products ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'subcategory_id'
  ) THEN
    ALTER TABLE products ADD COLUMN subcategory_id uuid REFERENCES categories(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'variants'
  ) THEN
    ALTER TABLE products ADD COLUMN variants jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_is_master ON products(is_master);
CREATE INDEX IF NOT EXISTS idx_products_subcategory_id ON products(subcategory_id);

-- Mark all existing products as master catalog entries (they become the canonical list)
UPDATE products SET is_master = true WHERE is_master = false AND dealer_id IS NULL;

-- ============================================================
-- 2. dealer_inventory table
-- ============================================================
CREATE TABLE IF NOT EXISTS dealer_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  -- Dealer-specific pricing
  price numeric NOT NULL DEFAULT 0,
  discount_price numeric,
  -- Dealer-specific stock
  stock_qty integer NOT NULL DEFAULT 0,
  stock_status text NOT NULL DEFAULT 'in_stock',
  -- 'in_stock' | 'out_of_stock' | 'limited'
  -- Dealer-specific variant availability
  available_colors text[] NOT NULL DEFAULT '{}',
  available_sizes text[] NOT NULL DEFAULT '{}',
  available_models text[] NOT NULL DEFAULT '{}',
  -- Dealer-specific attributes
  condition text NOT NULL DEFAULT 'new',
  -- 'new' | 'used' | 'refurbished' | 'open_box'
  warranty text,
  -- e.g. "1 year manufacturer", "6 months store warranty", "No warranty"
  -- Dealer-specific images (optional override of catalog images)
  images text[] NOT NULL DEFAULT '{}',
  -- Moderation status for dealer-specific images
  moderation_status text NOT NULL DEFAULT 'approved',
  -- 'pending' | 'approved' | 'rejected' | 'flagged'
  -- Metadata
  is_active boolean NOT NULL DEFAULT true,
  -- dealer can disable a listing without removing it
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Ensure one inventory entry per dealer per product
  UNIQUE(dealer_id, product_id)
);

ALTER TABLE dealer_inventory ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_dealer_inventory_dealer_id ON dealer_inventory(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_inventory_product_id ON dealer_inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_dealer_inventory_active ON dealer_inventory(is_active);
CREATE INDEX IF NOT EXISTS idx_dealer_inventory_stock ON dealer_inventory(stock_status);

DROP POLICY IF EXISTS "anon_select_dealer_inventory" ON dealer_inventory;
CREATE POLICY "anon_select_dealer_inventory" ON dealer_inventory FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_dealer_inventory" ON dealer_inventory;
CREATE POLICY "anon_insert_dealer_inventory" ON dealer_inventory FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_dealer_inventory" ON dealer_inventory;
CREATE POLICY "anon_update_dealer_inventory" ON dealer_inventory FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_dealer_inventory" ON dealer_inventory;
CREATE POLICY "anon_delete_dealer_inventory" ON dealer_inventory FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- 3. Add parent_id to categories for subcategory hierarchy
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE categories ADD COLUMN parent_id uuid REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
