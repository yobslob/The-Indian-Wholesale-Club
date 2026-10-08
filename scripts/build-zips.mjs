#!/usr/bin/env node
/**
 * scripts/build-zips.mjs: builds checkout's ZIP → city and state list (D-087, D-098) from GeoNames' US postal codes.
 *
 *   node scripts/build-zips.mjs <path to US.txt>
 *
 * US.txt is inside https://download.geonames.org/export/zip/US.zip (CC BY 4.0, credited on the privacy page). Only the
 * ZIP, the place name and the state code are kept, for the 50 states and DC we deliver to (packages/shared us-states.ts);
 * the first row of a ZIP wins. Writes apps/web/features/checkout/zip-codes.json, read only on the server
 * (app/api/zip/route.ts), so the browser gets one answer at a time. Dependency-free.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const source = process.argv[2];
if (!source) {
  console.error('Usage: node scripts/build-zips.mjs <path to GeoNames US.txt>');
  process.exit(1);
}
const states = new Set(
  [...readFileSync('packages/shared/src/domain/us-states.ts', 'utf8').matchAll(/code: '([A-Z]{2})'/g)].map((m) => m[1]),
);
const zips = {};
for (const row of readFileSync(source, 'utf8').split('\n')) {
  // country, postal code, place name, state name, state code, ...
  const [country, zip, place, , state] = row.split('\t');
  if (country !== 'US' || !/^\d{5}$/.test(zip ?? '') || !states.has(state) || !place || zip in zips) continue;
  zips[zip] = `${place}|${state}`;
}
const sorted = Object.fromEntries(Object.entries(zips).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync('apps/web/features/checkout/zip-codes.json', `${JSON.stringify(sorted)}\n`);
console.log(`ZIP list: ${Object.keys(sorted).length} ZIP codes (the 50 states and DC).`);
