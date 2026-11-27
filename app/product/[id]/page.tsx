import type { Metadata } from 'next';
import { ProductDetailClient } from '@/components/product-detail-client';
import { JsonLd, productSchema } from '@/components/json-ld';
import { fetchProductById } from '@/lib/data';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  try {
    const product = await fetchProductById(params.id);
    if (!product) {
      return {
        title: 'Product Not Found',
        description: 'The requested product is not available in local store inventories.',
      };
    }

    const priceText = product.discount_price ? `₹${product.discount_price}` : `₹${product.price}`;
    const dealerText = product.dealer ? ` at ${product.dealer.shop_name}` : '';
    const title = `${product.name} — Best Local Price ${priceText}${dealerText}`;
    const description =
      product.description ||
      `Buy ${product.name} with instant store pickup or local home delivery from verified neighborhood dealers.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: product.images?.[0] ? [{ url: product.images[0] }] : [],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: product.images?.[0] ? [product.images[0]] : [],
      },
    };
  } catch {
    return {
      title: 'Product Details',
    };
  }
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  let schema = null;
  try {
    const product = await fetchProductById(params.id);
    if (product) {
      schema = productSchema({
        name: product.name,
        description: product.description ?? undefined,
        price: product.price,
        discount_price: product.discount_price,
        images: product.images,
        brand: product.brand,
        category: product.category,
        dealer: product.dealer,
        id: product.id,
      });
    }
  } catch {}

  return (
    <>
      {schema && <JsonLd data={schema} />}
      <ProductDetailClient id={params.id} />
    </>
  );
}
