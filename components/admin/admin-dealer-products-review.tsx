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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiSync } from '@/lib/api-sync';
import {
  broadcastSync,
  getDbCategories,
  getDbDealers,
  getDbProducts,
  saveDbProduct,
} from '@/lib/firebase-db';
import { formatINR, getDiscountPercent, getEffectivePrice, timeAgo } from '@/lib/format';
import { useRealtimeSync } from '@/lib/realtime-client';
import type { Category, Dealer, ModerationLog, Product } from '@/lib/types';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  HelpCircle,
  History,
  Link2,
  MapPin,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  XCircle,
} from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

export type EnrichedProduct = Product & { submittingDealer?: Dealer };

const REJECTION_PRESETS = [
  'Incomplete product specifications or missing details',
  'Low quality or blurry product image',
  'Unrealistic or inaccurate pricing / discount',
  'Duplicate product already available in master catalog',
  'Restricted or non-compliant item for this category',
];

export function AdminDealerProductsReview() {
  const [products, setProducts] = useState<Product[]>([]);
  const [masterProducts, setMasterProducts] = useState<Product[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [logs, setLogs] = useState<ModerationLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDealer, setFilterDealer] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Inspection / Moderation Modals
  const [inspectingProduct, setInspectingProduct] = useState<EnrichedProduct | null>(null);
  const [linkMasterId, setLinkMasterId] = useState<string>('');
  const [rejectingProduct, setRejectingProduct] = useState<EnrichedProduct | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [infoProduct, setInfoProduct] = useState<EnrichedProduct | null>(null);
  const [infoRequestText, setInfoRequestText] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allProds, masterList, allDealers, allCategories, logsRes] = await Promise.all([
        getDbProducts({ includeUnapproved: true }),
        apiSync.fetchProducts({ masterOnly: true, includeUnapproved: true }).catch(() => []),
        apiSync.fetchDealers('admin').catch(() => getDbDealers()),
        getDbCategories(),
        fetch('/api/moderation-logs?entityType=product', { credentials: 'include', cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : { logs: [] }))
          .catch(() => ({ logs: [] })),
      ]);

      const dealerSubmitted = allProds.filter(
        (p) => p.dealer_id !== null && p.dealer_id !== undefined && p.dealer_id !== ''
      );

      setProducts(dealerSubmitted);
      setMasterProducts(masterList);
      setDealers(allDealers);
      setCategories(allCategories);
      setLogs((logsRes.moderationLogs || []).filter((l: ModerationLog) => l.entity_type === 'product'));
    } catch {
      toast.error('Failed to load dealer product submissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!detail || detail.type === 'products') {
        loadData();
      }
    };
    window.addEventListener('dc-sync-event', handleSync);
    return () => window.removeEventListener('dc-sync-event', handleSync);
  }, [loadData]);

  useRealtimeSync(['products', 'dealers', 'moderation_logs'], () => loadData());

  const enrichedProducts = useMemo(() => {
    const dealerMap = new Map<string, Dealer>(dealers.map((d) => [d.id, d]));
    return products.map((p) => ({
      ...p,
      submittingDealer: p.dealer_id ? dealerMap.get(p.dealer_id) : undefined,
    }));
  }, [products, dealers]);

  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let infoRequested = 0;
    for (const p of enrichedProducts) {
      const mod = p.moderation_status || 'pending';
      if (mod === 'pending') pending++;
      else if (mod === 'approved') approved++;
      else if (mod === 'rejected') rejected++;
      else if (mod === 'flagged') infoRequested++;
    }
    return { total: enrichedProducts.length, pending, approved, rejected, infoRequested };
  }, [enrichedProducts]);

  const filtered = useMemo(() => {
    return enrichedProducts.filter((p) => {
      const mod = p.moderation_status || 'pending';
      if (filterStatus !== 'all' && mod !== filterStatus) return false;
      if (filterDealer !== 'all' && p.dealer_id !== filterDealer) return false;
      if (filterCategory !== 'all' && p.category_id !== filterCategory) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchModel = p.model?.toLowerCase().includes(q) ?? false;
        const matchDealer = p.submittingDealer?.shop_name.toLowerCase().includes(q) ?? false;
        const matchBrand = (p.brand?.name || p.brand_name || '').toLowerCase().includes(q);
        const matchCity = p.submittingDealer?.city.toLowerCase().includes(q) ?? false;
        if (!matchName && !matchModel && !matchDealer && !matchBrand && !matchCity) return false;
      }

      return true;
    });
  }, [enrichedProducts, filterStatus, filterDealer, filterCategory, search]);

  const handleApprove = async (product: EnrichedProduct) => {
    try {
      const updated = await saveDbProduct(
        {
          id: product.id,
          action: 'approve',
        },
        { isUpdate: true }
      );
      broadcastSync('products', updated);
      toast.success(`"${product.name}" approved and published live to Customers!`);
      if (inspectingProduct?.id === product.id) setInspectingProduct(null);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve product');
    }
  };

  const handleOpenReject = (product: EnrichedProduct) => {
    setRejectingProduct(product);
    setRejectReason(product.rejection_reason || product.specifications?.['Rejection Reason'] || REJECTION_PRESETS[0]);
  };

  const handleConfirmReject = async () => {
    if (!rejectingProduct) return;
    try {
      const reason = rejectReason.trim() || 'Did not meet marketplace quality requirements';
      const updated = await saveDbProduct(
        {
          id: rejectingProduct.id,
          action: 'reject',
          reason,
          specifications: {
            ...(rejectingProduct.specifications || {}),
            'Rejection Reason': reason,
          },
        },
        { isUpdate: true }
      );
      broadcastSync('products', updated);
      toast.success(`"${rejectingProduct.name}" rejected and dealer notified.`);
      setRejectingProduct(null);
      if (inspectingProduct?.id === rejectingProduct.id) setInspectingProduct(null);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject product');
    }
  };

  const handleConfirmInfoRequest = async () => {
    if (!infoProduct) return;
    if (!infoRequestText.trim()) {
      toast.error('Please specify what information or updates are needed.');
      return;
    }
    try {
      const updated = await saveDbProduct(
        {
          id: infoProduct.id,
          action: 'request_info',
          reason: infoRequestText.trim(),
        },
        { isUpdate: true }
      );
      broadcastSync('products', updated);
      toast.success(`Information request sent to "${infoProduct.submittingDealer?.shop_name || 'Dealer'}".`);
      setInfoProduct(null);
      setInfoRequestText('');
      if (inspectingProduct?.id === infoProduct.id) setInspectingProduct(null);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to request information');
    }
  };

  const handleLinkToMaster = async () => {
    if (!inspectingProduct || !linkMasterId) return;
    try {
      const updated = await saveDbProduct(
        {
          id: inspectingProduct.id,
          action: 'link_master',
          master_product_id: linkMasterId,
        },
        { isUpdate: true }
      );
      broadcastSync('products', updated);
      toast.success(`Linked "${inspectingProduct.name}" to Master Catalog product.`);
      setInspectingProduct(null);
      setLinkMasterId('');
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to link product');
    }
  };

  return (
    <div className="space-y-5">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card className="p-3.5 border-border/80 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase">All Listings</span>
            <p className="text-2xl font-black text-foreground mt-0.5">{counts.total}</p>
          </div>
          <Package className="h-5 w-5 text-muted-foreground" />
        </Card>

        <Card className="p-3.5 border-amber-500/30 bg-amber-500/5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase flex items-center gap-1">
              <Clock className="h-3 w-3" /> Pending
            </span>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{counts.pending}</p>
          </div>
          <AlertTriangle className="h-5 w-5 text-amber-600" />
        </Card>

        <Card className="p-3.5 border-blue-500/30 bg-blue-500/5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase flex items-center gap-1">
              <HelpCircle className="h-3 w-3" /> Info Needed
            </span>
            <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5">{counts.infoRequested}</p>
          </div>
          <HelpCircle className="h-5 w-5 text-blue-600" />
        </Card>

        <Card className="p-3.5 border-emerald-500/30 bg-emerald-500/5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Approved
            </span>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{counts.approved}</p>
          </div>
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
        </Card>

        <Card className="p-3.5 border-rose-500/30 bg-rose-500/5 flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 uppercase flex items-center gap-1">
              <XCircle className="h-3 w-3" /> Rejected
            </span>
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5">{counts.rejected}</p>
          </div>
          <XCircle className="h-5 w-5 text-rose-600" />
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 h-9 text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All ({counts.total})</SelectItem>
              <SelectItem value="pending" className="text-xs">Pending ({counts.pending})</SelectItem>
              <SelectItem value="flagged" className="text-xs">Info Requested ({counts.infoRequested})</SelectItem>
              <SelectItem value="approved" className="text-xs">Approved ({counts.approved})</SelectItem>
              <SelectItem value="rejected" className="text-xs">Rejected ({counts.rejected})</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterDealer} onValueChange={setFilterDealer}>
            <SelectTrigger className="w-44 h-9 text-xs">
              <SelectValue placeholder="All Dealers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Dealers</SelectItem>
              {dealers.map((d) => (
                <SelectItem key={d.id} value={d.id} className="text-xs">
                  {d.shop_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-40 h-9 text-xs">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={loadData} className="h-9 px-3 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistoryModal(true)}
            className="h-9 px-3 text-xs"
          >
            <History className="h-3.5 w-3.5 mr-1" /> Approval History ({logs.length})
          </Button>
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search product, dealer, brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Mobile Submissions Cards (< 768px) */}
      <div className="md:hidden space-y-2.5">
        {filtered.length === 0 ? (
          <Card className="p-8 text-center text-xs text-muted-foreground rounded-2xl">
            <Package className="mx-auto h-7 w-7 opacity-40 mb-1.5" />
            No dealer product submissions found matching your filters.
          </Card>
        ) : (
          filtered.map((p) => {
            const effective = getEffectivePrice(p.price, p.discount_price);
            const mod = p.moderation_status || 'pending';
            return (
              <Card key={p.id} className="p-3.5 border-border/80 rounded-2xl space-y-2 shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-foreground truncate">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {p.submittingDealer?.shop_name || 'Dealer'} • {formatINR(effective)}
                    </p>
                  </div>
                  <Badge
                    variant={mod === 'approved' ? 'default' : mod === 'rejected' ? 'destructive' : 'secondary'}
                    className="text-[10px] capitalize shrink-0"
                  >
                    {mod === 'flagged' ? 'info needed' : mod}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setInspectingProduct(p);
                      setLinkMasterId(p.master_product_id || '');
                    }}
                    className="h-8 text-xs font-semibold rounded-lg"
                  >
                    Inspect
                  </Button>
                  {mod !== 'approved' && (
                    <Button
                      size="sm"
                      onClick={() => handleApprove(p)}
                      className="flex-1 h-8 text-xs font-bold bg-emerald-600 text-white rounded-lg"
                    >
                      Approve
                    </Button>
                  )}
                  {mod !== 'rejected' && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleOpenReject(p)}
                      className="flex-1 h-8 text-xs font-bold rounded-lg"
                    >
                      Reject
                    </Button>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Desktop Submissions Table (>= 768px) */}
      <Card className="hidden md:block border-border/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border/80 font-bold text-muted-foreground uppercase text-[11px]">
              <tr>
                <th className="px-4 py-3">Product Item</th>
                <th className="px-4 py-3">Submitting Dealer</th>
                <th className="px-4 py-3">Pricing &amp; Stock</th>
                <th className="px-4 py-3">Review Status</th>
                <th className="px-4 py-3 text-right">Moderation Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    <Package className="mx-auto h-8 w-8 opacity-40 mb-2" />
                    No dealer product submissions found matching your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const effective = getEffectivePrice(p.price, p.discount_price);
                  const discountPct = getDiscountPercent(p.price, p.discount_price);
                  const mod = p.moderation_status || 'pending';
                  const dealer = p.submittingDealer;

                  return (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3.5 max-w-xs">
                        <div className="flex items-start gap-3">
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted border border-border/60">
                            {p.images && p.images[0] ? (
                              <Image src={p.images[0]} alt={p.name} fill sizes="48px" className="object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                <Package className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-foreground text-xs sm:text-sm block leading-snug">
                              {p.name}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {(p.brand?.name || p.brand_name) && (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                                  {p.brand?.name || p.brand_name}
                                </Badge>
                              )}
                              {p.category?.name && (
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                                  {p.category.name}
                                </Badge>
                              )}
                              {p.master_product_id && (
                                <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] px-1.5 py-0 h-4">
                                  Catalogue Clone
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {dealer ? (
                          <div className="space-y-0.5">
                            <div className="font-bold text-foreground flex items-center gap-1.5">
                              <Store className="h-3.5 w-3.5 text-primary shrink-0" />
                              {dealer.shop_name}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {dealer.owner_name} • {dealer.phone}
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-2.5 w-2.5 shrink-0" />
                              {dealer.city}, {dealer.state}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">
                            Dealer ID: {p.dealer_id}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-bold text-foreground text-xs sm:text-sm">
                          {formatINR(effective)}
                        </div>
                        {p.discount_price && (
                          <div className="text-[10px] text-muted-foreground line-through">
                            MRP: {formatINR(p.price)} ({discountPct}% OFF)
                          </div>
                        )}
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          <span className="font-mono font-bold text-foreground">{p.stock_qty ?? 0}</span> units ({p.stock_status.replace(/_/g, ' ')})
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {mod === 'pending' && (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] gap-1 font-semibold">
                            <Clock className="h-3 w-3" /> Pending Review
                          </Badge>
                        )}
                        {mod === 'flagged' && (
                          <div className="space-y-1">
                            <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[10px] gap-1 font-semibold">
                              <HelpCircle className="h-3 w-3" /> Info Requested
                            </Badge>
                            {p.admin_info_request && (
                              <p className="text-[10px] text-muted-foreground line-clamp-1 max-w-[180px]">
                                {p.admin_info_request}
                              </p>
                            )}
                          </div>
                        )}
                        {mod === 'approved' && (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] gap-1 font-semibold">
                            <CheckCircle2 className="h-3 w-3" /> Approved &amp; Live
                          </Badge>
                        )}
                        {mod === 'rejected' && (
                          <div className="space-y-1">
                            <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 text-[10px] gap-1 font-semibold">
                              <XCircle className="h-3 w-3" /> Rejected
                            </Badge>
                            {(p.rejection_reason || p.specifications?.['Rejection Reason']) && (
                              <p className="text-[10px] text-muted-foreground line-clamp-1 max-w-[180px]">
                                {p.rejection_reason || p.specifications?.['Rejection Reason']}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-[11px]"
                            onClick={() => {
                              setInspectingProduct(p);
                              setLinkMasterId(p.master_product_id || '');
                            }}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" /> Details
                          </Button>

                          {mod !== 'approved' && (
                            <Button
                              size="sm"
                              className="h-8 px-2.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => handleApprove(p)}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                            </Button>
                          )}

                          {mod !== 'flagged' && mod !== 'approved' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 text-[11px]"
                              onClick={() => {
                                setInfoProduct(p);
                                setInfoRequestText(p.admin_info_request || '');
                              }}
                            >
                              <HelpCircle className="h-3.5 w-3.5 mr-1" /> Request Info
                            </Button>
                          )}

                          {mod !== 'rejected' && (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-8 px-2.5 text-[11px] font-bold"
                              onClick={() => handleOpenReject(p)}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* INSPECT DETAILS + LINK TO MASTER DIALOG */}
      <Dialog open={!!inspectingProduct} onOpenChange={(open) => !open && setInspectingProduct(null)}>
        {inspectingProduct && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" /> Dealer Product Submission Details
              </DialogTitle>
              <DialogDescription>
                Inspect submitted specifications, pricing, brand &amp; category match, or link to an existing Master Catalog item.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl border border-border bg-muted/20">
                <div className="relative h-36 w-36 shrink-0 rounded-xl overflow-hidden border border-border bg-muted mx-auto sm:mx-0">
                  {inspectingProduct.images && inspectingProduct.images[0] ? (
                    <Image src={inspectingProduct.images[0]} alt={inspectingProduct.name} fill className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <Package className="h-8 w-8" />
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-1.5">
                  <h3 className="font-bold text-base text-foreground">{inspectingProduct.name}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {inspectingProduct.model && (
                      <span className="font-mono text-muted-foreground">Model: {inspectingProduct.model}</span>
                    )}
                    {inspectingProduct.category?.name && (
                      <Badge variant="secondary">{inspectingProduct.category.name}</Badge>
                    )}
                    {(inspectingProduct.brand?.name || inspectingProduct.brand_name) && (
                      <Badge variant="outline">
                        {inspectingProduct.brand?.name || inspectingProduct.brand_name}
                      </Badge>
                    )}
                  </div>

                  <div className="pt-2 flex items-baseline gap-2">
                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                      {formatINR(getEffectivePrice(inspectingProduct.price, inspectingProduct.discount_price))}
                    </span>
                    {inspectingProduct.discount_price && (
                      <span className="text-xs text-muted-foreground line-through">
                        MRP: {formatINR(inspectingProduct.price)}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Stock: <strong className="text-foreground">{inspectingProduct.stock_qty} units</strong> ({inspectingProduct.stock_status})
                  </div>
                </div>
              </div>

              {/* Link to Existing Master Catalog */}
              <div className="p-3.5 rounded-xl border border-border bg-card space-y-2 text-xs">
                <Label className="font-bold flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 text-primary" /> Link to Master Catalog Item (Duplicate Prevention)
                </Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select value={linkMasterId} onValueChange={setLinkMasterId}>
                    <SelectTrigger className="flex-1 h-9 text-xs">
                      <SelectValue placeholder="Choose matching Master Catalog item..." />
                    </SelectTrigger>
                    <SelectContent>
                      {masterProducts.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="text-xs">
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!linkMasterId}
                    onClick={handleLinkToMaster}
                    className="h-9 text-xs font-semibold"
                  >
                    <Link2 className="h-3.5 w-3.5 mr-1" /> Link Master
                  </Button>
                </div>
              </div>

              {inspectingProduct.submittingDealer && (
                <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                  <span className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                    <Store className="h-4 w-4 text-primary" /> Submitting Dealership
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Shop Name:</span>{' '}
                      <strong className="text-foreground">{inspectingProduct.submittingDealer.shop_name}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Owner:</span>{' '}
                      <strong className="text-foreground">{inspectingProduct.submittingDealer.owner_name}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Phone:</span>{' '}
                      <strong className="text-foreground">{inspectingProduct.submittingDealer.phone}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Location:</span>{' '}
                      <strong className="text-foreground">
                        {inspectingProduct.submittingDealer.city}, {inspectingProduct.submittingDealer.state}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {inspectingProduct.description && (
                <div>
                  <h4 className="text-xs font-bold mb-1 uppercase text-muted-foreground">Product Description</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed p-3 rounded-lg bg-muted/30 border border-border">
                    {inspectingProduct.description}
                  </p>
                </div>
              )}

              {inspectingProduct.specifications && Object.keys(inspectingProduct.specifications).length > 0 && (
                <div>
                  <h4 className="text-xs font-bold mb-1 uppercase text-muted-foreground">Specifications</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(inspectingProduct.specifications).map(([key, val]) => (
                      <div key={key} className="p-2 rounded border border-border bg-muted/10">
                        <span className="text-muted-foreground block text-[10px]">{key}</span>
                        <span className="font-semibold text-foreground">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 flex-wrap">
              <Button type="button" variant="outline" onClick={() => setInspectingProduct(null)}>
                Close
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const p = inspectingProduct;
                  setInspectingProduct(null);
                  setInfoProduct(p);
                  setInfoRequestText(p.admin_info_request || '');
                }}
              >
                <HelpCircle className="mr-1.5 h-4 w-4" /> Request Info
              </Button>
              {inspectingProduct.moderation_status !== 'rejected' && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    const p = inspectingProduct;
                    setInspectingProduct(null);
                    handleOpenReject(p);
                  }}
                >
                  <XCircle className="mr-1.5 h-4 w-4" /> Reject Product
                </Button>
              )}
              {inspectingProduct.moderation_status !== 'approved' && (
                <Button
                  type="button"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  onClick={() => handleApprove(inspectingProduct)}
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve &amp; Publish
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* REQUEST ADDITIONAL INFO DIALOG */}
      <Dialog open={!!infoProduct} onOpenChange={(open) => !open && setInfoProduct(null)}>
        {infoProduct && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-blue-600" /> Request Additional Information
              </DialogTitle>
              <DialogDescription className="text-xs">
                Ask &quot;{infoProduct.submittingDealer?.shop_name || 'the dealer'}&quot; to clarify specs, images, or pricing for &quot;{infoProduct.name}&quot;.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <Label className="font-bold">Admin Request Message *</Label>
              <Textarea
                rows={4}
                value={infoRequestText}
                onChange={(e) => setInfoRequestText(e.target.value)}
                placeholder="e.g. Please attach a clear front photo and clarify official manufacturer warranty duration."
              />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setInfoProduct(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleConfirmInfoRequest} className="font-bold">
                Send Request to Dealer
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* REJECT CONFIRMATION DIALOG */}
      <Dialog open={!!rejectingProduct} onOpenChange={(open) => !open && setRejectingProduct(null)}>
        {rejectingProduct && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" /> Reject Product Submission
              </DialogTitle>
              <DialogDescription>
                Provide feedback to the dealer explaining why &quot;{rejectingProduct.name}&quot; cannot be published.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div>
                <Label className="text-xs font-bold mb-1.5 block">Select Preset Reason:</Label>
                <div className="space-y-1.5">
                  {REJECTION_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRejectReason(preset)}
                      className={`w-full text-left p-2 rounded border text-[11px] transition-colors ${
                        rejectReason === preset
                          ? 'border-primary bg-primary/10 font-bold text-foreground'
                          : 'border-border/70 hover:bg-muted/40 text-muted-foreground'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="customReason" className="text-xs font-bold mb-1.5 block">
                  Custom Rejection Note:
                </Label>
                <Textarea
                  id="customReason"
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explain what needs adjustment before this product can be approved..."
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setRejectingProduct(null)}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" className="font-bold" onClick={handleConfirmReject}>
                Confirm Rejection
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* APPROVAL AUDIT HISTORY MODAL */}
      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Product Moderation History
            </DialogTitle>
            <DialogDescription className="text-xs">
              Audit trail of product submissions, approvals, rejections, and master catalog links.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 text-xs">
            {logs.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No moderation history entries yet.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="p-3 rounded-xl border border-border bg-card space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-foreground">{log.entity_name || log.entity_id}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {log.action.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  {log.reason && <p className="text-muted-foreground">Note: {log.reason}</p>}
                  <p className="text-[10px] text-muted-foreground">
                    By {log.performed_by} • {timeAgo(log.created_at)}
                  </p>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setShowHistoryModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
