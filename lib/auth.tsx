'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from './supabase';
import type { Dealer, CustomerProfile } from './supabase';

export type UserRole = 'customer' | 'dealer' | 'admin';

type AuthContextType = {
  role: UserRole | null;
  dealer: Dealer | null;
  customer: CustomerProfile | null;
  loading: boolean;
  signIn: (email: string, password: string, role: UserRole) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  signUpCustomer: (email: string, password: string, fullName: string, phone: string, pinCode: string) => Promise<{ error: string | null }>;
  refreshCustomer: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const ADMIN_EMAILS = ['admin@dealerconnect.ai', 'admin@demo.in'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const restoreCustomer = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return false;

      const { data: profile } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile) {
        setCustomer(profile);
        setRole('customer');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const restore = async () => {
      try {
        const savedRole = localStorage.getItem('dc-auth-role') as UserRole | null;
        const savedDealerId = localStorage.getItem('dc-auth-dealer-id');

        if (savedRole === 'admin' && savedDealerId === 'admin') {
          if (mounted) {
            setRole('admin');
            setDealer(null);
            setLoading(false);
          }
          return;
        }

        if (savedRole === 'dealer' && savedDealerId) {
          const { data } = await supabase
            .from('dealers')
            .select('*, category:business_category_id(*)')
            .eq('id', savedDealerId)
            .maybeSingle();
          if (mounted) {
            setRole(data ? 'dealer' : null);
            setDealer(data);
            setLoading(false);
          }
          return;
        }

        const customerRestored = await restoreCustomer();
        if (mounted && !customerRestored) {
          setLoading(false);
        }
      } catch {
        if (mounted) setLoading(false);
      }
    };

    restore();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      (async () => { await restore(); })();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [restoreCustomer]);

  const signIn = useCallback(async (email: string, password: string, requestedRole: UserRole): Promise<{ error: string | null }> => {
    try {
      const lowerEmail = email.toLowerCase().trim();

      if (requestedRole === 'admin') {
        if (!ADMIN_EMAILS.includes(lowerEmail)) {
          return { error: 'This account does not have admin access.' };
        }
        if (password !== 'admin123') {
          return { error: 'Invalid admin password.' };
        }
        localStorage.setItem('dc-auth-role', 'admin');
        localStorage.setItem('dc-auth-dealer-id', 'admin');
        setRole('admin');
        setDealer(null);
        setCustomer(null);
        return { error: null };
      }

      if (requestedRole === 'dealer') {
        const { data: dealerRow, error: dbError } = await supabase
          .from('dealers')
          .select('*, category:business_category_id(*)')
          .eq('email', lowerEmail)
          .maybeSingle();

        if (dbError || !dealerRow) {
          return { error: 'No dealer account found with this email. Please register first.' };
        }

        if (dealerRow.status === 'pending') {
          return { error: 'Your registration is pending admin approval. Please wait for approval before logging in.' };
        }

        if (dealerRow.status === 'blocked' || dealerRow.status === 'suspended') {
          return { error: `Your account has been ${dealerRow.status}. Please contact support.` };
        }

        if (ADMIN_EMAILS.includes(lowerEmail)) {
          return { error: 'This is an admin email. Please use the admin login page.' };
        }

        localStorage.setItem('dc-auth-role', 'dealer');
        localStorage.setItem('dc-auth-dealer-id', dealerRow.id);
        setRole('dealer');
        setDealer(dealerRow);
        setCustomer(null);
        return { error: null };
      }

      if (requestedRole === 'customer') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: lowerEmail,
          password,
        });

        if (error) {
          return { error: error.message };
        }

        if (data.user) {
          const { data: profile } = await supabase
            .from('customer_profiles')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle();

          if (!profile) {
            return { error: 'No customer profile found. Please sign up first.' };
          }

          setCustomer(profile);
          setRole('customer');
          setDealer(null);
          return { error: null };
        }

        return { error: 'Login failed. Please try again.' };
      }

      return { error: 'Invalid role.' };
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

      const { data, error } = await supabase.auth.signUp({
        email: lowerEmail,
        password,
        options: {
          data: {
            full_name: fullName,
            phone,
            pin_code: pinCode,
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        const { error: profileError } = await supabase
          .from('customer_profiles')
          .insert({
            id: data.user.id,
            full_name: fullName,
            email: lowerEmail,
            phone,
            pin_code: pinCode,
          });

        if (profileError) {
          return { error: 'Account created but profile setup failed. Please try logging in.' };
        }

        const { data: profile } = await supabase
          .from('customer_profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profile) {
          setCustomer(profile);
          setRole('customer');
        }
      }

      return { error: null };
    } catch (e: any) {
      return { error: e.message ?? 'Sign up failed. Please try again.' };
    }
  }, []);

  const refreshCustomer = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      if (profile) setCustomer(profile);
    }
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem('dc-auth-role');
    localStorage.removeItem('dc-auth-dealer-id');
    await supabase.auth.signOut();
    setRole(null);
    setDealer(null);
    setCustomer(null);
  }, []);

  return (
    <AuthContext.Provider value={{ role, dealer, customer, loading, signIn, signOut, signUpCustomer, refreshCustomer }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
