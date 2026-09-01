-- Add AI generation fields to products table
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS short_description text,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS keywords text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS model_number text,
  ADD COLUMN IF NOT EXISTS ai_confidence numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_status text DEFAULT 'pending';

-- ai_status values: 'pending' | 'generating' | 'generated' | 'approved' | 'failed'

-- Add delivery/pickup and offer_price to dealer_inventory
ALTER TABLE dealer_inventory
  ADD COLUMN IF NOT EXISTS delivery_available boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pickup_available boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS offer_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS dealer_image_id uuid;

-- Add index for duplicate detection by slug
CREATE INDEX IF NOT EXISTS idx_products_slug_master ON products(slug) WHERE is_master = true;

-- Add index for AI status filtering
CREATE INDEX IF NOT EXISTS idx_products_ai_status ON products(ai_status) WHERE is_master = true;

-- Add index for dealer_inventory delivery/pickup
CREATE INDEX IF NOT EXISTS idx_dealer_inventory_delivery ON dealer_inventory(dealer_id) WHERE delivery_available = true;
