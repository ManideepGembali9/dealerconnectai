'use client';

import type {
  AppSettings,
  Brand,
  Category,
  Dealer,
  DealerApplication,
  DealerApplicationStatus,
  DealerSupportEnquiry,
  Enquiry,
  ModerationLog,
  Notification,
  Product,
  PushNotification,
  Review,
  ReviewReport,
} from './types';
import type { PlatformSupportSettings } from './server-db';

export type SyncSnapshot = {
  categories: Category[];
  brands: Brand[];
  dealers: Dealer[];
  dealerApplications: DealerApplication[];
  products: Product[];
  enquiries: Enquiry[];
  dealerEnquiries: DealerSupportEnquiry[];
  reviews: Review[];
  reviewReports: ReviewReport[];
  moderationLogs: ModerationLog[];
  notifications: Notification[];
  pushNotifications: PushNotification[];
  platformSettings: PlatformSupportSettings;
  appSettings: AppSettings;
  updatedAt: number;
};

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const apiSync = {
  fetchSnapshot: () => apiJson<SyncSnapshot>('/api/sync'),

  fetchDealers: async (scope?: 'admin'): Promise<Dealer[]> => {
    const q = scope ? `?scope=${scope}` : '';
    const data = await apiJson<{ dealers: Dealer[] }>(`/api/dealers${q}`);
    return data.dealers || [];
  },

  saveDealer: async (dealer: Partial<Dealer>, method: 'POST' | 'PATCH' = 'PATCH'): Promise<Dealer> => {
    const data = await apiJson<{ dealer: Dealer }>('/api/dealers', {
      method,
      body: JSON.stringify(dealer),
    });
    return data.dealer;
  },

  deleteDealer: (id: string) =>
    apiJson<{ deleted: boolean }>(`/api/dealers?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),

  fetchProducts: async (opts?: {
    dealerId?: string;
    masterOnly?: boolean;
    includeUnapproved?: boolean;
    scope?: 'public' | 'admin' | 'dealer';
  }): Promise<Product[]> => {
    const params = new URLSearchParams();
    if (opts?.dealerId) params.set('dealerId', opts.dealerId);
    if (opts?.masterOnly) params.set('masterOnly', 'true');
    if (opts?.includeUnapproved) params.set('includeUnapproved', 'true');
    if (opts?.scope) params.set('scope', opts.scope);
    const q = params.toString() ? `?${params.toString()}` : '';
    const data = await apiJson<{ products: Product[] }>(`/api/products${q}`);
    return data.products || [];
  },

  saveProduct: async (
    product: Partial<Product> & {
      from_catalogue?: boolean;
      resubmit?: boolean;
      action?: 'approve' | 'reject' | 'request_info' | 'link_master';
      reason?: string;
      syncMasterDetails?: boolean;
    },
    isUpdate = false
  ): Promise<Product> => {
    const data = await apiJson<{ product: Product }>('/api/products', {
      method: isUpdate ? 'PATCH' : 'POST',
      body: JSON.stringify(product),
    });
    return data.product;
  },

  bulkUpdateProducts: async (
    bulkUpdates: Array<{
      id: string;
      stock_qty?: number;
      stock_status?: Product['stock_status'];
      low_stock_threshold?: number;
    }>
  ): Promise<Product[]> => {
    const data = await apiJson<{ products: Product[] }>('/api/products', {
      method: 'PATCH',
      body: JSON.stringify({ bulkUpdates }),
    });
    return data.products || [];
  },

  deleteProduct: (id: string) =>
    apiJson<{ deleted: boolean }>(`/api/products?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),

  fetchDealerEnquiries: async (opts?: { scope?: 'dealer' | 'admin'; dealerId?: string }): Promise<DealerSupportEnquiry[]> => {
    const params = new URLSearchParams();
    if (opts?.scope) params.set('scope', opts.scope);
    if (opts?.dealerId) params.set('dealerId', opts.dealerId);
    const q = params.toString() ? `?${params.toString()}` : '';
    const data = await apiJson<{ dealerEnquiries: DealerSupportEnquiry[] }>(`/api/dealer-enquiries${q}`);
    return data.dealerEnquiries || [];
  },

  createDealerEnquiry: async (payload: {
    subject: string;
    category: DealerSupportEnquiry['category'];
    priority: DealerSupportEnquiry['priority'];
    description: string;
    attachment_url?: string | null;
  }): Promise<DealerSupportEnquiry> => {
    const data = await apiJson<{ dealerEnquiry: DealerSupportEnquiry }>('/api/dealer-enquiries', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.dealerEnquiry;
  },

  updateDealerEnquiry: async (payload: {
    id: string;
    actorRole?: 'dealer' | 'admin';
    message?: string;
    attachment_url?: string | null;
    status?: DealerSupportEnquiry['status'];
    assigned_to?: string;
    internal_notes?: string;
  }): Promise<DealerSupportEnquiry> => {
    const data = await apiJson<{ dealerEnquiry: DealerSupportEnquiry }>('/api/dealer-enquiries', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return data.dealerEnquiry;
  },

  fetchEnquiries: async (opts?: { scope?: 'customer' | 'dealer' | 'admin'; dealerId?: string; status?: string }): Promise<Enquiry[]> => {
    const params = new URLSearchParams();
    if (opts?.scope) params.set('scope', opts.scope);
    if (opts?.dealerId) params.set('dealerId', opts.dealerId);
    if (opts?.status) params.set('status', opts.status);
    const q = params.toString() ? `?${params.toString()}` : '';
    const data = await apiJson<{ enquiries: Enquiry[] }>(`/api/enquiries${q}`);
    return data.enquiries || [];
  },

  createEnquiry: async (payload: Partial<Enquiry>): Promise<Enquiry> => {
    const data = await apiJson<{ enquiry: Enquiry }>('/api/enquiries', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.enquiry;
  },

  updateEnquiry: async (payload: Partial<Enquiry> & { id: string; actorRole?: 'customer' | 'dealer' | 'admin'; follow_up_message?: string }): Promise<Enquiry> => {
    const data = await apiJson<{ enquiry: Enquiry }>('/api/enquiries', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return data.enquiry;
  },

  fetchReviews: async (opts?: { productId?: string; dealerId?: string; scope?: 'customer' | 'dealer' | 'admin' }): Promise<{
    reviews: Review[];
    reports?: ReviewReport[];
    moderationLogs?: ModerationLog[];
    canReview?: boolean;
    alreadyReviewed?: boolean;
  }> => {
    const params = new URLSearchParams();
    if (opts?.productId) params.set('productId', opts.productId);
    if (opts?.dealerId) params.set('dealerId', opts.dealerId);
    if (opts?.scope) params.set('scope', opts.scope);
    const q = params.toString() ? `?${params.toString()}` : '';
    return apiJson(`/api/reviews${q}`);
  },

  createReview: async (payload: {
    dealer_id: string | null;
    product_id: string | null;
    customer_name: string;
    rating: number;
    comment: string;
    quality_rating?: number | null;
  }): Promise<Review> => {
    const data = await apiJson<{ review: Review }>('/api/reviews', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.review;
  },

  updateReview: async (payload: {
    id: string;
    action: 'edit' | 'report' | 'dealer_reply' | 'delete_dealer_reply' | 'approve' | 'flag' | 'hide' | 'restore';
    rating?: number;
    comment?: string;
    dealer_response?: string;
    reason?: string;
  }): Promise<Review> => {
    const data = await apiJson<{ review: Review }>('/api/reviews', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return data.review;
  },

  deleteReview: (id: string) =>
    apiJson<{ deleted?: boolean; hidden?: boolean }>(`/api/reviews?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  fetchDealerApplications: async (): Promise<DealerApplication[]> => {
    const data = await apiJson<{ applications: DealerApplication[] }>('/api/dealer-applications');
    return data.applications || [];
  },

  submitDealerApplication: async (app: Partial<DealerApplication> & { dealer_password?: string | null }): Promise<DealerApplication> => {
    const data = await apiJson<{ application: DealerApplication }>('/api/dealer-applications', {
      method: 'POST',
      body: JSON.stringify(app),
    });
    return data.application;
  },

  reviewDealerApplication: async (
    id: string,
    action: 'approve' | 'reject' | 'under_review',
    reason?: string
  ): Promise<{ application: DealerApplication; dealer?: Dealer }> => {
    return apiJson('/api/dealer-applications', {
      method: 'PATCH',
      body: JSON.stringify({ id, action, reason }),
    });
  },

  fetchNotifications: async (scope?: 'customer' | 'dealer' | 'admin'): Promise<Notification[]> => {
    const q = scope ? `?scope=${scope}` : '';
    const data = await apiJson<{ notifications: Notification[] }>(`/api/notifications${q}`);
    return data.notifications || [];
  },

  fetchPushNotifications: async (): Promise<PushNotification[]> => {
    const data = await apiJson<{ pushNotifications: PushNotification[] }>('/api/notifications?scope=admin_push');
    return data.pushNotifications || [];
  },

  sendPushNotification: async (payload: {
    title: string;
    body: string;
    target_audience: PushNotification['target_audience'];
    target_user_ids?: string[] | null;
  }): Promise<PushNotification> => {
    const data = await apiJson<{ pushNotification: PushNotification }>('/api/notifications', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.pushNotification;
  },

  markNotificationRead: (id: string, scope?: 'customer' | 'dealer' | 'admin') =>
    apiJson('/api/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ id, scope }),
    }),

  markAllNotificationsRead: (scope?: 'customer' | 'dealer' | 'admin') =>
    apiJson('/api/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ markAll: true, scope }),
    }),

  deleteNotification: (id: string) =>
    apiJson(`/api/notifications?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),

  fetchMetadata: () =>
    apiJson<{
      categories: Category[];
      brands: Brand[];
      platformSettings: PlatformSupportSettings;
      appSettings: AppSettings;
    }>('/api/metadata'),

  saveMetadata: (
    kind: 'category' | 'brand' | 'platform_settings' | 'app_settings',
    item: unknown
  ) =>
    apiJson('/api/metadata', {
      method: 'POST',
      body: JSON.stringify({ kind, item }),
    }),

  deleteMetadata: (kind: 'category' | 'brand', id: string) =>
    apiJson(`/api/metadata?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};

export type { DealerApplicationStatus };
