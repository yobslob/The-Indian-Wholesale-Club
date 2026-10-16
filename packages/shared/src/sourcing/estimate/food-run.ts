import { foodWrites, weighFood, type FoodListing, type FoodResult, type FoodWrite } from './food';

/**
 * D-133, D-135: one pass over the food listings the database names (worker_food_plan), for the sourcing runner (each run)
 * and tools/weight-estimator (`pnpm weights food`, with its review sheet). Rules only, no model: about a millisecond a
 * listing. D-135: the real net weight, no packaging.
 */
export interface FoodPassDb {
  foodPlan(after: string | null, all: boolean): Promise<FoodListing[]>;
  setFoodWeights(writes: FoodWrite[]): Promise<number>;
}

export interface FoodPass {
  listings: number;
  options: number;
  written: number;
  /** Options whose net quantity nothing states: they keep what they have. */
  noNet: number;
  /** Every option looked at, for a review sheet. */
  rows: { listing: FoodListing; result: FoodResult }[];
}

export async function weighAllFood(
  db: FoodPassDb,
  opts: {
    all: boolean;
    dry: boolean;
    keep?: (page: FoodListing[]) => void;
    log?: (line: string) => void;
  },
): Promise<FoodPass> {
  const pass: FoodPass = { listings: 0, options: 0, written: 0, noNet: 0, rows: [] };
  let after: string | null = null;
  for (;;) {
    const page = await db.foodPlan(after, opts.all);
    if (!page.length) break;
    after = page[page.length - 1]!.product_id;
    const writes: FoodWrite[] = [];
    for (const listing of page) {
      const results = weighFood(listing);
      pass.listings += 1;
      pass.options += results.length;
      pass.noNet += results.filter((r) => !r.net).length;
      for (const result of results) pass.rows.push({ listing, result });
      writes.push(...foodWrites(results));
    }
    if (!opts.dry && writes.length) {
      opts.keep?.(page);
      for (let i = 0; i < writes.length; i += 500)
        pass.written += await db
          .setFoodWeights(writes.slice(i, i + 500))
          .catch((error: unknown) => {
            opts.log?.(
              `  writing food weights failed: ${error instanceof Error ? error.message : String(error)}`,
            );
            return 0;
          });
    }
  }
  return pass;
}
