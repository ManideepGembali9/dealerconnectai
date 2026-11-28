'use client';

import { AdminLoginScreen } from '@/components/admin/admin-login-screen';
import { AdminShell } from '@/components/admin/admin-shell';
import { useAuth } from '@/lib/auth';
import { useRealtimeSync } from '@/lib/realtime-client';
import { useCallback,useEffect,useState } from 'react';

// 14 Modular Control Center Subsystems
import { Module01Dashboard } from '@/components/admin/modules/module-01-dashboard';
import { Module02Dealers } from '@/components/admin/modules/module-02-dealers';
import { Module03Customers } from '@/components/admin/modules/module-03-customers';
import { Module04Products } from '@/components/admin/modules/module-04-products';
import { Module05Categories } from '@/components/admin/modules/module-05-categories';
import { Module06Brands } from '@/components/admin/modules/module-06-brands';
import { Module07Inventory } from '@/components/admin/modules/module-07-inventory';
import { Module08Enquiries } from '@/components/admin/modules/module-08-enquiries';
import { Module09Reviews } from '@/components/admin/modules/module-09-reviews';
import { Module10Homepage } from '@/components/admin/modules/module-10-homepage';
import { Module11Notifications } from '@/components/admin/modules/module-11-notifications';
import { Module12Analytics } from '@/components/admin/modules/module-12-analytics';
import { Module13Customization } from '@/components/admin/modules/module-13-customization';
import { Module14Settings } from '@/components/admin/modules/module-14-settings';

import {
  deleteDbDealer,
  getDbBrands,
  getDbCategories,
  getDbDealers,
  getDbEnquiries,
  getDbProducts,
  getDbReviews,
  saveDbDealer,
} from '@/lib/firebase-db';
import { supabase } from '@/lib/supabase';
import type { Brand,Category,Dealer,Enquiry,Product,Review } from '@/lib/types';

