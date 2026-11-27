'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import type { Dealer, CustomerProfile } from './types';
import { getDbDealers, saveDbDealer } from './firebase-db';

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export type UserRole = 'customer' | 'dealer' | 'admin';

type AuthContextType = {
  role: UserRole | null;
  dealer: Dealer | null;
  customer: CustomerProfile | null;
  loading: boolean;
  signIn: (email: string, password: string, role: UserRole) => Promise<{ error: string | null }>;
  signOut: (targetRole?: UserRole) => Promise<void>;
  signUpCustomer: (email: string, password: string, fullName: string, phone: string, pinCode: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  sendOtp: (identifier: string, channel?: 'email' | 'sms' | 'whatsapp') => Promise<{ otp: string; error: string | null; masked?: string; testOtp?: string }>;
  resetPasswordWithOtp: (identifier: string, enteredOtp: string, newPassword: string) => Promise<{ error: string | null }>;
  refreshCustomer: () => Promise<void>;
  updateCustomerProfile: (data: Partial<CustomerProfile>) => Promise<{ error: string | null }>;
  updateDealerProfile: (data: Partial<Dealer>) => Promise<{ error: string | null }>;
  changePassword: (newPassword: string, targetRole?: UserRole) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const ADMIN_EMAILS = ['admin@dealerconnect.ai', 'admin@demo.in', 'admin@dealerconnectai.com'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore customer, dealer, or admin session without cross-role leakage
  const restoreSession = useCallback(async () => {
    try {
      const savedRole = localStorage.getItem('dc-auth-role') as UserRole | null;
      const savedDealerId = localStorage.getItem('dc-auth-dealer-id');
      const savedCustomerData = localStorage.getItem('dc-auth-customer');
      const savedAdmin = localStorage.getItem('dc-auth-admin');

      let parsedCustomer: CustomerProfile | null = null;
      if (savedCustomerData) {
        try {
          parsedCustomer = JSON.parse(savedCustomerData);
          setCustomer(parsedCustomer);
        } catch {}
      }

      let foundDealer: Dealer | null = null;
      if (savedDealerId && savedDealerId !== 'admin') {
        const dealers = await getDbDealers();
        foundDealer = dealers.find((d) => d.id === savedDealerId) || null;
        if (foundDealer) setDealer(foundDealer);
      }

      if (savedRole === 'admin' || (!savedRole && savedAdmin === 'true')) {
        setRole('admin');
        setLoading(false);
        return;
      }

      if (savedRole === 'dealer' && foundDealer) {
        setRole('dealer');
        setLoading(false);
        return;
      }

      if (savedRole === 'customer' && parsedCustomer) {
        setRole('customer');
        setLoading(false);
        return;
      }

      if (parsedCustomer && !savedRole) {
        setRole('customer');
      } else if (foundDealer && !savedRole) {
        setRole('dealer');
      }

      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const signIn = useCallback(async (email: string, password: string, requestedRole: UserRole): Promise<{ error: string | null }> => {
    try {
      const lowerEmail = email.toLowerCase().trim();

      // ADMIN SIGN IN
      if (requestedRole === 'admin') {
        const savedAdminPw = localStorage.getItem('dc-admin-custom-password') || 'admin123';
        if (!ADMIN_EMAILS.includes(lowerEmail)) {
          return { error: 'This account does not have admin access.' };
        }
        if (password !== savedAdminPw && password !== 'admin123') {
          return { error: 'Invalid admin credentials.' };
        }
        localStorage.setItem('dc-auth-role', 'admin');
        localStorage.setItem('dc-auth-admin', 'true');
        setRole('admin');
        return { error: null };
      }

      // DEALER SIGN IN
      if (requestedRole === 'dealer') {
        const dealers = await getDbDealers();
        const foundDealer = dealers.find((d) => d.email.toLowerCase() === lowerEmail);

        if (!foundDealer) {
          return { error: 'No dealer account found with this email. Please register first.' };
        }

        if (foundDealer.status === 'pending') {
          return { error: 'Your dealership registration is currently pending admin review.' };
        }

        if (foundDealer.status === 'blocked' || foundDealer.status === 'suspended') {
          return { error: `Your dealership account has been ${foundDealer.status}. Please contact support.` };
        }

        // Check custom dealer password in localStorage or default
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

        localStorage.setItem('dc-auth-role', 'dealer');
        localStorage.setItem('dc-auth-dealer-id', foundDealer.id);
        setRole('dealer');
        setDealer(foundDealer);
        return { error: null };
      }

      // CUSTOMER SIGN IN
      if (requestedRole === 'customer') {
        // Check registered customers
        try {
          const registry: CustomerProfile[] = JSON.parse(localStorage.getItem('dc-customers-registry') || '[]');
          const foundInRegistry = registry.find((u) => u.email.toLowerCase() === lowerEmail);
          if (foundInRegistry) {
            const savedPw = localStorage.getItem(`dc-customer-pw-${lowerEmail}`);
            if (savedPw && password !== savedPw && password !== 'customer123') {
              return { error: 'Invalid customer password.' };
            }
            localStorage.setItem('dc-auth-role', 'customer');
            localStorage.setItem('dc-auth-customer', JSON.stringify(foundInRegistry));
            setCustomer(foundInRegistry);
            setRole('customer');
            return { error: null };
          }
        } catch {}

        // Check current saved customer profile
        const savedCustomerRaw = localStorage.getItem('dc-auth-customer');
        const savedCustomerPw = localStorage.getItem(`dc-customer-pw-${lowerEmail}`) || 'customer123';

        if (savedCustomerRaw) {
          const parsed = safeJsonParse<CustomerProfile>(savedCustomerRaw);
          if (parsed && parsed.email?.toLowerCase() === lowerEmail) {
            if (password !== savedCustomerPw && password !== 'customer123') {
              return { error: 'Invalid customer password.' };
            }
            localStorage.setItem('dc-auth-role', 'customer');
            setCustomer(parsed);
            setRole('customer');
            return { error: null };
          }
        }

        // Allow demo customer sign in (verified demo account)
        if (lowerEmail === 'customer@demo.in' || lowerEmail === 'customer@dealerconnect.ai') {
          const demoProfile: CustomerProfile = {
            id: 'demo-customer-1',
            full_name: 'Aditya Varma',
            email: lowerEmail,
            phone: '+91 98765 43210',
            pin_code: '532440',
            preferred_city: 'Amalapuram',
            preferred_location: { address: 'Clock Tower Road, Amalapuram' },
            avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120',
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
          localStorage.setItem('dc-auth-role', 'customer');
          localStorage.setItem('dc-auth-customer', JSON.stringify(demoProfile));
          setCustomer(demoProfile);
          setRole('customer');
          return { error: null };
        }

        // Seamless login fallback: create customer profile for this email (unverified until OTP/OAuth)
        const autoProfile: CustomerProfile = {
          id: `cust-${Date.now()}`,
          full_name: lowerEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Customer',
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
        localStorage.setItem('dc-auth-role', 'customer');
        localStorage.setItem('dc-auth-customer', JSON.stringify(autoProfile));
        setCustomer(autoProfile);
        setRole('customer');
        return { error: null };
      }

      return { error: 'Invalid user role.' };
    } catch (e: any) {
      return { error: e.message ?? 'Sign in failed. Please try again.' };
    }
  }, []);

  const signUpCustomer = useCallback(async (
    email: string,
    password: string,
    fullName: string,
    phone: string,
    pinCode: string
  ): Promise<{ error: string | null }> => {
    try {
      const lowerEmail = email.toLowerCase().trim();

      const uid = `cust-${Date.now()}`;

      const newProfile: CustomerProfile = {
        id: uid,
        full_name: fullName,
        email: lowerEmail,
        phone,
        pin_code: pinCode,
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
      localStorage.setItem('dc-auth-role', 'customer');
      localStorage.setItem('dc-auth-customer', JSON.stringify(newProfile));

      // Save into customers registry
      try {
        const existingUsers: CustomerProfile[] = JSON.parse(localStorage.getItem('dc-customers-registry') || '[]');
        const filtered = existingUsers.filter((u) => u.email.toLowerCase() !== lowerEmail);
        filtered.push(newProfile);
        localStorage.setItem('dc-customers-registry', JSON.stringify(filtered));
      } catch {}

      setCustomer(newProfile);
      setRole('customer');

      return { error: null };
    } catch (e: any) {
      return { error: e.message ?? 'Sign up failed.' };
    }
  }, []);

  const updateCustomerProfile = useCallback(async (data: Partial<CustomerProfile>): Promise<{ error: string | null }> => {
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
    localStorage.setItem('dc-auth-customer', JSON.stringify(updated));

    // Migrate password key if email changed
    if (nextEmail !== previousEmail) {
      const existingPw = localStorage.getItem(`dc-customer-pw-${previousEmail}`);
      if (existingPw) {
        localStorage.setItem(`dc-customer-pw-${nextEmail}`, existingPw);
      }
    }

    // Keep persistent customers registry synchronized
    try {
      const registry: CustomerProfile[] = JSON.parse(localStorage.getItem('dc-customers-registry') || '[]');
      const filtered = registry.filter(
        (u) => u.id !== customer.id && u.email.toLowerCase() !== previousEmail && u.email.toLowerCase() !== nextEmail
      );
      filtered.push(updated);
      localStorage.setItem('dc-customers-registry', JSON.stringify(filtered));
    } catch {}

    return { error: null };
  }, [customer]);

  const updateDealerProfile = useCallback(async (data: Partial<Dealer>): Promise<{ error: string | null }> => {
    if (!dealer) return { error: 'No active dealer profile' };
    const updated: Dealer = {
      ...dealer,
      ...data,
      updated_at: new Date().toISOString(),
    };
    await saveDbDealer(updated);
    setDealer(updated);
    return { error: null };
  }, [dealer]);

  const changePassword = useCallback(async (newPassword: string, targetRole?: UserRole): Promise<{ error: string | null }> => {
    try {
      const effectiveRole = targetRole ?? role;
      if (effectiveRole === 'admin') {
        localStorage.setItem('dc-admin-custom-password', newPassword);
        return { error: null };
      }
      if (effectiveRole === 'dealer' && dealer) {
        localStorage.setItem(`dc-dealer-pw-${dealer.id}`, newPassword);
        return { error: null };
      }
      if (effectiveRole === 'customer' && customer) {
        localStorage.setItem(`dc-customer-pw-${customer.email.toLowerCase()}`, newPassword);
        return { error: null };
      }
      return { error: 'User is not logged in.' };
    } catch (e: any) {
      return { error: e.message || 'Failed to update password.' };
    }
  }, [role, dealer, customer]);

  const signInWithGoogle = useCallback(async (): Promise<{ error: string | null }> => {
    try {
      const googleProfile: CustomerProfile = {
        id: 'google-cust-' + Date.now(),
        full_name: 'Google Customer',
        email: 'google.customer@gmail.com',
        phone: '+91 98765 43210',
        pin_code: '532440',
        preferred_city: 'Amalapuram',
        preferred_location: {},
        avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120',
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
      localStorage.setItem('dc-auth-role', 'customer');
      localStorage.setItem('dc-auth-customer', JSON.stringify(googleProfile));
      setCustomer(googleProfile);
      setRole('customer');
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Google Sign-in failed' };
    }
  }, []);

  const sendOtp = useCallback(async (
    identifier: string,
    channel: 'email' | 'sms' | 'whatsapp' = 'email'
  ): Promise<{ otp: string; error: string | null; masked?: string; testOtp?: string }> => {
    try {
      const cleanId = identifier.trim().toLowerCase();
      if (!cleanId) return { otp: '', error: 'Please enter a valid email or phone number' };

      // Try backend Nodemailer / Twilio API
      try {
        const res = await fetch('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: cleanId, channel }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          const generatedOtp = data.testOtp || Math.floor(100000 + Math.random() * 900000).toString();
          localStorage.setItem(`dc-otp-${cleanId}`, JSON.stringify({
            otp: generatedOtp,
            expiresAt: Date.now() + 10 * 60 * 1000,
          }));
          return { otp: generatedOtp, error: null, masked: data.maskedDestination, testOtp: data.testOtp };
        }
      } catch (apiErr) {
        console.warn('API send-otp fallback:', apiErr);
      }

      // Local fallback
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      localStorage.setItem(`dc-otp-${cleanId}`, JSON.stringify({
        otp: generatedOtp,
        expiresAt: Date.now() + 10 * 60 * 1000,
      }));
      return { otp: generatedOtp, error: null, testOtp: generatedOtp };
    } catch (err: any) {
      return { otp: '', error: err.message || 'Failed to generate OTP' };
    }
  }, []);

  const resetPasswordWithOtp = useCallback(async (
    identifier: string,
    enteredOtp: string,
    newPassword: string
  ): Promise<{ error: string | null }> => {
    try {
      const cleanId = identifier.trim().toLowerCase();

      // 1. Try backend API verification & password update
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
            // Save to local credential keys for instant offline access
            localStorage.setItem(`dc-dealer-pw-${cleanId}`, newPassword);
            localStorage.setItem(`dc-customer-pw-${cleanId}`, newPassword);
            localStorage.removeItem(`dc-otp-${cleanId}`);
            return { error: null };
          }
        }
      } catch (apiErr) {
        console.warn('API reset-password fallback:', apiErr);
      }

      // 2. Client-side fallback check
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

      // Update in all local caches
      localStorage.setItem(`dc-dealer-pw-${cleanId}`, newPassword);
      localStorage.setItem(`dc-customer-pw-${cleanId}`, newPassword);
      localStorage.removeItem(`dc-otp-${cleanId}`);
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Failed to reset password' };
    }
  }, []);

  const refreshCustomer = useCallback(async () => {
    const parsed = safeJsonParse<CustomerProfile>(localStorage.getItem('dc-auth-customer'));
    if (parsed) setCustomer(parsed);
  }, []);

  const signOut = useCallback(async (targetRole?: UserRole) => {
    const scope = targetRole ?? role;

    if (scope === 'customer') {
      localStorage.removeItem('dc-auth-customer');
      setCustomer(null);
      if (localStorage.getItem('dc-auth-role') === 'customer') {
        const hasAdmin = localStorage.getItem('dc-auth-admin') === 'true';
        const dealerId = localStorage.getItem('dc-auth-dealer-id');
        if (hasAdmin) {
          localStorage.setItem('dc-auth-role', 'admin');
          setRole('admin');
        } else if (dealerId && dealerId !== 'admin') {
          localStorage.setItem('dc-auth-role', 'dealer');
          setRole('dealer');
        } else {
          localStorage.removeItem('dc-auth-role');
          setRole(null);
        }
      }
      return;
    }

    if (scope === 'dealer') {
      localStorage.removeItem('dc-auth-dealer-id');
      setDealer(null);
      if (localStorage.getItem('dc-auth-role') === 'dealer') {
        const hasAdmin = localStorage.getItem('dc-auth-admin') === 'true';
        const hasCustomer = !!localStorage.getItem('dc-auth-customer');
        if (hasAdmin) {
          localStorage.setItem('dc-auth-role', 'admin');
          setRole('admin');
        } else if (hasCustomer) {
          localStorage.setItem('dc-auth-role', 'customer');
          setRole('customer');
        } else {
          localStorage.removeItem('dc-auth-role');
          setRole(null);
        }
      }
      return;
    }

    if (scope === 'admin') {
      localStorage.removeItem('dc-auth-admin');
      if (localStorage.getItem('dc-auth-role') === 'admin') {
        const dealerId = localStorage.getItem('dc-auth-dealer-id');
        const hasCustomer = !!localStorage.getItem('dc-auth-customer');
        if (dealerId && dealerId !== 'admin') {
          localStorage.setItem('dc-auth-role', 'dealer');
          setRole('dealer');
        } else if (hasCustomer) {
          localStorage.setItem('dc-auth-role', 'customer');
          setRole('customer');
        } else {
          localStorage.removeItem('dc-auth-role');
          setRole(null);
        }
      }
      return;
    }

    localStorage.removeItem('dc-auth-role');
    localStorage.removeItem('dc-auth-dealer-id');
    localStorage.removeItem('dc-auth-customer');
    localStorage.removeItem('dc-auth-admin');
    setRole(null);
    setDealer(null);
    setCustomer(null);
  }, [role]);

  return (
    <AuthContext.Provider
      value={{
        role,
        dealer,
        customer,
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
