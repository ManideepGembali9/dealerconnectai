import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  themeColor: '#8b5cf6',
};

export const metadata: Metadata = {
  title: 'DealerConnect AI — Admin Control Center',
  description: 'Supervise marketplace operations, verify dealers, and control master catalog.',
  manifest: '/manifest-admin.json',
  icons: {
    icon: '/icons/admin-192x192.png',
    apple: '/icons/admin-192x192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Admin App',
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
