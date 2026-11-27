import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  themeColor: '#8b5cf6',
};

export const metadata: Metadata = {
  title: 'DealerConnect AI — Admin Control Center',
  description: 'Supervise marketplace operations, verify dealers, and control master catalog.',
  manifest: '/manifest-admin.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Admin Portal',
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
