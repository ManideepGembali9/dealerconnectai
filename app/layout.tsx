import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider, AppProvider } from '@/lib/providers';
import { AuthProvider } from '@/lib/auth';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Chatbot } from '@/components/chatbot';
import { TourGuide } from '@/components/tour-guide';
import { Toaster } from '@/components/ui/sonner';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { FloatingAiButton } from '@/components/floating-ai-button';
import { ServiceWorkerRegister } from '@/components/sw-register';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://dealerconnectai.bolt.host'),
  title: 'DealerConnect AI — Find Local Shops, Compare Prices Nearby',
  description:
    'AI-powered local dealer marketplace. Search products by name, image, voice, or PIN code to discover nearby shops, compare prices and stock, and get directions instantly.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'DealerConnect AI',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    viewportFit: 'cover',
  },
  themeColor: '#2563eb',
  openGraph: {
    title: 'DealerConnect AI — Find Local Shops, Compare Prices Nearby',
    description: 'Discover nearby local dealers for any product. Compare prices, check stock, get directions.',
    images: [{ url: 'https://bolt.new/static/og_default.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: [{ url: 'https://bolt.new/static/og_default.png' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <AppProvider>
            <AuthProvider>
              <div className="relative flex min-h-screen flex-col">
                <SiteHeader />
                <main className="flex-1 pb-16 md:pb-0">{children}</main>
                <SiteFooter />
              </div>
              <MobileBottomNav />
              <FloatingAiButton />
              <Chatbot />
              <TourGuide />
              <Toaster />
              <ServiceWorkerRegister />
            </AuthProvider>
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
