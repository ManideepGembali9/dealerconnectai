import { MetadataRoute } from 'next';
import { getAppUrl } from '@/lib/utils';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getAppUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/customer/login',
          '/customer/signup',
          '/customer/forgot-password',
          '/customer/dashboard',
          '/customer/profile',
          '/customer/favorites',
          '/customer/search-history',
          '/customer/enquiries',
          '/customer/notifications',
          '/customer/settings',
          '/dealer/login',
          '/dealer/register',
          '/dealer',
          '/admin',
          '/admin/login',
          '/messages',
          '/profile',
          '/wishlist',
          '/notifications',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
