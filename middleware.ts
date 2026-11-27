import { NextResponse, type NextRequest } from 'next/server';

/**
 * Sets private no-store cache headers on portal & auth endpoints and isolates
 * portal routing metadata without breaking independent portal tabs.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  let portalContext: 'admin' | 'dealer' | 'customer' = 'customer';
  if (pathname.startsWith('/admin')) {
    portalContext = 'admin';
  } else if (pathname.startsWith('/dealer') && !/^\/dealer\/[^/]+$/.test(pathname)) {
    portalContext = 'dealer';
  }

  response.headers.set('X-Portal-Context', portalContext);

  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dealer') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/customer') ||
    pathname.startsWith('/messages') ||
    pathname.startsWith('/notifications')
  ) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|icons/|icon\\.svg|icon-192\\.svg|manifest.*\\.json|sw\\.js|offline\\.html).*)',
  ],
};
