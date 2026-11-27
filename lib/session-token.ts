import crypto from 'crypto';

export type PortalRole = 'customer' | 'dealer' | 'admin';

export const PORTAL_COOKIE_NAMES: Record<PortalRole, string> = {
  customer: 'dc_customer_session',
  dealer: 'dc_dealer_session',
  admin: 'dc_admin_session',
};

export type PortalSessionPayload = {
  role: PortalRole;
  sub: string;
  email: string;
  dealerId?: string;
  dealerStatus?: string;
  iat: number;
  exp: number;
};

function getSessionSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.OTP_SECRET ||
    process.env.SMTP_PASS ||
    process.env.TWILIO_AUTH_TOKEN ||
    'dealerconnect-portal-session-secret-2026'
  );
}

export function isValidPortalRole(value: unknown): value is PortalRole {
  return value === 'customer' || value === 'dealer' || value === 'admin';
}

export function signPortalSession(
  payload: Omit<PortalSessionPayload, 'iat' | 'exp'>,
  ttlSeconds = 7 * 24 * 60 * 60
): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: PortalSessionPayload = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  };
  const payloadB64 = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

export function verifyPortalSession(
  token: string | undefined | null,
  expectedRole: PortalRole
): PortalSessionPayload | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadB64, sig] = token.split('.', 2);
  if (!payloadB64 || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payloadB64)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as PortalSessionPayload;

    if (!parsed || parsed.role !== expectedRole) return null;
    if (!parsed.exp || Math.floor(Date.now() / 1000) > parsed.exp) return null;
    if (!parsed.sub || !parsed.email) return null;

    return parsed;
  } catch {
    return null;
  }
}

export function extractPortalCookie(
  cookieHeader: string | null,
  portal: PortalRole
): string | undefined {
  if (!cookieHeader) return undefined;
  const targetName = PORTAL_COOKIE_NAMES[portal];
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    if (key === targetName) {
      return decodeURIComponent(part.slice(eqIdx + 1).trim());
    }
  }
  return undefined;
}
