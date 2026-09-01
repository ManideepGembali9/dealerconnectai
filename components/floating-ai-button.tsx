'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, X, Mic, Camera, Send, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/providers';

export function FloatingAiButton() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { location } = useApp();

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    const params = new URLSearchParams();
    params.set('q', query.trim());
    if (location.pinCode) params.set('pin', location.pinCode);
    params.set('ai', 'true');
    router.push(`/ai-search?${params.toString()}`);
    setOpen(false);
    setQuery('');
    setLoading(false);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg transition-all hover:scale-110 active:scale-95 md:bottom-6 md:right-6"
        aria-label="Ask DealerConnect AI"
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
        <span className="absolute inset-0 animate-pulse-ring rounded-full" />
      </button>

      {/* AI search panel */}
      {open && (
        <div className="fixed bottom-36 right-4 z-50 w-[calc(100vw-2rem)] max-w-md md:bottom-24 md:right-6">
          <div className="rounded-2xl border border-border/60 bg-background/95 p-4 shadow-2xl backdrop-blur-lg">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold">Ask DealerConnect AI</p>
                <p className="text-xs text-muted-foreground">Find products and nearby dealers</p>
              </div>
            </div>

            <div className="relative">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="e.g. Samsung 55 inch TV under ₹50,000 near me"
                className="h-12 pr-10 text-sm"
                autoFocus
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-muted">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>

            <div className="mt-2 flex items-center gap-2">
              <Button variant="outline" size="sm" className="flex-1" disabled>
                <Mic className="mr-1.5 h-3.5 w-3.5" /> Voice
              </Button>
              <Button variant="outline" size="sm" className="flex-1" disabled>
                <Camera className="mr-1.5 h-3.5 w-3.5" /> Photo
              </Button>
              <Button size="sm" className="flex-1" onClick={handleSearch} disabled={loading || !query.trim()}>
                {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                Search
              </Button>
            </div>

            {location.pinCode && (
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> Using location: {location.pinCode}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-1.5">
              {['Samsung TV under ₹50,000', 'iPhone 15 near me', 'HP Laptop', 'LG Refrigerator'].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => { setQuery(suggestion); }}
                  className="rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
