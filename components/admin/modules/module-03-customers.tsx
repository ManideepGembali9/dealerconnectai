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
import { timeAgo } from '@/lib/format';
import type { CustomerProfile } from '@/lib/types';
import {
  Eye,
  Mail,
  MapPin,
  Phone,
  Search,
  UserCheck,UserX,
  Users
} from 'lucide-react';
import { useEffect,useMemo,useState } from 'react';
import { toast } from 'sonner';

type Module03Props = {
  customerCount: number;
};

// Initial realistic customer baseline data for admin visibility
const FALLBACK_CUSTOMERS: Array<CustomerProfile & { status: 'active' | 'inactive' | 'suspended'; search_count: number; enquiry_count: number }> = [
  {
    id: 'cust-101',
    full_name: 'Aditya Varma',
    email: 'aditya.varma@gmail.com',
    phone: '+91 98480 22334',
    pin_code: '533201',
    preferred_city: 'Amalapuram',
    preferred_location: {},
    avatar_url: null,
    preferences: {},
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    status: 'active',
    search_count: 24,
    enquiry_count: 3,
  },
  {
    id: 'cust-102',
    full_name: 'Pooja Reddy',
    email: 'pooja.reddy@yahoo.com',
    phone: '+91 94401 88712',
    pin_code: '533001',
    preferred_city: 'Kakinada',
    preferred_location: {},
    avatar_url: null,
    preferences: {},
    created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    status: 'active',
    search_count: 42,
    enquiry_count: 5,
  },
  {
    id: 'cust-103',
    full_name: 'Ravi Kumar Raju',
    email: 'ravi.raju@outlook.com',
    phone: '+91 99890 33441',
    pin_code: '533255',
    preferred_city: 'Rajahmundry',
    preferred_location: {},
    avatar_url: null,
    preferences: {},
    created_at: new Date(Date.now() - 40 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    status: 'active',
    search_count: 18,
    enquiry_count: 2,
  },
  {
    id: 'cust-104',
    full_name: 'Lakshmi Prasanna',
    email: 'lakshmi.prasanna@gmail.com',
    phone: '+91 98665 11229',
    pin_code: '533201',
    preferred_city: 'Amalapuram',
    preferred_location: {},
    avatar_url: null,
    preferences: {},
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    status: 'inactive',
    search_count: 5,
    enquiry_count: 0,
  },
  {
    id: 'cust-105',
    full_name: 'K. Venkat Rao',
    email: 'k.venkat@live.in',
    phone: '+91 97012 44558',
    pin_code: '530016',
    preferred_city: 'Visakhapatnam',
    preferred_location: {},
    avatar_url: null,
    preferences: {},
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    status: 'active',
    search_count: 67,
    enquiry_count: 7,
  },
];

export function Module03Customers({ customerCount }: Module03Props) {
  const [customers, setCustomers] = useState(FALLBACK_CUSTOMERS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<(typeof FALLBACK_CUSTOMERS)[0] | null>(null);

  useEffect(() => {
    // If local customer profile is saved, merge it into the admin list
    try {
      const raw = localStorage.getItem('dc-auth-customer');
      if (raw) {
        const currentProfile = JSON.parse(raw);
        setCustomers((prev) => {
          if (prev.some((c) => c.email.toLowerCase() === currentProfile.email.toLowerCase())) {
            return prev;
          }
          return [
            {
              id: currentProfile.id || `cust-${Date.now()}`,
              full_name: currentProfile.full_name || 'Current User',
              email: currentProfile.email,
              phone: currentProfile.phone || 'N/A',
              pin_code: currentProfile.pin_code || '533201',
              preferred_city: currentProfile.preferred_city || 'Amalapuram',
              preferred_location: {},
              avatar_url: null,
              preferences: {},
              created_at: currentProfile.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
              status: 'active',
              search_count: 12,
              enquiry_count: 1,
            },
            ...prev,
          ];
        });
      }
    } catch {}
  }, []);

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchName = c.full_name.toLowerCase().includes(q);
        const matchEmail = c.email.toLowerCase().includes(q);
        const matchPhone = c.phone?.toLowerCase().includes(q);
        const matchPin = c.pin_code?.includes(q);
        const matchCity = c.preferred_city?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchPhone && !matchPin && !matchCity) return false;
      }
      return true;
    });
  }, [customers, statusFilter, search]);

  const toggleCustomerStatus = (id: string, newStatus: 'active' | 'inactive' | 'suspended') => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
    );
    if (selectedCustomer?.id === id) {
      setSelectedCustomer((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
    toast.success(`Customer status changed to "${newStatus}"`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" /> Customer Management
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Monitor registered buyer accounts, search engagement, and account access status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 font-bold text-xs">
            {customers.length} Accounts Monitored
          </Badge>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {(['all', 'active', 'inactive', 'suspended'] as const).map((st) => (
            <Button
              key={st}
              size="sm"
              variant={statusFilter === st ? 'default' : 'outline'}
              onClick={() => setStatusFilter(st)}
              className="h-8 text-xs font-semibold capitalize"
            >
              {st}
            </Button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, email, phone, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Customers Table Card */}
      <Card className="border-border/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border/80 font-bold text-muted-foreground uppercase text-[11px]">
              <tr>
                <th className="px-4 py-3">Customer Profile</th>
                <th className="px-4 py-3">Location & PIN</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Activity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Account Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <Users className="mx-auto h-8 w-8 opacity-40 mb-2" />
                    No customer accounts found.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                          {c.full_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-foreground text-xs sm:text-sm">
                            {c.full_name}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Member since {timeAgo(c.created_at)}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="text-xs font-semibold text-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-primary shrink-0" />
                        {c.preferred_city || 'Amalapuram'}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        PIN: {c.pin_code || '533201'}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="text-[11px] font-medium text-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3 text-muted-foreground" /> {c.email}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3 text-muted-foreground" /> {c.phone || 'No phone'}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="text-[11px] font-semibold text-foreground">
                        {c.search_count} Searches
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {c.enquiry_count} Inquiries sent
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <Badge
                        variant={
                          c.status === 'active'
                            ? 'default'
                            : c.status === 'inactive'
                            ? 'secondary'
                            : 'destructive'
                        }
                        className="text-[10px] capitalize font-semibold"
                      >
                        {c.status}
                      </Badge>
                    </td>

                    <td className="px-4 py-3.5 text-right space-x-1 whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedCustomer(c)}
                        className="h-8 px-2 text-[11px] font-semibold"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> View Details
                      </Button>

                      {c.status === 'active' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleCustomerStatus(c.id, 'suspended')}
                          className="h-8 px-2 text-[11px] text-destructive hover:bg-destructive/10"
                        >
                          <UserX className="h-3.5 w-3.5 mr-1" /> Suspend
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleCustomerStatus(c.id, 'active')}
                          className="h-8 px-2 text-[11px] text-emerald-600 font-semibold"
                        >
                          <UserCheck className="h-3.5 w-3.5 mr-1" /> Activate
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Customer Details Modal */}
      <Dialog open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
        {selectedCustomer && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> {selectedCustomer.full_name}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Customer ID: {selectedCustomer.id}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="rounded-xl border border-border/80 p-3 bg-muted/20 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-semibold">Account Status:</span>
                  <Badge variant={selectedCustomer.status === 'active' ? 'default' : 'destructive'} className="capitalize">
                    {selectedCustomer.status}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-semibold text-foreground">{selectedCustomer.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="font-semibold text-foreground">{selectedCustomer.phone || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Location:</span>
                  <span className="font-semibold text-foreground">
                    {selectedCustomer.preferred_city}, PIN: {selectedCustomer.pin_code}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-border/80 p-3 space-y-2">
                <div className="font-bold text-foreground">Buyer Activity Metrics</div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-card border border-border/50">
                    <span className="text-muted-foreground block text-[10px]">Product Searches</span>
                    <span className="text-base font-bold text-primary">{selectedCustomer.search_count}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-card border border-border/50">
                    <span className="text-muted-foreground block text-[10px]">Dealer Enquiries</span>
                    <span className="text-base font-bold text-emerald-600">{selectedCustomer.enquiry_count}</span>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              {selectedCustomer.status === 'active' ? (
                <Button
                  variant="destructive"
                  onClick={() => toggleCustomerStatus(selectedCustomer.id, 'suspended')}
                >
                  Suspend Account
                </Button>
              ) : (
                <Button
                  onClick={() => toggleCustomerStatus(selectedCustomer.id, 'active')}
                  className="bg-emerald-600 text-white hover:bg-emerald-700 font-bold"
                >
                  Activate Account
                </Button>
              )}
              <Button variant="outline" onClick={() => setSelectedCustomer(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
