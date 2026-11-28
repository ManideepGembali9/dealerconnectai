-- Local Shop Product Finder / DealerConnect AI
-- Three-Portal Integrated Schema, Constraints, Rating Synchronization & RLS Policies

create extension if not exists "pgcrypto";

-- 1. CUSTOMER PROFILES
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  phone text,
  avatar_url text,
  pin_code text,
  preferred_city text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. DEALERS & DEALER APPLICATIONS
create table if not exists public.dealers (
  id text primary key,
  auth_user_id uuid references auth.users(id) on delete set null,
  shop_name text not null,
  owner_name text not null,
  email text not null unique,
  phone text not null,
  whatsapp text,
  description text,
  address text not null,
  village text,
  city text not null,
  district text not null,
  state text not null,
  pin_code text not null,
  gst_number text,
  logo_url text,
  banner_url text,
  map_lat double precision,
  map_lng double precision,
  working_hours jsonb not null default '{}'::jsonb,
  rating numeric(3,1) not null default 0,
  rating_count integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  delivery_available boolean not null default true,
  pickup_available boolean not null default true,
  home_delivery_radius_km integer not null default 10,
  low_stock_threshold integer not null default 5,
  product_count integer not null default 0,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz
);

create table if not exists public.dealer_applications (
  id text primary key,
  customer_id text not null,
  owner_name text not null,
  phone text not null,
  email text not null,
  shop_name text not null,
  category_id text,
  address text not null,
  city text not null,
  district text not null,
  state text not null,
  pin_code text not null,
  status text not null default 'pending' check (status in ('pending', 'under_review', 'approved', 'rejected', 'more_info_required')),
  rejection_reason text,
  reviewed_by text,
  reviewed_at timestamptz,
  dealer_id text references public.dealers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. MASTER PRODUCTS & DEALER INVENTORY
create table if not exists public.products (
  id text primary key,
  name text not null,
  slug text not null unique,
  description text,
  price numeric(12,2) not null check (price > 0),
  discount_price numeric(12,2) check (discount_price is null or discount_price >= 0),
  stock_status text not null default 'in_stock' check (stock_status in ('in_stock', 'limited', 'out_of_stock', 'restocking')),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  low_stock_threshold integer not null default 5,
  enquiry_count integer not null default 0,
  images text[] not null default '{}',
  specs jsonb not null default '{}'::jsonb,
  price_history jsonb not null default '[]'::jsonb,
  category_id text not null,
  brand_id text,
  brand_name text,
  dealer_id text references public.dealers(id) on delete cascade,
  is_master boolean not null default false,
  master_product_id text references public.products(id) on delete set null,
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'rejected', 'flagged')),
  rejection_reason text,
  admin_info_request text,
  is_trending boolean not null default false,
  is_active boolean not null default true,
  rating numeric(3,1) not null default 0,
  rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. ENQUIRIES & FOLLOW-UP MESSAGES
