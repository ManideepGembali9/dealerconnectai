'use client';

import { useAuth } from '@/lib/auth';
import { apiSync } from '@/lib/api-sync';
import { fetchReviewsForDealer } from '@/lib/data';
import { getDbEnquiries, getDbProducts } from '@/lib/firebase-db';
import { useRealtimeSync } from '@/lib/realtime-client';
import { supabase } from '@/lib/supabase';
import type { Dealer, Enquiry, Product, Review } from '@/lib/types';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

// Shell & Screens
import { DealerLoginScreen } from './dealer/dealer-login-screen';
import { DealerPendingScreen } from './dealer/dealer-pending-screen';
import { DealerShell } from './dealer/dealer-shell';

// 14 Ordered Modules
import { Module01DealerDashboard } from './dealer/modules/module-01-dashboard';
import { Module02DealerProfile } from './dealer/modules/module-02-profile';
import { Module03DealerProducts } from './dealer/modules/module-03-products';
import { Module04DealerAddProducts } from './dealer/modules/module-04-add-products';
import { Module05DealerInventory } from './dealer/modules/module-05-inventory';
import { Module06DealerPricing } from './dealer/modules/module-06-pricing';
import { Module07DealerStock } from './dealer/modules/module-07-stock';
import { Module08DealerEnquiries } from './dealer/modules/module-08-enquiries';
import { Module09DealerReviews } from './dealer/modules/module-09-reviews';
import { Module10DealerNotifications } from './dealer/modules/module-10-notifications';
import { Module11DealerAnalytics } from './dealer/modules/module-11-analytics';
import { Module12DealerDelivery } from './dealer/modules/module-12-delivery';
import { Module13DealerSupport } from './dealer/modules/module-13-support';
import { Module14DealerSettings } from './dealer/modules/module-14-settings';

