/**
 * Environment access in one place (docs/ops.md lists every variable).
 * NEXT_PUBLIC_* values are inlined into client bundles at build time, so they
 * must be read with literal `process.env.NAME` expressions.
 */
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name} (see apps/web/.env.example)`);
  return value;
}

export function supabaseUrl(): string {
  return required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabaseAnonKey(): string {
  return required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  );
}

/**
 * E-1: the old addresses whose pages move to the domain (comma separated host names, e.g. the old and the new
 * account's `*.vercel.app` production names). Read by the middleware at run time; never every vercel.app host,
 * because preview deployments live there too.
 */
export function legacyHostsValue(): string | undefined {
  return process.env.LEGACY_HOSTS;
}

/** Support address shown to customers. TODO(founder): Q-9 (domain + support email). */
export function supportEmail(): string | null {
  return process.env.NEXT_PUBLIC_CONTACT_EMAIL || null;
}
