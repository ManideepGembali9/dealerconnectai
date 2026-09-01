import { ProductDetailClient } from '@/components/product-detail-client';
import { JsonLd, productSchema } from '@/components/json-ld';
import { fetchProductById } from '@/lib/data';

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
  } catch { /* schema is optional */ }

  return (
    <>
      {schema && <JsonLd data={schema} />}
      <ProductDetailClient id={params.id} />
    </>
  );
}
