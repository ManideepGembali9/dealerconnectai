'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  User, Heart, MapPin, Bell, Store, Package, LogOut, Settings,
  ShoppingBag, Clock, Star, Trash2, ChevronRight, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/lib/providers';
import { useAuth } from '@/lib/auth';
import { fetchProductById, fetchApprovedDealers } from '@/lib/data';
import { ProductCard } from '@/components/product-card';
import { haversineKm, formatDistance } from '@/lib/geo';
import type { Product, Dealer } from '@/lib/supabase';
import { EmptyState } from '@/components/ui/states';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function ProfileClient() {
  const router = useRouter();
  const { role, dealer, signOut } = useAuth();
  const { wishlist, recentlyViewed, savedDealers, location, setLocation, toggleSavedDealer } = useApp();
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [savedDealerList, setSavedDealerList] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const productPromises = recentlyViewed.slice(0, 6).map((id) => fetchProductById(id));
        const products = await Promise.all(productPromises);
        setRecentProducts(products.filter(Boolean) as Product[]);

        if (savedDealers.length > 0) {
          const allDealers = await fetchApprovedDealers(50);
          setSavedDealerList(allDealers.filter((d) => savedDealers.includes(d.id)));
        }
      } catch {
        toast.error('Failed to load profile data');
      } finally {
        setLoading(false);
      }
    })();
  }, [recentlyViewed, savedDealers]);

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:py-10">
      {/* Profile header */}
      <Card className="mb-6 overflow-hidden border-border/60">
        <div className="blue-gradient h-24" />
        <div className="px-6 pb-6">
          <div className="-mt-10 mb-4 flex items-end justify-between">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-background bg-background">
              <User className="h-10 w-10 text-primary" />
            </div>
            {role && (
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign Out
              </Button>
            )}
          </div>
          <h1 className="text-xl font-bold">
            {role === 'dealer' ? dealer?.shop_name : role === 'admin' ? 'Admin' : 'Customer'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {role === 'dealer' ? dealer?.email : role === 'admin' ? 'admin@dealerconnect.ai' : 'Guest user'}
          </p>
          {role && (
            <Badge className="mt-2 blue-gradient text-white">
              {role === 'dealer' ? <Store className="mr-1 h-3 w-3" /> : <Settings className="mr-1 h-3 w-3" />}
              {role.toUpperCase()}
            </Badge>
          )}
        </div>
      </Card>

      {/* Location card */}
      <Card className="mb-6 border-border/60 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Your Location</p>
              <p className="text-sm text-muted-foreground">
                {location.label ?? 'Not set'} {location.pinCode && `· PIN ${location.pinCode}`}
              </p>
            </div>
          </div>
          <Link href="/nearby">
            <Button size="sm" variant="outline">Change</Button>
          </Link>
        </div>
      </Card>

      {/* Quick stats */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Link href="/wishlist" className="rounded-xl border border-border/60 p-4 text-center transition-all hover:border-primary hover:shadow-md">
          <Heart className="mx-auto mb-1 h-5 w-5 text-primary" />
          <p className="text-2xl font-bold">{wishlist.length}</p>
          <p className="text-xs text-muted-foreground">Wishlist</p>
        </Link>
        <div className="rounded-xl border border-border/60 p-4 text-center">
          <Clock className="mx-auto mb-1 h-5 w-5 text-primary" />
          <p className="text-2xl font-bold">{recentlyViewed.length}</p>
          <p className="text-xs text-muted-foreground">Viewed</p>
        </div>
        <div className="rounded-xl border border-border/60 p-4 text-center">
          <Store className="mx-auto mb-1 h-5 w-5 text-primary" />
          <p className="text-2xl font-bold">{savedDealers.length}</p>
          <p className="text-xs text-muted-foreground">Saved Shops</p>
        </div>
      </div>

      {/* Menu items */}
      <div className="mb-6 space-y-2">
        <ProfileMenuItem href="/wishlist" icon={Heart} label="My Wishlist" badge={wishlist.length} />
        <ProfileMenuItem href="/nearby" icon={MapPin} label="Nearby Dealers" />
        <ProfileMenuItem href="/messages" icon={ShoppingBag} label="Messages" />
        <ProfileMenuItem href="/notifications" icon={Bell} label="Notifications" />
        <ProfileMenuItem href="/ai-search" icon={Sparkles} label="AI Search" />
        {role === 'dealer' && <ProfileMenuItem href="/dealer" icon={Store} label="Dealer Dashboard" />}
        {role === 'admin' && <ProfileMenuItem href="/admin" icon={Settings} label="Admin Dashboard" />}
        {!role && (
          <>
            <ProfileMenuItem href="/dealer/login" icon={Store} label="Dealer Login" />
            <ProfileMenuItem href="/admin/login" icon={Settings} label="Admin Login" />
          </>
        )}
      </div>

      {/* Recently viewed products */}
      {recentProducts.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Clock className="h-5 w-5" /> Recently Viewed
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {recentProducts.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      )}

      {/* Saved dealers */}
      {savedDealerList.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Store className="h-5 w-5" /> Saved Dealers
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {savedDealerList.map((d) => (
              <Card key={d.id} className="flex items-center gap-3 border-border/60 p-3">
                {d.logo_url ? (
                  <Image src={d.logo_url} alt={d.shop_name} width={44} height={44} className="rounded-lg object-cover" />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted">
                    <Store className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 overflow-hidden">
                  <Link href={`/dealer/${d.id}`} className="block truncate font-medium hover:text-primary">{d.shop_name}</Link>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="h-3 w-3 fill-warning text-warning" />
                    {d.rating.toFixed(1)} · {d.city}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => { toggleSavedDealer(d.id); setSavedDealerList((prev) => prev.filter((x) => x.id !== d.id)); }}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty states */}
      {recentProducts.length === 0 && savedDealerList.length === 0 && wishlist.length === 0 && !role && (
        <EmptyState
          icon={User}
          title="Welcome to DealerConnect AI"
          description="Start exploring products, save your favorite dealers, and use AI search to find exactly what you need nearby."
          action={
            <div className="flex gap-2">
              <Link href="/search"><Button size="sm">Browse Products</Button></Link>
              <Link href="/ai-search"><Button size="sm" variant="outline">Try AI Search</Button></Link>
            </div>
          }
        />
      )}
    </div>
  );
}

function ProfileMenuItem({ href, icon: Icon, label, badge }: { href: string; icon: any; label: string; badge?: number }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-xl border border-border/60 p-3 transition-all hover:border-primary hover:shadow-sm">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <span className="flex-1 text-sm font-medium">{label}</span>
      {badge !== undefined && badge > 0 && (
        <Badge variant="secondary">{badge}</Badge>
      )}
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
