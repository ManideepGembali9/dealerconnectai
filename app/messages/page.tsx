import { Suspense } from 'react';
import { MessagesClient } from '@/components/messages-client';

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="flex h-96 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>}>
      <MessagesClient />
    </Suspense>
  );
}
