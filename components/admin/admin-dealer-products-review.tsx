'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,DialogContent,DialogDescription,
  DialogFooter,
  DialogHeader,DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,SelectContent,SelectItem,SelectTrigger,SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { broadcastSync,getDbDealers,getDbProducts,saveDbProduct } from '@/lib/firebase-db';
import { formatINR,getDiscountPercent,getEffectivePrice } from '@/lib/format';
import type { Dealer,Product } from '@/lib/types';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  MapPin,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  XCircle
} from 'lucide-react';
import Image from 'next/image';
import { useCallback,useEffect,useMemo,useState } from 'react';
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
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Inspection modal
  const [inspectingProduct, setInspectingProduct] = useState<EnrichedProduct | null>(null);

  // Reject modal
  const [rejectingProduct, setRejectingProduct] = useState<EnrichedProduct | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allProds, allDealers] = await Promise.all([
        getDbProducts({ includeUnapproved: true }),
        getDbDealers(),
      ]);

      // Filter products that were submitted by dealers
      const dealerSubmitted = allProds.filter(
        (p) => p.dealer_id !== null && p.dealer_id !== undefined && p.dealer_id !== ''
      );

      setProducts(dealerSubmitted);
      setDealers(allDealers);
    } catch {
      toast.error('Failed to load dealer product submissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const handleSync = (e: any) => {
      if (!e.detail || e.detail.type === 'products') {
        loadData();
      }
    };
    window.addEventListener('dc-sync-event', handleSync);
    return () => window.removeEventListener('dc-sync-event', handleSync);
  }, [loadData]);

  // Map dealer info to product
  const enrichedProducts = useMemo(() => {
    const dealerMap = new Map<string, Dealer>(dealers.map((d) => [d.id, d]));
    return products.map((p) => ({
      ...p,
      submittingDealer: p.dealer_id ? dealerMap.get(p.dealer_id) : undefined,
    }));
  }, [products, dealers]);

  // Counts
  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const p of enrichedProducts) {
      const mod = p.moderation_status || 'pending';
      if (mod === 'pending') pending++;
      else if (mod === 'approved') approved++;
      else if (mod === 'rejected') rejected++;
    }
    return { total: enrichedProducts.length, pending, approved, rejected };
  }, [enrichedProducts]);

  // Filtered list
  const filtered = useMemo(() => {
    return enrichedProducts.filter((p) => {
      const mod = p.moderation_status || 'pending';
      if (filterStatus !== 'all' && mod !== filterStatus) return false;

      if (search) {
        const q = search.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchModel = p.model?.toLowerCase().includes(q) ?? false;
        const matchDealer = p.submittingDealer?.shop_name.toLowerCase().includes(q) ?? false;
        const matchCity = p.submittingDealer?.city.toLowerCase().includes(q) ?? false;
        if (!matchName && !matchModel && !matchDealer && !matchCity) return false;
      }

      return true;
    });
  }, [enrichedProducts, filterStatus, search]);

  // APPROVE ACTION
  const handleApprove = async (product: EnrichedProduct) => {
    try {
      const { submittingDealer, ...cleanProduct } = product;
      const updated: Product = {
        ...cleanProduct,
        moderation_status: 'approved',
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      await saveDbProduct(updated);
      broadcastSync('products', updated);

      toast.success(`"${product.name}" accepted and published live!`);
      if (inspectingProduct?.id === product.id) setInspectingProduct(null);
      loadData();
    } catch {
      toast.error('Failed to approve product');
    }
  };

  // REJECT ACTION
  const handleOpenReject = (product: EnrichedProduct) => {
    setRejectingProduct(product);
    setRejectReason(product.specifications?.['Rejection Reason'] || REJECTION_PRESETS[0]);
  };

  const handleConfirmReject = async () => {
    if (!rejectingProduct) return;
    try {
      const { submittingDealer, ...cleanRejecting } = rejectingProduct;
      const updated: Product = {
        ...cleanRejecting,
        moderation_status: 'rejected',
        is_active: false,
        specifications: {
          ...(rejectingProduct.specifications || {}),
          'Rejection Reason': rejectReason.trim() || 'Did not meet quality requirements',
        },
        updated_at: new Date().toISOString(),
      };

      await saveDbProduct(updated);
      broadcastSync('products', updated);

      toast.success(`"${rejectingProduct.name}" marked as rejected.`);
      setRejectingProduct(null);
      if (inspectingProduct?.id === rejectingProduct.id) setInspectingProduct(null);
      loadData();
    } catch {
      toast.error('Failed to reject product');
    }
  };

  return (
    <div className="space-y-5">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3.5 border-border/80 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase">Total Submissions</span>
            <p className="text-2xl font-black text-foreground mt-0.5">{counts.total}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-muted text-muted-foreground">
            <Package className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-3.5 border-amber-500/30 bg-amber-500/5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase flex items-center gap-1">
              <Clock className="h-3 w-3" /> Pending Review
            </span>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{counts.pending}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-3.5 border-emerald-500/30 bg-emerald-500/5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Approved & Live
            </span>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{counts.approved}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-3.5 border-rose-500/30 bg-rose-500/5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 uppercase flex items-center gap-1">
              <XCircle className="h-3 w-3" /> Rejected
            </span>
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5">{counts.rejected}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-600">
            <XCircle className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-44 h-9 text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All Submissions ({counts.total})
              </SelectItem>
              <SelectItem value="pending" className="text-xs">
                Pending Review ({counts.pending})
              </SelectItem>
              <SelectItem value="approved" className="text-xs">
                Approved ({counts.approved})
              </SelectItem>
              <SelectItem value="rejected" className="text-xs">
                Rejected ({counts.rejected})
              </SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            className="h-9 px-3 text-xs"
            title="Refresh submissions"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by product, dealer, city, model..."
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
                  <Badge variant={mod === 'approved' ? 'default' : mod === 'rejected' ? 'destructive' : 'secondary'} className="text-[10px] capitalize shrink-0">
                    {mod}
                  </Badge>
                </div>
                {mod === 'pending' && (
                  <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                    <Button size="sm" onClick={() => handleApprove(p)} className="flex-1 h-8 text-xs font-bold bg-emerald-600 text-white rounded-lg">
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setRejectingProduct(p)} className="flex-1 h-8 text-xs font-bold rounded-lg">
                      Reject
                    </Button>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Submissions Table Card (>= 768px) */}
      <Card className="hidden md:block border-border/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border/80 font-bold text-muted-foreground uppercase text-[11px]">
              <tr>
                <th className="px-4 py-3">Product Item</th>
                <th className="px-4 py-3">Submitting Dealer</th>
                <th className="px-4 py-3">Pricing & Stock</th>
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
                      {/* Product details */}
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
                            <div className="flex items-center gap-2 mt-1">
                              {p.model && (
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  Model: {p.model}
                                </span>
                              )}
                              {p.category?.name && (
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                                  {p.category.name}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Submitting Dealer Info */}
                      <td className="px-4 py-3.5">
                        {dealer ? (
                          <div className="space-y-0.5">
                            <div className="font-bold text-foreground flex items-center gap-1.5">
                              <Store className="h-3.5 w-3.5 text-primary shrink-0" />
                              {dealer.shop_name}
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <span>{dealer.owner_name}</span>
                              <span>•</span>
                              <span>{dealer.phone}</span>
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

                      {/* Pricing and Stock */}
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

                      {/* Moderation Status */}
                      <td className="px-4 py-3.5">
                        {mod === 'pending' && (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] gap-1 font-semibold">
                            <Clock className="h-3 w-3" /> Pending Review
                          </Badge>
                        )}
                        {mod === 'approved' && (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] gap-1 font-semibold">
                            <CheckCircle2 className="h-3 w-3" /> Approved & Active
                          </Badge>
                        )}
                        {mod === 'rejected' && (
                          <div className="space-y-1">
                            <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 text-[10px] gap-1 font-semibold">
                              <XCircle className="h-3 w-3" /> Rejected
                            </Badge>
                            {p.specifications?.['Rejection Reason'] && (
                              <p className="text-[10px] text-muted-foreground line-clamp-1 max-w-[180px]" title={p.specifications['Rejection Reason']}>
                                {p.specifications['Rejection Reason']}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-[11px]"
                            onClick={() => setInspectingProduct(p)}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" /> View Details
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

      {/* INSPECT DETAILS DIALOG */}
      <Dialog open={!!inspectingProduct} onOpenChange={(open) => !open && setInspectingProduct(null)}>
        {inspectingProduct && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" /> Dealer Product Submission Details
              </DialogTitle>
              <DialogDescription>
                Review submitted specifications, pricing, and dealer information before making a decision.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-3">
              {/* Product Header Card */}
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
                    {inspectingProduct.brand?.name && (
                      <Badge variant="outline">{inspectingProduct.brand.name}</Badge>
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
                    Available Stock: <strong className="text-foreground">{inspectingProduct.stock_qty} units</strong> ({inspectingProduct.stock_status})
                  </div>
                </div>
              </div>

              {/* Submitting Dealer Info */}
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
                      <span className="text-muted-foreground">Owner Name:</span>{' '}
                      <strong className="text-foreground">{inspectingProduct.submittingDealer.owner_name}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Phone Number:</span>{' '}
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

              {/* Description */}
              {inspectingProduct.description && (
                <div>
                  <h4 className="text-xs font-bold text-foreground mb-1 uppercase text-muted-foreground">
                    Product Description
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed p-3 rounded-lg bg-muted/30 border border-border">
                    {inspectingProduct.description}
                  </p>
                </div>
              )}

              {/* Specifications */}
              {inspectingProduct.specifications && Object.keys(inspectingProduct.specifications).length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-foreground mb-1 uppercase text-muted-foreground">
                    Specifications
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(inspectingProduct.specifications).map(([key, val]) => (
                      <div key={key} className="p-2 rounded border border-border bg-muted/10">
                        <span className="text-muted-foreground block text-[10px]">{key}</span>
                        <span className="font-semibold text-foreground">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setInspectingProduct(null)}>
                Close
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
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve & Publish
                </Button>
              )}
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
              <Button
                type="button"
                variant="destructive"
                className="font-bold"
                onClick={handleConfirmReject}
              >
                Confirm Rejection
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
