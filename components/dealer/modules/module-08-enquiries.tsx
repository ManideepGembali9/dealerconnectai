'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { saveDbEnquiry } from '@/lib/firebase-db';
import { timeAgo } from '@/lib/format';
import type { Dealer, Enquiry, EnquiryStatus, Product } from '@/lib/types';
import {
  Check,
  Clock,
  Eye,
  Mail,
  MessageCircle,
  MessageSquareText,
  Package,
  Phone,
  Search,
  Send,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type Module08Props = {
  dealer: Dealer;
  enquiries: Enquiry[];
  products: Product[];
  onRefreshEnquiries?: () => Promise<void>;
};

const STATUS_BADGE: Record<EnquiryStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300' },
  viewed: { label: 'Viewed', className: 'bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300' },
  responded: { label: 'Responded', className: 'bg-indigo-500/15 text-indigo-700 border-indigo-500/30 dark:text-indigo-300' },
  resolved: { label: 'Resolved', className: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300' },
  closed: { label: 'Closed', className: 'bg-muted text-muted-foreground border-border' },
};

function normalizeStatus(raw?: string): EnquiryStatus {
  if (raw === 'new') return 'pending';
  if (raw === 'contacted') return 'responded';
  if (raw === 'completed') return 'resolved';
  if (raw === 'pending' || raw === 'viewed' || raw === 'responded' || raw === 'resolved' || raw === 'closed') {
    return raw;
  }
  return 'pending';
}

export function Module08DealerEnquiries({
  dealer,
  enquiries: initialEnquiries,
  products,
  onRefreshEnquiries,
}: Module08Props) {
  const [enquiries, setEnquiries] = useState<Enquiry[]>(initialEnquiries);
  const [filter, setFilter] = useState<'all' | EnquiryStatus>('all');
  const [search, setSearch] = useState('');
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [replyText, setReplyText] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setEnquiries(initialEnquiries);
  }, [initialEnquiries]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const filtered = useMemo(() => {
    return enquiries.filter((e) => {
      const st = normalizeStatus(e.status);
      if (filter !== 'all' && st !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchId = e.id.toLowerCase().includes(q);
        const matchCust = e.customer_name?.toLowerCase().includes(q);
        const matchPhone = e.customer_phone?.toLowerCase().includes(q);
        const matchMsg = e.message?.toLowerCase().includes(q);
        const matchProd = (e.product_name || e.product?.name || '').toLowerCase().includes(q);
        if (!matchId && !matchCust && !matchPhone && !matchMsg && !matchProd) return false;
      }
      return true;
    });
  }, [enquiries, filter, search]);

  const counts = useMemo(() => {
    const res = { all: enquiries.length, pending: 0, viewed: 0, responded: 0, resolved: 0, closed: 0 };
    for (const e of enquiries) {
      res[normalizeStatus(e.status)]++;
    }
    return res;
  }, [enquiries]);

  const handleOpenEnquiry = async (enq: Enquiry) => {
    setSelectedEnquiry(enq);
    setReplyText(enq.dealer_response || '');
    const st = normalizeStatus(enq.status);
    if (st === 'pending') {
      try {
        const saved = await saveDbEnquiry({ id: enq.id, dealer_id: dealer.id, status: 'viewed' });
        setEnquiries((prev) => prev.map((item) => (item.id === enq.id ? saved : item)));
        setSelectedEnquiry(saved);
        if (onRefreshEnquiries) await onRefreshEnquiries();
      } catch { }
    }
  };

  const handleUpdateStatus = async (enq: Enquiry, newStatus: EnquiryStatus, customReply?: string) => {
    setSaving(true);
    try {
      const saved = await saveDbEnquiry({
        id: enq.id,
        dealer_id: dealer.id,
        dealer_name: dealer.shop_name,
        status: newStatus,
        dealer_response: customReply !== undefined ? customReply.trim() || null : enq.dealer_response ?? null,
        responded_at:
          newStatus === 'responded' || customReply
            ? new Date().toISOString()
            : enq.responded_at ?? null,
        responded_by: dealer.shop_name,
      });

      setEnquiries((prev) => prev.map((item) => (item.id === enq.id ? saved : item)));
      if (selectedEnquiry?.id === enq.id) {
        setSelectedEnquiry(saved);
      }
      setFeedback({
        type: 'success',
        text: `Enquiry ${enq.id} updated to "${STATUS_BADGE[newStatus].label}"${customReply ? ' and response sent to customer.' : '.'}`,
      });
      toast.success(`Enquiry ${enq.id} marked as ${newStatus}`);
      if (onRefreshEnquiries) await onRefreshEnquiries();
    } catch (err: any) {
      const msg = err?.message || 'Failed to update enquiry';
      setFeedback({ type: 'error', text: msg });
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnquiry) return;
    if (!replyText.trim()) {
      setFeedback({ type: 'error', text: 'Please enter a response message for the customer.' });
      return;
    }
    await handleUpdateStatus(selectedEnquiry, 'responded', replyText.trim());
    setSelectedEnquiry(null);
  };

  const handleOpenWhatsApp = (phone: string, customerName: string, productTitle?: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const text = encodeURIComponent(
      `Hello ${customerName}, thank you for contacting ${dealer.shop_name} regarding ${productTitle || 'your product enquiry'
      }. We are pleased to confirm that this item is available for showroom pickup or local delivery.`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <MessageSquareText className="h-7 w-7 text-emerald-600" /> Customer Enquiries & Leads
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Private enquiries sent directly to {dealer.shop_name}. Reply in-app to notify buyers in real time.
          </p>
        </div>
        {counts.pending > 0 && (
          <Badge variant="destructive" className="px-3 py-1 text-xs font-bold gap-1 self-start sm:self-auto">
            <Clock className="h-3.5 w-3.5" /> {counts.pending} New Pending
          </Badge>
        )}
      </div>

      {feedback && (
        <div
          className={`rounded-xl border px-3.5 py-2.5 text-xs font-semibold flex items-center justify-between gap-2 ${feedback.type === 'success'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : 'border-destructive/30 bg-destructive/10 text-destructive'
            }`}
        >
          <span>{feedback.text}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-[11px] opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="overflow-x-auto pb-1">
          <Tabs value={filter} onValueChange={(v: any) => setFilter(v)}>
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs font-semibold">All ({counts.all})</TabsTrigger>
              <TabsTrigger value="pending" className="text-xs font-semibold">Pending ({counts.pending})</TabsTrigger>
              <TabsTrigger value="viewed" className="text-xs font-semibold">Viewed ({counts.viewed})</TabsTrigger>
              <TabsTrigger value="responded" className="text-xs font-semibold">Responded ({counts.responded})</TabsTrigger>
              <TabsTrigger value="resolved" className="text-xs font-semibold">Resolved ({counts.resolved})</TabsTrigger>
              <TabsTrigger value="closed" className="text-xs font-semibold">Closed ({counts.closed})</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search enquiry ID, customer, product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filtered.length === 0 ? (
          <div className="col-span-2 py-16 text-center text-muted-foreground">
            <MessageSquareText className="mx-auto h-8 w-8 opacity-40 mb-2" />
            No enquiries match the selected filter.
          </div>
        ) : (
          filtered.map((e) => {
            const st = normalizeStatus(e.status);
            const stCfg = STATUS_BADGE[st];
            const product = e.product || (e.product_id ? productMap.get(e.product_id) : null);
            const productTitle = e.product_name || product?.name;
            return (
              <Card
                key={e.id}
                className="p-5 border-border/80 flex flex-col justify-between shadow-sm transition-all hover:border-emerald-500/50"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-foreground text-sm">
                          {e.customer_name || 'Interested Customer'}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {e.id}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-mono block mt-0.5">
                        {e.customer_phone || 'No phone'} • {timeAgo(e.created_at)}
                      </span>
                      {e.customer_email && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Mail className="h-3 w-3" /> {e.customer_email}
                        </span>
                      )}
                    </div>
                    <Badge variant="outline" className={`text-[10px] font-bold shrink-0 ${stCfg.className}`}>
                      {stCfg.label}
                    </Badge>
                  </div>

                  {productTitle && (
                    <div className="mt-3 p-2.5 rounded-lg bg-muted/40 border border-border/50 text-xs flex items-center gap-2">
                      <Package className="h-4 w-4 text-emerald-600 shrink-0" />
                      <div className="truncate">
                        <span className="font-semibold text-foreground truncate block">
                          {productTitle}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {product?.category?.name || 'Showroom Product'}
                        </span>
                      </div>
                    </div>
                  )}

                  <p className="mt-3 text-xs text-foreground bg-muted/20 p-3 rounded-xl border border-border/40 leading-relaxed">
                    &quot;{e.message || 'Customer requested live availability and counter price.'}&quot;
                  </p>

                  {e.dealer_response && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block mb-0.5">
                        Your Reply {e.responded_at ? `• ${timeAgo(e.responded_at)}` : ''}
                      </span>
                      <p className="text-foreground">{e.dealer_response}</p>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-border/50 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      size="sm"
                      onClick={() => handleOpenEnquiry(e)}
                      className="h-8 px-2.5 text-xs font-bold bg-primary text-primary-foreground gap-1"
                    >
                      <Eye className="h-3.5 w-3.5" /> {e.dealer_response ? 'View / Update Reply' : 'View & Respond'}
                    </Button>
                    {e.customer_phone && (
                      <>
                        <Button
                          size="sm"
                          onClick={() =>
                            handleOpenWhatsApp(e.customer_phone!, e.customer_name || 'Customer', productTitle)
                          }
                          className="h-8 px-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                        </Button>
                        <Button size="sm" variant="outline" asChild className="h-8 px-2.5 text-xs font-semibold gap-1">
                          <a href={`tel:${e.customer_phone}`}>
                            <Phone className="h-3.5 w-3.5 text-emerald-600" /> Call
                          </a>
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {st !== 'resolved' && st !== 'closed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saving}
                        onClick={() => handleUpdateStatus(e, 'resolved')}
                        className="h-8 px-2 text-xs text-emerald-600 font-semibold"
                      >
                        <Check className="h-3.5 w-3.5 mr-1" /> Resolve
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Interactive View & Response Dialog */}
      <Dialog open={!!selectedEnquiry} onOpenChange={(open) => !open && setSelectedEnquiry(null)}>
        {selectedEnquiry && (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquareText className="h-5 w-5 text-emerald-600" /> Respond to Customer Enquiry
              </DialogTitle>
              <DialogDescription className="text-xs font-mono">
                ID: {selectedEnquiry.id} • {timeAgo(selectedEnquiry.created_at)}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSendReply} className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-bold text-foreground">{selectedEnquiry.customer_name || 'Customer'}</span>
                </div>
                {selectedEnquiry.customer_phone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone:</span>
                    <span className="font-mono font-semibold">{selectedEnquiry.customer_phone}</span>
                  </div>
                )}
                {(selectedEnquiry.product_name || selectedEnquiry.product?.name) && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Product:</span>
                    <span className="font-semibold text-foreground">
                      {selectedEnquiry.product_name || selectedEnquiry.product?.name}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t border-border/60">
                  <span className="text-muted-foreground block mb-1">Customer Request:</span>
                  <p className="text-foreground font-medium">{selectedEnquiry.message}</p>
                </div>
              </div>

              <div>
                <Label htmlFor="dealer-reply-text" className="text-xs font-bold">
                  Showroom Response Message *
                </Label>
                <div className="flex flex-wrap gap-1.5 my-1.5">
                  {[
                    'In stock at our showroom today! Visit anytime or call us for final deal price.',
                    'Special counter discount available today. Free local delivery within city limits.',
                  ].map((tpl) => (
                    <button
                      key={tpl}
                      type="button"
                      onClick={() => setReplyText(tpl)}
                      className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[10px] font-medium hover:bg-muted"
                    >
                      Quick template
                    </button>
                  ))}
                </div>
                <Textarea
                  id="dealer-reply-text"
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Confirm stock availability, best showroom price, delivery timing, and warranty details..."
                  className="text-xs"
                  required
                />
              </div>

              <DialogFooter className="flex-wrap gap-2">
                {normalizeStatus(selectedEnquiry.status) !== 'closed' && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={async () => {
                      await handleUpdateStatus(selectedEnquiry, 'closed');
                      setSelectedEnquiry(null);
                    }}
                    className="text-xs gap-1"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Close Lead
                  </Button>
                )}
                <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5">
                  <Send className="h-3.5 w-3.5" /> {saving ? 'Sending...' : 'Send Reply to Customer'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
