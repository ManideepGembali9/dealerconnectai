'use client';

import { Card } from '@/components/ui/card';
import { timeAgo } from '@/lib/format';
import type { Dealer,Review } from '@/lib/types';
import { Star } from 'lucide-react';
import { useMemo } from 'react';

type Module09Props = {
  dealer: Dealer;
  reviews: Review[];
};

export function Module09DealerReviews({ dealer, reviews }: Module09Props) {
  const shopReviews = useMemo(() => {
    return reviews.filter((r) => r.dealer_id === dealer.id || !r.dealer_id);
  }, [reviews, dealer.id]);

  const avgRating = dealer.rating || 5.0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <Star className="h-7 w-7 text-amber-500 fill-amber-500" /> Reviews & Ratings
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Customer feedback, verified ratings and ratings breakdown across store service dimensions
          </p>
        </div>

        <div className="flex items-center gap-2 bg-amber-500/10 text-amber-600 px-4 py-2 rounded-2xl font-bold text-sm">
          <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
          <span>{avgRating.toFixed(1)} / 5.0 Rating</span>
        </div>
      </div>

      {/* Reviews List */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {shopReviews.length === 0 ? (
          <div className="col-span-2 py-16 text-center text-muted-foreground">
            <Star className="mx-auto h-8 w-8 opacity-40 mb-2" />
            No customer reviews posted for this showroom yet.
          </div>
        ) : (
          shopReviews.map((r) => (
            <Card
              key={r.id}
              className="p-5 border-border/80 flex flex-col justify-between shadow-sm transition-all hover:border-emerald-500/50"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-bold text-foreground text-sm block">
                      {r.customer_name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Submitted {timeAgo(r.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded font-bold text-xs">
                    <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                    <span>{r.rating.toFixed(1)}</span>
                  </div>
                </div>

                <p className="mt-3 text-xs text-foreground italic bg-muted/20 p-3 rounded-xl border border-border/40 leading-relaxed">
                  &quot;{r.comment || 'Verified customer review'}&quot;
                </p>

                <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                  <div className="rounded-lg bg-card border border-border/50 p-1.5 text-center">
                    <span className="text-muted-foreground block">Quality</span>
                    <span className="font-bold text-foreground">{r.quality_rating ?? 5}★</span>
                  </div>
                  <div className="rounded-lg bg-card border border-border/50 p-1.5 text-center">
                    <span className="text-muted-foreground block">Counter Behavior</span>
                    <span className="font-bold text-foreground">{r.behavior_rating ?? 5}★</span>
                  </div>
                  <div className="rounded-lg bg-card border border-border/50 p-1.5 text-center">
                    <span className="text-muted-foreground block">Delivery</span>
                    <span className="font-bold text-foreground">{r.delivery_rating ?? 5}★</span>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
