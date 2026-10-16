import type { AmazonRow, FlipkartCard } from '@repo/shared/sourcing/auto';
import type { Page } from 'playwright';

/**
 * What the runner reads inside a shop's page. Each function runs in the page (Playwright sends its source), so it
 * uses nothing from outside itself; the shared readers (packages/shared/src/sourcing/auto/readers) parse the result.
 */

export function amazonRows(page: Page): Promise<AmazonRow[]> {
  return page.evaluate(() => {
    const text = (el: Element | null | undefined) =>
      (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    return Array.from(
      document.querySelectorAll('div[data-component-type="s-search-result"][data-asin]'),
    )
      .slice(0, 60)
      .map((el) => ({
        asin: el.getAttribute('data-asin') ?? '',
        // the h2 alone: the title block also holds the "Sponsored" label
        title: text(el.querySelector('h2')),
        price: text(el.querySelector('.a-price:not(.a-text-price) .a-offscreen')),
        // the struck-through MRP, not the "(₹92.80/100 g)" unit price
        mrp: text(el.querySelector('.a-price[data-a-strike="true"] .a-offscreen')),
        delivery: text(el.querySelector('[data-cy="delivery-recipe"]')),
        rating: text(el.querySelector('.a-icon-alt')),
        count: text(
          el.querySelector('[data-cy="reviews-block"] .s-underline-text') ??
            el.querySelector('[data-cy="reviews-block"] a[aria-label]'),
        ),
        sponsored: !!el.querySelector('.puis-sponsored-label-text'),
        image: (el.querySelector('img.s-image') as HTMLImageElement | null)?.src ?? '',
      }));
  });
}

export function flipkartCards(page: Page): Promise<FlipkartCard[]> {
  return page.evaluate(() => {
    const out: { id: string; text: string; href: string; image: string }[] = [];
    const seen = new Set<string>();
    for (const card of Array.from(document.querySelectorAll('div[data-id]'))) {
      const id = card.getAttribute('data-id') ?? '';
      const link = card.querySelector('a[href*="/p/"]');
      if (!id || !link || seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        text: ((card as HTMLElement).innerText ?? '').slice(0, 800),
        href: link.getAttribute('href') ?? '',
        image: (card.querySelector('img') as HTMLImageElement | null)?.src ?? '',
      });
      if (out.length >= 48) break;
    }
    return out;
  });
}

export function myntraProducts(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    const w = window as unknown as {
      __myx?: { searchData?: { results?: { products?: unknown[] } } };
    };
    return (w.__myx?.searchData?.results?.products ?? []).slice(0, 40);
  });
}

/** Blinkit's page state for search or a product page (`ui.search` / `ui.pdp`), once it has products in it. */
export async function blinkitState(page: Page, part: 'search' | 'pdp'): Promise<unknown> {
  await page
    .waitForFunction(
      (p) => {
        const w = window as unknown as {
          __reduxStore__?: { getState(): { ui?: Record<string, unknown> } };
        };
        return JSON.stringify(w.__reduxStore__?.getState().ui?.[p] ?? {}).includes('product_id');
      },
      part,
      { timeout: 15_000 },
    )
    .catch(() => undefined);
  return page.evaluate((p) => {
    const w = window as unknown as {
      __reduxStore__?: { getState(): { ui?: Record<string, unknown> } };
    };
    return JSON.parse(JSON.stringify(w.__reduxStore__?.getState().ui?.[p] ?? null));
  }, part);
}

/** "15 MINS", "Delivery in 14 minutes": the quick-commerce promise shown on the page. */
export function etaText(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const m = (document.body?.innerText ?? '').match(
      /delivery in \d+\s*min[a-z]*|\b\d+\s*mins?\b/i,
    );
    return m ? m[0] : null;
  });
}

export function bigbasketSearch(page: Page, query: string): Promise<unknown> {
  return page.evaluate(async (q) => {
    const res = await fetch(
      `/listing-svc/v2/products?type=ps&slug=${encodeURIComponent(q)}&page=1`,
      {
        headers: { accept: 'application/json' },
      },
    );
    return res.ok ? res.json() : null;
  }, query);
}

export function nextData(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    const el = document.getElementById('__NEXT_DATA__');
    try {
      return el ? JSON.parse(el.textContent ?? 'null') : null;
    } catch {
      return null;
    }
  });
}

export function bodyText(page: Page): Promise<string> {
  return page.evaluate(() => (document.body?.innerText ?? '').slice(0, 50_000));
}

/**
 * JSON the page loads while it opens (Zepto, Instamart): every same-site JSON answer under 5 MB, plus the page's
 * embedded data. Call before opening the page; `done()` returns what arrived.
 */
export function collectJson(page: Page, site: string): { done(): Promise<unknown[]> } {
  const blobs: Promise<unknown>[] = [];
  const onResponse = (res: import('playwright').Response) => {
    const type = res.headers()['content-type'] ?? '';
    const len = Number(res.headers()['content-length'] ?? 0);
    if (!type.includes('json') || len > 5_000_000 || !new URL(res.url()).hostname.endsWith(site))
      return;
    blobs.push(res.json().catch(() => null));
  };
  page.on('response', onResponse);
  return {
    async done() {
      page.off('response', onResponse);
      const embedded = await nextData(page).catch(() => null);
      return [...(await Promise.all(blobs)), embedded].filter(Boolean);
    },
  };
}
