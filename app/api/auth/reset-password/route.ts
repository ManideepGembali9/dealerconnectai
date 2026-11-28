import { NextResponse } from 'next/server';
import {
  ADMIN_PW_COOKIE_NAME,
  verifyResetToken,
  clearOtp,
  createAdminPasswordOverrideToken,
  extractCookieValue,
} from '@/lib/otp-store';
import { mutateServerDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_EMAILS = [
  'admin@dealerconnect.ai',
  'admin@demo.in',
  'admin@dealerconnectai.com',
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identifier, resetToken, newPassword } = body;

    if (!identifier || !resetToken || !newPassword) {
      return NextResponse.json(
        { error: 'Identifier, reset token, and new password are required' },
        { status: 400 }
      );
    }

    if (typeof newPassword !== 'string' || newPassword.length < 4) {
      return NextResponse.json(
        { error: 'Password must be at least 4 characters long' },
        { status: 400 }
      );
    }

    const cleanId = identifier.trim().toLowerCase();

    // Strictly verify OTP-issued reset token (via signed stateless cookie or server store)
    const resetCookie = extractCookieValue(request.headers.get('cookie'), 'dc_reset_session');
    const isValidToken = verifyResetToken(cleanId, String(resetToken), resetCookie);
    if (!isValidToken) {
      return NextResponse.json(
        { error: 'Invalid or expired password reset session. Please request a new OTP.' },
        { status: 401 }
      );
    }

    // Clear OTP from memory store and expire session cookies
    clearOtp(cleanId);

    // Sync dealer credential password in server-db if this identifier matches a dealer
    mutateServerDb((state) => {
      const matchedDealer = state.dealers.find((d) => d.email.toLowerCase() === cleanId);
      if (matchedDealer) {
        state.dealerCredentials[cleanId] = {
          dealerId: matchedDealer.id,
          email: cleanId,
          password: newPassword,
          status: matchedDealer.status,
        };
      }
    });

    const response = NextResponse.json({
      success: true,
      message: 'Password has been successfully updated! You can now sign in with your new password.',
    });
    if (ADMIN_EMAILS.includes(cleanId)) {
      const overrideTok = createAdminPasswordOverrideToken(cleanId, newPassword);
      response.cookies.set(ADMIN_PW_COOKIE_NAME, overrideTok, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
    }
    response.cookies.set('dc_otp_session', '', { path: '/', maxAge: 0 });
    response.cookies.set('dc_reset_session', '', { path: '/', maxAge: 0 });
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to update password' },
      { status: 500 }
    );
  }
}
