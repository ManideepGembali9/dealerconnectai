import { NextResponse } from 'next/server';
import {
  extractNamedCookie,
  GOOGLE_PENDING_COOKIE,
  sanitizeCustomerRedirect,
  verifyPendingGoogleProfile,
} from '@/lib/google-oauth';
import { PORTAL_COOKIE_NAMES, signPortalSession } from '@/lib/session-token';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
};

function clearPendingCookie(res: NextResponse) {
  res.cookies.set(GOOGLE_PENDING_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

/**
 * GET /api/auth/google/complete
 * Reads and clears the short-lived Google OAuth callback handoff cookie for /customer/callback.
 */
export async function GET(request: Request) {
  const token = extractNamedCookie(request.headers.get('cookie'), GOOGLE_PENDING_COOKIE);
  const pending = verifyPendingGoogleProfile(token);

  if (!pending) {
    const res = NextResponse.json(
      { authenticated: false, error: 'Google sign-in handoff expired or missing.' },
      { status: 401, headers: NO_STORE_HEADERS }
    );
    clearPendingCookie(res);
    return res;
  }

  const res = NextResponse.json(
    {
      authenticated: true,
      portal: 'customer',
      profile: {
        email: pending.email,
        full_name: pending.full_name,
        avatar_url: pending.avatar_url,
        google_sub: pending.google_sub,
        nextPath: sanitizeCustomerRedirect(pending.next, '/'),
      },
    },
    { headers: NO_STORE_HEADERS }
  );
  clearPendingCookie(res);
  return res;
}

/**
 * POST /api/auth/google/complete
 * Completes customer-only Google sign-in after interactive account selection
 * and sets ONLY the customer portal HTTP-only session cookie.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const emailRaw = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const customerId =
      typeof body?.customerId === 'string' && body.customerId.trim()
        ? body.customerId.trim()
        : `google-cust-${emailRaw}`;
    const safeNext = sanitizeCustomerRedirect(body?.next, '/');

    if (!emailRaw || !emailRaw.includes('@')) {
      return NextResponse.json(
        { error: 'Please select a valid Google email address.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    // Hardcode role: 'customer' so Google Sign-In can never mint dealer or admin sessions
    const customerToken = signPortalSession(
      {
        role: 'customer',
        sub: customerId,
        email: emailRaw,
      },
      14 * 24 * 60 * 60
    );

    const res = NextResponse.json(
      {
        success: true,
        portal: 'customer',
        customerId,
        email: emailRaw,
        nextPath: safeNext,
      },
      { headers: NO_STORE_HEADERS }
    );

    res.cookies.set(PORTAL_COOKIE_NAMES.customer, customerToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 14 * 24 * 60 * 60,
    });

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Could not complete Google customer login' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
