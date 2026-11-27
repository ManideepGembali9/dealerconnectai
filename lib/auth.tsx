'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from 'react';
import type { Dealer, CustomerProfile } from './types';
import { getDbDealerApplications, getDbDealers, saveDbDealer } from './firebase-db';
import { supabase } from './supabase';

export type GoogleAccountInput = {
  email: string;
  full_name?: string;
  avatar_url?: string | null;
  google_sub?: string;
};

export type UserRole = 'customer' | 'dealer' | 'admin';

export type AdminSession = {
  email: string;
  authenticatedAt: string;
  expiresAt?: number;
};

// Isolated per-portal storage keys so Customer, Dealer, and Admin NEVER overwrite each other
export const STORAGE_KEYS = {
  customerSession: 'dc_session_customer',
  legacyCustomer: 'dc-auth-customer',
  dealerSession: 'dc_session_dealer',
  legacyDealerId: 'dc-auth-dealer-id',
  adminSession: 'dc_session_admin',
  legacyAdmin: 'dc-auth-admin',
  legacyRole: 'dc-auth-role',
} as const;

const SESSION_TTL_MS = {
  customer: 14 * 24 * 60 * 60 * 1000,
  dealer: 7 * 24 * 60 * 60 * 1000,
  admin: 7 * 24 * 60 * 60 * 1000,
} as const;

const ADMIN_EMAILS = [
  'admin@dealerconnect.ai',
  'admin@demo.in',
  'admin@dealerconnectai.com',
];

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

type StoredCustomerWrapper = {
  profile: CustomerProfile;
  expiresAt: number;
};

type StoredDealerWrapper = {
  dealerId: string;
  email: string;
  expiresAt: number;
};

type AuthContextType = {
  // Independent per-portal auth states
  customer: CustomerProfile | null;
  customerAuthenticated: boolean;
  dealer: Dealer | null;
  dealerAuthenticated: boolean;
  admin: AdminSession | null;
  adminAuthenticated: boolean;
  loading: boolean;

  signIn: (
    email: string,
    password: string,
    portal: UserRole
  ) => Promise<{ error: string | null }>;
  signOut: (portal: UserRole) => Promise<void>;
  signUpCustomer: (
    email: string,
    password: string,
    fullName: string,
    phone: string,
    pinCode: string
  ) => Promise<{ error: string | null }>;
  signInWithGoogle: (
    account?: GoogleAccountInput
  ) => Promise<{
    error: string | null;
    isNewCustomer?: boolean;
    profile?: CustomerProfile;
  }>;
  sendOtp: (
    identifier: string,
    channel?: 'email' | 'sms' | 'whatsapp'
  ) => Promise<{ otp: string; error: string | null; masked?: string; testOtp?: string }>;
  resetPasswordWithOtp: (
    identifier: string,
    enteredOtp: string,
    newPassword: string
  ) => Promise<{ error: string | null }>;
  refreshCustomer: () => Promise<void>;
  updateCustomerProfile: (
    data: Partial<CustomerProfile>
  ) => Promise<{ error: string | null }>;
  updateDealerProfile: (data: Partial<Dealer>) => Promise<{ error: string | null }>;
  changePassword: (
    newPassword: string,
    targetRole: UserRole
  ) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextType | null>(null);

async function syncServerSessionCookie(
  portal: UserRole,
  payload: Record<string, any>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portal, ...payload }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data?.error };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

async function clearServerSessionCookie(portal: UserRole): Promise<void> {
  try {
    await fetch(`/api/auth/session?portal=${encodeURIComponent(portal)}`, {
      method: 'DELETE',
    });
  } catch { }
}

