import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Compass, Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <div className="relative mb-6">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/10 text-primary shadow-inner">
          <Compass className="h-12 w-12 animate-pulse" />
        </div>
        <div className="absolute -bottom-2 -right-2 rounded-full bg-background px-2.5 py-0.5 text-xs font-bold text-muted-foreground shadow-sm border border-border">
          404
        </div>
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
        Page Not Found
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        The page you are looking for doesn&apos;t exist or has been moved to a new address.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/">
          <Button className="gap-2 shadow-sm">
            <Home className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <Link href="/search">
          <Button variant="outline" className="gap-2">
            <Search className="h-4 w-4" />
            Search Products
          </Button>
        </Link>
      </div>
    </div>
  );
}
