import { NextResponse } from 'next/server';
import { getPortalAuthContext, unauthorizedResponse } from '@/lib/server-auth';
import { getServerDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = getPortalAuthContext(request);
  if (!auth.admin) {
    return unauthorizedResponse('Only Admins can access moderation audit logs.', 403);
  }

  const db = getServerDb();
  return NextResponse.json({
    moderationLogs: db.moderationLogs,
    reviewReports: db.reviewReports,
  });
}
