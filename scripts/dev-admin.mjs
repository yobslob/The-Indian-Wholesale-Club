#!/usr/bin/env node
/**
 * scripts/dev-admin.mjs: makes (or refreshes) an admin account in the LOCAL database.
 *
 *   pnpm dev:admin you@example.com "a-password-you-choose" [us|india]
 *
 * `check.mjs db` resets the local database, which deletes every local account, so run this
 * again after a reset. It does the three bootstrap steps from docs/ops.md except the last:
 * the website also needs the email in ADMIN_EMAILS (apps/web/.env.local), which you edit.
 * The app's admin mode needs only this script (the database decides, D-006).
 * Reads apps/web/.env.local; refuses anything but local Supabase.
 */
import { existsSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';

for (const file of ['apps/web/.env.local', 'apps/web/.env']) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const [emailArg, password, desk = 'us'] = process.argv.slice(2);
const email = (emailArg ?? '').trim().toLowerCase();
if (!email.includes('@') || !password || password.length < 8 || !['us', 'india'].includes(desk)) {
  console.error('Usage: pnpm dev:admin <email> <password (8+ characters)> [us|india]');
  process.exit(2);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
let host = '';
try {
  host = new URL(url).hostname;
} catch {
  /* reported below */
}
if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
  console.error(`Refusing: NEXT_PUBLIC_SUPABASE_URL is not local Supabase ("${url || 'unset'}").`);
  process.exit(2);
}
if (!key) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is missing in apps/web/.env.local (npx supabase status).');
  process.exit(2);
}

const service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function userId() {
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (data.user) return data.user.id;
  if (error && !/already/i.test(error.message)) throw error;
  const { data: page, error: listError } = await service.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const user = page.users.find((u) => u.email === email);
  if (!user) throw new Error(`${email} exists but could not be found`);
  const { error: updateError } = await service.auth.admin.updateUserById(user.id, { password });
  if (updateError) throw updateError;
  return user.id;
}

const id = await userId();
const allow = await service.from('admin_emails').upsert({ email, note: 'local dev admin' });
if (allow.error) throw allow.error;
const role = await service.from('profiles').update({ role: 'admin', desk }).eq('id', id);
if (role.error) throw role.error;

const listed = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .includes(email);
console.log(`Local admin ready: ${email} (desk: ${desk}).`);
console.log('App: sign in with it; admin mode opens.');
console.log(
  listed
    ? 'Website: sign in at /admin/login.'
    : `Website: also add ${email} to ADMIN_EMAILS in apps/web/.env.local, restart the web server, then /admin/login.`,
);
