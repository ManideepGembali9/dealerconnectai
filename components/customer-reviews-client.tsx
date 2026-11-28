'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Edit3,
  EyeOff,
  Flag,
  MessageSquareReply,
  Package,
  Star,
  Store,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { CustomerSubpageShell } from '@/components/profile/customer-subpage-shell';
import { apiSync } from '@/lib/api-sync';
import { getDbDealers, getDbProducts } from '@/lib/firebase-db';
import { timeAgo } from '@/lib/format';
import { useRealtimeSync } from '@/lib/realtime-client';
import type { Dealer, Product, Review } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function CustomerReviewsClient() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [dealers, setDealers] = useState<Record<string, Dealer>>({});
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRating, setEditRating] = useState(5);
  const [editComment, setEditComment] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadMyReviews = useCallback(async () => {
    try {
      const [{ reviews: mine }, prodList, dealerList] = await Promise.all([
        apiSync.fetchReviews({ scope: 'customer' }),
        getDbProducts({ includeUnapproved: true }),
        getDbDealers(),
      ]);
      setReviews(
        (mine || []).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      );
      const pMap: Record<string, Product> = {};
      prodList.forEach((p) => {
        pMap[p.id] = p;
      });
      setProducts(pMap);

      const dMap: Record<string, Dealer> = {};
      dealerList.forEach((d) => {
        dMap[d.id] = d;
      });
      setDealers(dMap);
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMyReviews();
  }, [loadMyReviews]);

  useRealtimeSync(['reviews', 'products', 'dealers', 'notifications'], loadMyReviews, {
    onReconnect: loadMyReviews,
  });

  const handleStartEdit = (rev: Review) => {
    setEditingId(rev.id);
    setEditRating(rev.rating);
    setEditComment(rev.comment || '');
  };

  const handleSaveEdit = async (id: string) => {
    if (editComment.trim().length < 5) {
      toast.error('Review comment must be at least 5 characters.');
      return;
    }
    setSavingId(id);
    try {
      await apiSync.updateReview({
        id,
        action: 'edit',
        rating: editRating,
        comment: editComment.trim(),
      });
      setEditingId(null);
      toast.success('Review updated across all portals!');
      await loadMyReviews();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update review');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setSavingId(id);
    try {
      await apiSync.deleteReview(id);
      setReviews((prev) => prev.filter((r) => r.id !== id));
      toast.success('Review deleted and ratings recalculated.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete review');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <CustomerSubpageShell
      title="My Reviews & Ratings"
      subtitle="Manage your product and showroom reviews, edit feedback, and track dealer replies"
      redirectPath="/customer/reviews"
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : reviews.length === 0 ? (
        <Card className="p-8 text-center">
          <Star className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-semibold">No Reviews Submitted Yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Once you enquire about a product or shop, you can share a verified review on its page.
          </p>
          <Link href="/search" className="mt-4 inline-block">
            <Button>Explore Products &amp; Shops</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((rev) => {
            const product = rev.product_id ? products[rev.product_id] : null;
            const dealer = rev.dealer_id ? dealers[rev.dealer_id] : null;
            const targetHref = product
              ? `/product/${product.id}`
              : dealer
                ? `/dealer/${dealer.id}`
                : '/';
            const targetName = product?.name || dealer?.shop_name || 'Local Store Listing';
            const isEditing = editingId === rev.id;

            return (
              <Card key={rev.id} className="p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px] gap-1">
                        {rev.product_id ? (
                          <Package className="h-3 w-3" />
                        ) : (
                          <Store className="h-3 w-3" />
                        )}
                        {rev.product_id ? 'Product Review' : 'Shop Review'}
                      </Badge>
                      {rev.is_hidden || rev.is_approved === false ? (
                        <Badge className="bg-amber-500/15 text-amber-600 text-[10px] gap-1">
                          <EyeOff className="h-3 w-3" /> Hidden by Moderation
                        </Badge>
                      ) : rev.is_flagged ? (
                        <Badge className="bg-red-500/15 text-red-600 text-[10px] gap-1">
                          <Flag className="h-3 w-3" /> Under Review
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500/15 text-emerald-600 text-[10px] gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Published
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(rev.created_at)}
                      </span>
                    </div>
                    <Link
                      href={targetHref}
                      className="mt-1.5 inline-block text-sm font-bold hover:text-primary hover:underline"
                    >
                      {targetName}
                    </Link>
                    {dealer && product && (
                      <p className="text-xs text-muted-foreground">Sold by {dealer.shop_name}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!isEditing && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 text-xs"
                        onClick={() => handleStartEdit(rev)}
                      >
                        <Edit3 className="h-3.5 w-3.5" /> Edit
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 text-xs text-destructive hover:bg-destructive/10"
                      disabled={savingId === rev.id}
                      onClick={() => handleDelete(rev.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setEditRating(star)}
                          className="p-0.5"
                          aria-label={`Rate ${star} stars`}
                        >
                          <Star
                            className={cn(
                              'h-5 w-5',
                              star <= editRating
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-muted-foreground/40'
                            )}
                          />
                        </button>
                      ))}
                      <span className="ml-2 text-xs font-semibold">{editRating}/5</span>
                    </div>
                    <Textarea
                      value={editComment}
                      onChange={(e) => setEditComment(e.target.value)}
                      rows={3}
                      className="text-sm"
                      placeholder="Update your review experience..."
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={savingId === rev.id}
                        onClick={() => handleSaveEdit(rev.id)}
                      >
                        {savingId === rev.id ? 'Saving...' : 'Save Changes'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={cn(
                            'h-4 w-4',
                            star <= rev.rating
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-muted-foreground/30'
                          )}
                        />
                      ))}
                      <span className="ml-1.5 text-xs font-bold">{rev.rating}/5</span>
                      {rev.updated_at && rev.updated_at !== rev.created_at && (
                        <span className="ml-2 text-[11px] text-muted-foreground">(Edited)</span>
                      )}
                    </div>
                    <p className="text-sm text-foreground">{rev.comment}</p>
                  </>
                )}

                {rev.dealer_response && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      <MessageSquareReply className="h-3.5 w-3.5" />
                      Reply from {rev.responded_by || dealer?.shop_name || 'Dealer'}
                    </p>
                    <p className="mt-1 text-xs text-foreground">{rev.dealer_response}</p>
                  </div>
                )}

                {rev.moderation_notes && (rev.is_hidden || rev.is_flagged) && (
                  <p className="text-xs text-amber-600">
                    Moderation note: {rev.moderation_notes}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </CustomerSubpageShell>
  );
}
