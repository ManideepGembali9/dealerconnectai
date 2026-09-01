import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
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
    sitemap: 'https://dealerconnectai.bolt.host/sitemap.xml',
  };
}
