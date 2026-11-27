import { Metadata } from 'next';
import { CartClient } from '@/components/cart-client';

export const metadata: Metadata = {
  title: 'My Shopping Cart',
  description: 'View items added to cart, review local dealer pricing, and place direct store inquiries.',
};

export default function CartPage() {
  return <CartClient />;
}
