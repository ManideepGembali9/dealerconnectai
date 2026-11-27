import { Suspense } from 'react';
import { HomeClient } from '@/components/home-client';
import { JsonLd, organizationSchema, websiteSchema } from '@/components/json-ld';

export default function HomePage() {
  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={websiteSchema()} />
      <Suspense fallback={<div className="flex h-96 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>}>
        <HomeClient />
      </Suspense>
    </>
  );
}
