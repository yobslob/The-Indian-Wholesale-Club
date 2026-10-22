import {
  checkPage,
  type CheckSource,
  type SourceResult,
  type AddedItem,
} from '@repo/shared/sourcing/auto';

import { shopOf, type RunContext } from './context';
import { isBlocked, ShopResting } from './lanes';
import { errorText, log } from './log';
import { shopFor, type PageRead } from './shops';

/**
 * The weekly check (D-118): every due listing's pages are read again, each page once for all the sources on it; a
 * source its page could not price is read on its own item page. The database applies the result
 * (worker_sourcing_checked): prices follow the shop, stock follows the shop, a jump is held for an admin.
 */

export interface CheckTotals {
  products: number;
  prices: number;
  stock: number;
  held: number;
  errors: number;
}

async function readPage(
  ctx: RunContext,
  site: string,
  url: string,
): Promise<{ read: PageRead | null; error?: string; blocked?: boolean }> {
  try {
    const read = await shopFor(shopOf(ctx, site)?.reader ?? null).read(
      ctx.lanes.of(site),
      url,
      ctx.now,
    );
    ctx.stats.page(site);
    return { read };
  } catch (error) {
    if (!(error instanceof ShopResting)) ctx.stats.page(site, error);
    return { read: null, error: errorText(error), blocked: isBlocked(error) };
  }
}

async function checkProduct(
  ctx: RunContext,
  productId: string,
  name: string,
  sources: CheckSource[],
) {
  const pages = new Map<string, CheckSource[]>();
  for (const s of sources) pages.set(s.page_url, [...(pages.get(s.page_url) ?? []), s]);
  const results: SourceResult[] = [];
  const added: AddedItem[] = [];
  let blocked = false;
  await Promise.all(
    [...pages].map(async ([url, onPage]) => {
      const { read, error, blocked: refused } = await readPage(ctx, onPage[0]!.site, url);
      if (refused) blocked = true;
      const page = checkPage(onPage, read?.product ?? null, read?.pageDays ?? null, error);
      added.push(...page.added);
      for (const r of page.results) {
        const source = onPage.find((s) => s.id === r.id)!;
        if (r.ok || !read?.product || source.item_url === url) {
          results.push(r);
          continue;
        }
        // the family page did not price this item: its own page does
        const own = await readPage(ctx, source.site, source.item_url);
        if (own.blocked) blocked = true;
        results.push(
          checkPage(
            [{ ...source, page_url: source.item_url }],
            own.read?.product ?? null,
            own.read?.pageDays ?? null,
            own.error,
          ).results[0]!,
        );
      }
    }),
  );
  // D-149: a shop's robot check says nothing about the piece. Nothing is written, so no source counts a failure
  // (two take it out of use) and the listing stays due for the next run.
  if (blocked) {
    log(`  "${name}": a shop showed a robot check; checked on a later run`);
    return null;
  }
  const unread = results.filter((r) => !r.ok);
  if (unread.length)
    log(`  "${name}": ${unread.length} of ${results.length} unread (${unread[0]!.error})`);
  return ctx.db!.checked(productId, { sources: results, added });
}

export async function runChecks(ctx: RunContext): Promise<CheckTotals> {
  const totals: CheckTotals = { products: 0, prices: 0, stock: 0, held: 0, errors: 0 };
  log(`checking ${ctx.plan.checks.length} listing${ctx.plan.checks.length === 1 ? '' : 's'}`);
  await Promise.all(
    ctx.plan.checks.map(async (c) => {
      try {
        const r = await checkProduct(ctx, c.product_id, c.name, c.sources);
        if (!r) return;
        totals.products += 1;
        totals.prices += r.price_changes;
        totals.stock += r.stock_changes;
        totals.held += r.held;
        if (r.price_changes || r.stock_changes || r.held || r.added)
          log(
            `  "${c.name}": ${r.price_changes} price, ${r.stock_changes} stock, ${r.held} held, ${r.added} new`,
          );
      } catch (error) {
        totals.errors += 1;
        log(`  "${c.name}": check failed: ${errorText(error)}`);
      }
    }),
  );
  return totals;
}
