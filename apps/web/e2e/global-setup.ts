import { assertSafeEnvironment, DEMO_PRODUCT, E2E_ADMIN, E2E_CUSTOMER, serviceClient } from './env';

type Service = ReturnType<typeof serviceClient>;

/** Creates the account if it doesn't exist yet and (re)sets its password. Returns the user id. */
async function ensureUser(service: Service, email: string, password: string): Promise<string> {
  const { data: created, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.user) return created.user.id;
  if (error && !/already/i.test(error.message)) throw error;
  const { data: page, error: listError } = await service.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const user = page.users.find((u) => u.email === email);
  if (!user) throw new Error(`E2E user ${email} exists but could not be found`);
  const { error: updateError } = await service.auth.admin.updateUserById(user.id, { password });
  if (updateError) throw updateError;
  return user.id;
}

/**
 * Before the run (local DB only): an admin account (role + admin_emails; the server's
 * ADMIN_EMAILS gets the address from playwright.config.ts), a customer account, and
 * enough stock on the demo product that repeated runs never sell it out.
 */
export default async function globalSetup(): Promise<void> {
  assertSafeEnvironment();
  const service = serviceClient();

  const adminId = await ensureUser(service, E2E_ADMIN.email, E2E_ADMIN.password);
  await ensureUser(service, E2E_CUSTOMER.email, E2E_CUSTOMER.password);

  const { error: allowError } = await service
    .from('admin_emails')
    .upsert({ email: E2E_ADMIN.email, note: 'E2E tests (local only)' });
  if (allowError) throw allowError;
  const { error: roleError } = await service
    .from('profiles')
    .update({ role: 'admin', desk: 'us' })
    .eq('id', adminId);
  if (roleError) throw roleError;

  // Checkout needs an open cycle (D-045). A fresh database has the seed's; a local one that ran a whole cycle by hand
  // may not (with no "days between cutoffs" set, none opens by itself, D-063).
  const { data: open, error: openError } = await service.from('cycles').select('id').eq('status', 'open').maybeSingle();
  if (openError) throw openError;
  if (!open) {
    throw new Error('No open cycle, so checkout is closed: open one in the admin (Cycles) or run `npx supabase db reset`.');
  }

  const { data: variants, error: variantError } = await service
    .from('product_variants')
    .select('id, qty_reserved, product:products!inner(slug)')
    .eq('product.slug', DEMO_PRODUCT.slug);
  if (variantError) throw variantError;
  if (!variants.length) {
    throw new Error(
      `Demo product "${DEMO_PRODUCT.slug}" not found: run \`npx supabase db reset\` (demo seed).`,
    );
  }
  for (const v of variants) {
    const { error } = await service.rpc('admin_set_listed_qty', {
      p_variant: v.id,
      p_qty_listed: v.qty_reserved + 5,
      p_note: 'E2E top-up (local only)',
    });
    if (error) throw error;
  }
}
