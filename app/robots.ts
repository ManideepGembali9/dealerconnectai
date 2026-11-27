import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dealerconnectai.app';
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
