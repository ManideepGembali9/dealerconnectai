'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Tag, Smartphone, ShoppingCart, Refrigerator, Apple, Shirt, Footprints,
  Gem, Circle, Sparkles, Pill, Wrench, Car, Dumbbell, BookOpen, Baby, Gift,
  Flower2, Sprout, Utensils, Cake, Watch, Glasses, Palette, Store,
  type LucideIcon
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fetchCategories } from '@/lib/data';
import type { Category } from '@/lib/supabase';

const ICON_MAP: Record<string, LucideIcon> = {
  Tag, Smartphone, ShoppingCart, Refrigerator, Apple, Shirt, Footprints,
  Gem, Circle, Sparkles, Pill, Wrench, Car, Dumbbell, BookOpen, Baby, Gift,
  Flower2, Sprout, Utensils, Cake, Watch, Glasses, Palette, Store,
};

export function CategoriesClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const cats = await fetchCategories();
        setCategories(cats);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">All Categories</h1>
        <p className="mt-2 text-sm text-muted-foreground">Browse every type of local business on the platform</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="h-12 w-12 animate-pulse rounded-full bg-muted" />
              <div className="mt-2 h-4 w-20 animate-pulse rounded bg-muted" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {categories.map((cat) => {
            const Icon = ICON_MAP[cat.icon] ?? Tag;
            return (
              <Link
                key={cat.id}
                href={`/search?category=${cat.slug}`}
                className="group flex flex-col items-center gap-3 rounded-xl border border-border/60 bg-card p-5 text-center transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 text-primary transition-all group-hover:from-primary group-hover:to-accent group-hover:text-primary-foreground">
                  <Icon className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{cat.name}</h3>
                  {cat.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{cat.description}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
