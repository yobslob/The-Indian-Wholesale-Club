import 'server-only';

import { cookies } from 'next/headers';

import { parsePage, parsePageSize, sizeCookie, type PageSize } from './paging';

/** A list's page and page size: the address first, then the size this admin chose for the list last time. */
export async function readPaging(
  list: string,
  params: Record<string, string | string[] | undefined>,
  param = 'page',
): Promise<{ page: number; size: PageSize; offset: number }> {
  const jar = await cookies();
  const raw = params.size;
  const size = parsePageSize(Array.isArray(raw) ? raw[0] : raw, jar.get(sizeCookie(list))?.value);
  const page = parsePage(params[param]);
  return { page, size, offset: (page - 1) * size };
}
