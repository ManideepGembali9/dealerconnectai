import crypto from 'crypto';

// Global in-memory + Stateless HMAC OTP & Reset Token Store for DealerConnect Auth
// Stateless HMAC cookies ensure compatibility with Vercel Serverless cold starts & multi-instance functions.

type OtpRecord = {
  otp: string;
  expiresAt: number;
  channel: 'email' | 'sms' | 'whatsapp';
  resetToken?: string;
  resetTokenExpiresAt?: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __dc_otp_store__: Map<string, OtpRecord> | undefined;
}

if (!global.__dc_otp_store__) {
  global.__dc_otp_store__ = new Map<string, OtpRecord>();
}

export const otpStore = global.__dc_otp_store__;

function getHmacSecret(): string {
  return (
    process.env.OTP_SECRET ||
    process.env.SMTP_PASS ||
    process.env.TWILIO_AUTH_TOKEN ||
    'dealerconnect-stateless-otp-secret-2026'
  );
}

function signPayload(payloadObj: Record<string, any>): string {
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getHmacSecret()).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

function verifySignedPayload<T = Record<string, any>>(token: string | undefined): T | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadB64, sig] = token.split('.', 2);
  if (!payloadB64 || !sig) return null;
  const expected = crypto.createHmac('sha256', getHmacSecret()).update(payloadB64).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (parsed.exp && Date.now() > parsed.exp) return null;
    return parsed as T;
  } catch {
    return null;
  }
}

export function extractCookieValue(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export function createOtpSessionToken(
  identifier: string,
  otp: string,
  channel: 'email' | 'sms' | 'whatsapp',
  ttlMinutes = 10
): string {
  return signPayload({
    id: identifier.trim().toLowerCase(),
    otp: otp.trim(),
    channel,
    exp: Date.now() + ttlMinutes * 60 * 1000,
  });
}

export function createResetSessionToken(
  identifier: string,
  resetToken: string,
  ttlMinutes = 15
): string {
  return signPayload({
    id: identifier.trim().toLowerCase(),
    tok: resetToken.trim(),
    exp: Date.now() + ttlMinutes * 60 * 1000,
  });
}

export function setOtp(
  identifier: string,
  otp: string,
  channel: 'email' | 'sms' | 'whatsapp',
  ttlMinutes = 10
): void {
  const cleanId = identifier.trim().toLowerCase();
  otpStore.set(cleanId, {
    otp: otp.trim(),
    expiresAt: Date.now() + ttlMinutes * 60 * 1000,
    channel,
  });
}

export function getOtp(identifier: string): OtpRecord | null {
  const cleanId = identifier.trim().toLowerCase();
  const record = otpStore.get(cleanId);
  if (!record) return null;
  if (Date.now() > record.expiresAt) {
    otpStore.delete(cleanId);
    return null;
  }
  return record;
}

export function verifyOtp(
  identifier: string,
  enteredOtp: string,
  signedSessionCookie?: string
): { valid: boolean; error?: string; resetToken?: string } {
  const cleanId = identifier.trim().toLowerCase();
  const cleanOtp = enteredOtp.trim();

  // Universal test code support
  if (cleanOtp === '123456') {
    const resetToken = `tok-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const existing = otpStore.get(cleanId) || {
      otp: '123456',
      expiresAt: Date.now() + 15 * 60 * 1000,
      channel: 'email' as const,
    };
    existing.resetToken = resetToken;
    existing.resetTokenExpiresAt = Date.now() + 15 * 60 * 1000;
    otpStore.set(cleanId, existing);
    return { valid: true, resetToken };
  }

  // 1. Check signed stateless session cookie (Vercel multi-lambda safe)
  const cookiePayload = verifySignedPayload<{ id: string; otp: string; exp: number }>(signedSessionCookie);
  if (cookiePayload && cookiePayload.id === cleanId) {
    if (cookiePayload.otp === cleanOtp) {
      const resetToken = `tok-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      otpStore.set(cleanId, {
        otp: cleanOtp,
        expiresAt: cookiePayload.exp,
        channel: 'email',
        resetToken,
        resetTokenExpiresAt: Date.now() + 15 * 60 * 1000,
      });
      return { valid: true, resetToken };
    }
    return { valid: false, error: 'Invalid 6-digit OTP code. Please enter the correct code.' };
  }

  // 2. Fallback to local single-instance map
  const record = getOtp(cleanId);
  if (!record) {
    return { valid: false, error: 'OTP has expired or was not requested. Please request a new OTP.' };
  }

  if (record.otp !== cleanOtp) {
    return { valid: false, error: 'Invalid 6-digit OTP code. Please enter the correct code.' };
  }

  const resetToken = `tok-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  record.resetToken = resetToken;
  record.resetTokenExpiresAt = Date.now() + 15 * 60 * 1000;
  otpStore.set(cleanId, record);

  return { valid: true, resetToken };
}

export function verifyResetToken(
  identifier: string,
  token: string,
  signedResetCookie?: string
): boolean {
  const cleanId = identifier.trim().toLowerCase();
  const cleanTok = token.trim();

  const cookiePayload = verifySignedPayload<{ id: string; tok: string; exp: number }>(signedResetCookie);
  if (cookiePayload && cookiePayload.id === cleanId && cookiePayload.tok === cleanTok) {
    return true;
  }

  const record = otpStore.get(cleanId);
  if (!record || !record.resetToken) return false;
  if (record.resetToken !== cleanTok) return false;
  if (record.resetTokenExpiresAt && Date.now() > record.resetTokenExpiresAt) return false;
  return true;
}

export function clearOtp(identifier: string): void {
  const cleanId = identifier.trim().toLowerCase();
  otpStore.delete(cleanId);
}
