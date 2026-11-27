import './globals.css';
import type { Metadata, Viewport } from 'next';
import { ThemeProvider, AppProvider } from '@/lib/providers';
import { AuthProvider } from '@/lib/auth';
import { ClientShell } from '@/components/client-shell';
import { PermissionPrompt } from '@/components/permission-prompt';
import { ServiceWorkerRegister } from '@/components/sw-register';
import { getAppUrl } from '@/lib/utils';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#D4AF37',
};

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: {
    default: 'DealerConnect AI — Find Local Shops, Compare Prices Nearby',
    template: '%s | DealerConnect AI',
  },
  description:
    'Smart local dealer marketplace. Discover nearby neighborhood shops, compare prices, check live stock, and buy directly from verified local dealers.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'DealerConnect AI',
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    siteName: 'DealerConnect AI',
    title: 'DealerConnect AI — Find Local Shops, Compare Prices Nearby',
    description: 'Discover nearby verified dealers for any product. Compare prices, check real-time stock, get directions.',
    images: [{ url: '/icons/icon-512x512.png', width: 512, height: 512, alt: 'DealerConnect AI' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DealerConnect AI — Find Local Shops, Compare Prices Nearby',
    description: 'Discover nearby verified dealers for any product. Compare prices, check real-time stock, get directions.',
    images: ['/icons/icon-512x512.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased text-foreground" suppressHydrationWarning>
        <ThemeProvider>
          <AppProvider>
            <AuthProvider>
              <ClientShell>{children}</ClientShell>
              <PermissionPrompt />
              <ServiceWorkerRegister />
            </AuthProvider>
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
