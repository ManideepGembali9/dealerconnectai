'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { getDbEnquiries, saveDbEnquiry } from '@/lib/firebase-db';
import { timeAgo } from '@/lib/format';
import { useRealtimeSync } from '@/lib/realtime-client';
import type { Enquiry, EnquiryStatus } from '@/lib/types';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  MessageCircle,
  MessageSquare,
  Phone,
  RefreshCw,
  Send,
  Store,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

const STATUS_CONFIG: Record<EnquiryStatus, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  },
  viewed: {
    label: 'Viewed',
    className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  },
  responded: {
    label: 'Responded',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  },
  resolved: {
    label: 'Resolved',
    className: 'bg-primary/15 text-primary border-primary/30',
  },
  closed: {
    label: 'Closed',
    className: 'bg-muted text-muted-foreground border-border',
  },
};

export function CustomerEnquiriesClient() {
  const router = useRouter();
  const { customerAuthenticated, customer, loading: authLoading } = useAuth();
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | EnquiryStatus>('all');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [sendingReplyId, setSendingReplyId] = useState<string | null>(null);

  const loadEnquiries = useCallback(async () => {
    if (!customer) return;
    try {
      const list = await getDbEnquiries(undefined, {
        customerId: customer.id,
        customerEmail: customer.email,
      });
      // Guarantee strict Customer-to-Dealer isolation (never mix DENQ Dealer-to-Admin leads)
      setEnquiries((list || []).filter((item) => !String(item.id || '').startsWith('DENQ')));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [customer]);

  useRealtimeSync(['enquiries', 'notifications'], loadEnquiries, {
    enabled: Boolean(customer),
    onReconnect: loadEnquiries,
  });

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
      const updated = await saveDbEnquiry({ id: enq.id, status: nextStatus, actorRole: 'customer' });
      setEnquiries((prev) =>
        prev.map((item) =>
          item.id === enq.id
            ? { ...item, ...updated, dealer: item.dealer, product: item.product }
            : item
        )
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSendFollowUp = async (enq: Enquiry) => {
    const text = (replyDrafts[enq.id] || '').trim();
    if (!text) return;
    setSendingReplyId(enq.id);
    try {
      const updated = await saveDbEnquiry({
        id: enq.id,
        actorRole: 'customer',
        follow_up_message: text,
      });
      setReplyDrafts((prev) => ({ ...prev, [enq.id]: '' }));
      setEnquiries((prev) =>
        prev.map((item) =>
          item.id === enq.id
            ? { ...item, ...updated, dealer: item.dealer, product: item.product }
            : item
        )
      );
      toast.success('Follow-up message sent to dealer!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reply');
    } finally {
      setSendingReplyId(null);
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
    <div className="min-h-[calc(100vh-5rem)] bg-background text-foreground">
      {/* Minimal Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/profile"
              aria-label="Back to My Account"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="truncate text-lg font-extrabold tracking-tight text-foreground">
              My Enquiries ({enquiries.length})
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={loadEnquiries}
              className="h-8 gap-1.5 rounded-xl text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Link
              href="/"
              className="hidden md:inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              Home
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 pb-24 sm:pb-12">
        <p className="mb-3 text-xs sm:text-sm text-muted-foreground">
          Track your product enquiries with local dealers and respond in real time.
        </p>

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
              const formattedDate = e.created_at
                ? new Date(e.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : '';

              return (
                <Card key={e.id} className="p-4 sm:p-5 rounded-2xl border-border/80 space-y-3">
                  <div className="flex items-start gap-3">
                    {e.product?.images?.[0] ? (
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted border border-border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={e.product.images[0]}
                          alt={productTitle}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted border border-border">
                        <Store className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                            <span className="font-mono">{e.id}</span>
                            {formattedDate && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> {formattedDate}
                              </span>
                            )}
                          </div>
                          {e.product?.id ? (
                            <Link
                              href={`/product/${e.product.id}`}
                              className="text-sm font-bold hover:underline block truncate mt-0.5"
                            >
                              {productTitle}
                            </Link>
                          ) : (
                            <p className="text-sm font-bold truncate mt-0.5">{productTitle}</p>
                          )}
                          {e.dealer?.id ? (
                            <Link
                              href={`/dealer/${e.dealer.id}`}
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                            >
                              <Store className="h-3 w-3" /> {shopName}
                            </Link>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Store className="h-3 w-3" /> {shopName}
                            </span>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={`${st.className} text-[10px] font-bold shrink-0`}
                        >
                          {st.label}
                        </Badge>
                      </div>

                      {e.message && (
                        <p className="mt-2.5 text-xs sm:text-sm text-foreground bg-muted/30 rounded-xl p-2.5 border border-border/50">
                          {e.message}
                        </p>
                      )}

                      {Array.isArray(e.conversation) && e.conversation.length > 0 ? (
                        <div className="mt-2.5 space-y-2">
                          {e.conversation.slice(1).map((msg) => (
                            <div
                              key={msg.id}
                              className={`rounded-xl border p-2.5 text-xs ${
                                msg.sender_role === 'dealer'
                                  ? 'border-emerald-500/30 bg-emerald-500/10'
                                  : 'border-primary/20 bg-primary/5'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <span className="font-bold">
                                  {msg.sender_role === 'dealer' ? 'Dealer Reply' : 'Your Follow-up'} (
                                  {msg.sender_name})
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {timeAgo(msg.created_at)}
                                </span>
                              </div>
                              <p className="text-foreground leading-relaxed">{msg.message}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        e.dealer_response && (
                          <div className="mt-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                <MessageCircle className="h-3.5 w-3.5" /> Dealer Response
                              </span>
                              {e.responded_at && (
                                <span className="text-[10px] text-muted-foreground">
                                  {timeAgo(e.responded_at)}
                                </span>
                              )}
                            </div>
                            <p className="text-foreground leading-relaxed">{e.dealer_response}</p>
                          </div>
                        )
                      )}

                      <div className="mt-2.5 flex items-end gap-2">
                        <Textarea
                          value={replyDrafts[e.id] || ''}
                          onChange={(ev) =>
                            setReplyDrafts((prev) => ({ ...prev, [e.id]: ev.target.value }))
                          }
                          placeholder="Send a follow-up question to this dealer..."
                          rows={1}
                          className="min-h-[38px] text-xs rounded-xl"
                        />
                        <Button
                          size="sm"
                          type="button"
                          disabled={sendingReplyId === e.id || !(replyDrafts[e.id] || '').trim()}
                          onClick={() => handleSendFollowUp(e)}
                          className="h-9 px-3 rounded-xl text-xs gap-1 shrink-0"
                        >
                          <Send className="h-3 w-3" />
                          {sendingReplyId === e.id ? 'Sending' : 'Reply'}
                        </Button>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {timeAgo(e.created_at)}
                          </span>
                          {e.dealer?.phone && (
                            <a
                              href={`tel:${e.dealer.phone}`}
                              className="flex items-center gap-1 font-semibold text-primary hover:underline"
                            >
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
          <Card className="p-10 sm:p-12 text-center rounded-3xl border-dashed space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MessageSquare className="h-8 w-8" />
            </div>
            <h2 className="text-base font-bold text-foreground">No Product Enquiries Yet</h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
              {statusFilter === 'all'
                ? 'Explore local shops and tap "Send Enquiry" on any product to ask about price, stock, or delivery.'
                : `No enquiries found in "${statusFilter}" status.`}
            </p>
            <div className="pt-1">
              <Link
                href="/search"
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#FF7E5F] to-[#FF3F6C] px-7 py-2.5 text-xs font-bold text-white shadow-md hover:opacity-95 transition-opacity"
              >
                Find Products
              </Link>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
