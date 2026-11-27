'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs,TabsList,TabsTrigger } from '@/components/ui/tabs';
import { timeAgo } from '@/lib/format';
import type { Review } from '@/lib/types';
import {
  Check,
  Flag,
  Search,
  Star,
  Trash2
} from 'lucide-react';
import { useMemo,useState } from 'react';
import { toast } from 'sonner';

type ExtendedReview = Review & {
  is_flagged?: boolean;
};

type Module09Props = {
  reviews: Review[];
  onRefreshReviews?: () => Promise<void>;
};

export function Module09Reviews({ reviews: initialReviews }: Module09Props) {
  const [reviews, setReviews] = useState<ExtendedReview[]>(initialReviews);
  const [filter, setFilter] = useState<'all' | 'approved' | 'flagged' | 'low'>('all');
  const [search, setSearch] = useState('');

  // Sync with prop
  useMemo(() => {
    setReviews(initialReviews);
  }, [initialReviews]);

  const filtered = useMemo(() => {
    return reviews.filter((r) => {
      if (filter === 'approved' && !r.is_approved) return false;
      if (filter === 'flagged' && !r.is_flagged) return false;
      if (filter === 'low' && r.rating > 2) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchCust = r.customer_name.toLowerCase().includes(q);
        const matchComm = r.comment?.toLowerCase().includes(q);
        if (!matchCust && !matchComm) return false;
      }
      return true;
    });
  }, [reviews, filter, search]);

  const handleApprove = (id: string) => {
    setReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, is_approved: true, is_flagged: false } : r))
    );
    toast.success('Review approved and published');
  };

  const handleFlag = (id: string) => {
    setReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, is_flagged: true } : r))
    );
    toast.info('Review flagged for content moderation');
  };

  const handleDelete = (id: string) => {
    if (!confirm('Permanently delete this customer review?')) return;
    setReviews((prev) => prev.filter((r) => r.id !== id));
    toast.success('Review removed');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <Star className="h-7 w-7 text-amber-500 fill-amber-500" /> Reviews & Ratings Moderation
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Inspect multi-dimensional customer ratings (quality, cleanliness, behavior & delivery) and moderate testimonials
          </p>
        </div>
      </div>

      {/* Tabs and Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={filter} onValueChange={(v: any) => setFilter(v)}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs font-semibold">
              All Reviews ({reviews.length})
            </TabsTrigger>
            <TabsTrigger value="approved" className="text-xs font-semibold">
              Approved
            </TabsTrigger>
            <TabsTrigger value="flagged" className="text-xs font-semibold">
              Flagged ({reviews.filter((r) => r.is_flagged).length})
            </TabsTrigger>
            <TabsTrigger value="low" className="text-xs font-semibold">
              Low Rating (≤2★)
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search reviewer or comment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Reviews Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filtered.length === 0 ? (
          <div className="col-span-2 py-16 text-center text-muted-foreground">
            <Star className="mx-auto h-8 w-8 opacity-40 mb-2" />
            No reviews match the selected filter.
          </div>
        ) : (
          filtered.map((r) => (
            <Card
              key={r.id}
              className="p-5 border-border/80 flex flex-col justify-between shadow-sm transition-all hover:border-primary/50"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-sm">{r.customer_name}</span>
                      <Badge
                        variant={r.is_approved ? 'default' : r.is_flagged ? 'destructive' : 'secondary'}
                        className="text-[10px] font-semibold"
                      >
                        {r.is_approved ? 'Approved' : r.is_flagged ? 'Flagged' : 'Pending'}
                      </Badge>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Submitted {timeAgo(r.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 bg-amber-500/10 text-amber-600 px-2.5 py-1 rounded-lg font-bold text-xs">
                    <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                    <span>{r.rating.toFixed(1)}</span>
                  </div>
                </div>

                {/* Comment */}
                <p className="mt-3 text-xs text-foreground leading-relaxed italic bg-muted/20 p-3 rounded-xl border border-border/40">
                  &quot;{r.comment || 'No written commentary provided.'}&quot;
                </p>

                {/* Rating Dimensions Breakdown */}
                <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                  <div className="rounded-lg bg-card border border-border/50 p-1.5 text-center">
                    <span className="text-muted-foreground block">Quality</span>
                    <span className="font-bold text-foreground">{r.quality_rating ?? 5}★</span>
                  </div>
                  <div className="rounded-lg bg-card border border-border/50 p-1.5 text-center">
                    <span className="text-muted-foreground block">Store Behavior</span>
                    <span className="font-bold text-foreground">{r.behavior_rating ?? 5}★</span>
                  </div>
                  <div className="rounded-lg bg-card border border-border/50 p-1.5 text-center">
                    <span className="text-muted-foreground block">Delivery</span>
                    <span className="font-bold text-foreground">{r.delivery_rating ?? 5}★</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground font-mono">ID: {r.id}</span>
                <div className="flex items-center gap-1">
                  {!r.is_approved && (
                    <Button
                      size="sm"
                      onClick={() => handleApprove(r.id)}
                      className="h-7 px-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Check className="h-3 w-3 mr-1" /> Approve
                    </Button>
                  )}
                  {!r.is_flagged && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleFlag(r.id)}
                      className="h-7 px-2 text-xs text-amber-600 font-semibold"
                    >
                      <Flag className="h-3 w-3 mr-1" /> Flag
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(r.id)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    title="Delete Review"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
