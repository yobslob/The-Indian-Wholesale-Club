#!/usr/bin/env node
/**
 * scripts/dev-photo-e2e.mjs: puts one vendor piece in the LOCAL database for the photo worker (V4, D-103), going
 * through the vendor's real storage rules on the way.
 *
 *   pnpm dev:photo-e2e <front> <back> <closeup> [--house=<front image>,<back image>] [--category=kurtas] [--wears=women]
 *
 * 1. makes (or refreshes) the local worker account (role worker) and prints the worker's settings;
 * 2. makes a local vendor account for the first active vendor and signs in AS that vendor;
 * 3. uploads the three photos with the vendor's own session, checks another vendor's folder is refused, sends the piece;
 * 4. with --house, puts a house model in place (product-media/house-models/dev-model/).
 * Then: tools/photo-worker/.venv/Scripts/python tools/photo-worker/worker.py --once (once per view).
 * Reads apps/web/.env.local; refuses anything but local Supabase. Run `pnpm dev:admin` again after a `db` reset.
 */
import { existsSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';

import { createClient } from '@supabase/supabase-js';

for (const file of ['apps/web/.env.local', 'apps/web/.env']) {
  if (existsSync(file)) process.loadEnvFile(file);
}
const args = process.argv.slice(2);
const flag = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const [front, back, closeup] = args.filter((a) => !a.startsWith('--'));
if (![front, back, closeup].every((f) => f && existsSync(f))) {
  console.error('Usage: pnpm dev:photo-e2e <front> <back> <closeup> [--house=<front>,<back>] [--category=kurtas] [--wears=women]');
  process.exit(2);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!['127.0.0.1', 'localhost', '::1'].includes(new URL(url || 'http://unset').hostname) || !anonKey || !serviceKey) {
  console.error(`Refusing: local Supabase URL and keys needed in apps/web/.env.local ("${url || 'unset'}").`);
  process.exit(2);
}
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, serviceKey, opts);
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};
const type = (file) => ({ '.png': 'image/png', '.webp': 'image/webp' })[extname(file).toLowerCase()] ?? 'image/jpeg';

async function account(email, password) {
  const { data } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (data.user) return data.user.id;
  const users = must(await service.auth.admin.listUsers({ perPage: 1000 }), 'list users').users;
  const user = users.find((u) => u.email === email);
  must(await service.auth.admin.updateUserById(user.id, { password }), 'reset password');
  return user.id;
}

// 1. the worker
const workerEmail = 'photo-worker@iwc.local';
const workerPassword = 'local-worker-password';
const workerId = await account(workerEmail, workerPassword);
must(await service.from('profiles').update({ role: 'worker' }).eq('id', workerId), 'worker role');

// 2. a vendor account, signed in as the vendor
const vendors = must(await service.from('vendors').select('id, shop_name').eq('status', 'active').order('created_at').limit(2), 'vendors');
if (vendors.length === 0) throw new Error('No active vendor in the local database (seeded by the catalogue).');
const [vendor, otherVendor] = vendors;
const vendorEmail = 'vendor-dev@vendors.iwc.local';
const vendorId = await account(vendorEmail, 'local-vendor-password');
must(await service.rpc('_link_vendor_account', { p_user: vendorId, p_vendor: vendor.id, p_language: 'hi', p_by: null }), 'link');
const asVendor = createClient(url, anonKey, opts);
must(await asVendor.auth.signInWithPassword({ email: vendorEmail, password: 'local-vendor-password' }), 'vendor sign-in');

// 3. the piece
const category = must(await service.from('categories').select('id').eq('slug', flag('category', 'kurtas')).single(), 'category');
const submission = must(await asVendor.rpc('vendor_new_submission', { p_type: 'clothing' }), 'new submission');
for (const [view, file] of [['front', front], ['back', back], ['closeup', closeup]]) {
  const path = `${vendor.id}/${submission}/${view}${extname(file).toLowerCase()}`;
  must(await asVendor.storage.from('vendor-uploads').upload(path, readFileSync(file), { contentType: type(file), upsert: true }), `upload ${view}`);
  must(await asVendor.rpc('vendor_add_photo', { p_submission: submission, p_view: view, p_path: path, p_checks: {} }), `record ${view}`);
}
must(await asVendor.rpc('vendor_submit', {
  p_submission: submission,
  p_details: { category_id: category.id, wears: flag('wears', 'women'), fabric: 'Cotton', shop_price_paise: 120000, variants: [{ label: 'M', qty: 2 }] },
}), 'submit');

// 4. a house model
const house = flag('house');
if (house) {
  const [houseFront, houseBack] = house.split(',');
  for (const [name, file] of [['front', houseFront], ['back', houseBack]]) {
    must(await service.storage.from('product-media').upload(`house-models/dev-model/${name}.jpg`, readFileSync(file), { contentType: type(file), upsert: true }), `house ${name}`);
  }
  must(await service.from('house_models').upsert({ slug: 'dev-model', label: 'Dev model', wears: flag('wears', 'women') === 'men' ? 'men' : 'women', front_path: 'house-models/dev-model/front.jpg', back_path: 'house-models/dev-model/back.jpg' }, { onConflict: 'slug' }), 'house model');
}

// Last, with a 1-byte body: storage refuses before reading the body, and Node would reuse that connection.
if (otherVendor) {
  const { error } = await asVendor.storage.from('vendor-uploads').upload(`${otherVendor.id}/${submission}/x.jpg`, Buffer.from('x'), { contentType: 'image/jpeg' });
  if (!error) throw new Error('INV-10 broken: the vendor uploaded into another vendor\'s folder');
  console.log('Storage rule held: another vendor\'s folder was refused.');
}
console.log(`Sent piece ${submission} for ${vendor.shop_name}; two photo jobs are queued.`);
console.log('Run the worker with these settings (environment variables or tools/photo-worker/.env):');
console.log(`  IWC_SUPABASE_URL=${url}\n  IWC_SUPABASE_ANON_KEY=${anonKey}\n  IWC_WORKER_EMAIL=${workerEmail}\n  IWC_WORKER_PASSWORD=${workerPassword}`);
