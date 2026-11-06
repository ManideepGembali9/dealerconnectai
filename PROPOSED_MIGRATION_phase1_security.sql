/*
# Phase 1: Security & Authentication Overhaul

## Overview
Fixes all critical security issues from the Phase 1 audit:
1. Adds auth_user_id column to dealers for Supabase Auth linkage
2. Creates role helper functions (is_admin, is_dealer, current_dealer_id)
3. Adds triggers to auto-assign app_metadata.role on signup (customer default, dealer on link)
4. Creates SECURITY DEFINER functions for admin privileged operations
5. Creates a secure dealer account linking function for existing dealers
6. Restricts column-level privileges to prevent privilege escalation
7. Replaces all open USING(true) RLS policies with ownership-scoped policies
8. Adjusts table grants for least-privilege access
9. Adds missing UPDATE/DELETE policies on customer tables

## Non-destructive
- No tables dropped, no columns deleted, no data lost
- All existing dealer records preserved (auth_user_id starts NULL)
- Existing customer auth accounts unaffected
- All policies use DROP IF EXISTS before CREATE for idempotency

## Post-migration steps (manual, NOT part of this migration):
1. Create admin account via Supabase Dashboard > Authentication > Users > Add User
2. Set admin role in SQL Editor:
   UPDATE auth.users SET raw_app_meta_data = '{"role":"admin"}'::jsonb WHERE email = 'your-admin@email.com';
3. Existing dealers use "Set Up Password" flow on dealer login page (email + phone verification)
*/

-- ============================================================
-- SECTION 1: Add auth_user_id to dealers table
-- ============================================================
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS auth_user_id uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_dealers_auth_user_id ON dealers(auth_user_id);

-- ============================================================
-- SECTION 2: Role helper functions
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_dealer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'dealer',
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.current_dealer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.dealers WHERE auth_user_id = auth.uid();
$$;

-- ============================================================
-- SECTION 3: Auth role assignment triggers
-- ============================================================

-- Trigger 1: Default all new auth users to 'customer' role
CREATE OR REPLACE FUNCTION public.set_default_customer_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  IF NEW.raw_app_meta_data IS NULL OR (NEW.raw_app_meta_data ->> 'role') IS NULL THEN
    NEW.raw_app_meta_data = COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || '{"role": "customer"}'::jsonb;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_default_customer_role_trigger ON auth.users;
CREATE TRIGGER set_default_customer_role_trigger
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.set_default_customer_role();

-- Trigger 2: Set role to 'dealer' when a dealer record is linked to an auth user
CREATE OR REPLACE FUNCTION public.set_dealer_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  IF NEW.auth_user_id IS NOT NULL THEN
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "dealer"}'::jsonb
    WHERE id = NEW.auth_user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_dealer_role_trigger ON dealers;
CREATE TRIGGER set_dealer_role_trigger
AFTER INSERT OR UPDATE OF auth_user_id ON dealers
FOR EACH ROW
EXECUTE FUNCTION public.set_dealer_role();

-- ============================================================
-- SECTION 4: Admin SECURITY DEFINER functions
-- ============================================================

