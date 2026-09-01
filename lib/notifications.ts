import { supabase, type Notification, type PushSubscription } from './supabase';

const CUSTOMER_ID_KEY = 'dc_customer_id';
const PREFS_KEY = 'dc_notif_prefs';

export function getCustomerId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(CUSTOMER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CUSTOMER_ID_KEY, id);
  }
  return id;
}

export function getNotificationPrefs(): { in_stock: boolean; price_drop: boolean; nearby: boolean } {
  if (typeof window === 'undefined') return { in_stock: true, price_drop: true, nearby: true };
  const stored = localStorage.getItem(PREFS_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* fall through */ }
  }
  return { in_stock: true, price_drop: true, nearby: true };
}

export function setNotificationPrefs(prefs: { in_stock: boolean; price_drop: boolean; nearby: boolean }): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

/**
 * Subscribe to push notifications via the browser Web Push API.
 * Stores the subscription in the push_subscriptions table.
 */
export async function subscribeToPush(
  pinCode?: string,
  productIds: string[] = [],
): Promise<{ subscribed: boolean; error: string | null }> {
  const customerId = getCustomerId();
  const prefs = getNotificationPrefs();

  // Check if Push API is supported
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    // Fallback: store a lightweight subscription record without browser push
    const { error } = await supabase.from('push_subscriptions').upsert({
      customer_id: customerId,
      endpoint: `local://${customerId}`,
      subscription: { source: 'browser-local', customerId },
      preferences: prefs,
      pin_code: pinCode ?? null,
      product_ids: productIds,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'customer_id' });

    return { subscribed: !error, error: error?.message ?? null };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { subscribed: false, error: 'Notification permission denied. Please allow notifications in your browser settings.' };
    }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      // Create a new subscription with a dummy VAPID key (demo)
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: undefined,
      });
    }

    const { error } = await supabase.from('push_subscriptions').upsert({
      customer_id: customerId,
      endpoint: sub.endpoint,
      subscription: sub.toJSON() as Record<string, unknown>,
      preferences: prefs,
      pin_code: pinCode ?? null,
      product_ids: productIds,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'customer_id' });

    return { subscribed: !error, error: error?.message ?? null };
  } catch (err: any) {
    // Fallback to local subscription
    const { error } = await supabase.from('push_subscriptions').upsert({
      customer_id: customerId,
      endpoint: `local://${customerId}`,
      subscription: { source: 'browser-local', customerId, error: err.message },
      preferences: prefs,
      pin_code: pinCode ?? null,
      product_ids: productIds,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'customer_id' });

    return { subscribed: !error, error: err.message };
  }
}

/**
 * Unsubscribe from push notifications.
 */
export async function unsubscribeFromPush(): Promise<{ error: string | null }> {
  const customerId = getCustomerId();

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    } catch { /* ignore */ }
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('customer_id', customerId);

  return { error: error?.message ?? null };
}

/**
 * Get the current push subscription status.
 */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  const customerId = getCustomerId();
  const { data } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .maybeSingle();
  return data as PushSubscription | null;
}

/**
 * Update notification preferences.
 */
export async function updatePushPreferences(
  prefs: { in_stock: boolean; price_drop: boolean; nearby: boolean },
  pinCode?: string,
): Promise<{ error: string | null }> {
  const customerId = getCustomerId();
  setNotificationPrefs(prefs);

  const { error } = await supabase
    .from('push_subscriptions')
    .update({ preferences: prefs, pin_code: pinCode ?? null, updated_at: new Date().toISOString() })
    .eq('customer_id', customerId)
    .eq('is_active', true);

  return { error: error?.message ?? null };
}

/**
 * Add a product to the customer's watch list for notifications.
 */
export async function watchProduct(productId: string): Promise<{ error: string | null }> {
  const customerId = getCustomerId();
  const { data } = await supabase
    .from('push_subscriptions')
    .select('product_ids')
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .maybeSingle();

  const currentIds = (data?.product_ids as string[]) ?? [];
  if (currentIds.includes(productId)) return { error: null };

  const { error } = await supabase
    .from('push_subscriptions')
    .update({ product_ids: [...currentIds, productId], updated_at: new Date().toISOString() })
    .eq('customer_id', customerId)
    .eq('is_active', true);

  return { error: error?.message ?? null };
}

