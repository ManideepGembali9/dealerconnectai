import { fetchCategories, fetchApprovedDealers, fetchProducts } from '@/lib/data';
import { getAppUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    (host && !host.includes('localhost') && !host.includes('127.0.0.1') ? `${proto}://${host}` : getAppUrl());
  const now = new Date().toISOString();

  interface SitemapEntry {
    url: string;
    priority: string;
    changefreq: string;
    lastmod?: string;
  }

  const staticUrls: SitemapEntry[] = [
    { url: baseUrl, priority: '1.0', changefreq: 'daily', lastmod: now },
    { url: `${baseUrl}/search`, priority: '0.9', changefreq: 'daily', lastmod: now },
    { url: `${baseUrl}/categories`, priority: '0.8', changefreq: 'weekly', lastmod: now },
    { url: `${baseUrl}/nearby`, priority: '0.8', changefreq: 'daily', lastmod: now },
    { url: `${baseUrl}/compare`, priority: '0.7', changefreq: 'weekly', lastmod: now },
    { url: `${baseUrl}/cart`, priority: '0.5', changefreq: 'monthly', lastmod: now },
  ];

  const dynamicUrls: SitemapEntry[] = [];

  try {
    const [categories, dealers, products] = await Promise.all([
      fetchCategories(),
      fetchApprovedDealers(100),
      fetchProducts({ limit: 200 }),
    ]);

    for (const cat of categories) {
      dynamicUrls.push({
        url: `${baseUrl}/search?category=${encodeURIComponent(cat.slug)}`,
        priority: '0.7',
        changefreq: 'weekly',
        lastmod: now,
      });
    }

    for (const dealer of dealers) {
      dynamicUrls.push({
        url: `${baseUrl}/dealer/${encodeURIComponent(dealer.id)}`,
        priority: '0.7',
        changefreq: 'weekly',
        lastmod: dealer.updated_at || now,
      });
    }

    for (const product of products) {
      dynamicUrls.push({
        url: `${baseUrl}/product/${encodeURIComponent(product.id)}`,
        priority: '0.8',
        changefreq: 'weekly',
        lastmod: product.created_at || now,
      });
    }
  } catch {}

  const allUrls = [...staticUrls, ...dynamicUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (item) => `  <url>
    <loc>${item.url}</loc>
    <lastmod>${item.lastmod || now}</lastmod>
    <changefreq>${item.changefreq}</changefreq>
    <priority>${item.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
    },
  });
}
