import { NextResponse } from 'next/server';
import {
  createGoogleOAuthState,
  getGoogleOAuthConfig,
  GOOGLE_OAUTH_STATE_COOKIE,
  sanitizeCustomerRedirect,
} from '@/lib/google-oauth';

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

/**
 * Starts Customer-Only Google OAuth flow.
 * - When GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET are configured on the server,
 *   generates an HMAC-signed CSRF state and points to Google's account selector
 *   (`prompt=select_account`).
 * - When OAuth env vars are absent in local/demo mode, instructs the client UI
 *   to present the interactive Google account selector safely without leaking secrets.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const safeNext = sanitizeCustomerRedirect(url.searchParams.get('next'), '/');
  const wantsJson =
    url.searchParams.get('format') === 'json' ||
    request.headers.get('accept')?.includes('application/json');

  const origin = getRequestOrigin(request);
  const config = getGoogleOAuthConfig(origin);

  if (!config.configured) {
    if (wantsJson) {
      return NextResponse.json(
        {
          mode: 'account_picker',
          portal: 'customer',
          nextPath: safeNext,
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    const fallbackUrl = new URL('/customer/login', origin);
    fallbackUrl.searchParams.set('google', 'picker');
    fallbackUrl.searchParams.set('redirect', safeNext);
    return NextResponse.redirect(fallbackUrl, { headers: NO_STORE_HEADERS });
  }

  const { signedToken } = createGoogleOAuthState(safeNext);
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', config.clientId);
  googleAuthUrl.searchParams.set('redirect_uri', config.redirectUri);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid email profile');
  googleAuthUrl.searchParams.set('prompt', 'select_account');
  googleAuthUrl.searchParams.set('access_type', 'online');
  googleAuthUrl.searchParams.set('state', signedToken);

  const response = wantsJson
    ? NextResponse.json(
        {
          mode: 'oauth',
          portal: 'customer',
          authUrl: googleAuthUrl.toString(),
          nextPath: safeNext,
        },
        { headers: NO_STORE_HEADERS }
      )
    : NextResponse.redirect(googleAuthUrl.toString(), { headers: NO_STORE_HEADERS });

  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, signedToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  });

  return response;
}
