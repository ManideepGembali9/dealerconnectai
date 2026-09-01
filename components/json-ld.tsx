interface JsonLdProps {
  data: Record<string, any>;
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'DealerConnect AI',
    description: 'AI-powered local dealer marketplace. Search products by name, image, voice, or PIN code to discover nearby shops, compare prices and stock, and get directions instantly.',
    url: 'https://dealerconnectai.bolt.host',
    logo: 'https://dealerconnectai.bolt.host/icon.svg',
    sameAs: [],
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'DealerConnect AI',
    url: 'https://dealerconnectai.bolt.host',
    description: 'AI-powered local dealer marketplace. Search products, discover nearby dealers, compare prices, and connect instantly.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://dealerconnectai.bolt.host/search?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function productSchema(product: {
  name: string;
  description?: string;
  price: number;
  discount_price?: number | null;
  images?: string[];
  brand?: { name: string } | null;
  category?: { name: string } | null;
  dealer?: { shop_name: string; city: string; state: string } | null;
  id: string;
}) {
  const price = product.discount_price && product.discount_price > 0 ? product.discount_price : product.price;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description ?? `${product.name} from ${product.brand?.name ?? 'local dealer'}`,
    image: product.images ?? [],
    brand: {
      '@type': 'Brand',
      name: product.brand?.name ?? 'Unknown',
    },
    category: product.category?.name,
    offers: {
      '@type': 'Offer',
      price: price,
      priceCurrency: 'INR',
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'Store',
        name: product.dealer?.shop_name ?? 'Local Dealer',
        address: {
          '@type': 'PostalAddress',
          addressLocality: product.dealer?.city,
          addressRegion: product.dealer?.state,
        },
      },
    },
  };
}

export function dealerSchema(dealer: {
  shop_name: string;
  description?: string | null;
  city: string;
  state: string;
  address: string | null;
  phone: string | null;
  rating: number;
  rating_count: number;
  logo_url?: string | null;
  id: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: dealer.shop_name,
    description: dealer.description ?? `${dealer.shop_name} in ${dealer.city}, ${dealer.state}`,
    image: dealer.logo_url ?? undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: dealer.address ?? undefined,
      addressLocality: dealer.city,
      addressRegion: dealer.state,
    },
    telephone: dealer.phone ?? undefined,
    aggregateRating: dealer.rating_count > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: dealer.rating,
      reviewCount: dealer.rating_count,
    } : undefined,
  };
}

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
