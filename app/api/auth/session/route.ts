import { NextResponse } from 'next/server';
import {
  extractPortalCookie,
  isValidPortalRole,
  PORTAL_COOKIE_NAMES,
  signPortalSession,
  verifyPortalSession,
} from '@/lib/session-token';
import {
  ADMIN_PW_COOKIE_NAME,
  extractCookieValue,
  verifyAdminPasswordOverrideToken,
} from '@/lib/otp-store';
import { verifyDealerLoginInServerDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_EMAILS = [
  'admin@dealerconnect.ai',
  'admin@demo.in',
  'admin@dealerconnectai.com',
];

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
};

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}

/**
 * Inspect independent portal authentication status via its own HTTP-only cookie.
 * GET /api/auth/session?portal=customer|dealer|admin
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const portalParam = url.searchParams.get('portal');

  if (portalParam) {
    if (!isValidPortalRole(portalParam)) {
      return NextResponse.json(
        { error: 'Invalid portal identifier' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
    const token = extractPortalCookie(request.headers.get('cookie'), portalParam);
    const verified = verifyPortalSession(token, portalParam);
    if (!verified) {
      return NextResponse.json(
        { authenticated: false, portal: portalParam },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }
    if (portalParam === 'dealer' && verified.dealerStatus !== 'approved') {
      return NextResponse.json(
        { authenticated: false, portal: 'dealer', error: 'Dealer account is not approved' },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }
    return NextResponse.json(
      { authenticated: true, portal: portalParam, session: verified },
      { headers: NO_STORE_HEADERS }
    );
  }

  // Return independent status for each portal without cross-contamination
  const cookieHeader = request.headers.get('cookie');
  const customerSession = verifyPortalSession(
    extractPortalCookie(cookieHeader, 'customer'),
    'customer'
  );
  const dealerSession = verifyPortalSession(
    extractPortalCookie(cookieHeader, 'dealer'),
    'dealer'
  );
  const adminSession = verifyPortalSession(
    extractPortalCookie(cookieHeader, 'admin'),
    'admin'
  );

  return NextResponse.json(
    {
      sessions: {
        customer: customerSession ? { authenticated: true, ...customerSession } : { authenticated: false },
        dealer:
          dealerSession && dealerSession.dealerStatus === 'approved'
            ? { authenticated: true, ...dealerSession }
            : { authenticated: false },
        admin: adminSession ? { authenticated: true, ...adminSession } : { authenticated: false },
      },
    },
    { headers: NO_STORE_HEADERS }
  );
}

/**
 * Issue a portal-scoped HMAC HTTP-only cookie after validating portal rules.
 * Never accepts arbitrary client role overrides or modifies other portals' cookies.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const portal = body?.portal;
    const emailRaw = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const sub = typeof body?.sub === 'string' ? body.sub.trim() : '';

    if (!isValidPortalRole(portal)) {
      return NextResponse.json(
        { error: 'Valid portal (customer, dealer, or admin) is required' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
    if (!emailRaw || !emailRaw.includes('@')) {
      return NextResponse.json(
        { error: 'Valid account email is required' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    // 1. ADMIN PORTAL AUTHENTICATION
    if (portal === 'admin') {
      if (!ADMIN_EMAILS.includes(emailRaw)) {
        return NextResponse.json(
          { error: 'This account does not have admin access.' },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }
      const configuredAdminPw = process.env.ADMIN_MASTER_PASSWORD;
      const expectedAdminPw = configuredAdminPw || 'admin123';
      const overrideCookie = extractCookieValue(request.headers.get('cookie'), ADMIN_PW_COOKIE_NAME);
      const overrideMatch = verifyAdminPasswordOverrideToken(emailRaw, password, overrideCookie);
      const passwordOk = password === expectedAdminPw || overrideMatch;
      if (!passwordOk) {
        return NextResponse.json(
          { error: 'Invalid admin credentials.' },
          { status: 401, headers: NO_STORE_HEADERS }
        );
      }

      const token = signPortalSession({
        role: 'admin',
        sub: `admin:${emailRaw}`,
        email: emailRaw,
      });
      const res = NextResponse.json(
        { success: true, portal: 'admin', email: emailRaw },
        { headers: NO_STORE_HEADERS }
      );
      res.cookies.set(PORTAL_COOKIE_NAMES.admin, token, cookieOptions(7 * 24 * 60 * 60));
      return res;
    }

    // 2. DEALER PORTAL AUTHENTICATION (approved dealers only)
    if (portal === 'dealer') {
      if (!password) {
        return NextResponse.json(
          { error: 'Dealer password is required.' },
          { status: 401, headers: NO_STORE_HEADERS }
        );
      }

      const verification = verifyDealerLoginInServerDb(emailRaw, password);
      if (!verification.ok || !verification.dealer) {
        const statusCode = verification.error?.toLowerCase().includes('password') ? 401 : 403;
        return NextResponse.json(
          { error: verification.error || 'Only approved dealers can access the Dealer Dashboard.' },
          { status: statusCode, headers: NO_STORE_HEADERS }
        );
      }

      const dealer = verification.dealer;
      const token = signPortalSession({
        role: 'dealer',
        sub: dealer.id,
        email: dealer.email.toLowerCase(),
        dealerId: dealer.id,
        dealerStatus: dealer.status,
      });
      const res = NextResponse.json(
        {
          success: true,
          portal: 'dealer',
          dealerId: dealer.id,
          email: dealer.email.toLowerCase(),
          dealer,
        },
        { headers: NO_STORE_HEADERS }
      );
      res.cookies.set(PORTAL_COOKIE_NAMES.dealer, token, cookieOptions(7 * 24 * 60 * 60));
      return res;
    }

    // 3. CUSTOMER PORTAL AUTHENTICATION
    const customerId = sub || `cust:${emailRaw}`;
    const token = signPortalSession({
      role: 'customer',
      sub: customerId,
      email: emailRaw,
    });
    const res = NextResponse.json(
      { success: true, portal: 'customer', customerId, email: emailRaw },
      { headers: NO_STORE_HEADERS }
    );
    res.cookies.set(PORTAL_COOKIE_NAMES.customer, token, cookieOptions(14 * 24 * 60 * 60));
    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Session authentication failed' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

/**
 * Independent portal logout: deletes ONLY the requested portal's cookie.
 */
export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const portalParam = url.searchParams.get('portal');

  if (!isValidPortalRole(portalParam)) {
    return NextResponse.json(
      { error: 'Specify ?portal=customer|dealer|admin' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const res = NextResponse.json(
    { success: true, loggedOutPortal: portalParam },
    { headers: NO_STORE_HEADERS }
  );
  res.cookies.set(PORTAL_COOKIE_NAMES[portalParam], '', cookieOptions(0));
  return res;
}
