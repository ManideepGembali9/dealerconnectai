import { supabase, type Message, type Dealer } from './supabase';

const CUSTOMER_ID_KEY = 'dc-customer-id';

export function getCustomerId(): string {
  if (typeof window === 'undefined') return 'anon';
  let id = localStorage.getItem(CUSTOMER_ID_KEY);
  if (!id) {
    id = `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(CUSTOMER_ID_KEY, id);
  }
  return id;
}

export async function fetchConversations(): Promise<{ dealer: Dealer; lastMessage: Message; unreadCount: number }[]> {
  const customerId = getCustomerId();
  const { data, error } = await supabase
    .from('messages')
    .select('*, dealer:dealer_id(*, category:business_category_id(*))')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  const messages = (data ?? []) as unknown as Message[];

  const conversationsMap = new Map<string, { dealer: Dealer; lastMessage: Message; unreadCount: number }>();
  for (const msg of messages) {
    if (!msg.dealer_id || !msg.dealer) continue;
    const existing = conversationsMap.get(msg.dealer_id);
    if (!existing) {
      conversationsMap.set(msg.dealer_id, {
        dealer: msg.dealer,
        lastMessage: msg,
        unreadCount: msg.sender_type === 'dealer' && !msg.is_read ? 1 : 0,
      });
    } else {
      if (msg.sender_type === 'dealer' && !msg.is_read) existing.unreadCount++;
      if (new Date(msg.created_at) > new Date(existing.lastMessage.created_at)) {
        existing.lastMessage = msg;
      }
    }
  }

  return Array.from(conversationsMap.values()).sort(
    (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime(),
  );
}

export async function fetchMessages(dealerId: string): Promise<Message[]> {
  const customerId = getCustomerId();
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('customer_id', customerId)
    .eq('dealer_id', dealerId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function sendMessage(
  dealerId: string,
  body: string,
  productId?: string | null,
  imageUrl?: string | null,
  senderType: 'customer' | 'dealer' = 'customer',
): Promise<Message | null> {
  const customerId = getCustomerId();
  const { data, error } = await supabase
    .from('messages')
    .insert({
      customer_id: customerId,
      dealer_id: dealerId,
      sender_type: senderType,
      body,
      product_id: productId ?? null,
      image_url: imageUrl ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as Message;
}

export async function markMessagesRead(dealerId: string): Promise<void> {
  const customerId = getCustomerId();
  await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('customer_id', customerId)
    .eq('dealer_id', dealerId)
    .eq('sender_type', 'dealer')
    .eq('is_read', false);
}

export async function fetchDealerConversations(dealerId: string): Promise<{ customerId: string; lastMessage: Message; unreadCount: number; customerLabel: string }[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('dealer_id', dealerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  const messages = (data ?? []) as Message[];

  const conversationsMap = new Map<string, { customerId: string; lastMessage: Message; unreadCount: number; customerLabel: string }>();
  for (const msg of messages) {
    const existing = conversationsMap.get(msg.customer_id);
    if (!existing) {
      conversationsMap.set(msg.customer_id, {
        customerId: msg.customer_id,
        lastMessage: msg,
        unreadCount: msg.sender_type === 'customer' && !msg.is_read ? 1 : 0,
        customerLabel: msg.customer_id.startsWith('c-') ? `Customer ${msg.customer_id.slice(-4)}` : 'Customer',
      });
    } else {
      if (msg.sender_type === 'customer' && !msg.is_read) existing.unreadCount++;
      if (new Date(msg.created_at) > new Date(existing.lastMessage.created_at)) {
        existing.lastMessage = msg;
      }
    }
  }

  return Array.from(conversationsMap.values()).sort(
    (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime(),
  );
}
