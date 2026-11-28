import { NextResponse } from 'next/server';
import {
  extractPortalCookie,
  verifyPortalSession,
  type PortalSessionPayload,
} from './session-token';
import { getServerDb, type RealtimeEvent } from './server-db';
import type { Dealer } from './types';

export type PortalAuthContext = {
  customer: PortalSessionPayload | null;
  dealer: PortalSessionPayload | null;
  dealerRecord: Dealer | null;
  admin: PortalSessionPayload | null;
};

export function getPortalAuthContext(request?: Request | { headers: Headers }): PortalAuthContext {
  const cookieHeader = request?.headers?.get('cookie') ?? null;
  const customer = verifyPortalSession(extractPortalCookie(cookieHeader, 'customer'), 'customer');
  const dealerRaw = verifyPortalSession(extractPortalCookie(cookieHeader, 'dealer'), 'dealer');
  const admin = verifyPortalSession(extractPortalCookie(cookieHeader, 'admin'), 'admin');

  let dealer: PortalSessionPayload | null = null;
  let dealerRecord: Dealer | null = null;
  if (dealerRaw && dealerRaw.dealerId) {
    const db = getServerDb();
    const matched = db.dealers.find((d) => d.id === dealerRaw.dealerId);
    if (matched && matched.status === 'approved') {
      dealer = dealerRaw;
      dealerRecord = matched;
    }
  }

  return {
    customer,
    dealer,
    dealerRecord,
    admin,
  };
}

export function unauthorizedResponse(message = 'Authentication required', status: 401 | 403 = 401) {
  return NextResponse.json({ error: message }, { status });
}

export function canClientReceiveRealtimeEvent(
  event: RealtimeEvent,
  auth: PortalAuthContext
): boolean {
  // Public catalog, dealers, approved/moderated reviews, categories, brands, settings update all portals
  if (
    event.topic === 'products' ||
    event.topic === 'dealers' ||
    event.topic === 'reviews' ||
    event.topic === 'categories' ||
    event.topic === 'brands' ||
    event.topic === 'settings'
  ) {
    return true;
  }

  if (auth.admin) {
    return true;
  }

  if (event.topic === 'moderation_logs') {
    return Boolean(auth.admin);
  }

  if (event.topic === 'enquiries') {
    if (auth.dealer && event.dealerId && auth.dealer.dealerId === event.dealerId) {
      return true;
    }
    if (
      auth.customer &&
      ((event.customerId && auth.customer.sub === event.customerId) ||
        (event.customerEmail && auth.customer.email.toLowerCase() === event.customerEmail.toLowerCase()))
    ) {
      return true;
    }
    return false;
  }

  if (event.topic === 'dealer_applications') {
    if (auth.customer && event.customerId && auth.customer.sub === event.customerId) {
      return true;
    }
    return false;
  }

  if (event.topic === 'notifications') {
    if (event.recipientRole === 'all') return true;
    if (event.recipientRole === 'dealer' && auth.dealer && event.dealerId === auth.dealer.dealerId) {
      return true;
    }
    if (
      event.recipientRole === 'customer' &&
      auth.customer &&
      ((event.customerId && auth.customer.sub === event.customerId) ||
        (event.customerEmail && auth.customer.email.toLowerCase() === event.customerEmail.toLowerCase()))
    ) {
      return true;
    }
    return false;
  }

  return false;
}
