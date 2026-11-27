'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MapPin,
  MessageSquareText,
  Package,
  Phone,
  Send,
  Store,
  User,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { saveDbEnquiry } from '@/lib/firebase-db';
import { formatINR, getEffectivePrice } from '@/lib/format';
import type { Dealer, Enquiry, Product } from '@/lib/types';

type SendEnquiryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealer: Dealer | null;
  product?: Product | null;
  defaultMessage?: string;
};

export function SendEnquiryDialog({
  open,
  onOpenChange,
  dealer,
  product,
  defaultMessage,
}: SendEnquiryDialogProps) {
  const { customer } = useAuth();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedEnquiry, setSubmittedEnquiry] = useState<Enquiry | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    const openingFresh = !wasOpenRef.current;
    wasOpenRef.current = true;
    if (!openingFresh) return;

    setError(null);
    setSubmittedEnquiry(null);
    setCustomerName(customer?.full_name || '');
    setCustomerPhone(customer?.phone || '');
    setCustomerEmail(customer?.email || '');
    if (defaultMessage) {
      setMessage(defaultMessage);
    } else if (product) {
      setMessage(
        `Hi ${dealer?.shop_name || 'team'}, I am interested in "${product.name}". Could you confirm live stock availability and final showroom price?`
      );
    } else {
      setMessage(
        `Hi ${dealer?.shop_name || 'team'}, I would like to enquire about product availability and pricing at your store.`
      );
    }
  }, [open, customer, dealer, product, defaultMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealer) {
      setError('No target dealer selected.');
      return;
    }

    const cleanName = customerName.trim();
    const cleanPhone = customerPhone.trim();
    const digitsOnly = cleanPhone.replace(/\D/g, '');
    const cleanMessage = message.trim();

    if (cleanName.length < 2) {
      setError('Please enter your full name.');
      return;
    }
    if (digitsOnly.length < 7) {
      setError('Please enter a valid contact phone number.');
      return;
    }
    if (cleanMessage.length < 5) {
      setError('Please enter your enquiry message (at least 5 characters).');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const saved = await saveDbEnquiry({
        customer_id: customer?.id ?? null,
        customer_email: (customerEmail || customer?.email || '').trim().toLowerCase() || null,
        dealer_id: dealer.id,
        dealer_name: dealer.shop_name,
        product_id: product?.id ?? null,
        product_name: product?.name ?? null,
        customer_name: cleanName,
        customer_phone: cleanPhone,
        message: cleanMessage,
        channel: 'form',
        status: 'pending',
      });
      setSubmittedEnquiry(saved);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit enquiry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!dealer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg rounded-2xl p-4 sm:p-6 max-h-[90dvh] overflow-y-auto">
        {submittedEnquiry ? (
          <div className="space-y-4 py-2 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-foreground">Enquiry Sent Successfully!</h3>
              <p className="text-xs text-muted-foreground">
                Your enquiry has been delivered to{' '}
                <span className="font-bold text-foreground">{dealer.shop_name}</span> and recorded in the shared database.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-muted/40 p-3.5 text-left text-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Enquiry ID</span>
                <span className="font-mono font-bold text-foreground">{submittedEnquiry.id}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Status</span>
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] capitalize">
                  {submittedEnquiry.status || 'pending'}
                </Badge>
              </div>
              {product && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Product</span>
                  <span className="font-semibold text-foreground truncate max-w-[230px]">
                    {product.name}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Showroom</span>
                <span className="font-semibold text-foreground">{dealer.shop_name}</span>
              </div>
            </div>

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 h-10 rounded-xl font-semibold text-xs"
              >
                Continue Browsing
              </Button>
              <Button asChild className="flex-1 h-10 rounded-xl font-bold text-xs">
                <Link href={customer ? '/customer/enquiries' : '/customer/login?redirect=/customer/enquiries'}>
                  Track My Enquiries →
                </Link>
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-black">
                <MessageSquareText className="h-5 w-5 text-primary" /> Send Product Enquiry
              </DialogTitle>
              <DialogDescription className="text-xs">
                Ask directly about live showroom stock, counter price quotes, delivery, or pickup.
              </DialogDescription>
            </DialogHeader>

            {/* Target Showroom & Product Summary */}
            <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-foreground flex items-center gap-1.5">
                    <Store className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">{dealer.shop_name}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {dealer.city}, PIN {dealer.pin_code}
                    </span>
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  Direct Seller
                </Badge>
              </div>

              {product && (
                <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground flex items-center gap-1.5 truncate">
                    <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{product.name}</span>
                  </span>
                  <span className="font-black text-foreground shrink-0">
                    {formatINR(getEffectivePrice(product.price, product.discount_price))}
                  </span>
                </div>
              )}
            </div>

            {!customer && (
              <div className="rounded-xl border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground flex items-center justify-between gap-2">
                <span>Sign in as a Customer to track responses in your account.</span>
                <Link
                  href={`/customer/login?redirect=${encodeURIComponent(product ? `/product/${product.id}` : `/dealer/${dealer.id}`)}`}
                  className="font-bold text-primary hover:underline shrink-0"
                >
                  Sign In
                </Link>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="enq-name" className="text-xs font-bold">
                  Your Name *
                </Label>
                <div className="relative mt-1">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="enq-name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Full Name"
                    className="h-10 pl-9 text-xs sm:text-sm rounded-xl"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="enq-phone" className="text-xs font-bold">
                  Phone Number *
                </Label>
                <div className="relative mt-1">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="enq-phone"
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+91 98480 12345"
                    className="h-10 pl-9 text-xs sm:text-sm rounded-xl"
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="enq-message" className="text-xs font-bold">
                Enquiry Message *
              </Label>
              <Textarea
                id="enq-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Ask about availability, final showroom price, warranty, or doorstep delivery..."
                className="mt-1 text-xs sm:text-sm rounded-xl"
                required
              />
            </div>

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="h-10 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="h-10 rounded-xl font-bold text-xs sm:text-sm px-5 gap-1.5"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending Enquiry...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Submit Enquiry
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