/**
 * Remove a product from the watch list.
 */
export async function unwatchProduct(productId: string): Promise<{ error: string | null }> {
  const customerId = getCustomerId();
  const { data } = await supabase
    .from('push_subscriptions')
    .select('product_ids')
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .maybeSingle();

  const currentIds = (data?.product_ids as string[]) ?? [];
  const { error } = await supabase
    .from('push_subscriptions')
    .update({ product_ids: currentIds.filter((id) => id !== productId), updated_at: new Date().toISOString() })
    .eq('customer_id', customerId)
    .eq('is_active', true);

  return { error: error?.message ?? null };
}

/**
 * Fetch notifications for the current customer.
 */
export async function fetchNotifications(limit = 50): Promise<Notification[]> {
  const customerId = getCustomerId();
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Notification[]) ?? [];
}

/**
 * Get unread notification count.
 */
export async function fetchUnreadCount(): Promise<number> {
  const customerId = getCustomerId();
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('is_read', false);
  if (error) return 0;
  return count ?? 0;
}

/**
 * Mark a notification as read.
 */
export async function markNotificationRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ is_read: true }).eq('id', id);
}

/**
 * Mark all notifications as read.
 */
export async function markAllNotificationsRead(): Promise<void> {
  const customerId = getCustomerId();
  await supabase.from('notifications').update({ is_read: true }).eq('customer_id', customerId).eq('is_read', false);
}

/**
 * Delete a notification.
 */
export async function deleteNotification(id: string): Promise<void> {
  await supabase.from('notifications').delete().eq('id', id);
}

/**
 * Create a notification record (used internally by moderation + stock/price watchers).
 */
export async function createNotification(params: {
  customer_id: string;
  type: 'in_stock' | 'price_drop' | 'nearby_available' | 'moderation_update';
  title: string;
  message: string;
  product_id?: string | null;
  dealer_id?: string | null;
  product_name?: string | null;
  dealer_name?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  pin_code?: string | null;
  distance_km?: number | null;
}): Promise<void> {
  await supabase.from('notifications').insert({
    customer_id: params.customer_id,
    type: params.type,
    title: params.title,
    message: params.message,
    product_id: params.product_id ?? null,
    dealer_id: params.dealer_id ?? null,
    product_name: params.product_name ?? null,
    dealer_name: params.dealer_name ?? null,
    old_value: params.old_value ?? null,
    new_value: params.new_value ?? null,
    pin_code: params.pin_code ?? null,
    distance_km: params.distance_km ?? null,
  });
}

/**
 * Simulate sending a push notification to the browser (for demo — real Web Push needs a server with VAPID keys).
 * Shows a browser notification if permission is granted.
 */
export function showBrowserNotification(title: string, body: string, icon?: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: icon ?? '/icon.png' });
  }
}

/**
 * Generate stock-change and price-drop notifications for watched products.
 * Called when a dealer updates stock status or price.
 */
export async function notifyProductWatchers(
  productId: string,
  productName: string,
  changeType: 'stock' | 'price',
  oldValue: string,
  newValue: string,
  dealerName?: string,
): Promise<void> {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('customer_id, preferences, product_ids')
    .eq('is_active', true)
    .contains('product_ids', [productId]);

  if (!subs || subs.length === 0) return;

  for (const sub of subs) {
    const prefs = sub.preferences as { in_stock: boolean; price_drop: boolean; nearby: boolean };
    const type = changeType === 'stock' ? 'in_stock' : 'price_drop';
    if (changeType === 'stock' && !prefs.in_stock) continue;
    if (changeType === 'price' && !prefs.price_drop) continue;

    const title = changeType === 'stock'
      ? `Stock Update: ${productName}`
      : `Price Drop: ${productName}`;
    const message = changeType === 'stock'
      ? `${productName} is now ${newValue} at ${dealerName ?? 'a shop near you'}.`
      : `${productName} price changed from ${oldValue} to ${newValue} at ${dealerName ?? 'a shop near you'}.`;

    await createNotification({
      customer_id: sub.customer_id,
      type,
      title,
      message,
      product_id: productId,
      product_name: productName,
      dealer_name: dealerName,
      old_value: oldValue,
      new_value: newValue,
    });
  }
}