export function AdminDashboardClient() {
  const { adminAuthenticated, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('01-dashboard');

  // Platform Data
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [searchLogs, setSearchLogs] = useState<any[]>([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);

  // Load actual database data
  const loadPlatformData = useCallback(async (isInitial = false) => {
    if (isInitial) setDataLoading(true);
    try {
      const [dls, prods, cats, brnds, revs, logs, enqs] = await Promise.all([
        getDbDealers(),
        getDbProducts({ includeUnapproved: true }),
        getDbCategories(),
        getDbBrands(),
        getDbReviews(),
        supabase.from('search_logs').select('*').limit(100),
        getDbEnquiries(),
      ]);

      setDealers(dls);
      setProducts(prods);
      setCategories(cats);
      setBrands(brnds);
      setReviews(revs);
      setSearchLogs(logs?.data || []);

      // Compute customer count from registered customer storage + session + baseline
      let registryCount = 0;
      if (typeof window !== 'undefined') {
        try {
          const emails = new Set<string>();
          const reg = JSON.parse(localStorage.getItem('dc-customers-registry') || '[]');
          if (Array.isArray(reg)) {
            reg.forEach((c: any) => {
              if (c?.email) emails.add(String(c.email).toLowerCase());
            });
          }
          const dbCust = JSON.parse(localStorage.getItem('dc_db_customers') || '[]');
          if (Array.isArray(dbCust)) {
            dbCust.forEach((c: any) => {
              if (c?.email) emails.add(String(c.email).toLowerCase());
            });
          }
          const wrapped = localStorage.getItem('dc_session_customer');
          if (wrapped) {
            const p = JSON.parse(wrapped)?.profile;
            if (p?.email) emails.add(String(p.email).toLowerCase());
          }
          registryCount = emails.size;
        } catch {}
      }
      setCustomerCount(Math.max(registryCount, 5));
      setEnquiries(enqs);
    } catch (err) {
      console.error('Failed to load platform data:', err);
    } finally {
      if (isInitial) setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const tabParam = new URLSearchParams(window.location.search).get('tab');
      if (tabParam) setActiveTab(tabParam);
    }
  }, []);

  useRealtimeSync('all', () => loadPlatformData(false), {
    enabled: adminAuthenticated,
    onReconnect: () => loadPlatformData(false),
  });

  useEffect(() => {
    if (adminAuthenticated) {
      loadPlatformData(true);

      const handleSync = () => {
        loadPlatformData(false);
      };

      window.addEventListener('storage', handleSync);
      window.addEventListener('dc-sync-event', handleSync);
      return () => {
        window.removeEventListener('storage', handleSync);
        window.removeEventListener('dc-sync-event', handleSync);
      };
    }
  }, [adminAuthenticated, loadPlatformData]);

  // Dealer Management Handlers
  const handleUpdateDealerStatus = async (id: string, status: Dealer['status']) => {
    try {
      const target = dealers.find((d) => d.id === id);
      if (!target) return;
      const updated: Dealer = {
        ...target,
        status,
        approved_at: status === 'approved' ? new Date().toISOString() : target.approved_at,
      };
      await saveDbDealer(updated);
      setDealers((prev) => prev.map((d) => (d.id === id ? updated : d)));
    } catch {
      throw new Error('Failed to update dealer status');
    }
  };

  const handleDeleteDealer = async (id: string) => {
    try {
      await deleteDbDealer(id);
      setDealers((prev) => prev.filter((d) => d.id !== id));
      setProducts((prev) => prev.filter((p) => p.dealer_id !== id));
    } catch {
      throw new Error('Failed to delete dealer');
    }
  };

  // 1. Loading state while checking authentication
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-xs text-muted-foreground font-semibold">
            Verifying Administrator Credentials...
          </p>
        </div>
      </div>
    );
  }

  // 2. ADMIN LOGIN FIRST: If admin portal is not signed in, render Admin Login screen
  if (!adminAuthenticated) {
    return <AdminLoginScreen onLoginSuccess={loadPlatformData} />;
  }

  // 3. Loading state for initial data fetch
  if (dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-xs text-muted-foreground font-semibold">
            Initializing Admin Control Center Modules...
          </p>
        </div>
      </div>
    );
  }

  const pendingDealersCount = dealers.filter((d) => d.status === 'pending').length;
  const openEnquiriesCount = enquiries.filter(
    (e) => e.status !== 'resolved' && e.status !== 'closed' && (e as any).status !== 'completed'
  ).length;

  return (
    <AdminShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      pendingDealersCount={pendingDealersCount}
      openEnquiriesCount={openEnquiriesCount}
    >
      {/* 01. Dashboard */}
      {activeTab === '01-dashboard' && (
        <Module01Dashboard
          dealers={dealers}
          products={products}
          categories={categories}
          customerCount={customerCount}
          reviews={reviews}
          enquiries={enquiries}
          searchLogs={searchLogs}
          onNavigateTab={setActiveTab}
          onOpenLayoutManager={() => {
            // Trigger layout manager modal
            const btn = document.querySelector('[data-layout-trigger="true"]') as HTMLButtonElement;
            btn?.click();
          }}
        />
      )}

      {/* 02. Dealer Management */}
      {activeTab === '02-dealers' && (
        <Module02Dealers
          dealers={dealers}
          onUpdateDealerStatus={handleUpdateDealerStatus}
          onDeleteDealer={handleDeleteDealer}
          onRefreshDealers={loadPlatformData}
        />
      )}

      {/* 03. Customer Management */}
      {activeTab === '03-customers' && (
        <Module03Customers customerCount={customerCount} enquiries={enquiries} />
      )}

      {/* 04. Product Management */}
      {activeTab === '04-products' && <Module04Products />}

      {/* 05. Category Management */}
      {activeTab === '05-categories' && (
        <Module05Categories
          categories={categories}
          products={products}
          onRefreshCategories={loadPlatformData}
        />
      )}

      {/* 06. Brand Management */}
      {activeTab === '06-brands' && (
        <Module06Brands
          brands={brands}
          products={products}
          onRefreshBrands={loadPlatformData}
        />
      )}

      {/* 07. Inventory Management */}
      {activeTab === '07-inventory' && (
        <Module07Inventory
          products={products}
          dealers={dealers}
          onNavigateTab={setActiveTab}
        />
      )}

      {/* 08. Enquiry Management */}
      {activeTab === '08-enquiries' && (
        <Module08Enquiries
          enquiries={enquiries}
          dealers={dealers}
          products={products}
          onRefreshEnquiries={loadPlatformData}
        />
      )}

      {/* 09. Reviews and Ratings */}
      {activeTab === '09-reviews' && (
        <Module09Reviews
          reviews={reviews}
          dealers={dealers}
          products={products}
          onRefreshReviews={loadPlatformData}
        />
      )}

      {/* 10. Homepage Management */}
      {activeTab === '10-homepage' && (
        <Module10Homepage
          products={products}
          dealers={dealers}
          categories={categories}
        />
      )}

      {/* 11. Notifications */}
      {activeTab === '11-notifications' && (
        <Module11Notifications onNavigateTab={setActiveTab} />
      )}

      {/* 12. Analytics and Reports */}
      {activeTab === '12-analytics' && (
        <Module12Analytics
          dealers={dealers}
          products={products}
          categories={categories}
          customerCount={customerCount}
          searchLogs={searchLogs}
          enquiries={enquiries}
        />
      )}

      {/* 13. App Customization */}
      {activeTab === '13-customization' && <Module13Customization />}

      {/* 14. Settings */}
      {activeTab === '14-settings' && <Module14Settings />}
    </AdminShell>
  );
}
