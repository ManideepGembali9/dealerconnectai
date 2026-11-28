import { NextResponse } from 'next/server';
import { getPortalAuthContext, unauthorizedResponse } from '@/lib/server-auth';
import { getServerDb, mutateServerDb } from '@/lib/server-db';
import type { Brand, Category } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const db = getServerDb();
  return NextResponse.json({
    categories: db.categories,
    brands: db.brands,
    platformSettings: db.platformSettings,
    appSettings: db.appSettings,
  });
}

export async function POST(request: Request) {
  try {
    const auth = getPortalAuthContext(request);
    if (!auth.admin) {
      return unauthorizedResponse('Admin authorization required to modify catalog metadata.', 403);
    }

    const body = await request.json();
    const kind = body?.kind as 'category' | 'brand' | 'platform_settings' | 'app_settings';

    const result = mutateServerDb((state, emit) => {
      if (kind === 'category' && body?.item) {
        const item = body.item as Category;
        const idx = state.categories.findIndex((c) => c.id === item.id);
        if (idx >= 0) state.categories[idx] = item;
        else state.categories = [...state.categories, item];
        emit({ topic: 'categories', action: idx >= 0 ? 'updated' : 'created', recordId: item.id });
        return { categories: state.categories };
      }
      if (kind === 'brand' && body?.item) {
        const item = body.item as Brand;
        const idx = state.brands.findIndex((b) => b.id === item.id);
        if (idx >= 0) state.brands[idx] = item;
        else state.brands = [...state.brands, item];
        emit({ topic: 'brands', action: idx >= 0 ? 'updated' : 'created', recordId: item.id });
        return { brands: state.brands };
      }
      if (kind === 'platform_settings' && body?.item) {
        state.platformSettings = { ...state.platformSettings, ...body.item };
        emit({ topic: 'settings', action: 'updated' });
        return { platformSettings: state.platformSettings };
      }
      if (kind === 'app_settings' && body?.item) {
        state.appSettings = { ...state.appSettings, ...body.item };
        emit({ topic: 'settings', action: 'updated' });
        return { appSettings: state.appSettings };
      }
      return { error: 'Invalid metadata payload', status: 400 as const };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save metadata';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = getPortalAuthContext(request);
    if (!auth.admin) {
      return unauthorizedResponse('Admin authorization required.', 403);
    }

    const { searchParams } = new URL(request.url);
    const kind = searchParams.get('kind');
    const id = searchParams.get('id');
    if (!kind || !id) {
      return NextResponse.json({ error: 'kind and id are required' }, { status: 400 });
    }

    const result = mutateServerDb((state, emit) => {
      if (kind === 'category') {
        state.categories = state.categories.filter((c) => c.id !== id);
        emit({ topic: 'categories', action: 'deleted', recordId: id });
      } else if (kind === 'brand') {
        state.brands = state.brands.filter((b) => b.id !== id);
        emit({ topic: 'brands', action: 'deleted', recordId: id });
      }
      return { deleted: true };
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete metadata';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
