import { NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/otp-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identifier, otp } = body;

    if (!identifier || !otp) {
      return NextResponse.json(
        { error: 'Identifier and 6-digit OTP code are required' },
        { status: 400 }
      );
    }

    const cleanId = identifier.trim().toLowerCase();
    const cleanOtp = otp.toString().trim();

    // Check if Twilio Verify is configured for SMS
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

    if (!cleanId.includes('@') && accountSid && authToken && verifyServiceSid && cleanOtp !== '123456') {
      try {
        let phoneNum = cleanId.replace(/\D/g, '');
        if (phoneNum.length === 10) phoneNum = `+91${phoneNum}`;
        else if (!phoneNum.startsWith('+')) phoneNum = `+${phoneNum}`;

        const twilioUrl = `https://verify.twilio.com/v2/Services/${verifyServiceSid}/VerificationCheck`;
        const formData = new URLSearchParams();
        formData.append('To', phoneNum);
        formData.append('Code', cleanOtp);

        const res = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        });

        if (res.ok) {
          const checkData = await res.json();
          if (checkData.status === 'approved') {
            const resetToken = `tok-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            return NextResponse.json({
              success: true,
              message: 'OTP verified successfully via Twilio Verify',
              resetToken,
            });
          }
        }
      } catch (err: any) {
        console.warn('Twilio verification check notice:', err?.message);
      }
    }

    // Standard in-memory verification (supports generated OTP & test code 123456)
    const result = verifyOtp(cleanId, cleanOtp);
    if (!result.valid) {
      return NextResponse.json(
        { error: result.error || 'Invalid OTP code' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
      resetToken: result.resetToken,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to verify OTP' },
      { status: 500 }
    );
  }
}
