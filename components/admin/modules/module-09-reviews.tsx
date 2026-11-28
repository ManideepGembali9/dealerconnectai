'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiSync } from '@/lib/api-sync';
import { timeAgo } from '@/lib/format';
import type { Dealer, ModerationLog, Product, Review } from '@/lib/types';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Flag,
  History,
  MessageSquareReply,
  Package,
  Search,
  Star,
  Store,
} from 'lucide-react';
import { toast } from 'sonner';

type Props = {
  reviews: Review[];
  dealers?: Dealer[];
  products?: Product[];
  onRefreshReviews: () => Promise<void>;
};

export function Module09Reviews({
  reviews,
  dealers = [],
  products = [],
  onRefreshReviews,
}: Props) {
  const [filter, setFilter] = useState<'all' | 'product' | 'dealer' | 'approved' | 'flagged' | 'hidden' | 'low'>('all');
  const [search, setSearch] = useState('');
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<ModerationLog[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [showAuditLogs, setShowAuditLogs] = useState(false);

  const loadModerationDetails = useCallback(async () => {
    try {
      const data = await apiSync.fetchReviews({ scope: 'admin' });
      setLogs(data.moderationLogs || []);
    } catch {}
  }, []);

  useEffect(() => {
    loadModerationDetails();
  }, [loadModerationDetails, reviews.length]);

  const dealerMap = useMemo(() => {
    const map: Record<string, Dealer> = {};
    dealers.forEach((d) => {
      map[d.id] = d;
    });
    return map;
  }, [dealers]);

  const productMap = useMemo(() => {
    const map: Record<string, Product> = {};
    products.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [products]);

  const filtered = useMemo(() => {
    return reviews.filter((r) => {
      const isHidden = Boolean(r.is_hidden || r.is_approved === false);
      const isFlagged = Boolean(r.is_flagged || (r.reports && r.reports.length > 0));
      const matchFilter =
        filter === 'all' ||
        (filter === 'product' && Boolean(r.product_id)) ||
        (filter === 'dealer' && !r.product_id) ||
        (filter === 'approved' && !isHidden) ||
        (filter === 'flagged' && isFlagged) ||
        (filter === 'hidden' && isHidden) ||
        (filter === 'low' && Number(r.rating) <= 2);

      if (!matchFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const dName = r.dealer_id ? dealerMap[r.dealer_id]?.shop_name || '' : '';
      const pName = r.product_id ? productMap[r.product_id]?.name || '' : '';
      return (
        r.customer_name.toLowerCase().includes(q) ||
        (r.comment || '').toLowerCase().includes(q) ||
        dName.toLowerCase().includes(q) ||
        pName.toLowerCase().includes(q)
      );
    });
  }, [reviews, filter, search, dealerMap, productMap]);

  const handleModerationAction = async (
    revId: string,
    action: 'approve' | 'flag' | 'hide' | 'restore'
  ) => {
    setLoadingId(revId);
    try {
      await apiSync.updateReview({
        id: revId,
        action,
        reason: (adminNotes[revId] || '').trim() || `Admin ${action}d review`,
      });
      toast.success(`Review ${action}d and logged in audit trail.`);
      await Promise.all([onRefreshReviews(), loadModerationDetails()]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Moderation failed');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-foreground">
            Reviews &amp; Moderation Control ({reviews.length})
          </h2>
          <p className="text-xs text-muted-foreground">
            Inspect reported feedback, approve or hide offensive reviews, restore moderated items, and review full audit logs
          </p>
        </div>

        <Button
          size="sm"
          variant={showAuditLogs ? 'default' : 'outline'}
          onClick={() => setShowAuditLogs((v) => !v)}
          className="gap-1.5 text-xs rounded-xl"
        >
          <History className="h-3.5 w-3.5" /> Audit History ({logs.length})
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'all', label: `All (${reviews.length})` },
            { id: 'approved', label: 'Visible' },
            { id: 'flagged', label: `Flagged (${reviews.filter((r) => r.is_flagged || (r.reports && r.reports.length > 0)).length})` },
            { id: 'hidden', label: `Hidden (${reviews.filter((r) => r.is_hidden || r.is_approved === false).length})` },
            { id: 'low', label: 'Low Rating (1-2★)' },
            { id: 'product', label: 'Products' },
            { id: 'dealer', label: 'Shops' },
          ].map((f) => (
            <Button
              key={f.id}
              size="sm"
              variant={filter === f.id ? 'default' : 'outline'}
              className="h-8 text-xs rounded-xl"
              onClick={() => setFilter(f.id as typeof filter)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, dealer, product..."
            className="h-8 pl-8 text-xs rounded-xl"
          />
        </div>
      </div>

      {/* Moderation Audit History Drawer */}
      {showAuditLogs && (
        <Card className="p-4 rounded-2xl border-border/80 bg-muted/20 space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" /> Moderation Audit Trail (Non-Destructive)
          </h3>
          {logs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No moderation actions recorded yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 text-xs bg-card p-2.5 rounded-xl border border-border/60">
                  <div>
                    <Badge variant="outline" className="text-[10px] mr-2 uppercase">{log.action}</Badge>
                    <span className="font-semibold">{log.entity_name || log.entity_id}</span>
                    {log.reason && <span className="text-muted-foreground ml-2">— {log.reason}</span>}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{log.performed_by} • {timeAgo(log.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Review List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card className="p-12 text-center rounded-2xl">
            <Star className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No customer reviews match the current filter.</p>
          </Card>
        ) : (
          filtered.map((rev) => {
            const dealer = rev.dealer_id ? dealerMap[rev.dealer_id] : null;
            const product = rev.product_id ? productMap[rev.product_id] : null;
            const isHidden = Boolean(rev.is_hidden || rev.is_approved === false);

            return (
              <Card key={rev.id} className="p-4 sm:p-5 rounded-2xl border-border/80 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{rev.customer_name}</span>
                      <Badge variant="outline" className="text-[10px] gap-1">
                        {rev.product_id ? <Package className="h-3 w-3" /> : <Store className="h-3 w-3" />}
                        {product ? product.name : dealer?.shop_name || 'Shop Review'}
                      </Badge>
                      {dealer && (
                        <span className="text-xs text-muted-foreground">• {dealer.shop_name}</span>
                      )}
                      {isHidden ? (
                        <Badge className="bg-amber-500/15 text-amber-700 text-[10px] gap-1">
                          <EyeOff className="h-3 w-3" /> Hidden
                        </Badge>
                      ) : rev.is_flagged ? (
                        <Badge className="bg-red-500/15 text-red-700 text-[10px] gap-1">
                          <Flag className="h-3 w-3" /> Flagged
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500/15 text-emerald-700 text-[10px] gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Visible
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo(rev.created_at)}</p>
                  </div>

                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <p className="text-sm text-foreground bg-muted/20 p-3 rounded-xl border border-border/40">
                  {rev.comment || 'No comment text'}
                </p>

                {rev.dealer_response && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs">
                    <p className="font-bold text-emerald-700 flex items-center gap-1.5">
                      <MessageSquareReply className="h-3.5 w-3.5" /> Dealer Response ({rev.responded_by || dealer?.shop_name || 'Dealer'})
                    </p>
                    <p className="mt-1 text-foreground">{rev.dealer_response}</p>
                  </div>
                )}

                {rev.reports && rev.reports.length > 0 && (
                  <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-2.5 text-xs space-y-1">
                    <p className="font-bold text-red-700">Reports ({rev.reports.length})</p>
                    {rev.reports.map((rep) => (
                      <p key={rep.id} className="text-red-700/90">
                        • {rep.reporter_name}: &ldquo;{rep.reason}&rdquo; ({timeAgo(rep.created_at)})
                      </p>
                    ))}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                  <Input
                    value={adminNotes[rev.id] ?? ''}
                    onChange={(e) => setAdminNotes((p) => ({ ...p, [rev.id]: e.target.value }))}
                    placeholder="Moderation audit note (optional)..."
                    className="h-8 text-xs flex-1 rounded-xl"
                  />
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    {isHidden ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loadingId === rev.id}
                        onClick={() => handleModerationAction(rev.id, 'restore')}
                        className="h-8 text-xs gap-1 rounded-xl text-emerald-700 border-emerald-500/30"
                      >
                        <Eye className="h-3.5 w-3.5" /> Restore Review
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loadingId === rev.id}
                          onClick={() => handleModerationAction(rev.id, 'approve')}
                          className="h-8 text-xs gap-1 rounded-xl text-emerald-700"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loadingId === rev.id}
                          onClick={() => handleModerationAction(rev.id, 'flag')}
                          className="h-8 text-xs gap-1 rounded-xl text-amber-700"
                        >
                          <Flag className="h-3.5 w-3.5" /> Flag
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loadingId === rev.id}
                          onClick={() => handleModerationAction(rev.id, 'hide')}
                          className="h-8 text-xs gap-1 rounded-xl text-destructive border-destructive/30"
                        >
                          <EyeOff className="h-3.5 w-3.5" /> Hide Review
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
