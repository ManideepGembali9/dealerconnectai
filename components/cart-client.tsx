'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import { saveDbEnquiry } from '@/lib/firebase-db';
import { formatINR } from '@/lib/format';
import { useApp } from '@/lib/providers';
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Store,
  Trash2
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export function CartClient() {
  const { customer } = useAuth();
  const { cart, removeFromCart, updateCartQuantity, clearCart, cartTotal, t } = useApp();
  const [promoCode, setPromoCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState(false);
  const [promoFeedback, setPromoFeedback] = useState<string | null>(null);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [placing, setPlacing] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [placedEnquiryIds, setPlacedEnquiryIds] = useState<string[]>([]);
  const [orderPlaced, setOrderPlaced] = useState(false);

  useEffect(() => {
    if (customer) {
      setBuyerName((prev) => prev || customer.full_name || '');
      setBuyerPhone((prev) => prev || customer.phone || '');
    }
  }, [customer]);

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
    const cleanName = buyerName.trim() || customer?.full_name || 'Customer';
    const cleanPhone = buyerPhone.trim() || customer?.phone || '';
    if (cleanPhone.replace(/\D/g, '').length < 7) {
      setCheckoutError('Please enter a valid contact phone number so local dealers can confirm your order.');
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
        const summaryLines = items
          .map((it) => `${it.quantity}x ${it.product.name}`)
          .join(', ');
        const saved = await saveDbEnquiry({
          customer_id: customer?.id ?? null,
          customer_email: customer?.email ?? null,
          dealer_id: dealerId,
          dealer_name: primaryItem.product.dealer?.shop_name || 'Local Showroom',
          product_id: primaryItem.product.id,
          product_name: primaryItem.product.name,
          customer_name: cleanName,
          customer_phone: cleanPhone,
          message: `Cart Order Enquiry (${items.length} item${items.length > 1 ? 's' : ''}): ${summaryLines}. Estimated total ${formatINR(finalTotal)}.`,
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

  if (orderPlaced) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center animate-in fade-in text-foreground">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted text-foreground mb-4 border border-border">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Order Enquiry Sent Successfully!</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          The local dealers have received your order request and can now respond inside your Enquiry Tracker.
        </p>
        {placedEnquiryIds.length > 0 && (
          <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs">
            <span className="text-muted-foreground font-semibold">Enquiry Reference:</span>
            {placedEnquiryIds.map((id) => (
              <span key={id} className="font-mono font-bold text-foreground">{id}</span>
            ))}
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90">
            <Link href={customer ? '/customer/enquiries' : '/customer/login?redirect=/customer/enquiries'}>Track My Enquiries →</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-xl border-border text-foreground hover:bg-muted">
            <Link href="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center animate-in fade-in text-foreground">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4 border border-border">
          <ShoppingCart className="h-10 w-10 text-foreground" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Your Cart is Empty</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Explore products from local verified stores, compare prices, and add items to your cart.
        </p>
        <div className="mt-6">
          <Button asChild size="lg" className="rounded-xl px-8 shadow-sm bg-primary text-primary-foreground hover:bg-primary/90">
            <Link href="/search">
              Browse Products <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 text-foreground transition-colors">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">{t('myCart')}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {cart.length} unique item{cart.length > 1 ? 's' : ''} from local stores
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearCart}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {t('clearAll')}
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Cart Item List */}
        <div className="lg:col-span-8 space-y-4">
          {cart.map((item) => {
            const p = item.product;
            const price = p.discount_price && p.discount_price > 0 ? p.discount_price : p.price;
            const img = p.images[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800';

            return (
              <Card key={p.id} className="overflow-hidden rounded-2xl border border-border bg-card p-4 transition-all">
                <div className="flex gap-4">
                  <Link href={`/product/${p.id}`} className="relative h-24 w-24 sm:h-28 sm:w-28 shrink-0 overflow-hidden rounded-xl bg-muted border border-border">
                    <Image src={img} alt={p.name} fill className="object-cover" />
                  </Link>

                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/product/${p.id}`} className="text-sm sm:text-base font-semibold text-foreground hover:underline transition-colors line-clamp-1">
                          {p.name}
                        </Link>
                        <button
                          onClick={() => removeFromCart(p.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors p-1"
                          title="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {p.dealer && (
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Store className="h-3.5 w-3.5 text-foreground" />
                          <span>{p.dealer.shop_name}</span>
                          <span>({p.dealer.city})</span>
                        </p>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base sm:text-lg font-bold text-foreground">{formatINR(price * item.quantity)}</span>
                        {item.quantity > 1 && (
                          <span className="text-xs text-muted-foreground">({formatINR(price)} each)</span>
                        )}
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1">
                        <button
                          onClick={() => updateCartQuantity(p.id, item.quantity - 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-card text-foreground transition-colors"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-xs font-bold text-foreground">{item.quantity}</span>
                        <button
                          onClick={() => updateCartQuantity(p.id, item.quantity + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-card text-foreground transition-colors"
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
          <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold tracking-tight text-foreground">Order Summary</h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-medium text-foreground">{formatINR(cartTotal)}</span>
              </div>
              {discountApplied && (
                <div className="flex justify-between text-foreground font-bold">
                  <span>Promo Discount (10%)</span>
                  <span>-{formatINR(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>Store Pickup</span>
                <span className="font-bold text-foreground">FREE</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between text-base font-bold text-foreground">
                <span>Estimated Total</span>
                <span className="text-xl font-black text-foreground">{formatINR(finalTotal)}</span>
              </div>
            </div>

            {/* Promo Code Input */}
            <div className="pt-2 space-y-1.5">
              <div className="flex gap-2">
                <Input
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="Promo Code (LOCAL10)"
                  className="h-9 text-xs uppercase border-border bg-muted/30 text-foreground"
                />
                <Button onClick={applyPromo} size="sm" variant="outline" className="h-9 text-xs border-border font-bold text-foreground hover:bg-muted">
                  Apply
                </Button>
              </div>
              {promoFeedback && (
                <p className="text-[11px] font-medium text-muted-foreground">{promoFeedback}</p>
              )}
            </div>

            {/* Buyer Contact Details */}
            <div className="pt-2 space-y-2 border-t border-border/60">
              <p className="text-xs font-bold text-foreground">Contact Details for Dealers</p>
              <Input
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Your Full Name *"
                className="h-9 text-xs border-border bg-muted/30"
              />
              <Input
                type="tel"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                placeholder="Mobile Number *"
                className="h-9 text-xs border-border bg-muted/30"
              />
              {checkoutError && (
                <p className="text-[11px] font-semibold text-destructive">{checkoutError}</p>
              )}
            </div>

            {/* Checkout Action */}
            <div className="pt-2 space-y-2">
              <Button onClick={handlePlaceOrder} disabled={placing} size="lg" className="w-full rounded-xl font-black shadow-sm bg-primary text-primary-foreground hover:bg-primary/90">
                {placing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending Enquiry...</> : 'Inquire & Buy from Dealers'}
              </Button>
              <p className="text-[11px] text-center text-muted-foreground">
                No upfront payment required. Dealers confirm live inventory & coordinate directly.
              </p>
            </div>

            <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground space-y-1.5 border border-border">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <ShieldCheck className="h-4 w-4 text-foreground" /> Verified Local Guarantees
              </div>
              <p>• Official GST store billing with manufacturer warranty</p>
              <p>• Same-day local store pickup or fast home delivery</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
