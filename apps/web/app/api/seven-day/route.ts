import { NextResponse } from 'next/server';
import { z } from 'zod';

import { MOST, PAGE } from '@/features/catalog/browse-query';
import { quickPageCached } from '@/features/catalog/data';
import { limitRequestLocal } from '@/lib/rate-limit';

const category = z.string().regex(/^[a-z0-9-]{1,80}$/).nullable().catch(null);
const offset = z.coerce.number().int().min(0).max(MOST).catch(0);
const limit = z.coerce.number().int().min(1).max(MOST).catch(PAGE);

/**
 * The 7-day page's category pills and Show more without reloading it (D-148): one page of light cards from the same
 * cached store_quick_browse() read the page uses. Nothing a customer may not see (D-003, D-017).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const limited = limitRequestLocal(request.headers, 'browse');
  if (limited) return limited;
  const params = new URL(request.url).searchParams;
  const from = offset.parse(params.get('offset') ?? 0);
  const count = Math.min(limit.parse(params.get('limit') ?? PAGE), MOST - from);
  if (count <= 0) return NextResponse.json({ error: 'No more pieces on one page.' }, { status: 400 });
  return NextResponse.json(await quickPageCached(category.parse(params.get('category')), from, count));
}