-- Approve / suspend / block a dealer
CREATE OR REPLACE FUNCTION public.admin_set_dealer_status(
  p_dealer_id uuid,
  p_new_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  IF p_new_status = 'approved' THEN
    UPDATE dealers SET status = p_new_status, approved_at = now() WHERE id = p_dealer_id;
  ELSE
    UPDATE dealers SET status = p_new_status WHERE id = p_dealer_id;
  END IF;

  INSERT INTO moderation_logs (action, actor_type, actor_id, notes, metadata)
  VALUES (
    'dealer_status_change', 'admin', auth.uid()::text, p_new_status,
    jsonb_build_object('dealer_id', p_dealer_id, 'new_status', p_new_status)
  );
END;
$$;

-- Approve / reject / flag / resubmit a product image (also updates product moderation_status)
CREATE OR REPLACE FUNCTION public.admin_set_image_moderation(
  p_image_id uuid,
  p_new_status text,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id uuid;
  v_image_url text;
  v_image_version integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  SELECT product_id, image_url, version INTO v_product_id, v_image_url, v_image_version
  FROM product_images WHERE id = p_image_id;

  IF v_product_id IS NULL THEN
    RAISE EXCEPTION 'Image not found';
  END IF;

  UPDATE product_images
  SET moderation_status = p_new_status,
      admin_notes = p_notes,
      reviewed_by = auth.uid()::text,
      reviewed_at = now()
  WHERE id = p_image_id;

  IF p_new_status IN ('approved', 'rejected') THEN
    UPDATE products SET moderation_status = p_new_status WHERE id = v_product_id;
  END IF;

  INSERT INTO moderation_logs (product_id, product_image_id, action, actor_type, actor_id, notes, image_url, image_version)
  VALUES (v_product_id, p_image_id, p_new_status, 'admin', auth.uid()::text, p_notes, v_image_url, v_image_version);
END;
$$;

-- Set product moderation status directly
CREATE OR REPLACE FUNCTION public.admin_set_product_moderation(
  p_product_id uuid,
  p_new_status text,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  UPDATE products SET moderation_status = p_new_status WHERE id = p_product_id;

  INSERT INTO moderation_logs (product_id, action, actor_type, actor_id, notes)
  VALUES (p_product_id, 'product_moderation_' || p_new_status, 'admin', auth.uid()::text, p_notes);
END;
$$;

-- Toggle product featured flag
CREATE OR REPLACE FUNCTION public.admin_set_product_featured(
  p_product_id uuid,
  p_featured boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;
  UPDATE products SET is_featured = p_featured WHERE id = p_product_id;
END;
$$;

-- Toggle product trending flag
CREATE OR REPLACE FUNCTION public.admin_set_product_trending(
  p_product_id uuid,
  p_trending boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;
  UPDATE products SET is_trending = p_trending WHERE id = p_product_id;
END;
$$;

-- ============================================================
-- SECTION 5: Dealer account linking function
-- Used by existing dealers (auth_user_id IS NULL) to securely
-- link a new Supabase Auth account. Requires email + phone match.
-- ============================================================

CREATE OR REPLACE FUNCTION public.link_dealer_account(
  p_email text,
  p_phone text,
  p_auth_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_dealer_id uuid;
  v_auth_email text;
BEGIN
  SELECT email INTO v_auth_email FROM auth.users WHERE id = p_auth_user_id;
  IF v_auth_email IS NULL THEN
    RAISE EXCEPTION 'Auth user not found';
  END IF;

  IF v_auth_email != p_email THEN
    RAISE EXCEPTION 'Email mismatch between auth user and dealer record';
  END IF;

  SELECT id INTO v_dealer_id FROM public.dealers
  WHERE email = p_email AND phone = p_phone AND auth_user_id IS NULL;

  IF v_dealer_id IS NULL THEN
    RAISE EXCEPTION 'No matching unlinked dealer account found';
  END IF;

  UPDATE public.dealers SET auth_user_id = p_auth_user_id WHERE id = v_dealer_id;

  RETURN v_dealer_id;
END;
$$;

-- ============================================================
-- SECTION 6: Function execution grants
-- ============================================================

-- Helper functions: callable by everyone (they only read the JWT)
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_dealer() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_dealer_id() TO anon, authenticated;

-- Admin functions: only authenticated (body checks is_admin)
REVOKE EXECUTE ON FUNCTION public.admin_set_dealer_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_dealer_status(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_set_image_moderation(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_image_moderation(uuid, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_set_product_moderation(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_product_moderation(uuid, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_set_product_featured(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_product_featured(uuid, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_set_product_trending(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_product_trending(uuid, boolean) TO authenticated;

-- Dealer linking function: only authenticated
REVOKE EXECUTE ON FUNCTION public.link_dealer_account(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_dealer_account(text, text, uuid) TO authenticated;

-- ============================================================
-- SECTION 7: Column-level privilege restrictions
-- Prevents dealers from updating sensitive columns even when
-- RLS allows the row update. Admin functions bypass this via
-- SECURITY DEFINER (they run as the table owner).
-- ============================================================

-- ---- dealers ----
REVOKE INSERT, UPDATE, DELETE ON dealers FROM anon;
GRANT SELECT ON dealers TO anon;

REVOKE INSERT ON dealers FROM authenticated;
GRANT INSERT (
  shop_name, owner_name, email, phone, whatsapp, address, village,
  city, district, state, pin_code, gst_number, logo_url, banner_url,
  map_lat, map_lng, working_hours, business_category_id,
  delivery_available, pickup_available, home_delivery_radius_km,
  auth_user_id
) ON dealers TO authenticated;

REVOKE UPDATE ON dealers FROM authenticated;
GRANT UPDATE (
  shop_name, owner_name, phone, whatsapp, address, village,
  city, district, state, pin_code, gst_number, logo_url, banner_url,
  map_lat, map_lng, working_hours, business_category_id,
  delivery_available, pickup_available, home_delivery_radius_km
) ON dealers TO authenticated;
-- Dealers CANNOT update: status, rating, rating_count, approved_at,
-- product_count, view_count, email, auth_user_id, created_at, id

-- ---- products ----
REVOKE INSERT, UPDATE, DELETE ON products FROM anon;
GRANT SELECT ON products TO anon;

REVOKE INSERT ON products FROM authenticated;
GRANT INSERT (
  dealer_id, name, slug, brand_id, category_id, model, sku, barcode,
  description, specifications, features, price, discount_price,
  color, size, weight, material, warranty, delivery_available,
  pickup_available, return_policy, tags, images, video_url,
  stock_qty, stock_status, is_active, subcategory_id, variants,
  short_description, seo_title, seo_description, keywords, model_number
) ON products TO authenticated;

REVOKE UPDATE ON products FROM authenticated;
GRANT UPDATE (
  name, slug, brand_id, category_id, model, sku, barcode,
  description, specifications, features, price, discount_price,
  color, size, weight, material, warranty, delivery_available,
  pickup_available, return_policy, tags, images, video_url,
  stock_qty, stock_status, is_active, subcategory_id, variants,
  short_description, seo_title, seo_description, keywords, model_number
) ON products TO authenticated;
-- Dealers CANNOT update: moderation_status, view_count, search_count,
-- is_featured, is_trending, is_master, ai_verified, ai_description,
-- ai_tags, ai_confidence, ai_status, dealer_id, created_at, id

-- ---- dealer_inventory ----
REVOKE INSERT, UPDATE, DELETE ON dealer_inventory FROM anon;
GRANT SELECT ON dealer_inventory TO anon;

REVOKE INSERT ON dealer_inventory FROM authenticated;
GRANT INSERT (
  dealer_id, product_id, price, discount_price, stock_qty,
  stock_status, available_colors, available_sizes, available_models,
  condition, warranty, images, is_active, delivery_available,
  pickup_available, offer_price, dealer_image_id
) ON dealer_inventory TO authenticated;

REVOKE UPDATE ON dealer_inventory FROM authenticated;
GRANT UPDATE (
  price, discount_price, stock_qty, stock_status,
  available_colors, available_sizes, available_models,
  condition, warranty, images, is_active, delivery_available,
  pickup_available, offer_price, dealer_image_id, updated_at
) ON dealer_inventory TO authenticated;
-- Dealers CANNOT update: moderation_status, view_count, dealer_id,
-- product_id, created_at, id

-- ---- product_images ----
REVOKE INSERT, UPDATE, DELETE ON product_images FROM anon;
GRANT SELECT ON product_images TO anon;

REVOKE INSERT ON product_images FROM authenticated;
GRANT INSERT (
  product_id, image_url, version, dealer_comment, is_active
) ON product_images TO authenticated;

REVOKE UPDATE ON product_images FROM authenticated;
GRANT UPDATE (
  image_url, version, dealer_comment, is_active
) ON product_images TO authenticated;
-- Dealers CANNOT update: ai_verdict, ai_confidence, ai_flags,
-- ai_detected_*, ai_description, ai_tags, ai_warning,
-- moderation_status, admin_notes, reviewed_by, reviewed_at,
-- product_id, created_at, id

-- ---- moderation_logs ----
REVOKE ALL ON moderation_logs FROM anon;
-- authenticated keeps SELECT, INSERT (RLS restricts to admin/dealer-own)
-- UPDATE, DELETE handled by RLS (admin only)

-- ---- search_logs ----
REVOKE ALL ON search_logs FROM anon;
GRANT INSERT ON search_logs TO anon;
-- authenticated: SELECT (admin only via RLS), INSERT (search logging)

-- ---- reviews ----
REVOKE UPDATE, DELETE ON reviews FROM anon;

-- ---- enquiries ----
REVOKE ALL ON enquiries FROM anon;
GRANT INSERT ON enquiries TO anon;

-- ---- messages, notifications, push_subscriptions ----
-- Keep current grants (anon CRUD) for anonymous browsing features.
-- RLS will restrict DELETE on messages to admin-only.

-- ---- categories, brands ----
REVOKE INSERT, UPDATE, DELETE ON categories FROM anon;
REVOKE INSERT, UPDATE, DELETE ON brands FROM anon;

-- ============================================================
-- SECTION 8: Drop ALL existing insecure policies
-- ============================================================

-- categories
DROP POLICY IF EXISTS "anon_read_categories" ON categories;
DROP POLICY IF EXISTS "anon_write_categories" ON categories;

-- brands
DROP POLICY IF EXISTS "anon_read_brands" ON brands;
DROP POLICY IF EXISTS "anon_write_brands" ON brands;

-- dealers
DROP POLICY IF EXISTS "anon_read_dealers" ON dealers;
DROP POLICY IF EXISTS "anon_write_dealers" ON dealers;

-- products
DROP POLICY IF EXISTS "anon_read_products" ON products;
DROP POLICY IF EXISTS "anon_write_products" ON products;

-- reviews
DROP POLICY IF EXISTS "anon_read_reviews" ON reviews;
DROP POLICY IF EXISTS "anon_write_reviews" ON reviews;

-- enquiries (including conflicting ones from migration 5)
DROP POLICY IF EXISTS "anon_read_enquiries" ON enquiries;
DROP POLICY IF EXISTS "anon_write_enquiries" ON enquiries;
DROP POLICY IF EXISTS "insert_own_enquiry" ON enquiries;
DROP POLICY IF EXISTS "select_own_enquiries" ON enquiries;
DROP POLICY IF EXISTS "update_own_enquiries" ON enquiries;

-- search_logs
DROP POLICY IF EXISTS "anon_read_search_logs" ON search_logs;
DROP POLICY IF EXISTS "anon_write_search_logs" ON search_logs;

-- product_images
DROP POLICY IF EXISTS "anon_select_product_images" ON product_images;
DROP POLICY IF EXISTS "anon_insert_product_images" ON product_images;
DROP POLICY IF EXISTS "anon_update_product_images" ON product_images;
DROP POLICY IF EXISTS "anon_delete_product_images" ON product_images;

-- moderation_logs
DROP POLICY IF EXISTS "anon_select_moderation_logs" ON moderation_logs;
DROP POLICY IF EXISTS "anon_insert_moderation_logs" ON moderation_logs;
DROP POLICY IF EXISTS "anon_update_moderation_logs" ON moderation_logs;
DROP POLICY IF EXISTS "anon_delete_moderation_logs" ON moderation_logs;

-- push_subscriptions
DROP POLICY IF EXISTS "anon_select_push_subs" ON push_subscriptions;
DROP POLICY IF EXISTS "anon_insert_push_subs" ON push_subscriptions;
DROP POLICY IF EXISTS "anon_update_push_subs" ON push_subscriptions;
DROP POLICY IF EXISTS "anon_delete_push_subs" ON push_subscriptions;

-- notifications
DROP POLICY IF EXISTS "anon_select_notifications" ON notifications;
DROP POLICY IF EXISTS "anon_insert_notifications" ON notifications;
DROP POLICY IF EXISTS "anon_update_notifications" ON notifications;
DROP POLICY IF EXISTS "anon_delete_notifications" ON notifications;

-- dealer_inventory
DROP POLICY IF EXISTS "anon_select_dealer_inventory" ON dealer_inventory;
DROP POLICY IF EXISTS "anon_insert_dealer_inventory" ON dealer_inventory;
DROP POLICY IF EXISTS "anon_update_dealer_inventory" ON dealer_inventory;
DROP POLICY IF EXISTS "anon_delete_dealer_inventory" ON dealer_inventory;

-- messages
DROP POLICY IF EXISTS "anon_select_messages" ON messages;
DROP POLICY IF EXISTS "anon_insert_messages" ON messages;
DROP POLICY IF EXISTS "anon_update_messages" ON messages;
DROP POLICY IF EXISTS "anon_delete_messages" ON messages;

-- ============================================================
-- SECTION 9: Create new secure RLS policies
-- ============================================================

-- ---- categories: public read, admin-only write ----
CREATE POLICY "read_categories" ON categories
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_write_categories" ON categories
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin_update_categories" ON categories
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_delete_categories" ON categories
  FOR DELETE TO authenticated USING (public.is_admin());

-- ---- brands: public read, admin-only write ----
CREATE POLICY "read_brands" ON brands
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_write_brands" ON brands
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin_update_brands" ON brands
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_delete_brands" ON brands
  FOR DELETE TO authenticated USING (public.is_admin());

-- ---- dealers: public read approved, dealer sees own, admin sees all ----
CREATE POLICY "read_dealers" ON dealers
  FOR SELECT TO anon, authenticated
  USING (status = 'approved' OR auth_user_id = auth.uid() OR public.is_admin());

CREATE POLICY "dealer_insert_own" ON dealers
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid() OR public.is_admin());

CREATE POLICY "dealer_update_own" ON dealers
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_admin())
  WITH CHECK (auth_user_id = auth.uid() OR public.is_admin());

CREATE POLICY "admin_delete_dealers" ON dealers
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---- products: public read approved+active, dealer sees own, admin all ----
CREATE POLICY "read_products" ON products
  FOR SELECT TO anon, authenticated
  USING (
    (moderation_status = 'approved' AND is_active = true)
    OR dealer_id = public.current_dealer_id()
    OR public.is_admin()
  );

CREATE POLICY "dealer_insert_products" ON products
  FOR INSERT TO authenticated
  WITH CHECK (dealer_id = public.current_dealer_id() OR public.is_admin());

CREATE POLICY "dealer_update_products" ON products
  FOR UPDATE TO authenticated
  USING (dealer_id = public.current_dealer_id() OR public.is_admin())
  WITH CHECK (dealer_id = public.current_dealer_id() OR public.is_admin());

CREATE POLICY "dealer_delete_products" ON products
  FOR DELETE TO authenticated
  USING (dealer_id = public.current_dealer_id() OR public.is_admin());

-- ---- dealer_inventory: public read active, dealer sees own, admin all ----
CREATE POLICY "read_dealer_inventory" ON dealer_inventory
  FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    OR dealer_id = public.current_dealer_id()
    OR public.is_admin()
  );

CREATE POLICY "dealer_insert_inventory" ON dealer_inventory
  FOR INSERT TO authenticated
  WITH CHECK (dealer_id = public.current_dealer_id() OR public.is_admin());

CREATE POLICY "dealer_update_inventory" ON dealer_inventory
  FOR UPDATE TO authenticated
  USING (dealer_id = public.current_dealer_id() OR public.is_admin())
  WITH CHECK (dealer_id = public.current_dealer_id() OR public.is_admin());

CREATE POLICY "dealer_delete_inventory" ON dealer_inventory
  FOR DELETE TO authenticated
  USING (dealer_id = public.current_dealer_id() OR public.is_admin());

-- ---- product_images: public read, dealer manages own, admin all ----
CREATE POLICY "read_product_images" ON product_images
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "dealer_insert_images" ON product_images
  FOR INSERT TO authenticated
  WITH CHECK (
    product_id IN (SELECT id FROM products WHERE dealer_id = public.current_dealer_id())
    OR public.is_admin()
  );

CREATE POLICY "dealer_update_images" ON product_images
  FOR UPDATE TO authenticated
  USING (
    product_id IN (SELECT id FROM products WHERE dealer_id = public.current_dealer_id())
    OR public.is_admin()
  )
  WITH CHECK (
    product_id IN (SELECT id FROM products WHERE dealer_id = public.current_dealer_id())
    OR public.is_admin()
  );

CREATE POLICY "dealer_delete_images" ON product_images
  FOR DELETE TO authenticated
  USING (
    product_id IN (SELECT id FROM products WHERE dealer_id = public.current_dealer_id())
    OR public.is_admin()
  );

-- ---- moderation_logs: admin/dealer-own read, admin/dealer-own insert, admin update/delete ----
CREATE POLICY "read_moderation_logs" ON moderation_logs
  FOR SELECT TO anon, authenticated
  USING (
    public.is_admin()
    OR product_id IN (SELECT id FROM products WHERE dealer_id = public.current_dealer_id())
  );

CREATE POLICY "insert_moderation_logs" ON moderation_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR product_id IN (SELECT id FROM products WHERE dealer_id = public.current_dealer_id())
  );

CREATE POLICY "admin_update_moderation_logs" ON moderation_logs
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin_delete_moderation_logs" ON moderation_logs
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---- reviews: public read/insert, admin update/delete ----
CREATE POLICY "read_reviews" ON reviews
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "insert_reviews" ON reviews
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "admin_update_reviews" ON reviews
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin_delete_reviews" ON reviews
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---- enquiries: public insert, dealer/admin/customer read own ----
CREATE POLICY "read_enquiries" ON enquiries
  FOR SELECT TO anon, authenticated
  USING (
    public.is_admin()
    OR dealer_id = public.current_dealer_id()
    OR customer_id = auth.uid()
  );

CREATE POLICY "insert_enquiries" ON enquiries
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "admin_update_enquiries" ON enquiries
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin_delete_enquiries" ON enquiries
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---- search_logs: public insert (search logging), admin-only read ----
CREATE POLICY "admin_read_search_logs" ON search_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "insert_search_logs" ON search_logs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "admin_update_search_logs" ON search_logs
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admin_delete_search_logs" ON search_logs
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---- messages: open for anonymous messaging (browser UUID), admin-only delete ----
CREATE POLICY "read_messages" ON messages
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "insert_messages" ON messages
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_messages" ON messages
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "admin_delete_messages" ON messages
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---- notifications: open for anonymous (browser UUID customer_id) ----
CREATE POLICY "read_notifications" ON notifications
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "insert_notifications" ON notifications
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_notifications" ON notifications
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_notifications" ON notifications
  FOR DELETE TO anon, authenticated USING (true);

-- ---- push_subscriptions: open for anonymous (browser UUID customer_id) ----
CREATE POLICY "read_push_subs" ON push_subscriptions
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "insert_push_subs" ON push_subscriptions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_push_subs" ON push_subscriptions
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_push_subs" ON push_subscriptions
  FOR DELETE TO anon, authenticated USING (true);

-- ============================================================
-- SECTION 10: Add missing policies on customer tables
-- (existing ownership policies from migration 5 are preserved)
-- ============================================================

-- customer_profiles: add DELETE (self-deletion)
DROP POLICY IF EXISTS "delete_own_profile" ON customer_profiles;
CREATE POLICY "delete_own_profile" ON customer_profiles
  FOR DELETE TO authenticated
  USING (auth.uid() = id);

-- customer_favorites: add UPDATE
DROP POLICY IF EXISTS "update_own_favorites" ON customer_favorites;
CREATE POLICY "update_own_favorites" ON customer_favorites
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- customer_search_history: add UPDATE
DROP POLICY IF EXISTS "update_own_search_history" ON customer_search_history;
CREATE POLICY "update_own_search_history" ON customer_search_history
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
