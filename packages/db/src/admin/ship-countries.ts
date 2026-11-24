import { unwrap, type IwcClient } from '../client';

/** D-208: one country's ShipGlobal route and the freight its prices carry (admin only, RLS). */
export async function getShipCountry(client: IwcClient, iso2: string) {
  return unwrap(
    await client
      .from('ship_countries')
      .select('iso2, name, inr_per_kg, inr_quote_1kg, service, days_min, days_max, open')
      .eq('iso2', iso2.toUpperCase())
      .maybeSingle(),
  );
}

/** Every country, for Admin → Settings → Countries. */
export async function listShipCountries(client: IwcClient) {
  return unwrap(
    await client
      .from('ship_countries')
      .select('iso2, name, inr_per_kg, inr_quote_1kg, service, days_min, days_max, open')
      .order('name'),
  );
}

/** Admin → Settings → Countries: a country's freight a kg and whether IWC sells there. */
export async function updateShipCountry(client: IwcClient, iso2: string, patch: { inr_per_kg?: number | null; open?: boolean }) {
  unwrap(await client.from('ship_countries').update(patch).eq('iso2', iso2.toUpperCase()));
}
