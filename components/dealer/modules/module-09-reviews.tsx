'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiSync } from '@/lib/api-sync';
import { timeAgo } from '@/lib/format';
import type { Dealer, Product, Review } from '@/lib/types';
import {
  CheckCircle2,
  Edit3,
  EyeOff,
  Flag,
  MessageSquareReply,
  Package,
  Search,
  Send,
  Star,
  Store,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

type Props = {
  dealer: Dealer;
  reviews: Review[];
  products?: Product[];
  onRefreshReviews?: () => Promise<void>;
};

export function Module09DealerReviews({
  dealer,
  reviews,
  products = [],
  onRefreshReviews,
}: Props) {
  const [filter, setFilter] = useState<'all' | 'product' | 'dealer' | 'unanswered' | 'replied'>('all');
  const [search, setSearch] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');

  const productMap = useMemo(() => {
    const map: Record<string, Product> = {};
    products.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [products]);

  const visibleReviews = useMemo(() => {
    return reviews.filter((r) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'product' && Boolean(r.product_id)) ||
        (filter === 'dealer' && !r.product_id) ||
        (filter === 'unanswered' && !r.dealer_response) ||
        (filter === 'replied' && Boolean(r.dealer_response));

      if (!matchesFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const pName = r.product_id ? productMap[r.product_id]?.name || '' : '';
      return (
        r.customer_name.toLowerCase().includes(q) ||
        (r.comment || '').toLowerCase().includes(q) ||
        pName.toLowerCase().includes(q)
      );
    });
  }, [reviews, filter, search, productMap]);

  const activeReviews = useMemo(
    () => reviews.filter((r) => r.is_approved !== false && !r.is_hidden),
    [reviews]
  );

  const avgRating =
    activeReviews.length > 0
      ? (activeReviews.reduce((s, r) => s + Number(r.rating || 0), 0) / activeReviews.length).toFixed(1)
      : Number(dealer.rating || 0).toFixed(1);

  const distribution = useMemo(() => {
    const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    activeReviews.forEach((r) => {
      const k = Math.max(1, Math.min(5, Math.round(r.rating || 5)));
      counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
  }, [activeReviews]);

  const handleSaveReply = async (rev: Review) => {
    const text = (replyDrafts[rev.id] ?? rev.dealer_response ?? '').trim();
    if (text.length < 2) {
      toast.error('Please enter a response before saving.');
      return;
    }
    setSubmittingId(rev.id);
    try {
      await apiSync.updateReview({
        id: rev.id,
        action: 'dealer_reply',
        dealer_response: text,
      });
      setEditingReplyId(null);
      setReplyDrafts((prev) => ({ ...prev, [rev.id]: '' }));
      toast.success('Response published & customer notified!');
      await onRefreshReviews?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish response');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleDeleteReply = async (revId: string) => {
    setSubmittingId(revId);
    try {
      await apiSync.updateReview({ id: revId, action: 'delete_dealer_reply' });
      toast.success('Dealer reply deleted.');
      await onRefreshReviews?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete reply');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleReportReview = async (revId: string) => {
    if (reportReason.trim().length < 3) {
      toast.error('Provide a short reason for reporting.');
      return;
    }
    setSubmittingId(revId);
    try {
      await apiSync.updateReview({
        id: revId,
        action: 'report',
        reason: reportReason.trim(),
      });
      setReportingId(null);
      setReportReason('');
      toast.success('Reported to Admin Moderation Queue.');
      await onRefreshReviews?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to report review');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-black text-foreground flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
          Customer Reviews &amp; Dealer Replies ({reviews.length})
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Track product &amp; showroom ratings, respond professionally to buyers, and flag policy issues
        </p>
      </div>

      {/* Rating Summary & Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 flex flex-col justify-center items-center text-center rounded-2xl border-border/80">
          <p className="text-4xl font-black text-foreground">{avgRating}</p>
          <div className="flex items-center gap-1 mt-1.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${
                  i <= Math.round(Number(avgRating))
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-muted-foreground/30'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {activeReviews.length} visible published reviews
          </p>
        </Card>

        <Card className="md:col-span-2 p-5 rounded-2xl border-border/80 space-y-2">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = distribution[stars] || 0;
            const pct = activeReviews.length > 0 ? Math.round((count / activeReviews.length) * 100) : 0;
            return (
              <div key={stars} className="flex items-center gap-3 text-xs">
                <span className="w-10 font-bold text-foreground">{stars}★</span>
                <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-12 text-right text-muted-foreground">{count} ({pct}%)</span>
              </div>
            );
          })}
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'all', label: `All (${reviews.length})` },
            { id: 'unanswered', label: `Needs Reply (${reviews.filter((r) => !r.dealer_response).length})` },
            { id: 'replied', label: `Replied (${reviews.filter((r) => Boolean(r.dealer_response)).length})` },
            { id: 'product', label: 'Product Reviews' },
            { id: 'dealer', label: 'Shop Reviews' },
          ].map((t) => (
            <Button
              key={t.id}
              size="sm"
              variant={filter === t.id ? 'default' : 'outline'}
              className="h-8 text-xs rounded-xl"
              onClick={() => setFilter(t.id as typeof filter)}
            >
              {t.label}
            </Button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search review or customer..."
            className="h-8 pl-8 text-xs rounded-xl"
          />
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-3">
        {visibleReviews.length === 0 ? (
          <Card className="p-12 text-center rounded-2xl border-border/80">
            <p className="text-sm font-semibold text-muted-foreground">No reviews match this filter.</p>
          </Card>
        ) : (
          visibleReviews.map((r) => {
            const product = r.product_id ? productMap[r.product_id] : null;
            const isEditingReply = editingReplyId === r.id || !r.dealer_response;

            return (
              <Card key={r.id} className="p-4 sm:p-5 rounded-2xl border-border/80 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-sm text-foreground">{r.customer_name}</p>
                      <Badge variant="outline" className="text-[10px] gap-1">
                        {r.product_id ? <Package className="h-3 w-3" /> : <Store className="h-3 w-3" />}
                        {product ? product.name : r.product_id ? `Product ${r.product_id}` : 'Showroom Review'}
                      </Badge>
                      {r.is_verified_interaction && (
                        <Badge className="bg-emerald-500/15 text-emerald-700 text-[10px] gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Verified Buyer
                        </Badge>
                      )}
                      {r.is_hidden && (
                        <Badge className="bg-amber-500/15 text-amber-700 text-[10px] gap-1">
                          <EyeOff className="h-3 w-3" /> Hidden by Admin
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo(r.created_at)}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, idx) => (
                        <Star
                          key={idx}
                          className={`h-3.5 w-3.5 ${
                            idx < r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'
                          }`}
                        />
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[11px] text-muted-foreground"
                      onClick={() => setReportingId(reportingId === r.id ? null : r.id)}
                    >
                      <Flag className="h-3 w-3 mr-1" /> Flag
                    </Button>
                  </div>
                </div>

                {r.comment && (
                  <p className="text-sm text-foreground bg-muted/20 p-3 rounded-xl border border-border/40">
                    {r.comment}
                  </p>
                )}

                {reportingId === r.id && (
                  <div className="flex items-center gap-2">
                    <Input
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      placeholder="Explain why this review should be inspected by Admin..."
                      className="h-8 text-xs"
                    />
                    <Button
                      size="sm"
                      disabled={submittingId === r.id}
                      onClick={() => handleReportReview(r.id)}
                      className="h-8 text-xs"
                    >
                      Submit Report
                    </Button>
                  </div>
                )}

                {r.dealer_response && editingReplyId !== r.id ? (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                        <MessageSquareReply className="h-3.5 w-3.5" /> Your Public Response
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => {
                            setEditingReplyId(r.id);
                            setReplyDrafts((prev) => ({ ...prev, [r.id]: r.dealer_response || '' }));
                          }}
                        >
                          <Edit3 className="h-3 w-3 mr-1" /> Edit Reply
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px] text-destructive"
                          disabled={submittingId === r.id}
                          onClick={() => handleDeleteReply(r.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-foreground">{r.dealer_response}</p>
                  </div>
                ) : (
                  isEditingReply && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Textarea
                        value={replyDrafts[r.id] ?? ''}
                        onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        placeholder="Write a helpful public response to this customer..."
                        rows={2}
                        className="text-xs rounded-xl"
                      />
                      <div className="flex sm:flex-col gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          disabled={submittingId === r.id}
                          onClick={() => handleSaveReply(r)}
                          className="h-8 gap-1 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Send className="h-3 w-3" /> {submittingId === r.id ? 'Saving...' : 'Post Reply'}
                        </Button>
                        {r.dealer_response && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => setEditingReplyId(null)}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
