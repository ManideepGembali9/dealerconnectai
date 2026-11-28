import { NextResponse } from 'next/server';
import { getPortalAuthContext } from '@/lib/server-auth';
import { getServerDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = getPortalAuthContext(request);
  const db = getServerDb();

  const isAdmin = Boolean(auth.admin);
  const dealerId = auth.dealer?.dealerId ?? null;
  const customerId = auth.customer?.sub ?? null;
  const customerEmail = auth.customer?.email?.toLowerCase() ?? null;

  const visibleDealers = isAdmin
    ? db.dealers
    : db.dealers.filter((d) => d.status === 'approved' || (dealerId && d.id === dealerId));

  const visibleReviews = isAdmin
    ? db.reviews
    : db.reviews.filter((r) => {
        if (r.is_approved !== false && !r.is_hidden) return true;
        if (
          customerId &&
          (r.customer_id === customerId ||
            (customerEmail && r.customer_email?.toLowerCase() === customerEmail))
        ) {
          return true;
        }
        return false;
      });

  const visibleEnquiries = isAdmin
    ? db.enquiries
    : db.enquiries.filter((e) => {
        if (dealerId && e.dealer_id === dealerId) return true;
        if (
          customerId &&
          (e.customer_id === customerId ||
            (customerEmail && e.customer_email?.toLowerCase() === customerEmail))
        ) {
          return true;
        }
        return false;
      });

  const visibleApplications = isAdmin
    ? db.dealerApplications
    : customerId
      ? db.dealerApplications.filter(
          (a) =>
            a.customer_id === customerId ||
            (customerEmail && a.email.toLowerCase() === customerEmail)
        )
      : [];

  const visibleNotifications = db.notifications.filter((n) => {
    if (n.recipient_role === 'admin') return isAdmin;
    if (n.recipient_role === 'dealer') return Boolean(dealerId && n.recipient_id === dealerId);
    if (n.recipient_role === 'customer') {
      return Boolean(
        customerId &&
          (n.recipient_id === customerId ||
            (customerEmail && n.recipient_id?.toLowerCase() === customerEmail))
      );
    }
    return false;
  });

  return NextResponse.json({
    categories: db.categories,
    brands: db.brands,
    dealers: visibleDealers,
    dealerApplications: visibleApplications,
    products: db.products,
    enquiries: visibleEnquiries,
    reviews: visibleReviews,
    reviewReports: isAdmin ? db.reviewReports : [],
    moderationLogs: isAdmin ? db.moderationLogs : [],
    notifications: visibleNotifications,
    pushNotifications: isAdmin ? db.pushNotifications : [],
    platformSettings: db.platformSettings,
    appSettings: db.appSettings,
    updatedAt: db.updatedAt,
    sessions: {
      customer: Boolean(auth.customer),
      dealer: Boolean(auth.dealer),
      admin: isAdmin,
    },
  });
}
