import { z } from 'zod';

import { unwrap, type IwcClient } from '../client';

/** D-208: the countries IWC sells in (names only: never a rate, a service or a weight, non-negotiable 1). */
const countriesSchema = z.array(z.object({ code: z.string().regex(/^[a-z]{2}$/), name: z.string() }));
export type StoreCountry = z.infer<typeof countriesSchema>[number];

export async function getCountries(client: IwcClient): Promise<StoreCountry[]> {
  return countriesSchema.parse(unwrap(await client.rpc('store_countries', undefined, { get: true })));
}

/** D-208: prices in a country, in US cents: pieces (and their Heavy-item shipping), cards (cheapest option) and kits. */
export const countryPricesSchema = z
  .object({
    country: z.string(),
    variants: z.record(z.string(), z.object({ price: z.number().int(), heavy: z.number().int() })),
    products: z.record(z.string(), z.number().int()),
    recipes: z.record(z.string(), z.number().int()),
  })
  .nullable();
export type CountryPrices = z.infer<typeof countryPricesSchema>;

export async function getCountryPrices(
  client: IwcClient,
  country: string,
  /** Recipes by their slug. */
  ids: { variants: string[]; products: string[]; recipes: string[] },
): Promise<CountryPrices> {
  return countryPricesSchema.parse(
    unwrap(
      await client.rpc('store_country_prices', {
        p_country: country,
        p_variants: ids.variants.slice(0, 200),
        p_products: ids.products.slice(0, 200),
        p_recipes: ids.recipes.slice(0, 200),
      }),
    ),
  );
}