export function DealerDashboardClient() {
  const { dealerAuthenticated, dealer: authDealer, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState('01-dashboard');
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  // Load Dealer Profile
  const loadDealerProfile = useCallback(async (dealerId: string) => {
    try {
      const { data, error } = await supabase
        .from('dealers')
        .select('*, category:business_category_id(*)')
        .eq('id', dealerId)
        .maybeSingle();

      if (error) {
        console.warn('Error loading dealer profile from supabase:', error);
      }
      if (data) {
        setDealer(data);
      } else if (authDealer) {
        setDealer(authDealer);
      }
    } catch (e) {
      console.error('Failed to load dealer profile:', e);
      if (authDealer) setDealer(authDealer);
    }
  }, [authDealer]);

  // Load Dealer's Products (dealer-scoped only)
  const loadProducts = useCallback(async (dealerId: string) => {
    try {
      const list = await getDbProducts({ dealerId, includeUnapproved: true });
      setProducts(list || []);
    } catch (e) {
      console.error('Failed to load products:', e);
    }
  }, []);

  // Load Customer Enquiries (privately scoped to this dealer only)
  const loadEnquiries = useCallback(async (dealerId: string) => {
    try {
      const list = await getDbEnquiries(dealerId);
      setEnquiries(list || []);
    } catch (e) {
      console.error('Failed to load enquiries:', e);
    }
  }, []);

  // Load Reviews
  const loadReviews = useCallback(async (dealerId: string) => {
    try {
      const resp = await apiSync.fetchReviews({ scope: 'dealer' }).catch(async () => ({
        reviews: await fetchReviewsForDealer(dealerId, true),
      }));
      setReviews(resp.reviews || []);
    } catch (e) {
      console.error('Failed to load reviews:', e);
    }
  }, []);

  // Master Loader
  const loadAllData = useCallback(async () => {
    const targetId = authDealer?.id || dealer?.id;
    if (!targetId) return;

    await Promise.all([
      loadDealerProfile(targetId),
      loadProducts(targetId),
      loadEnquiries(targetId),
      loadReviews(targetId),
    ]);
  }, [authDealer?.id, dealer?.id, loadDealerProfile, loadProducts, loadEnquiries, loadReviews]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const tabParam = new URLSearchParams(window.location.search).get('tab');
      if (tabParam) setActiveTab(tabParam);
    }
  }, []);

  useRealtimeSync(
    ['enquiries', 'reviews', 'products', 'dealers', 'notifications', 'dealer_applications'],
    loadAllData,
    { enabled: Boolean(authDealer?.id), onReconnect: loadAllData }
  );

  useEffect(() => {
    if (authDealer?.id) {
      loadAllData();

      const handleSync = () => {
        loadAllData();
      };

      window.addEventListener('storage', handleSync);
      window.addEventListener('dc-sync-event', handleSync);
      return () => {
        window.removeEventListener('storage', handleSync);
        window.removeEventListener('dc-sync-event', handleSync);
      };
    }
  }, [authDealer?.id, loadAllData]);

  // Computed Badges for Shell
  const pendingEnquiriesCount = useMemo(() => {
    return enquiries.filter(
      (e) =>
        e.status === 'pending' ||
        e.status === 'viewed' ||
        (e as any).status === 'new'
    ).length;
  }, [enquiries]);

  const outOfStockCount = useMemo(() => {
    return products.filter((p) => p.stock_status === 'out_of_stock').length;
  }, [products]);

  // =========================================================================
  // 1. AUTH LOADING STATE
  // =========================================================================
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-600">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <p className="text-sm font-semibold text-foreground">
            Verifying Dealer Credentials...
          </p>
          <p className="text-xs text-muted-foreground">
            Connecting to DealerConnect Merchant Network
          </p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. UNAUTHENTICATED DEALER -> SHOW INDEPENDENT DEALER LOGIN
  // =========================================================================
  if (!authDealer || !dealerAuthenticated) {
    return <DealerLoginScreen onLoginSuccess={loadAllData} />;
  }

  const effectiveDealer = dealer || authDealer;

  // =========================================================================
  // 3. PENDING DEALER APPROVAL SCREEN
  // =========================================================================
  if (effectiveDealer.status === 'pending') {
    return (
      <DealerPendingScreen
        dealer={effectiveDealer}
        onRefresh={async () => {
          await loadDealerProfile(effectiveDealer.id);
        }}
      />
    );
  }

  // =========================================================================
  // 4. SUSPENDED / REJECTED SCREEN
  // =========================================================================
  if (effectiveDealer.status === 'suspended' || effectiveDealer.status === 'blocked') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md w-full rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-4 shadow-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Shop Access Suspended</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Your showroom account for <span className="font-semibold text-foreground">{effectiveDealer.shop_name}</span> has been suspended by the platform administrator.
            </p>
          </div>
          <p className="text-xs text-muted-foreground border-t border-border/50 pt-3">
            Please contact DealerConnect Support at <span className="font-mono font-medium text-foreground">support@dealerconnect.ai</span> or call <span className="font-semibold text-foreground">+91 1800-DEALER</span> to appeal this decision.
          </p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 5. APPROVED DEALER DASHBOARD SHELL WITH 14 ORDERED MODULES
  // =========================================================================
  return (
    <DealerShell
      dealer={effectiveDealer}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      pendingEnquiriesCount={pendingEnquiriesCount}
      outOfStockCount={outOfStockCount}
    >
      {activeTab === '01-dashboard' && (
        <Module01DealerDashboard
          dealer={effectiveDealer}
          products={products}
          enquiries={enquiries}
          reviews={reviews}
          onNavigateTab={setActiveTab}
        />
      )}

      {activeTab === '02-profile' && (
        <Module02DealerProfile
          dealer={effectiveDealer}
          onRefreshDealer={async () => {
            await loadDealerProfile(effectiveDealer.id);
          }}
        />
      )}

      {activeTab === '03-products' && (
        <Module03DealerProducts
          dealer={effectiveDealer}
          products={products}
          onRefreshProducts={async () => {
            await loadProducts(effectiveDealer.id);
          }}
          onNavigateTab={setActiveTab}
        />
      )}

      {activeTab === '04-add-products' && (
        <Module04DealerAddProducts
          dealer={effectiveDealer}
          onInventoryChanged={async () => {
            await loadProducts(effectiveDealer.id);
          }}
        />
      )}

      {activeTab === '05-inventory' && (
        <Module05DealerInventory
          dealer={effectiveDealer}
          products={products}
          onRefreshProducts={async () => {
            await loadProducts(effectiveDealer.id);
          }}
        />
      )}

      {activeTab === '06-pricing' && (
        <Module06DealerPricing
          dealer={effectiveDealer}
          products={products}
          onRefreshProducts={async () => {
            await loadProducts(effectiveDealer.id);
          }}
        />
      )}

      {activeTab === '07-stock' && (
        <Module07DealerStock
          dealer={effectiveDealer}
          products={products}
          onRefreshProducts={async () => {
            await loadProducts(effectiveDealer.id);
          }}
        />
      )}

      {activeTab === '08-enquiries' && (
        <Module08DealerEnquiries
          dealer={effectiveDealer}
          enquiries={enquiries}
          products={products}
          onRefreshEnquiries={async () => {
            await loadEnquiries(effectiveDealer.id);
          }}
        />
      )}

      {activeTab === '09-reviews' && (
        <Module09DealerReviews
          dealer={effectiveDealer}
          reviews={reviews}
          products={products}
          onRefreshReviews={async () => {
            await loadReviews(effectiveDealer.id);
          }}
        />
      )}

      {activeTab === '10-notifications' && (
        <Module10DealerNotifications
          dealer={effectiveDealer}
          onNavigateTab={setActiveTab}
        />
      )}

      {activeTab === '11-analytics' && (
        <Module11DealerAnalytics
          dealer={effectiveDealer}
          products={products}
          enquiries={enquiries}
        />
      )}

      {activeTab === '12-delivery' && (
        <Module12DealerDelivery
          dealer={effectiveDealer}
          onRefreshDealer={async () => {
            await loadDealerProfile(effectiveDealer.id);
          }}
        />
      )}

      {activeTab === '13-support' && (
        <Module13DealerSupport dealer={effectiveDealer} />
      )}

      {activeTab === '14-settings' && (
        <Module14DealerSettings dealer={effectiveDealer} />
      )}
    </DealerShell>
  );
}