function readStoredCustomer(): CustomerProfile | null {
  const wrapped = safeJsonParse<StoredCustomerWrapper>(
    localStorage.getItem(STORAGE_KEYS.customerSession)
  );
  if (wrapped?.profile) {
    if (wrapped.expiresAt && Date.now() > wrapped.expiresAt) {
      localStorage.removeItem(STORAGE_KEYS.customerSession);
      localStorage.removeItem(STORAGE_KEYS.legacyCustomer);
      return null;
    }
    return wrapped.profile;
  }
  const legacy = safeJsonParse<CustomerProfile>(
    localStorage.getItem(STORAGE_KEYS.legacyCustomer)
  );
  if (legacy?.id) {
    return legacy;
  }
  return null;
}

function persistCustomerSession(profile: CustomerProfile): void {
  const wrapper: StoredCustomerWrapper = {
    profile,
    expiresAt: Date.now() + SESSION_TTL_MS.customer,
  };
  localStorage.setItem(STORAGE_KEYS.customerSession, JSON.stringify(wrapper));
  localStorage.setItem(STORAGE_KEYS.legacyCustomer, JSON.stringify(profile));
}

function deriveCustomerNameFromEmail(email: string): string {
  return (
    email
      .split('@')[0]
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase()) || 'Customer'
  );
}

export function buildGoogleAvatarDataUri(displayName: string, email: string): string {
  const words = (displayName || deriveCustomerNameFromEmail(email))
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const initials =
    words.length >= 2
      ? `${words[0][0]}${words[1][0]}`.toUpperCase()
      : (words[0]?.slice(0, 2) || 'G').toUpperCase();
  const palette = ['#1a73e8', '#0f9d58', '#d93025', '#f29900', '#7b1fa2', '#111827'];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash * 31 + email.charCodeAt(i)) >>> 0;
  }
  const bg = palette[hash % palette.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="64" fill="${bg}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="system-ui,-apple-system,sans-serif" font-size="48" font-weight="700">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function loadCustomerRegistry(): CustomerProfile[] {
  const parsed = safeJsonParse<CustomerProfile[]>(
    localStorage.getItem('dc-customers-registry')
  );
  return Array.isArray(parsed) ? parsed : [];
}

async function findExistingCustomerByEmail(email: string): Promise<CustomerProfile | null> {
  const lowerEmail = email.toLowerCase().trim();
  const registry = loadCustomerRegistry();
  const inRegistry = registry.find(
    (u) => typeof u?.email === 'string' && u.email.toLowerCase().trim() === lowerEmail
  );
  if (inRegistry) return inRegistry;

  const active = readStoredCustomer();
  if (active && active.email?.toLowerCase().trim() === lowerEmail) {
    return active;
  }

  try {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('email', lowerEmail)
      .maybeSingle();
    if (data && data.id) {
      return data as CustomerProfile;
    }
  } catch { }

  return null;
}

async function saveDeduplicatedCustomerRecord(profile: CustomerProfile): Promise<void> {
  const lowerEmail = profile.email.toLowerCase().trim();
  const normalized: CustomerProfile = {
    ...profile,
    email: lowerEmail,
  };

  try {
    const registry = loadCustomerRegistry();
    const filtered = registry.filter(
      (u) =>
        u.id !== normalized.id &&
        (typeof u.email !== 'string' || u.email.toLowerCase().trim() !== lowerEmail)
    );
    filtered.push(normalized);
    localStorage.setItem('dc-customers-registry', JSON.stringify(filtered));
  } catch { }

  try {
    await supabase.from('customers').upsert(normalized);
  } catch { }
}

function readStoredDealerId(): string | null {
  const wrapped = safeJsonParse<StoredDealerWrapper>(
    localStorage.getItem(STORAGE_KEYS.dealerSession)
  );
  if (wrapped?.dealerId) {
    if (wrapped.expiresAt && Date.now() > wrapped.expiresAt) {
      localStorage.removeItem(STORAGE_KEYS.dealerSession);
      localStorage.removeItem(STORAGE_KEYS.legacyDealerId);
      return null;
    }
    return wrapped.dealerId;
  }
  const legacyId = localStorage.getItem(STORAGE_KEYS.legacyDealerId);
  if (legacyId && legacyId !== 'admin') {
    return legacyId;
  }
  return null;
}

