'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs,TabsList,TabsTrigger } from '@/components/ui/tabs';
import { timeAgo } from '@/lib/format';
import type { Dealer,Enquiry,Product } from '@/lib/types';
import {
  Check,
  MessageCircle,
  MessageSquareText,
  Package,
  Phone,
  Search
} from 'lucide-react';
import { useMemo,useState } from 'react';
import { toast } from 'sonner';

type ExtendedEnquiry = Enquiry & {
  status?: 'new' | 'contacted' | 'resolved';
  product_name?: string;
};

type Module08Props = {
  dealer: Dealer;
  enquiries: Enquiry[];
  products: Product[];
};

export function Module08DealerEnquiries({
  dealer,
  enquiries: initialEnquiries,
  products,
}: Module08Props) {
  const [enquiries, setEnquiries] = useState<ExtendedEnquiry[]>(() => {
    return initialEnquiries.map((e, idx) => ({
      ...e,
      status: (e as any).status || (idx === 0 ? 'new' : 'contacted'),
    }));
  });
  const [filter, setFilter] = useState<'all' | 'new' | 'contacted' | 'resolved'>('all');
  const [search, setSearch] = useState('');
  const [selectedEnquiry, setSelectedEnquiry] = useState<ExtendedEnquiry | null>(null);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const filtered = useMemo(() => {
    return enquiries.filter((e) => {
      if (filter !== 'all' && e.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchCust = e.customer_name?.toLowerCase().includes(q);
        const matchPhone = e.customer_phone?.toLowerCase().includes(q);
        const matchMsg = e.message?.toLowerCase().includes(q);
        if (!matchCust && !matchPhone && !matchMsg) return false;
      }
      return true;
    });
  }, [enquiries, filter, search]);

  const handleUpdateStatus = (id: string, newStatus: 'new' | 'contacted' | 'resolved') => {
    setEnquiries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: newStatus } : e))
    );
    if (selectedEnquiry?.id === id) {
      setSelectedEnquiry((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
    toast.success(`Enquiry marked as "${newStatus}"`);
  };

  const handleOpenWhatsApp = (phone: string, customerName: string, productTitle?: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const text = encodeURIComponent(
      `Hello ${customerName}, thank you for contacting ${dealer.shop_name} regarding ${
        productTitle || 'your product enquiry'
      }. We are pleased to confirm that this item is available for immediate showroom pickup/delivery.`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <MessageSquareText className="h-7 w-7 text-emerald-600" /> Customer Enquiries & Leads
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Respond to local buyers asking for live price quotes, warranty confirmation & store pickup details
          </p>
        </div>
      </div>

      {/* Tabs and Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={filter} onValueChange={(v: any) => setFilter(v)}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs font-semibold">
              All ({enquiries.length})
            </TabsTrigger>
            <TabsTrigger value="new" className="text-xs font-semibold">
              New ({enquiries.filter((e) => e.status === 'new').length})
            </TabsTrigger>
            <TabsTrigger value="contacted" className="text-xs font-semibold">
              Contacted ({enquiries.filter((e) => e.status === 'contacted').length})
            </TabsTrigger>
            <TabsTrigger value="resolved" className="text-xs font-semibold">
              Resolved ({enquiries.filter((e) => e.status === 'resolved').length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search customer or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Enquiries Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filtered.length === 0 ? (
          <div className="col-span-2 py-16 text-center text-muted-foreground">
            <MessageSquareText className="mx-auto h-8 w-8 opacity-40 mb-2" />
            No enquiries match the selected filter.
          </div>
        ) : (
          filtered.map((e) => {
            const product = e.product_id ? productMap.get(e.product_id) : null;
            return (
              <Card
                key={e.id}
                className="p-5 border-border/80 flex flex-col justify-between shadow-sm transition-all hover:border-emerald-500/50"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-foreground text-sm block">
                        {e.customer_name || 'Interested Customer'}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {e.customer_phone || 'No phone'} • {timeAgo(e.created_at)}
                      </span>
                    </div>
                    <Badge
                      variant={
                        e.status === 'new'
                          ? 'destructive'
                          : e.status === 'contacted'
                          ? 'secondary'
                          : 'default'
                      }
                      className="text-[10px] capitalize font-bold"
                    >
                      {e.status}
                    </Badge>
                  </div>

                  {product && (
                    <div className="mt-3 p-2.5 rounded-lg bg-muted/40 border border-border/50 text-xs flex items-center gap-2">
                      <Package className="h-4 w-4 text-emerald-600 shrink-0" />
                      <div className="truncate">
                        <span className="font-semibold text-foreground truncate block">
                          {product.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {product.category?.name || 'Category'}
                        </span>
                      </div>
                    </div>
                  )}

                  <p className="mt-3 text-xs text-foreground bg-muted/20 p-3 rounded-xl border border-border/40 leading-relaxed italic">
                    &quot;{e.message || 'Customer requested live availability and counter price.'}&quot;
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border/50 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {e.customer_phone && (
                      <>
                        <Button
                          size="sm"
                          onClick={() =>
                            handleOpenWhatsApp(
                              e.customer_phone!,
                              e.customer_name || 'Customer',
                              product?.name
                            )
                          }
                          className="h-8 px-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                          className="h-8 px-2.5 text-xs font-semibold gap-1"
                        >
                          <a href={`tel:${e.customer_phone}`}>
                            <Phone className="h-3.5 w-3.5 text-emerald-600" /> Call
                          </a>
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {e.status !== 'contacted' && e.status !== 'resolved' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUpdateStatus(e.id, 'contacted')}
                        className="h-8 px-2 text-xs font-semibold"
                      >
                        Mark Contacted
                      </Button>
                    )}
                    {e.status !== 'resolved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(e.id, 'resolved')}
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
    </div>
  );
}
