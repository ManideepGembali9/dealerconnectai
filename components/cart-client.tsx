'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import { fetchProducts } from '@/lib/data';
import { saveDbEnquiry } from '@/lib/firebase-db';
import { formatINR } from '@/lib/format';
import { useApp } from '@/lib/providers';
import { useRealtimeSync } from '@/lib/realtime-client';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Store,
  Trash2,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

export function CartClient() {
  const router = useRouter();
  const { customer } = useAuth();
  const {
    cart,
    removeFromCart,
    updateCartQuantity,
    syncCartProducts,
    clearCart,
    cartTotal,
    t,
  } = useApp();

  const [promoCode, setPromoCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState(false);
  const [promoFeedback, setPromoFeedback] = useState<string | null>(null);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [placing, setPlacing] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [placedEnquiryIds, setPlacedEnquiryIds] = useState<string[]>([]);
  const [orderPlaced, setOrderPlaced] = useState(false);

  const refreshLiveStock = useCallback(async () => {
    if (cart.length === 0) return;
    try {
      const live = await fetchProducts({ limit: 500 });
      if (live && live.length > 0) {
        syncCartProducts(live);
      }
    } catch {
      // Keep cached cart snapshot if offline
    }
  }, [cart.length, syncCartProducts]);

  useRealtimeSync(['products', 'dealers'], refreshLiveStock, {
    enabled: cart.length > 0,
    onReconnect: refreshLiveStock,
  });

  useEffect(() => {
    refreshLiveStock();
  }, [refreshLiveStock]);

  useEffect(() => {
    if (customer) {
      setBuyerName((prev) => prev || customer.full_name || '');
      setBuyerPhone((prev) => prev || customer.phone || '');
    }
  }, [customer]);

  const outOfStockItems = useMemo(
    () =>
      cart.filter(
        (item) =>
          item.product.stock_status === 'out_of_stock' ||
          (typeof item.product.stock_qty === 'number' && item.product.stock_qty <= 0)
      ),
    [cart]
  );

  const applyPromo = () => {
    const code = promoCode.trim().toUpperCase();
    if (code === 'LOCAL10' || code === 'FESTIVE') {
      setDiscountApplied(true);
      setPromoFeedback('Promo code applied! 10% discount included.');
      toast.success('Promo code applied! 10% discount added.');
    } else {
      setDiscountApplied(false);
      setPromoFeedback('Invalid promo code. Try "LOCAL10" or "FESTIVE".');
      toast.error('Invalid promo code. Try "LOCAL10" or "FESTIVE"');
    }
  };

  const discountAmount = discountApplied ? Math.round(cartTotal * 0.1) : 0;
  const finalTotal = cartTotal - discountAmount;

  const handlePlaceOrder = async () => {
    setCheckoutError(null);
    if (outOfStockItems.length > 0) {
      setCheckoutError('Remove out-of-stock items before sending an enquiry to dealers.');
      toast.error('Please remove out-of-stock items from your cart');
      return;
    }
    const cleanName = buyerName.trim() || customer?.full_name || 'Customer';
    const cleanPhone = buyerPhone.trim() || customer?.phone || '';
    if (cleanPhone.replace(/\D/g, '').length < 7) {
      setCheckoutError(
        'Please enter a valid contact phone number so local dealers can confirm your order.'
      );
      return;
    }

    setPlacing(true);
    try {
      const byDealer = new Map<string, typeof cart>();
      for (const item of cart) {
        const dId = item.product.dealer_id || item.product.dealer?.id || 'dealer-1';
        const arr = byDealer.get(dId) || [];
        arr.push(item);
        byDealer.set(dId, arr);
      }

      const ids: string[] = [];
      for (const [dealerId, items] of byDealer.entries()) {
        const primaryItem = items[0];
        const dealerSubtotal = items.reduce((sum, it) => {
          const p =
            it.product.discount_price && it.product.discount_price > 0
              ? it.product.discount_price
              : it.product.price;
          return sum + p * it.quantity;
        }, 0);
        const dealerTotal = discountApplied ? Math.round(dealerSubtotal * 0.9) : dealerSubtotal;
        const summaryLines = items.map((it) => `${it.quantity}x ${it.product.name}`).join(', ');
        const saved = await saveDbEnquiry({
          customer_id: customer?.id ?? null,
          customer_email: customer?.email ?? null,
          dealer_id: dealerId,
          dealer_name: primaryItem.product.dealer?.shop_name || 'Local Showroom',
          product_id: primaryItem.product.id,
          product_name: primaryItem.product.name,
          customer_name: cleanName,
          customer_phone: cleanPhone,
          message: `Cart Order Enquiry (${items.length} item${items.length > 1 ? 's' : ''}): ${summaryLines}. Estimated total ${formatINR(dealerTotal)}.`,
          channel: 'form',
          status: 'pending',
        });
        ids.push(saved.id);
      }

      setPlacedEnquiryIds(ids);
      setOrderPlaced(true);
      clearCart();
      toast.success('Your enquiry and order request has been sent to the local dealers!');
    } catch {
      setCheckoutError('Failed to send order enquiry. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-background text-foreground">
      {/* Minimal Page-Specific Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Go back"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-lg font-extrabold tracking-tight text-foreground">
              {t('myCart') || 'My Cart'}
            </h1>
            {!orderPlaced && cart.length > 0 && (
              <Badge variant="secondary" className="text-xs font-bold">
                {cart.length}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!orderPlaced && cart.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCart}
                className="text-xs font-semibold text-muted-foreground hover:text-destructive"
              >
                {t('clearAll') || 'Clear All'}
              </Button>
            )}
            <Link
              href="/"
              className="hidden md:inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              Home
            </Link>
          </div>
        </div>
      </header>

      {/* Order Confirmation State */}
      {orderPlaced ? (
        <div className="mx-auto max-w-2xl px-4 py-16 text-center animate-in fade-in text-foreground">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-border bg-muted text-foreground">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Order Enquiry Sent Successfully!
          </h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            The local dealers have received your order request and can now respond inside your
            Enquiry Tracker.
          </p>
          {placedEnquiryIds.length > 0 && (
            <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs">
              <span className="font-semibold text-muted-foreground">Enquiry Reference:</span>
              {placedEnquiryIds.map((id) => (
                <span key={id} className="font-mono font-bold text-foreground">
                  {id}
                </span>
              ))}
            </div>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Link
                href={customer ? '/customer/enquiries' : '/customer/login?redirect=/customer/enquiries'}
              >
                Track My Enquiries &rarr;
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-xl border-border text-foreground hover:bg-muted"
            >
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        </div>
      ) : cart.length === 0 ? (
        /* Empty Cart State */
        <div className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-md flex-col items-center justify-center px-6 py-12 text-center animate-in fade-in">
          <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-[#FF7E5F]/15 to-[#FF3F6C]/15 border border-[#FF3F6C]/20 shadow-sm">
            <ShoppingCart className="h-14 w-14 text-[#FF3F6C]" strokeWidth={1.75} />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Your Cart is Empty
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Add a product to your shopping cart
          </p>
          <div className="mt-7 w-full max-w-xs">
            <Link
              href="/search"
              className="flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#FF7E5F] to-[#FF3F6C] px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-rose-500/20 hover:opacity-95 transition-all active:scale-[0.98]"
            >
              Shop Now
            </Link>
          </div>
        </div>
      ) : (
        /* Populated Cart View */
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
          {outOfStockItems.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs text-destructive">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  {outOfStockItems.length} item{outOfStockItems.length > 1 ? 's' : ''} in your
                  cart went out of stock.
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => outOfStockItems.forEach((it) => removeFromCart(it.product.id, it.selectedVariant))}
                className="h-7 border-destructive/40 text-xs font-bold text-destructive hover:bg-destructive/15"
              >
                Remove Out-of-Stock
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Cart Item List */}
            <div className="space-y-3.5 lg:col-span-8">
              {cart.map((item) => {
                const p = item.product;
                const price = p.discount_price && p.discount_price > 0 ? p.discount_price : p.price;
                const img =
                  p.images?.[0] ||
                  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800';
                const isOut =
                  p.stock_status === 'out_of_stock' ||
                  (typeof p.stock_qty === 'number' && p.stock_qty <= 0);
                const maxStock = typeof p.stock_qty === 'number' && p.stock_qty > 0 ? p.stock_qty : 99;

                return (
                  <Card
                    key={`${p.id}-${item.selectedVariant || 'default'}`}
                    className="overflow-hidden rounded-2xl border border-border bg-card p-3.5 sm:p-4 transition-all"
                  >
                    <div className="flex gap-3.5 sm:gap-4">
                      <Link
                        href={`/product/${p.id}`}
                        className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-border bg-muted sm:h-28 sm:w-28"
                      >
                        <Image src={img} alt={p.name} fill unoptimized className="object-cover" />
                      </Link>

                      <div className="flex flex-1 flex-col justify-between min-w-0">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              href={`/product/${p.id}`}
                              className="line-clamp-2 text-sm sm:text-base font-semibold text-foreground hover:underline"
                            >
                              {p.name}
                            </Link>
                            <button
                              type="button"
                              onClick={() => removeFromCart(p.id, item.selectedVariant)}
                              className="shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors"
                              aria-label={`Remove ${p.name}`}
                              title="Remove item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            {p.dealer && (
                              <Link
                                href={`/dealer/${p.dealer.id}`}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                              >
                                <Store className="h-3.5 w-3.5 text-primary shrink-0" />
                                <span className="truncate">{p.dealer.shop_name}</span>
                                {p.dealer.city && <span>({p.dealer.city})</span>}
                              </Link>
                            )}
                            {isOut ? (
                              <Badge variant="destructive" className="text-[10px]">
                                Out of Stock
                              </Badge>
                            ) : p.stock_status === 'limited' ? (
                              <Badge
                                variant="secondary"
                                className="bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px]"
                              >
                                Only {maxStock} left
                              </Badge>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px]"
                              >
                                In Stock
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-baseline gap-1.5">
                            <span className="text-base sm:text-lg font-bold text-foreground">
                              {formatINR(price * item.quantity)}
                            </span>
                            {item.quantity > 1 && (
                              <span className="text-xs text-muted-foreground">
                                ({formatINR(price)} each)
                              </span>
                            )}
                          </div>

                          {/* Quantity Stepper */}
                          <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1">
                            <button
                              type="button"
                              onClick={() =>
                                updateCartQuantity(p.id, item.quantity - 1, item.selectedVariant)
                              }
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground hover:bg-card transition-colors"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span
                              data-testid={`cart-qty-${p.id}`}
                              className="w-8 text-center text-xs font-bold text-foreground"
                            >
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              disabled={isOut || item.quantity >= maxStock}
                              onClick={() =>
                                updateCartQuantity(p.id, item.quantity + 1, item.selectedVariant)
                              }
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground hover:bg-card disabled:opacity-40 transition-colors"
                              aria-label="Increase quantity"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Order Summary Side Card */}
            <div className="lg:col-span-4">
              <Card className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h2 className="text-base font-bold tracking-tight text-foreground">
                  Order Summary
                </h2>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="font-medium text-foreground">{formatINR(cartTotal)}</span>
                  </div>
                  {discountApplied && (
                    <div className="flex justify-between font-bold text-emerald-600 dark:text-emerald-400">
                      <span>Promo Discount (10%)</span>
                      <span>-{formatINR(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>Store Pickup</span>
                    <span className="font-bold text-foreground">FREE</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2.5 text-base font-bold text-foreground">
                    <span>Total</span>
                    <span data-testid="cart-total" className="text-xl font-black text-foreground">
                      {formatINR(finalTotal)}
                    </span>
                  </div>
                </div>

                {/* Promo Code Input */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex gap-2">
                    <Input
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder="Promo Code (LOCAL10)"
                      className="h-9 border-border bg-muted/30 text-xs uppercase text-foreground"
                    />
                    <Button
                      type="button"
                      onClick={applyPromo}
                      size="sm"
                      variant="outline"
                      className="h-9 border-border text-xs font-bold text-foreground hover:bg-muted"
                    >
                      Apply
                    </Button>
                  </div>
                  {promoFeedback && (
                    <p className="text-[11px] font-medium text-muted-foreground">{promoFeedback}</p>
                  )}
                </div>

                {/* Buyer Contact Details */}
                <div className="space-y-2 border-t border-border/60 pt-2">
                  <p className="text-xs font-bold text-foreground">Contact Details for Dealers</p>
                  <Input
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="Your Full Name *"
                    className="h-9 border-border bg-muted/30 text-xs"
                  />
                  <Input
                    type="tel"
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    placeholder="Mobile Number *"
                    className="h-9 border-border bg-muted/30 text-xs"
                  />
                  {checkoutError && (
                    <p className="text-[11px] font-semibold text-destructive">{checkoutError}</p>
                  )}
                </div>

                {/* Local Dealer Enquiry Action */}
                <div className="space-y-2 pt-1">
                  <Button
                    type="button"
                    onClick={handlePlaceOrder}
                    disabled={placing || outOfStockItems.length > 0}
                    size="lg"
                    className="w-full rounded-xl bg-primary font-black text-primary-foreground shadow-sm hover:bg-primary/90"
                  >
                    {placing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending Enquiry...
                      </>
                    ) : (
                      'Inquire & Buy from Dealers'
                    )}
                  </Button>
                  <p className="text-center text-[11px] text-muted-foreground">
                    No upfront payment required. Local dealers confirm live stock & coordinate
                    pickup or delivery directly.
                  </p>
                </div>

                <div className="space-y-1.5 rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" /> Verified Local Guarantees
                  </div>
                  <p>&bull; Official GST store billing with manufacturer warranty</p>
                  <p>&bull; Same-day local store pickup or fast home delivery</p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
