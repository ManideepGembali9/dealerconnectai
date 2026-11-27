import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  themeColor: '#10b981',
};

export const metadata: Metadata = {
  title: 'DealerConnect AI — Merchant Portal',
  description: 'Manage your showroom inventory, pricing, and incoming customer leads.',
  manifest: '/manifest-dealer.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Dealer Portal',
  },
};

export default function DealerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