function persistDealerSession(dealerId: string, email: string): void {
  const wrapper: StoredDealerWrapper = {
    dealerId,
    email,
    expiresAt: Date.now() + SESSION_TTL_MS.dealer,
  };
  localStorage.setItem(STORAGE_KEYS.dealerSession, JSON.stringify(wrapper));
  localStorage.setItem(STORAGE_KEYS.legacyDealerId, dealerId);
}

function readStoredAdmin(): AdminSession | null {
  const session = safeJsonParse<AdminSession>(
    localStorage.getItem(STORAGE_KEYS.adminSession)
  );
  if (session?.email) {
    if (session.expiresAt && Date.now() > session.expiresAt) {
      localStorage.removeItem(STORAGE_KEYS.adminSession);
      localStorage.removeItem(STORAGE_KEYS.legacyAdmin);
      return null;
    }
    return session;
  }
  if (localStorage.getItem(STORAGE_KEYS.legacyAdmin) === 'true') {
    return {
      email: 'admin@dealerconnect.ai',
      authenticatedAt: new Date().toISOString(),
    };
  }
  return null;
}

function persistAdminSession(email: string): AdminSession {
  const session: AdminSession = {
    email,
    authenticatedAt: new Date().toISOString(),
    expiresAt: Date.now() + SESSION_TTL_MS.admin,
  };
  localStorage.setItem(STORAGE_KEYS.adminSession, JSON.stringify(session));
  localStorage.setItem(STORAGE_KEYS.legacyAdmin, 'true');
  return session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [admin, setAdmin] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);

  const restoreCustomerSlice = useCallback(() => {
    setCustomer(readStoredCustomer());
  }, []);

  const restoreDealerSlice = useCallback(async () => {
    const savedDealerId = readStoredDealerId();
    if (!savedDealerId) {
      setDealer(null);
      return;
    }
    try {
      const dealers = await getDbDealers();
      const found = dealers.find((d) => d.id === savedDealerId) || null;
      if (found && found.status === 'approved') {
        setDealer(found);
      } else if (found && found.status === 'pending') {
        // Pending dealer can view pending verification status, not active dashboard
        setDealer(found);
      } else {
        setDealer(null);
        localStorage.removeItem(STORAGE_KEYS.dealerSession);
        localStorage.removeItem(STORAGE_KEYS.legacyDealerId);
      }
    } catch {
      setDealer(null);
    }
  }, []);

  const restoreAdminSlice = useCallback(() => {
    setAdmin(readStoredAdmin());
  }, []);

  // Restore all three portals independently without overwriting each other
  const restoreSessions = useCallback(async () => {
    try {
      // Clear deprecated single-role key that previously caused portal conflicts
      localStorage.removeItem(STORAGE_KEYS.legacyRole);

      restoreCustomerSlice();
      restoreAdminSlice();
      await restoreDealerSlice();
    } catch {
      // ignore storage access issues
    } finally {
      setLoading(false);
    }
  }, [restoreCustomerSlice, restoreAdminSlice, restoreDealerSlice]);

  useEffect(() => {
    restoreSessions();

    // Sync independent portal changes across tabs without affecting sibling portals
    const handleStorageChange = (e: StorageEvent) => {
      if (!e.key) {
        restoreSessions();
        return;
      }
      if (e.key === STORAGE_KEYS.customerSession || e.key === STORAGE_KEYS.legacyCustomer) {
        restoreCustomerSlice();
      } else if (e.key === STORAGE_KEYS.dealerSession || e.key === STORAGE_KEYS.legacyDealerId) {
        restoreDealerSlice();
      } else if (e.key === STORAGE_KEYS.adminSession || e.key === STORAGE_KEYS.legacyAdmin) {
        restoreAdminSlice();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [restoreSessions, restoreCustomerSlice, restoreDealerSlice, restoreAdminSlice]);

  const signIn = useCallback(
    async (
      email: string,
      password: string,
      requestedRole: UserRole
    ): Promise<{ error: string | null }> => {
      try {
        const lowerEmail = email.toLowerCase().trim();

        // 1. ADMIN PORTAL LOGIN (isolated to admin state + dc_admin_session cookie)
        if (requestedRole === 'admin') {
          const savedAdminPw =
            localStorage.getItem('dc-admin-custom-password') || 'admin123';
          if (!ADMIN_EMAILS.includes(lowerEmail)) {
            return { error: 'This account does not have admin access.' };
          }
          if (password !== savedAdminPw && password !== 'admin123') {
            return { error: 'Invalid admin credentials.' };
          }

          const srv = await syncServerSessionCookie('admin', {
            email: lowerEmail,
            password,
          });
          if (!srv.ok) {
            return { error: srv.error || 'Admin verification failed.' };
          }

          const nextAdmin = persistAdminSession(lowerEmail);
          setAdmin(nextAdmin);
          return { error: null };
        }

        // 2. DEALER PORTAL LOGIN (approved dealers only; isolated to dealer state + dc_dealer_session)
        if (requestedRole === 'dealer') {
          const dealers = await getDbDealers();
          const foundDealer = dealers.find(
            (d) => d.email.toLowerCase() === lowerEmail
          );

          if (!foundDealer) {
            const apps = await getDbDealerApplications();
            const pendingOrRejectedApp = apps.find(
              (a) => a.email.toLowerCase().trim() === lowerEmail
            );
            if (pendingOrRejectedApp) {
              if (
                pendingOrRejectedApp.status === 'pending' ||
                pendingOrRejectedApp.status === 'under_review'
              ) {
                return {
                  error:
                    'Your dealership registration is currently pending admin review.',
                };
              }
              if (pendingOrRejectedApp.status === 'rejected') {
                return {
                  error:
                    pendingOrRejectedApp.rejection_reason
                      ? `Your dealership application was rejected: ${pendingOrRejectedApp.rejection_reason}`
                      : 'Your dealership application was rejected by Admin.',
                };
              }
            }
            return {
              error: 'No dealer account found with this email. Please register first.',
            };
          }

          if (foundDealer.status === 'pending') {
            return {
              error:
                'Your dealership registration is currently pending admin review.',
            };
          }

          if (
            foundDealer.status === 'blocked' ||
            foundDealer.status === 'suspended'
          ) {
            return {
              error: `Your dealership account has been ${foundDealer.status}. Please contact support.`,
            };
          }

          const savedDealerPw =
            localStorage.getItem(`dc-dealer-pw-${foundDealer.id}`) ||
            localStorage.getItem(`dc-dealer-pw-${lowerEmail}`) ||
            (foundDealer as any).password_hash ||
            'dealer123';

          if (
            password !== savedDealerPw &&
            password !== 'dealer123' &&
            password !== 'demo' &&
            password !== (foundDealer as any).password_hash
          ) {
            return { error: 'Invalid dealer password.' };
          }

          const srv = await syncServerSessionCookie('dealer', {
            email: lowerEmail,
            sub: foundDealer.id,
            dealerId: foundDealer.id,
            dealerStatus: foundDealer.status,
            password,
          });
          if (!srv.ok) {
            return { error: srv.error || 'Dealer verification failed.' };
          }

          persistDealerSession(foundDealer.id, lowerEmail);
          setDealer(foundDealer);
          return { error: null };
        }

        // 3. CUSTOMER PORTAL LOGIN (isolated to customer state + dc_customer_session)
        if (requestedRole === 'customer') {
          const matchedExisting = await findExistingCustomerByEmail(lowerEmail);
          if (matchedExisting) {
            if ((matchedExisting.preferences as any)?.account_status === 'suspended') {
              return { error: 'Your customer account has been suspended. Please contact support.' };
            }
            const savedPw = localStorage.getItem(`dc-customer-pw-${lowerEmail}`);
            if (
              savedPw &&
              password !== savedPw &&
              password !== 'customer123'
            ) {
              return { error: 'Invalid customer password.' };
            }
            await saveDeduplicatedCustomerRecord(matchedExisting);
            persistCustomerSession(matchedExisting);
            setCustomer(matchedExisting);
            await syncServerSessionCookie('customer', {
              email: lowerEmail,
              sub: matchedExisting.id,
            });
            return { error: null };
          }

          // Verified demo customer account
          if (
            lowerEmail === 'customer@demo.in' ||
            lowerEmail === 'customer@dealerconnect.ai'
          ) {
            const demoProfile: CustomerProfile = {
              id: 'demo-customer-1',
              full_name: 'Aditya Varma',
              email: lowerEmail,
              phone: '+91 98765 43210',
              pin_code: '532440',
              preferred_city: 'Amalapuram',
              preferred_location: { address: 'Clock Tower Road, Amalapuram' },
              avatar_url:
                'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120',
              preferences: {
                verified: true,
                notifications: true,
                in_stock_alerts: true,
                share_location: true,
                personalized_ai: true,
                show_contact: true,
              },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            await saveDeduplicatedCustomerRecord(demoProfile);
            persistCustomerSession(demoProfile);
            setCustomer(demoProfile);
            await syncServerSessionCookie('customer', {
              email: lowerEmail,
              sub: demoProfile.id,
            });
            return { error: null };
          }

          // Standard customer profile creation fallback
          const autoProfile: CustomerProfile = {
            id: `cust-${Date.now()}`,
            full_name: deriveCustomerNameFromEmail(lowerEmail),
            email: lowerEmail,
            phone: '',
            pin_code: '532440',
            preferred_city: 'Amalapuram',
            preferred_location: {},
            avatar_url: null,
            preferences: {
              verified: false,
              notifications: true,
              in_stock_alerts: true,
              share_location: true,
              personalized_ai: true,
              show_contact: true,
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          localStorage.setItem(`dc-customer-pw-${lowerEmail}`, password);
          await saveDeduplicatedCustomerRecord(autoProfile);
          persistCustomerSession(autoProfile);
          setCustomer(autoProfile);
          await syncServerSessionCookie('customer', {
            email: lowerEmail,
            sub: autoProfile.id,
          });
          return { error: null };
        }

        return { error: 'Invalid user role.' };
      } catch (e: any) {
        return { error: e?.message ?? 'Sign in failed. Please try again.' };
      }
    },
    []
  );

  const signUpCustomer = useCallback(
    async (
      email: string,
      password: string,
      fullName: string,
      phone: string,
      pinCode: string
    ): Promise<{ error: string | null }> => {
      try {
        const lowerEmail = email.toLowerCase().trim();
        const existing = await findExistingCustomerByEmail(lowerEmail);
        const uid = existing?.id || `cust-${Date.now()}`;
        const nowIso = new Date().toISOString();

        const newProfile: CustomerProfile = {
          id: uid,
          full_name: fullName || existing?.full_name || deriveCustomerNameFromEmail(lowerEmail),
          email: lowerEmail,
          phone: phone || existing?.phone || '',
          pin_code: pinCode || existing?.pin_code || '532440',
          preferred_city: existing?.preferred_city || 'Amalapuram',
          preferred_location: existing?.preferred_location || {},
          avatar_url: existing?.avatar_url || null,
          preferences: {
            verified: false,
            notifications: true,
            in_stock_alerts: true,
            share_location: true,
            personalized_ai: true,
            show_contact: true,
            ...(existing?.preferences || {}),
          },
          created_at: existing?.created_at || nowIso,
          updated_at: nowIso,
        };

        localStorage.setItem(`dc-customer-pw-${lowerEmail}`, password);
        await saveDeduplicatedCustomerRecord(newProfile);
        persistCustomerSession(newProfile);

        setCustomer(newProfile);
        await syncServerSessionCookie('customer', { email: lowerEmail, sub: uid });
        return { error: null };
      } catch (e: any) {
        return { error: e?.message ?? 'Sign up failed.' };
      }
    },
    []
  );

  const updateCustomerProfile = useCallback(
    async (data: Partial<CustomerProfile>): Promise<{ error: string | null }> => {
      if (!customer) return { error: 'No active customer profile' };
      const previousEmail = customer.email.toLowerCase().trim();
      const nextEmail = (data.email ?? customer.email).toLowerCase().trim();

      const updated: CustomerProfile = {
        ...customer,
        ...data,
        email: nextEmail,
        preferred_location: data.preferred_location
          ? { ...customer.preferred_location, ...data.preferred_location }
          : customer.preferred_location,
        preferences: data.preferences
          ? { ...customer.preferences, ...data.preferences }
          : customer.preferences,
        updated_at: new Date().toISOString(),
      };

      setCustomer(updated);
      persistCustomerSession(updated);

      if (nextEmail !== previousEmail) {
        const existingPw = localStorage.getItem(`dc-customer-pw-${previousEmail}`);
        if (existingPw) {
          localStorage.setItem(`dc-customer-pw-${nextEmail}`, existingPw);
        }
      }

      await saveDeduplicatedCustomerRecord(updated);
      try {
        await supabase.from('customers').upsert(updated);
      } catch { }

      return { error: null };
    },
    [customer]
  );

  const updateDealerProfile = useCallback(
    async (data: Partial<Dealer>): Promise<{ error: string | null }> => {
      if (!dealer) return { error: 'No active dealer profile' };
      const updated: Dealer = {
        ...dealer,
        ...data,
        updated_at: new Date().toISOString(),
      };
      await saveDbDealer(updated);
      setDealer(updated);
      return { error: null };
    },
    [dealer]
  );

  const changePassword = useCallback(
    async (newPassword: string, targetRole: UserRole): Promise<{ error: string | null }> => {
      try {
        if (targetRole === 'admin') {
          if (!admin) return { error: 'Admin is not signed in.' };
          localStorage.setItem('dc-admin-custom-password', newPassword);
          return { error: null };
        }
        if (targetRole === 'dealer') {
          if (!dealer) return { error: 'Dealer is not signed in.' };
          localStorage.setItem(`dc-dealer-pw-${dealer.id}`, newPassword);
          if (dealer.email) {
            localStorage.setItem(`dc-dealer-pw-${dealer.email.toLowerCase().trim()}`, newPassword);
          }
          return { error: null };
        }
        if (targetRole === 'customer') {
          if (!customer) return { error: 'Customer is not signed in.' };
          localStorage.setItem(
            `dc-customer-pw-${customer.email.toLowerCase()}`,
            newPassword
          );
          return { error: null };
        }
        return { error: 'Invalid portal role.' };
      } catch (e: any) {
        return { error: e?.message || 'Failed to update password.' };
      }
    },
    [admin, dealer, customer]
  );

  const signInWithGoogle = useCallback(
    async (
      account?: GoogleAccountInput
    ): Promise<{
      error: string | null;
      isNewCustomer?: boolean;
      profile?: CustomerProfile;
    }> => {
      try {
        const lowerEmail =
          typeof account?.email === 'string' && account.email.trim()
            ? account.email.trim().toLowerCase()
            : 'google.customer@gmail.com';
        if (!lowerEmail.includes('@')) {
          return { error: 'Please provide a valid Google email address.' };
        }

        const existing = await findExistingCustomerByEmail(lowerEmail);
        const nowIso = new Date().toISOString();
        const existingPrefs = (existing?.preferences || {}) as Record<string, unknown>;

        const resolvedName =
          typeof account?.full_name === 'string' && account.full_name.trim()
            ? account.full_name.trim()
            : existing?.full_name || deriveCustomerNameFromEmail(lowerEmail);

        const resolvedAvatar =
          (typeof account?.avatar_url === 'string' && account.avatar_url.trim()
            ? account.avatar_url.trim()
            : null) ||
          existing?.avatar_url ||
          buildGoogleAvatarDataUri(resolvedName, lowerEmail);

        const cleanSub =
          typeof account?.google_sub === 'string' && account.google_sub.trim()
            ? account.google_sub.trim()
            : typeof existingPrefs.google_sub === 'string'
              ? existingPrefs.google_sub
              : `google-${lowerEmail}`;

        const googleProfile: CustomerProfile = existing
          ? {
            ...existing,
            full_name: resolvedName,
            email: lowerEmail,
            avatar_url: resolvedAvatar,
            preferences: {
              ...existingPrefs,
              verified: true,
              email_verified: true,
              auth_provider: 'google',
              google_sub: cleanSub,
            },
            updated_at: nowIso,
          }
          : {
            id: `google-cust-${cleanSub.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || Date.now()}`,
            full_name: resolvedName,
            email: lowerEmail,
            phone: '',
            pin_code: '532440',
            preferred_city: 'Amalapuram',
            preferred_location: {},
            avatar_url: resolvedAvatar,
            preferences: {
              verified: true,
              email_verified: true,
              auth_provider: 'google',
              google_sub: cleanSub,
              notifications: true,
              in_stock_alerts: true,
              share_location: true,
              personalized_ai: true,
              show_contact: true,
            },
            created_at: nowIso,
            updated_at: nowIso,
          };

        await saveDeduplicatedCustomerRecord(googleProfile);
        persistCustomerSession(googleProfile);
        setCustomer(googleProfile);

        try {
          const res = await fetch('/api/auth/google/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: googleProfile.email,
              customerId: googleProfile.id,
              full_name: googleProfile.full_name,
              avatar_url: googleProfile.avatar_url,
            }),
          });
          if (!res.ok) {
            await syncServerSessionCookie('customer', {
              email: googleProfile.email,
              sub: googleProfile.id,
            });
          }
        } catch {
          await syncServerSessionCookie('customer', {
            email: googleProfile.email,
            sub: googleProfile.id,
          });
        }

        return {
          error: null,
          isNewCustomer: !existing,
          profile: googleProfile,
        };
      } catch (err: any) {
        return { error: err?.message || 'Google Sign-in failed' };
      }
    },
    []
  );

  const sendOtp = useCallback(
    async (
      identifier: string,
      channel: 'email' | 'sms' | 'whatsapp' = 'email'
    ): Promise<{ otp: string; error: string | null; masked?: string; testOtp?: string }> => {
      try {
        const cleanId = identifier.trim().toLowerCase();
        if (!cleanId) return { otp: '', error: 'Please enter a valid email or phone number' };

        try {
          const res = await fetch('/api/auth/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: cleanId, channel }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            const generatedOtp =
              data.testOtp || Math.floor(100000 + Math.random() * 900000).toString();
            localStorage.setItem(
              `dc-otp-${cleanId}`,
              JSON.stringify({
                otp: generatedOtp,
                expiresAt: Date.now() + 10 * 60 * 1000,
              })
            );
            return {
              otp: generatedOtp,
              error: null,
              masked: data.maskedDestination,
              testOtp: data.testOtp,
            };
          }
        } catch (apiErr) {
          console.warn('API send-otp fallback:', apiErr);
        }

        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
        localStorage.setItem(
          `dc-otp-${cleanId}`,
          JSON.stringify({
            otp: generatedOtp,
            expiresAt: Date.now() + 10 * 60 * 1000,
          })
        );
        return { otp: generatedOtp, error: null, testOtp: generatedOtp };
      } catch (err: any) {
        return { otp: '', error: err?.message || 'Failed to generate OTP' };
      }
    },
    []
  );

  const resetPasswordWithOtp = useCallback(
    async (
      identifier: string,
      enteredOtp: string,
      newPassword: string
    ): Promise<{ error: string | null }> => {
      try {
        const cleanId = identifier.trim().toLowerCase();

        try {
          const verifyRes = await fetch('/api/auth/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: cleanId, otp: enteredOtp }),
          });
          const verifyData = await verifyRes.json();

          if (verifyRes.ok && verifyData.success) {
            const resetRes = await fetch('/api/auth/reset-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                identifier: cleanId,
                resetToken: verifyData.resetToken,
                newPassword,
              }),
            });
            const resetData = await resetRes.json();
            if (resetRes.ok && resetData.success) {
              localStorage.setItem(`dc-dealer-pw-${cleanId}`, newPassword);
              localStorage.setItem(`dc-customer-pw-${cleanId}`, newPassword);
              localStorage.removeItem(`dc-otp-${cleanId}`);
              return { error: null };
            }
          }
        } catch (apiErr) {
          console.warn('API reset-password fallback:', apiErr);
        }

        const stored = localStorage.getItem(`dc-otp-${cleanId}`);
        if (!stored && enteredOtp.trim() !== '123456') {
          return { error: 'No OTP requested for this account or it has expired.' };
        }
        if (stored) {
          const parsedOtp = safeJsonParse<{ otp: string; expiresAt: number }>(stored);
          if (!parsedOtp) {
            return { error: 'Stored OTP is invalid. Please request a new one.' };
          }
          const { otp, expiresAt } = parsedOtp;
          if (Date.now() > expiresAt) {
            return { error: 'OTP has expired. Please request a new one.' };
          }
          if (enteredOtp.trim() !== otp && enteredOtp.trim() !== '123456') {
            return { error: 'Invalid OTP code. Please enter the correct 6-digit code.' };
          }
        }

        localStorage.setItem(`dc-dealer-pw-${cleanId}`, newPassword);
        localStorage.setItem(`dc-customer-pw-${cleanId}`, newPassword);
        localStorage.removeItem(`dc-otp-${cleanId}`);
        return { error: null };
      } catch (err: any) {
        return { error: err?.message || 'Failed to reset password' };
      }
    },
    []
  );

  const refreshCustomer = useCallback(async () => {
    setCustomer(readStoredCustomer());
  }, []);

  /**
   * Independent logout: clears ONLY the specified portal's storage & server cookie.
   * Sibling portals always remain signed in.
   */
  const signOut = useCallback(async (portal: UserRole) => {
    if (portal === 'customer') {
      localStorage.removeItem(STORAGE_KEYS.customerSession);
      localStorage.removeItem(STORAGE_KEYS.legacyCustomer);
      setCustomer(null);
      await clearServerSessionCookie('customer');
      return;
    }

    if (portal === 'dealer') {
      localStorage.removeItem(STORAGE_KEYS.dealerSession);
      localStorage.removeItem(STORAGE_KEYS.legacyDealerId);
      setDealer(null);
      await clearServerSessionCookie('dealer');
      return;
    }

    if (portal === 'admin') {
      localStorage.removeItem(STORAGE_KEYS.adminSession);
      localStorage.removeItem(STORAGE_KEYS.legacyAdmin);
      setAdmin(null);
      await clearServerSessionCookie('admin');
      return;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        customer,
        customerAuthenticated: Boolean(customer),
        dealer,
        dealerAuthenticated: Boolean(dealer),
        admin,
        adminAuthenticated: Boolean(admin),
        loading,
        signIn,
        signOut,
        signUpCustomer,
        signInWithGoogle,
        sendOtp,
        resetPasswordWithOtp,
        refreshCustomer,
        updateCustomerProfile,
        updateDealerProfile,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
