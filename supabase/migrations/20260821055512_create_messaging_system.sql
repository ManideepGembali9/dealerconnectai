-- Customer-dealer messaging system
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- conversation identification: customer_id (browser UUID) <-> dealer_id
  customer_id text NOT NULL,
  dealer_id uuid NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  -- message content
  sender_type text NOT NULL DEFAULT 'customer', -- 'customer' | 'dealer'
  body text NOT NULL,
  -- optional attachments
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  image_url text,
  -- status
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_messages" ON messages;
CREATE POLICY "anon_select_messages" ON messages FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_messages" ON messages;
CREATE POLICY "anon_insert_messages" ON messages FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_messages" ON messages;
CREATE POLICY "anon_update_messages" ON messages FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_messages" ON messages;
CREATE POLICY "anon_delete_messages" ON messages FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_messages_customer_dealer ON messages(customer_id, dealer_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_messages_dealer ON messages(dealer_id);
