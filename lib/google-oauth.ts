import crypto from 'crypto';

export const GOOGLE_OAUTH_STATE_COOKIE = 'dc_google_oauth_state';
export const GOOGLE_PENDING_COOKIE = 'dc_google_pending';

export type GoogleOAuthStatePayload = {
  nonce: string;
  next: string;
  exp: number;
};

export type PendingGoogleProfile = {
  email: string;
  full_name: string;
  avatar_url: string | null;
  google_sub: string;
  next: string;
  exp: number;
};

function getOAuthSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.OTP_SECRET ||
    process.env.SMTP_PASS ||
    process.env.TWILIO_AUTH_TOKEN ||
    'dealerconnect-portal-session-secret-2026'
  );
}

/**
 * Ensures customer Google login redirects stay strictly within the Customer App.
 * Never allows open redirects or Dealer/Admin portal escalation.
 */
export function sanitizeCustomerRedirect(
  nextPath: string | null | undefined,
  fallback = '/'
): string {
  if (!nextPath || typeof nextPath !== 'string') return fallback;
  const trimmed = nextPath.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback;
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('/admin') ||
    lower.startsWith('/dealer') ||
    lower.startsWith('/api') ||
    lower.startsWith('/customer/callback')
  ) {
    return fallback;
  }
  return trimmed;
}

export function getGoogleOAuthConfig(requestOrigin?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || '';
  const baseOrigin = (
    process.env.NEXT_PUBLIC_APP_URL ||
    requestOrigin ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    `${baseOrigin}/api/auth/google/callback`;

  return {
    configured: Boolean(clientId && clientSecret),
    clientId,
    clientSecret,
    redirectUri,
  };
}

function signToken(payload: object): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getOAuthSecret())
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${sig}`;
}

function verifyToken<T extends { exp?: number }>(token: string | undefined | null): T | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadB64, sig] = token.split('.', 2);
  if (!payloadB64 || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getOAuthSecret())
    .update(payloadB64)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as T;
    if (!parsed?.exp || Math.floor(Date.now() / 1000) > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function createGoogleOAuthState(nextPath: string, ttlSeconds = 600) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload: GoogleOAuthStatePayload = {
    nonce,
    next: sanitizeCustomerRedirect(nextPath, '/'),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  return {
    nonce,
    signedToken: signToken(payload),
  };
}

export function verifyGoogleOAuthState(token: string | undefined | null): GoogleOAuthStatePayload | null {
  const parsed = verifyToken<GoogleOAuthStatePayload>(token);
  if (!parsed?.nonce || !parsed?.next) return null;
  return parsed;
}

export function signPendingGoogleProfile(
  profile: Omit<PendingGoogleProfile, 'exp'>,
  ttlSeconds = 300
): string {
  return signToken({
    ...profile,
    next: sanitizeCustomerRedirect(profile.next, '/'),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  });
}

export function verifyPendingGoogleProfile(
  token: string | undefined | null
): PendingGoogleProfile | null {
  const parsed = verifyToken<PendingGoogleProfile>(token);
  if (!parsed?.email || !parsed?.google_sub) return null;
  return parsed;
}

export function extractNamedCookie(
  cookieHeader: string | null,
  cookieName: string
): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    if (key === cookieName) {
      return decodeURIComponent(part.slice(eqIdx + 1).trim());
    }
  }
  return undefined;
}
