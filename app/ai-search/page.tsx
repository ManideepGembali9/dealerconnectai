import { Suspense } from 'react';
import { AiSearchClient } from '@/components/ai-search-client';

export default function AiSearchPage() {
  return (
    <Suspense fallback={<div className="flex h-96 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>}>
      <AiSearchClient />
    </Suspense>
  );
}
