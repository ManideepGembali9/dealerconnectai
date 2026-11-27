'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,DialogContent,DialogDescription,
  DialogFooter,
  DialogHeader,DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs,TabsList,TabsTrigger } from '@/components/ui/tabs';
import { timeAgo } from '@/lib/format';
import type { Dealer,Enquiry,Product } from '@/lib/types';
import {
  Check,
  Clock,
  Eye,
  MessageSquareText,
  Phone,
  Search,
  Store
} from 'lucide-react';
import { useMemo,useState } from 'react';
import { toast } from 'sonner';

type ExtendedEnquiry = Enquiry & {
  status?: 'pending' | 'contacted' | 'completed';
  notes?: string;
  dealer_name?: string;
  product_name?: string;
};

type Module08Props = {
  enquiries: Enquiry[];
  dealers: Dealer[];
  products: Product[];
};

export function Module08Enquiries({ enquiries: initialEnquiries, dealers, products }: Module08Props) {
  const [enquiries, setEnquiries] = useState<ExtendedEnquiry[]>(() => {
    return initialEnquiries.map((e, idx) => ({
      ...e,
      status: (e as any).status || (idx % 2 === 0 ? 'pending' : 'completed'),
    }));
  });
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('all');
  const [search, setSearch] = useState('');
  const [selectedEnquiry, setSelectedEnquiry] = useState<ExtendedEnquiry | null>(null);

  // Sync with prop
  useMemo(() => {
    setEnquiries((prev) => {
      const statusMap = new Map(prev.map((e) => [e.id, e.status]));
      return initialEnquiries.map((e, idx) => ({
        ...e,
        status: statusMap.get(e.id) || (idx % 2 === 0 ? 'pending' : 'completed'),
      }));
    });
  }, [initialEnquiries]);

  const dealerMap = useMemo(() => new Map(dealers.map((d) => [d.id, d])), [dealers]);
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const filteredEnquiries = useMemo(() => {
    return enquiries.filter((e) => {
      if (filterStatus !== 'all' && e.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchCust = e.customer_name?.toLowerCase().includes(q);
        const matchPhone = e.customer_phone?.toLowerCase().includes(q);
        const matchMsg = e.message?.toLowerCase().includes(q);
        if (!matchCust && !matchPhone && !matchMsg) return false;
      }
      return true;
    });
  }, [enquiries, filterStatus, search]);

  const counts = useMemo(() => {
    return {
      all: enquiries.length,
      pending: enquiries.filter((e) => e.status === 'pending').length,
      completed: enquiries.filter((e) => e.status === 'completed').length,
    };
  }, [enquiries]);

  const handleUpdateStatus = (id: string, newStatus: 'pending' | 'contacted' | 'completed') => {
    setEnquiries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: newStatus } : e))
    );
    if (selectedEnquiry?.id === id) {
      setSelectedEnquiry((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
    toast.success(`Enquiry marked as ${newStatus}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <MessageSquareText className="h-7 w-7 text-primary" /> Enquiry & Lead Management
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Track customer price inquiries, showroom contact requests & dealer response pipelines
          </p>
        </div>

        {counts.pending > 0 && (
          <Badge variant="destructive" className="px-3 py-1 text-xs font-bold gap-1 self-start sm:self-auto">
            <Clock className="h-3.5 w-3.5" /> {counts.pending} Open Enquiries
          </Badge>
        )}
      </div>

      {/* Tabs and Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs font-semibold">
              All ({counts.all})
            </TabsTrigger>
            <TabsTrigger value="pending" className="text-xs font-semibold">
              Pending ({counts.pending})
            </TabsTrigger>
            <TabsTrigger value="completed" className="text-xs font-semibold">
              Completed ({counts.completed})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search customer, phone, message..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Mobile Enquiries Cards (< 768px) */}
      <div className="md:hidden space-y-2.5">
        {filteredEnquiries.length === 0 ? (
          <Card className="p-8 text-center text-xs text-muted-foreground rounded-2xl">
            <MessageSquareText className="mx-auto h-7 w-7 opacity-40 mb-1.5" />
            No enquiries found.
          </Card>
        ) : (
          filteredEnquiries.map((e) => {
            const targetDealer = e.dealer_id ? dealerMap.get(e.dealer_id) : null;
            return (
              <Card key={e.id} className="p-4 border-border/80 rounded-2xl space-y-2 shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-foreground truncate">{e.customer_name || 'Anonymous User'}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{targetDealer?.shop_name || 'Central Helpdesk'} • {e.customer_phone || 'No phone'}</p>
                  </div>
                  <Badge variant={e.status === 'completed' ? 'default' : 'secondary'} className="text-[10px] capitalize shrink-0">
                    {e.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{e.message || 'Customer requested live availability and quote.'}</p>
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <Button size="sm" variant="outline" onClick={() => setSelectedEnquiry(e)} className="h-8 px-2.5 text-[11px] font-semibold">
                    <Eye className="h-3.5 w-3.5 mr-1" /> View
                  </Button>
                  {e.status !== 'completed' ? (
                    <Button size="sm" onClick={() => handleUpdateStatus(e.id, 'completed')} className="h-8 px-2.5 text-[11px] font-bold bg-emerald-600 text-white">
                      <Check className="h-3.5 w-3.5 mr-1" /> Complete
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => handleUpdateStatus(e.id, 'pending')} className="h-8 px-2.5 text-[11px] text-muted-foreground">
                      Reopen
                    </Button>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Enquiries Table (>= 768px) */}
      <Card className="hidden md:block border-border/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border/80 font-bold text-muted-foreground uppercase text-[11px]">
              <tr>
                <th className="px-4 py-3">Customer Information</th>
                <th className="px-4 py-3">Target Dealer</th>
                <th className="px-4 py-3">Enquiry Content</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredEnquiries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <MessageSquareText className="mx-auto h-8 w-8 opacity-40 mb-2" />
                    No enquiries found.
                  </td>
                </tr>
              ) : (
                filteredEnquiries.map((e) => {
                  const targetDealer = e.dealer_id ? dealerMap.get(e.dealer_id) : null;
                  const targetProduct = e.product_id ? productMap.get(e.product_id) : null;
                  return (
                    <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-foreground text-xs sm:text-sm">
                          {e.customer_name || 'Anonymous User'}
                        </div>
                        {e.customer_phone && (
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3" /> {e.customer_phone}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground">
                          {timeAgo(e.created_at)}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-foreground flex items-center gap-1">
                          <Store className="h-3 w-3 text-primary shrink-0" />
                          {targetDealer?.shop_name || 'Central Helpdesk'}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {targetDealer?.city || 'Local Area'}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 max-w-xs">
                        {targetProduct && (
                          <Badge variant="outline" className="text-[10px] mb-1 font-semibold block truncate max-w-[200px]">
                            📦 {targetProduct.name}
                          </Badge>
                        )}
                        <p className="text-[11px] text-foreground line-clamp-2">
                          {e.message || 'Customer requested live availability and quote.'}
                        </p>
                      </td>

                      <td className="px-4 py-3.5">
                        <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                          {e.channel}
                        </Badge>
                      </td>

                      <td className="px-4 py-3.5">
                        <Badge
                          variant={e.status === 'completed' ? 'default' : 'secondary'}
                          className="text-[10px] capitalize font-semibold"
                        >
                          {e.status}
                        </Badge>
                      </td>

                      <td className="px-4 py-3.5 text-right space-x-1 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedEnquiry(e)}
                          className="h-8 px-2 text-[11px] font-semibold"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Button>

                        {e.status !== 'completed' ? (
                          <Button
                            size="sm"
                            onClick={() => handleUpdateStatus(e.id, 'completed')}
                            className="h-8 px-2.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <Check className="h-3.5 w-3.5 mr-1" /> Complete
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUpdateStatus(e.id, 'pending')}
                            className="h-8 px-2 text-[11px] text-muted-foreground"
                          >
                            Reopen
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

      {/* Enquiry Modal */}
      <Dialog open={!!selectedEnquiry} onOpenChange={(open) => !open && setSelectedEnquiry(null)}>
        {selectedEnquiry && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquareText className="h-5 w-5 text-primary" /> Enquiry Details
              </DialogTitle>
              <DialogDescription className="text-xs">
                Received {timeAgo(selectedEnquiry.created_at)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="rounded-xl border border-border/80 p-3 bg-muted/20 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-semibold">Customer:</span>
                  <span className="font-bold text-foreground">
                    {selectedEnquiry.customer_name || 'Anonymous User'}
                  </span>
                </div>
                {selectedEnquiry.customer_phone && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-semibold">Phone:</span>
                    <span className="font-mono text-foreground font-bold">
                      {selectedEnquiry.customer_phone}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-semibold">Inquiry Channel:</span>
                  <Badge variant="outline" className="uppercase font-bold text-[10px]">
                    {selectedEnquiry.channel}
                  </Badge>
                </div>
              </div>

              <div className="rounded-xl border border-border/80 p-3 space-y-1.5">
                <span className="font-bold text-foreground block">Customer Message / Note</span>
                <p className="text-muted-foreground leading-relaxed">
                  {selectedEnquiry.message || 'No additional note provided.'}
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2">
              {selectedEnquiry.status !== 'completed' ? (
                <Button
                  onClick={() => handleUpdateStatus(selectedEnquiry.id, 'completed')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  <Check className="h-4 w-4 mr-1" /> Mark Resolved
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => handleUpdateStatus(selectedEnquiry.id, 'pending')}
                >
                  Mark as Pending
                </Button>
              )}
              <Button variant="ghost" onClick={() => setSelectedEnquiry(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
