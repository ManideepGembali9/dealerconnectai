import { MetadataRoute } from 'next';
import { fetchCategories, fetchApprovedDealers, fetchProducts } from '@/lib/data';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://dealerconnectai.bolt.host';
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/search`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/ai-search`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/categories`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/nearby`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/compare`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
  ];

  const routes: MetadataRoute.Sitemap = [...staticRoutes];

  try {
    const [categories, dealers, products] = await Promise.all([
      fetchCategories(),
      fetchApprovedDealers(100),
      fetchProducts({ limit: 200 }),
    ]);

    for (const cat of categories) {
      routes.push({
        url: `${baseUrl}/search?category=${cat.slug}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
      });
    }

    for (const dealer of dealers) {
      routes.push({
        url: `${baseUrl}/dealer/${dealer.id}`,
        lastModified: dealer.updated_at ? new Date(dealer.updated_at) : now,
        changeFrequency: 'weekly',
        priority: 0.7,
      });
    }

    for (const product of products) {
      routes.push({
        url: `${baseUrl}/product/${product.id}`,
        lastModified: product.created_at ? new Date(product.created_at) : now,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  } catch (e) {
    console.error('Sitemap generation failed:', e);
  }

  return routes;
}