create table if not exists public.enquiries (
  id text primary key,
  customer_id text,
  customer_email text,
  dealer_id text not null references public.dealers(id) on delete cascade,
  product_id text references public.products(id) on delete set null,
  product_name text,
  dealer_name text,
  customer_name text not null,
  customer_phone text not null,
  message text not null,
  channel text not null default 'form' check (channel in ('form', 'whatsapp', 'call')),
  status text not null default 'pending' check (status in ('pending', 'viewed', 'responded', 'in_progress', 'resolved', 'closed')),
  dealer_response text,
  responded_at timestamptz,
  responded_by text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enquiry_messages (
  id text primary key,
  enquiry_id text not null references public.enquiries(id) on delete cascade,
  sender_role text not null check (sender_role in ('customer', 'dealer', 'admin')),
  sender_name text not null,
  message text not null,
  created_at timestamptz not null default now()
);

-- 4B. DEALER-TO-ADMIN ENQUIRIES & LEAD MANAGEMENT (STRICTLY SEPARATED FROM CUSTOMER ENQUIRIES)
create table if not exists public.dealer_enquiries (
  id text primary key,
  dealer_id text not null references public.dealers(id) on delete cascade,
  dealer_name text not null,
  shop_name text not null,
  dealer_email text not null,
  subject text not null,
  category text not null check (category in (
    'product_approval', 'catalog_request', 'account_issue', 'verification',
    'technical_support', 'platform_issue', 'billing_subscription', 'other'
  )),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  description text not null,
  attachment_url text,
  status text not null default 'new' check (status in (
    'new', 'open', 'in_progress', 'waiting_for_dealer', 'responded', 'resolved', 'closed'
  )),
  assigned_to text,
  internal_notes text,
  first_responded_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dealer_enquiry_messages (
  id text primary key,
  dealer_enquiry_id text not null references public.dealer_enquiries(id) on delete cascade,
  sender_role text not null check (sender_role in ('dealer', 'admin')),
  sender_name text not null,
  message text not null,
  attachment_url text,
  created_at timestamptz not null default now()
);

-- 5. REVIEWS, REPORTS & MODERATION AUDIT TRAIL
create table if not exists public.reviews (
  id text primary key,
  customer_id text not null,
  customer_email text,
  customer_name text not null,
  target_type text not null check (target_type in ('product', 'dealer')),
  product_id text references public.products(id) on delete cascade,
  dealer_id text references public.dealers(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text not null check (char_length(comment) >= 5),
  dealer_response text,
  responded_at timestamptz,
  responded_by text,
  is_verified_interaction boolean not null default false,
  is_approved boolean not null default true,
  is_flagged boolean not null default false,
  is_hidden boolean not null default false,
  moderation_notes text,
  moderated_at timestamptz,
  moderated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_unique_customer_product unique (customer_id, target_type, product_id),
  constraint reviews_target_check check (
    (target_type = 'product' and product_id is not null) or
    (target_type = 'dealer' and dealer_id is not null and product_id is null)
  )
);

create unique index if not exists reviews_unique_customer_dealer_shop
  on public.reviews (customer_id, dealer_id)
  where target_type = 'dealer';

create table if not exists public.review_reports (
  id text primary key,
  review_id text not null references public.reviews(id) on delete cascade,
  reporter_id text not null,
  reporter_name text not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_logs (
  id text primary key,
  action text not null,
  entity_type text not null check (entity_type in ('dealer', 'product', 'review', 'category', 'brand')),
  entity_id text not null,
  entity_name text,
  performed_by text not null,
  reason text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 6. PERSISTENT THREE-PORTAL NOTIFICATIONS
create table if not exists public.notifications (
  id text primary key,
  recipient_id text not null,
  recipient_role text not null check (recipient_role in ('customer', 'dealer', 'admin')),
  type text not null,
  title text not null,
  message text not null,
  related_record_id text,
  link_url text,
  product_id text,
  dealer_id text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- INDEXES
create index if not exists idx_products_dealer on public.products(dealer_id);
create index if not exists idx_products_master on public.products(is_master);
create index if not exists idx_products_moderation on public.products(moderation_status, is_active);
create index if not exists idx_enquiries_dealer on public.enquiries(dealer_id, created_at desc);
create index if not exists idx_enquiries_customer on public.enquiries(customer_id, created_at desc);
create index if not exists idx_dealer_enquiries_dealer on public.dealer_enquiries(dealer_id, created_at desc);
create index if not exists idx_dealer_enquiries_status on public.dealer_enquiries(status, priority);
create index if not exists idx_reviews_product on public.reviews(product_id, is_approved, is_hidden);
create index if not exists idx_reviews_dealer on public.reviews(dealer_id, is_approved, is_hidden);
create index if not exists idx_notifications_recipient on public.notifications(recipient_role, recipient_id, is_read, created_at desc);

-- REALTIME RATING SYNCHRONIZATION TRIGGER
create or replace function public.sync_review_ratings()
returns trigger as $$
declare
  v_product_id text;
  v_dealer_id text;
begin
  v_product_id := coalesce(new.product_id, old.product_id);
  v_dealer_id := coalesce(new.dealer_id, old.dealer_id);

  if v_product_id is not null then
    update public.products p
    set
      rating = coalesce((
        select round(avg(r.rating)::numeric, 1)
        from public.reviews r
        where r.product_id = v_product_id and r.is_approved = true and r.is_hidden = false
      ), 0),
      rating_count = (
        select count(*)
        from public.reviews r
        where r.product_id = v_product_id and r.is_approved = true and r.is_hidden = false
      ),
      updated_at = now()
    where p.id = v_product_id;
  end if;

  if v_dealer_id is not null then
    update public.dealers d
    set
      rating = coalesce((
        select round(avg(r.rating)::numeric, 1)
        from public.reviews r
        where r.dealer_id = v_dealer_id and r.is_approved = true and r.is_hidden = false
      ), 0),
      rating_count = (
        select count(*)
        from public.reviews r
        where r.dealer_id = v_dealer_id and r.is_approved = true and r.is_hidden = false
      ),
      updated_at = now()
    where d.id = v_dealer_id;
  end if;

  return coalesce(new, old);
end;
$$ language plpgsql security definer;

drop trigger if exists trg_sync_review_ratings on public.reviews;
create trigger trg_sync_review_ratings
after insert or update or delete on public.reviews
for each row execute function public.sync_review_ratings();

-- ROW LEVEL SECURITY (RLS)
alter table public.customers enable row level security;
alter table public.dealers enable row level security;
alter table public.dealer_applications enable row level security;
alter table public.products enable row level security;
alter table public.enquiries enable row level security;
alter table public.enquiry_messages enable row level security;
alter table public.dealer_enquiries enable row level security;
alter table public.dealer_enquiry_messages enable row level security;
alter table public.reviews enable row level security;
alter table public.review_reports enable row level security;
alter table public.moderation_logs enable row level security;
alter table public.notifications enable row level security;

-- Helper predicates based on verified Supabase JWT claims
create or replace function public.is_admin() returns boolean as $$
  select coalesce((auth.jwt() ->> 'role') = 'admin' or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$ language sql stable;

-- Dealers: public sees approved dealers; dealer sees/updates own shop; admin manages all
drop policy if exists dealers_public_read on public.dealers;
create policy dealers_public_read on public.dealers for select using (status = 'approved' or auth_user_id = auth.uid() or public.is_admin());

drop policy if exists dealers_self_or_admin_update on public.dealers;
create policy dealers_self_or_admin_update on public.dealers for update using (auth_user_id = auth.uid() or public.is_admin());

-- Products: public sees ONLY approved active shop listings from approved dealers; dealers manage ONLY own non-master; admins manage all
drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select using (
  public.is_admin()
  or exists (select 1 from public.dealers d where d.id = products.dealer_id and d.auth_user_id = auth.uid())
  or (is_master = true and moderation_status = 'approved' and is_active = true and exists (select 1 from public.dealers d where d.auth_user_id = auth.uid() and d.status = 'approved'))
  or (
    dealer_id is not null
    and moderation_status = 'approved'
    and is_active = true
    and exists (select 1 from public.dealers d where d.id = products.dealer_id and d.status = 'approved')
  )
);

-- Enforce server-side product approval lifecycle for dealers
create or replace function public.enforce_dealer_product_moderation()
returns trigger as $$
begin
  if not public.is_admin() then
    new.is_master := false;
    if tg_op = 'INSERT' then
      new.moderation_status := 'pending';
    elsif old.moderation_status <> 'approved' and new.moderation_status = 'approved' then
      raise exception 'Dealers cannot self-approve products';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_enforce_dealer_product_moderation on public.products;
create trigger trg_enforce_dealer_product_moderation
before insert or update on public.products
for each row execute function public.enforce_dealer_product_moderation();

drop policy if exists products_dealer_manage_own on public.products;
create policy products_dealer_manage_own on public.products
  for all
  using (
    public.is_admin() or (
      is_master = false and exists (
        select 1 from public.dealers d where d.id = products.dealer_id and d.auth_user_id = auth.uid() and d.status = 'approved'
      )
    )
  );

-- Enquiries: private strictly to owning Customer, target Dealer, or Admin
drop policy if exists enquiries_scoped_read on public.enquiries;
create policy enquiries_scoped_read on public.enquiries for select using (
  public.is_admin()
  or customer_id = auth.uid()::text
  or exists (select 1 from public.dealers d where d.id = enquiries.dealer_id and d.auth_user_id = auth.uid())
);

drop policy if exists enquiries_customer_create on public.enquiries;
create policy enquiries_customer_create on public.enquiries for insert with check (customer_id = auth.uid()::text);

-- Dealer-to-Admin Enquiries: strictly owning Dealer + Admin only (never Customers, never other Dealers)
drop policy if exists dealer_enquiries_scoped_access on public.dealer_enquiries;
create policy dealer_enquiries_scoped_access on public.dealer_enquiries for all using (
  public.is_admin()
  or exists (select 1 from public.dealers d where d.id = dealer_enquiries.dealer_id and d.auth_user_id = auth.uid() and d.status = 'approved')
);

drop policy if exists dealer_enquiry_messages_scoped_access on public.dealer_enquiry_messages;
create policy dealer_enquiry_messages_scoped_access on public.dealer_enquiry_messages for all using (
  public.is_admin()
  or exists (
    select 1 from public.dealer_enquiries de
    join public.dealers d on d.id = de.dealer_id
    where de.id = dealer_enquiry_messages.dealer_enquiry_id and d.auth_user_id = auth.uid()
  )
);

-- Reviews: public sees non-hidden approved reviews; customer edits/deletes own; dealer replies to own via RPC/trigger; admin moderates all
drop policy if exists reviews_public_read on public.reviews;
create policy reviews_public_read on public.reviews for select using (
  (is_approved = true and is_hidden = false)
  or customer_id = auth.uid()::text
  or exists (select 1 from public.dealers d where d.id = reviews.dealer_id and d.auth_user_id = auth.uid())
  or public.is_admin()
);

drop policy if exists reviews_customer_write_own on public.reviews;
create policy reviews_customer_write_own on public.reviews
  for insert
  with check (
    customer_id = auth.uid()::text
    and exists (
      select 1 from public.enquiries e
      where e.customer_id = auth.uid()::text
        and ((reviews.product_id is not null and e.product_id = reviews.product_id) or (e.dealer_id = reviews.dealer_id))
    )
  );

drop policy if exists reviews_customer_edit_delete_own on public.reviews;
create policy reviews_customer_edit_delete_own on public.reviews for update using (customer_id = auth.uid()::text or public.is_admin());

drop policy if exists reviews_customer_delete_own on public.reviews;
create policy reviews_customer_delete_own on public.reviews for delete using (customer_id = auth.uid()::text);

-- Moderation logs: Admin read/write only
drop policy if exists moderation_logs_admin_only on public.moderation_logs;
create policy moderation_logs_admin_only on public.moderation_logs for all using (public.is_admin());

-- Notifications: strict recipient scoping
drop policy if exists notifications_recipient_only on public.notifications;
create policy notifications_recipient_only on public.notifications for all using (
  (recipient_role = 'admin' and public.is_admin())
  or (recipient_role = 'customer' and recipient_id = auth.uid()::text)
  or (recipient_role = 'dealer' and exists (select 1 from public.dealers d where d.id = notifications.recipient_id and d.auth_user_id = auth.uid()))
);
