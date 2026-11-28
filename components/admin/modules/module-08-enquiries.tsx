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
  MessageSquareText,
  Phone,
  Search,
  Store,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type Module08Props = {
  enquiries: Enquiry[];
  dealers: Dealer[];
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

export function Module08Enquiries({
  enquiries: initialEnquiries,
  dealers,
  products,
  onRefreshEnquiries,
}: Module08Props) {
  const [enquiries, setEnquiries] = useState<Enquiry[]>(initialEnquiries);
  const [filterStatus, setFilterStatus] = useState<'all' | EnquiryStatus>('all');
  const [filterDealer, setFilterDealer] = useState<string>('all');
  const [filterCustomer, setFilterCustomer] = useState<string>('all');
  const [filterProduct, setFilterProduct] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setEnquiries(initialEnquiries);
  }, [initialEnquiries]);

  const dealerMap = useMemo(() => new Map(dealers.map((d) => [d.id, d])), [dealers]);
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const uniqueCustomers = useMemo(() => {
    const names = new Set<string>();
    enquiries.forEach((e) => {
      if (e.customer_name?.trim()) names.add(e.customer_name.trim());
    });
    return Array.from(names).sort();
  }, [enquiries]);

  const uniqueEnquiryProducts = useMemo(() => {
    const map = new Map<string, string>();
    enquiries.forEach((e) => {
      if (e.product_id) {
        map.set(e.product_id, e.product_name || productMap.get(e.product_id)?.name || e.product_id);
      }
    });
    return Array.from(map.entries());
  }, [enquiries, productMap]);

  const filteredEnquiries = useMemo(() => {
    return enquiries.filter((e) => {
      const st = normalizeStatus(e.status);
      if (filterStatus !== 'all' && st !== filterStatus) return false;
      if (filterDealer !== 'all' && e.dealer_id !== filterDealer) return false;
      if (filterCustomer !== 'all' && (e.customer_name || '').trim() !== filterCustomer) return false;
      if (filterProduct !== 'all' && e.product_id !== filterProduct) return false;
      if (search) {
        const q = search.toLowerCase();
        const targetDealer = e.dealer || (e.dealer_id ? dealerMap.get(e.dealer_id) : null);
        const matchId = e.id.toLowerCase().includes(q);
        const matchCust = e.customer_name?.toLowerCase().includes(q);
        const matchPhone = e.customer_phone?.toLowerCase().includes(q);
        const matchMsg = e.message?.toLowerCase().includes(q);
        const matchDealer = (e.dealer_name || targetDealer?.shop_name || '').toLowerCase().includes(q);
        const matchProd = (e.product_name || e.product?.name || '').toLowerCase().includes(q);
        if (!matchId && !matchCust && !matchPhone && !matchMsg && !matchDealer && !matchProd) return false;
      }
      return true;
    });
  }, [enquiries, filterStatus, filterDealer, filterCustomer, filterProduct, search, dealerMap]);

  const counts = useMemo(() => {
    const c = { all: enquiries.length, pending: 0, viewed: 0, responded: 0, resolved: 0, closed: 0 };
    for (const e of enquiries) {
      c[normalizeStatus(e.status)]++;
    }
    return c;
  }, [enquiries]);

  const openEnquiryModal = (e: Enquiry) => {
    setSelectedEnquiry(e);
    setAdminNotes(e.admin_notes || '');
  };

  const handleUpdateStatus = async (enq: Enquiry, newStatus: EnquiryStatus, notesOverride?: string) => {
    setSaving(true);
    try {
      const saved = await saveDbEnquiry({
        id: enq.id,
        actorRole: 'admin',
        status: newStatus,
        admin_notes: notesOverride !== undefined ? notesOverride.trim() || null : enq.admin_notes ?? null,
      });
      setEnquiries((prev) => prev.map((item) => (item.id === enq.id ? saved : item)));
      if (selectedEnquiry?.id === enq.id) {
        setSelectedEnquiry(saved);
      }
      setFeedback({ type: 'success', text: `Enquiry ${enq.id} updated to "${STATUS_BADGE[newStatus].label}".` });
      toast.success(`Enquiry marked as ${newStatus}`);
      if (onRefreshEnquiries) await onRefreshEnquiries();
    } catch (err: any) {
      const msg = err?.message || 'Failed to update enquiry';
      setFeedback({ type: 'error', text: msg });
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const openLeadsCount = counts.pending + counts.viewed;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <MessageSquareText className="h-7 w-7 text-primary" /> Customer Enquiries (Monitor)
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Track real Customer-to-Dealer product inquiries, showroom quotes &amp; resolution statuses across all showrooms
          </p>
        </div>

        {openLeadsCount > 0 && (
          <Badge variant="destructive" className="px-3 py-1 text-xs font-bold gap-1 self-start sm:self-auto">
            <Clock className="h-3.5 w-3.5" /> {openLeadsCount} Awaiting Reply
          </Badge>
        )}
      </div>

      {feedback && (
        <div
          className={`rounded-xl border px-3.5 py-2.5 text-xs font-semibold flex items-center justify-between gap-2 ${
            feedback.type === 'success'
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
          <Tabs value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
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
            placeholder="Search ID, customer, shop, product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Multi-Portal Filters: Dealer, Customer, Product */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <select
          aria-label="Filter enquiries by dealer"
          value={filterDealer}
          onChange={(e) => setFilterDealer(e.target.value)}
          className="h-9 rounded-xl border border-input bg-background px-3 text-xs text-foreground"
        >
          <option value="all">All Dealers ({dealers.length})</option>
          {dealers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.shop_name}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter enquiries by customer"
          value={filterCustomer}
          onChange={(e) => setFilterCustomer(e.target.value)}
          className="h-9 rounded-xl border border-input bg-background px-3 text-xs text-foreground"
        >
          <option value="all">All Customers ({uniqueCustomers.length})</option>
          {uniqueCustomers.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter enquiries by product"
          value={filterProduct}
          onChange={(e) => setFilterProduct(e.target.value)}
          className="h-9 rounded-xl border border-input bg-background px-3 text-xs text-foreground"
        >
          <option value="all">All Products ({uniqueEnquiryProducts.length})</option>
          {uniqueEnquiryProducts.map(([pid, pname]) => (
            <option key={pid} value={pid}>
              {pname}
            </option>
          ))}
        </select>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2.5">
        {filteredEnquiries.length === 0 ? (
          <Card className="p-8 text-center text-xs text-muted-foreground rounded-2xl">
            <MessageSquareText className="mx-auto h-7 w-7 opacity-40 mb-1.5" />
            No enquiries found.
          </Card>
        ) : (
          filteredEnquiries.map((e) => {
            const st = normalizeStatus(e.status);
            const targetDealer = e.dealer || (e.dealer_id ? dealerMap.get(e.dealer_id) : null);
            return (
              <Card key={e.id} className="p-4 border-border/80 rounded-2xl space-y-2 shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-foreground truncate">
                      {e.customer_name || 'Buyer'}
                    </p>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      {e.id} • {targetDealer?.shop_name || e.dealer_name || 'Showroom'}
                    </p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] font-bold shrink-0 ${STATUS_BADGE[st].className}`}>
                    {STATUS_BADGE[st].label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{e.message || 'Customer inquiry'}</p>
                <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/50">
                  <Button size="sm" variant="outline" onClick={() => openEnquiryModal(e)} className="h-7 px-2.5 text-[11px]">
                    <Eye className="h-3 w-3 mr-1" /> Inspect
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Desktop Table */}
      <Card className="hidden md:block border-border/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border/80 font-bold text-muted-foreground uppercase text-[11px]">
              <tr>
                <th className="px-4 py-3">Customer & Contact</th>
                <th className="px-4 py-3">Target Dealer / Product</th>
                <th className="px-4 py-3">Inquiry & Response</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredEnquiries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <MessageSquareText className="mx-auto h-8 w-8 opacity-40 mb-2" />
                    No enquiries found.
                  </td>
                </tr>
              ) : (
                filteredEnquiries.map((e) => {
                  const st = normalizeStatus(e.status);
                  const targetDealer = e.dealer || (e.dealer_id ? dealerMap.get(e.dealer_id) : null);
                  const targetProduct = e.product || (e.product_id ? productMap.get(e.product_id) : null);
                  return (
                    <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-foreground">{e.customer_name || 'Buyer'}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{e.id}</div>
                        {e.customer_phone && (
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3 text-emerald-500" /> {e.customer_phone}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-foreground flex items-center gap-1">
                          <Store className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="truncate max-w-[180px]">
                            {targetDealer?.shop_name || e.dealer_name || 'General Showroom'}
                          </span>
                        </div>
                        {(e.product_name || targetProduct?.name) && (
                          <div className="text-[11px] text-muted-foreground truncate max-w-[200px] mt-0.5">
                            Product: {e.product_name || targetProduct?.name}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <p className="text-xs text-foreground line-clamp-2 max-w-[260px]">
                          {e.message || 'Stock and price enquiry'}
                        </p>
                        {e.dealer_response && (
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 line-clamp-1 mt-0.5 font-medium">
                            Reply: {e.dealer_response}
                          </p>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {timeAgo(e.created_at)} • {e.channel}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <Badge variant="outline" className={`text-[10px] font-semibold ${STATUS_BADGE[st].className}`}>
                          {STATUS_BADGE[st].label}
                        </Badge>
                      </td>

                      <td className="px-4 py-3.5 text-right space-x-1 whitespace-nowrap">
                        <Button size="sm" variant="outline" onClick={() => openEnquiryModal(e)} className="h-8 px-2.5 text-[11px] font-semibold">
                          <Eye className="h-3.5 w-3.5 mr-1" /> Manage
                        </Button>
                        {st !== 'resolved' && st !== 'closed' && (
                          <Button
                            size="sm"
                            disabled={saving}
                            onClick={() => handleUpdateStatus(e, 'resolved')}
                            className="h-8 px-2.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <Check className="h-3.5 w-3.5 mr-1" /> Resolve
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Enquiry Inspection & Moderation Modal */}
      <Dialog open={!!selectedEnquiry} onOpenChange={(open) => !open && setSelectedEnquiry(null)}>
        {selectedEnquiry && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquareText className="h-5 w-5 text-primary" /> Enquiry Inspection
              </DialogTitle>
              <DialogDescription className="text-xs font-mono">
                {selectedEnquiry.id} • {timeAgo(selectedEnquiry.created_at)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="rounded-xl border border-border/80 p-3 bg-muted/20 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-semibold">Customer:</span>
                  <span className="font-bold text-foreground">{selectedEnquiry.customer_name || 'Buyer'}</span>
                </div>
                {selectedEnquiry.customer_email && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-semibold">Email:</span>
                    <span className="font-mono text-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {selectedEnquiry.customer_email}
                    </span>
                  </div>
                )}
                {selectedEnquiry.customer_phone && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-semibold">Phone:</span>
                    <span className="font-mono text-foreground font-bold">{selectedEnquiry.customer_phone}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-semibold">Showroom:</span>
                  <span className="font-bold text-foreground">
                    {(selectedEnquiry.dealer_id
                      ? dealerMap.get(selectedEnquiry.dealer_id)?.shop_name
                      : null) ||
                      selectedEnquiry.dealer_name ||
                      selectedEnquiry.dealer_id ||
                      'General Showroom'}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-border/80 p-3 space-y-1">
                <span className="font-bold text-foreground block">Customer Message</span>
                <p className="text-muted-foreground leading-relaxed">{selectedEnquiry.message}</p>
              </div>

              {selectedEnquiry.dealer_response && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1">
                  <span className="font-bold text-emerald-700 dark:text-emerald-300 block">Dealer Response</span>
                  <p className="text-foreground leading-relaxed">{selectedEnquiry.dealer_response}</p>
                </div>
              )}

              <div>
                <Label htmlFor="admin-enq-notes" className="text-xs font-bold">
                  Internal Admin Moderation Notes
                </Label>
                <Textarea
                  id="admin-enq-notes"
                  rows={2}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Optional internal audit note..."
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => handleUpdateStatus(selectedEnquiry, 'closed', adminNotes)}
                className="text-xs gap-1"
              >
                <XCircle className="h-3.5 w-3.5" /> Close
              </Button>
              <Button
                disabled={saving}
                onClick={() => handleUpdateStatus(selectedEnquiry, 'resolved', adminNotes)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1"
              >
                <Check className="h-3.5 w-3.5" /> Save & Mark Resolved
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
