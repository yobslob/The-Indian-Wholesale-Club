import type { Lanes } from './browser';
import type { Db } from './db';
import type { ShopStats } from './log';
import type { SourcingPlan, SourcingShop } from '@repo/shared/sourcing/auto';

/** Everything a run shares. `db` is null on a dry run (`try`): nothing is written. */
export interface RunContext {
  db: Db | null;
  plan: SourcingPlan;
  lanes: Lanes;
  stats: ShopStats;
  known: Set<string>;
  now: Date;
}

export const shopOf = (ctx: RunContext, site: string): SourcingShop | undefined =>
  ctx.plan.shops.find((s) => s.site === site);

/** The shops the founder named (D-118), for a dry run without the database. Same as the migration's list. */
export const DEFAULT_SHOPS: SourcingShop[] = [
  {
    site: 'blinkit.com',
    label: 'Blinkit',
    reader: 'blinkit',
    product_types: ['food', 'home'],
    delivery_days: 3,
  },
  {
    site: 'zepto.com',
    label: 'Zepto',
    reader: 'zepto',
    product_types: ['food', 'home'],
    delivery_days: 3,
  },
  {
    site: 'swiggy.com',
    label: 'Instamart',
    reader: 'instamart',
    product_types: ['food', 'home'],
    delivery_days: 3,
  },
  {
    site: 'bigbasket.com',
    label: 'BigBasket',
    reader: 'bigbasket',
    product_types: ['food', 'home'],
    delivery_days: 3,
  },
  {
    site: 'amazon.in',
    label: 'Amazon India',
    reader: 'amazon',
    product_types: ['clothing', 'food', 'home'],
    delivery_days: null,
  },
  {
    site: 'flipkart.com',
    label: 'Flipkart',
    reader: 'flipkart',
    product_types: ['clothing', 'food', 'home'],
    delivery_days: null,
  },
  {
    site: 'myntra.com',
    label: 'Myntra',
    reader: 'myntra',
    product_types: ['clothing'],
    delivery_days: 3,
  },
  {
    site: 'oyela.in',
    label: 'Oyela',
    reader: 'shopify',
    product_types: ['clothing'],
    delivery_days: 3,
  },
  {
    site: 'nishorama.com',
    label: 'Nishorama',
    reader: 'shopify',
    product_types: ['clothing'],
    delivery_days: 3,
  },
  {
    site: 'offduty.in',
    label: 'Offduty',
    reader: 'shopify',
    product_types: ['clothing'],
    delivery_days: 3,
  },
];
