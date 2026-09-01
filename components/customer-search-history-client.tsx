'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Sparkles, Camera, Mic, Trash2, MapPin, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/format';
import { toast } from 'sonner';

export function CustomerSearchHistoryClient() {
  const router = useRouter();
  const { role, customer, loading: authLoading } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && role !== 'customer') { router.push('/customer/login'); return; }
    if (customer) loadHistory();
  }, [authLoading, role, customer]);

  const loadHistory = async () => {
    if (!customer) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('customer_search_history')
        .select('*')
        .eq('user_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setHistory(data ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const clearHistory = async () => {
    if (!customer) return;
    try {
      await supabase.from('customer_search_history').delete().eq('user_id', customer.id);
      setHistory([]);
      toast.success('Search history cleared');
    } catch { toast.error('Failed to clear history'); }
  };

  if (authLoading || loading) {
    return <div className="mx-auto max-w-4xl px-4 py-20 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }
  if (!customer) return null;

  const typeIcon = (type: string) => {
    if (type === 'ai') return <Sparkles className="h-4 w-4 text-accent" />;
    if (type === 'image') return <Camera className="h-4 w-4 text-primary" />;
    if (type === 'voice') return <Mic className="h-4 w-4 text-primary" />;
    return <Search className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Search History</h1>
          <p className="text-sm text-muted-foreground">Your previous product and AI searches</p>
        </div>
        {history.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearHistory}><Trash2 className="mr-2 h-4 w-4" /> Clear History</Button>
        )}
      </div>

      {history.length > 0 ? (
        <div className="space-y-2">
          {history.map((h) => (
            <Card key={h.id} className="flex items-center gap-3 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">{typeIcon(h.search_type)}</div>
              <Link href={`/search?q=${encodeURIComponent(h.query)}`} className="flex-1">
                <p className="text-sm font-medium hover:text-primary">{h.query}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> {timeAgo(h.created_at)}
                  {h.pin_code && <><span>·</span><MapPin className="h-3 w-3" /> {h.pin_code}</>}
                  {h.results_count > 0 && <><span>·</span> {h.results_count} results</>}
                </div>
              </Link>
              <Badge variant="secondary" className="text-xs capitalize">{h.search_type}</Badge>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Search className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No search history yet. Your searches will appear here.</p>
          <Link href="/search" className="mt-3 inline-block"><Button variant="outline">Start Searching</Button></Link>
        </Card>
      )}
    </div>
  );
}
