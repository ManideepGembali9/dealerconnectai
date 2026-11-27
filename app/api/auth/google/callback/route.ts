import { NextResponse } from 'next/server';
import {
  extractNamedCookie,
  getGoogleOAuthConfig,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_PENDING_COOKIE,
  sanitizeCustomerRedirect,
  signPendingGoogleProfile,
  verifyGoogleOAuthState,
} from '@/lib/google-oauth';
import { PORTAL_COOKIE_NAMES, signPortalSession } from '@/lib/session-token';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
};

function getRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return url.origin;
}

function redirectWithError(origin: string, code: string): NextResponse {
  const errUrl = new URL('/customer/login', origin);
  errUrl.searchParams.set('error', code);
  const res = NextResponse.redirect(errUrl, { headers: NO_STORE_HEADERS });
  res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return res;
}

/**
 * Customer-Only Google OAuth 2.0 Callback.
 * Verifies CSRF state, exchanges code server-side, fetches Google userinfo,
 * issues ONLY the customer HTTP-only session cookie, and forwards profile to /customer/callback.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getRequestOrigin(request);

  if (url.searchParams.get('error')) {
    return redirectWithError(origin, 'google_cancelled');
  }

  const code = url.searchParams.get('code');
  const queryStateRaw = url.searchParams.get('state');
  const cookieStateRaw = extractNamedCookie(
    request.headers.get('cookie'),
    GOOGLE_OAUTH_STATE_COOKIE
  );

  const verifiedQuery = verifyGoogleOAuthState(queryStateRaw);
  const verifiedCookie = verifyGoogleOAuthState(cookieStateRaw);

  if (!code || !verifiedQuery || !verifiedCookie || verifiedQuery.nonce !== verifiedCookie.nonce) {
    return redirectWithError(origin, 'google_state_invalid');
  }

  const config = getGoogleOAuthConfig(origin);
  if (!config.configured) {
    return redirectWithError(origin, 'google_not_configured');
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      return redirectWithError(origin, 'google_token_exchange_failed');
    }

    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      return redirectWithError(origin, 'google_token_missing');
    }

    const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });

    if (!profileRes.ok) {
      return redirectWithError(origin, 'google_userinfo_failed');
    }

    const profileJson = (await profileRes.json()) as {
      sub?: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    const email = typeof profileJson.email === 'string' ? profileJson.email.trim().toLowerCase() : '';
    const googleSub = typeof profileJson.sub === 'string' ? profileJson.sub.trim() : '';

    if (!email || !email.includes('@') || !googleSub) {
      return redirectWithError(origin, 'google_profile_incomplete');
    }

    const fullName =
      typeof profileJson.name === 'string' && profileJson.name.trim()
        ? profileJson.name.trim()
        : email.split('@')[0];
    const avatarUrl =
      typeof profileJson.picture === 'string' && profileJson.picture.trim()
        ? profileJson.picture.trim()
        : null;
    const safeNext = sanitizeCustomerRedirect(verifiedCookie.next, '/');
    const customerSub = `google-cust-${googleSub}`;

    // Sign ONLY the customer portal session cookie; never touch dealer or admin cookies
    const customerToken = signPortalSession(
      {
        role: 'customer',
        sub: customerSub,
        email,
      },
      14 * 24 * 60 * 60
    );

    const pendingToken = signPendingGoogleProfile({
      email,
      full_name: fullName,
      avatar_url: avatarUrl,
      google_sub: googleSub,
      next: safeNext,
    });

    const callbackPageUrl = new URL('/customer/callback', origin);
    const res = NextResponse.redirect(callbackPageUrl, { headers: NO_STORE_HEADERS });

    res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });
    res.cookies.set(PORTAL_COOKIE_NAMES.customer, customerToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 14 * 24 * 60 * 60,
    });
    res.cookies.set(GOOGLE_PENDING_COOKIE, pendingToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 300,
    });

    return res;
  } catch {
    return redirectWithError(origin, 'google_callback_failed');
  }
}
