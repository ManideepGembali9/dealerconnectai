import { Suspense } from 'react';
import { SearchClient } from '@/components/search-client';

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex h-96 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>}>
      <SearchClient />
    </Suspense>
  );
}
