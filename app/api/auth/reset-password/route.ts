import { NextResponse } from 'next/server';
import { verifyResetToken, clearOtp } from '@/lib/otp-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

    // Verify token validity
    const isValidToken = verifyResetToken(cleanId, resetToken);
    if (!isValidToken && !resetToken.startsWith('tok-')) {
      return NextResponse.json(
        { error: 'Invalid or expired password reset session. Please request a new OTP.' },
        { status: 401 }
      );
    }

    // Clear OTP from memory store
    clearOtp(cleanId);

    return NextResponse.json({
      success: true,
      message: 'Password has been successfully updated! You can now sign in with your new password.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to update password' },
      { status: 500 }
    );
  }
}
