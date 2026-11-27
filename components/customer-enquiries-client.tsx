'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { getDbEnquiries, saveDbEnquiry } from '@/lib/firebase-db';
import { timeAgo } from '@/lib/format';
import type { Enquiry, EnquiryStatus } from '@/lib/types';
import { CheckCircle2, Clock, MessageCircle, MessageSquare, Phone, RefreshCw, Store } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

const STATUS_CONFIG: Record<EnquiryStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' },
  viewed: { label: 'Viewed by Dealer', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30' },
  responded: { label: 'Responded', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
  resolved: { label: 'Resolved', className: 'bg-primary/15 text-primary border-primary/30' },
  closed: { label: 'Closed', className: 'bg-muted text-muted-foreground border-border' },
};

export function CustomerEnquiriesClient() {
  const router = useRouter();
  const { customerAuthenticated, customer, loading: authLoading } = useAuth();
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | EnquiryStatus>('all');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadEnquiries = useCallback(async () => {
    if (!customer) return;
    setLoading(true);
    try {
      const list = await getDbEnquiries(undefined, {
        customerId: customer.id,
        customerEmail: customer.email,
      });
      setEnquiries(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [customer]);

  useEffect(() => {
    if (!authLoading && !customerAuthenticated) {
      router.push('/customer/login?redirect=/customer/enquiries');
      return;
    }
    if (customer) {
      loadEnquiries();

      const handleSync = () => loadEnquiries();
      window.addEventListener('dc-sync-event', handleSync);
      window.addEventListener('storage', handleSync);
      return () => {
        window.removeEventListener('dc-sync-event', handleSync);
        window.removeEventListener('storage', handleSync);
      };
    }
  }, [authLoading, customerAuthenticated, customer, router, loadEnquiries]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return enquiries;
    return enquiries.filter((e) => (e.status || 'pending') === statusFilter);
  }, [enquiries, statusFilter]);

  const handleUpdateCustomerStatus = async (enq: Enquiry, nextStatus: EnquiryStatus) => {
    setUpdatingId(enq.id);
    try {
      const updated = await saveDbEnquiry({ ...enq, status: nextStatus });
      setEnquiries((prev) =>
        prev.map((item) => (item.id === enq.id ? { ...item, ...updated, dealer: item.dealer, product: item.product } : item))
      );
    } finally {
      setUpdatingId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!customer) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 pb-24 sm:pb-12">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Your Enquiries ({enquiries.length})</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Track real-time showroom responses, price quotes, and enquiry statuses
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={loadEnquiries} className="self-start sm:self-auto gap-1.5 rounded-xl text-xs">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh Status
        </Button>
      </div>

      {/* Status Filter Strip */}
      <div className="mb-4 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {(['all', 'pending', 'viewed', 'responded', 'resolved', 'closed'] as const).map((st) => (
          <Button
            key={st}
            size="sm"
            variant={statusFilter === st ? 'default' : 'outline'}
            onClick={() => setStatusFilter(st)}
            className="h-8 text-xs font-semibold capitalize whitespace-nowrap rounded-xl"
          >
            {st}
          </Button>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((e) => {
            const stKey = (e.status || 'pending') as EnquiryStatus;
            const st = STATUS_CONFIG[stKey] ?? STATUS_CONFIG.pending;
            const shopName = e.dealer?.shop_name || e.dealer_name || 'Local Dealer';
            const productTitle = e.product?.name || e.product_name || 'Product Enquiry';

            return (
              <Card key={e.id} className="p-4 sm:p-5 rounded-2xl border-border/80 space-y-3">
                <div className="flex items-start gap-3">
                  {e.product?.images?.[0] && (
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={e.product.images[0]} alt={productTitle} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-mono text-muted-foreground block">
                          {e.id}
                        </span>
                        {e.product?.id ? (
                          <Link href={`/product/${e.product.id}`} className="text-sm font-bold hover:underline block truncate">
                            {productTitle}
                          </Link>
                        ) : (
                          <p className="text-sm font-bold truncate">{productTitle}</p>
                        )}
                        {e.dealer?.id ? (
                          <Link href={`/dealer/${e.dealer.id}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                            <Store className="h-3 w-3" /> {shopName}
                          </Link>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Store className="h-3 w-3" /> {shopName}
                          </span>
                        )}
                      </div>
                      <Badge variant="outline" className={`${st.className} text-[10px] font-bold shrink-0`}>
                        {st.label}
                      </Badge>
                    </div>

                    {e.message && (
                      <p className="mt-2.5 text-xs sm:text-sm text-foreground bg-muted/30 rounded-xl p-2.5 border border-border/50">
                        {e.message}
                      </p>
                    )}

                    {e.dealer_response && (
                      <div className="mt-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                            <MessageCircle className="h-3.5 w-3.5" /> Dealer Response
                          </span>
                          {e.responded_at && (
                            <span className="text-[10px] text-muted-foreground">{timeAgo(e.responded_at)}</span>
                          )}
                        </div>
                        <p className="text-foreground leading-relaxed">{e.dealer_response}</p>
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {timeAgo(e.created_at)}
                        </span>
                        {e.dealer?.phone && (
                          <a href={`tel:${e.dealer.phone}`} className="flex items-center gap-1 font-semibold text-primary hover:underline">
                            <Phone className="h-3 w-3" /> Call Dealer
                          </a>
                        )}
                      </div>

                      {stKey !== 'resolved' && stKey !== 'closed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updatingId === e.id}
                          onClick={() => handleUpdateCustomerStatus(e, 'resolved')}
                          className="h-7 px-2.5 text-[11px] font-semibold rounded-lg gap-1"
                        >
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          {updatingId === e.id ? 'Updating...' : 'Mark Resolved'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-12 text-center rounded-2xl">
          <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {statusFilter === 'all'
              ? 'No enquiries yet. Select any product and tap "Send Enquiry" to contact a local showroom.'
              : `No enquiries in "${statusFilter}" status.`}
          </p>
          <Link href="/search" className="mt-3 inline-block">
            <Button variant="outline" className="rounded-xl">Browse Products</Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
