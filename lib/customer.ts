import { supabase } from './supabase';

export async function saveSearchHistory(
  userId: string,
  query: string,
  options: {
    searchType?: 'text' | 'ai' | 'image' | 'voice';
    pinCode?: string | null;
    locationLabel?: string | null;
    resultsCount?: number;
  } = {}
) {
  try {
    await supabase.from('customer_search_history').insert({
      user_id: userId,
      query,
      search_type: options.searchType ?? 'text',
      pin_code: options.pinCode ?? null,
      location_label: options.locationLabel ?? null,
      results_count: options.resultsCount ?? 0,
    });
  } catch {
    // Silent fail — search history is non-critical
  }
}

export async function toggleFavorite(
  userId: string,
  type: 'product' | 'dealer',
  targetId: string
): Promise<{ isFavorite: boolean; error: string | null }> {
  try {
    const col = type === 'product' ? 'product_id' : 'dealer_id';
    const { data: existing } = await supabase
      .from('customer_favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('type', type)
      .eq(col, targetId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('customer_favorites')
        .delete()
        .eq('id', existing.id);
      return { isFavorite: false, error: null };
    }

    const insert: Record<string, any> = {
      user_id: userId,
      type,
      [col]: targetId,
    };
    const { error } = await supabase.from('customer_favorites').insert(insert);
    if (error) return { isFavorite: false, error: error.message };
    return { isFavorite: true, error: null };
  } catch (e: any) {
    return { isFavorite: false, error: e.message ?? 'Failed to toggle favorite' };
  }
}

export async function isFavorited(
  userId: string,
  type: 'product' | 'dealer',
  targetId: string
): Promise<boolean> {
  try {
    const col = type === 'product' ? 'product_id' : 'dealer_id';
    const { data } = await supabase
      .from('customer_favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('type', type)
      .eq(col, targetId)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}
