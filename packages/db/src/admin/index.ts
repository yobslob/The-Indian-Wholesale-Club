/**
 * Admin reads/writes on base tables. Use the ADMIN'S OWN signed-in client: RLS
 * (`is_admin()` = role + allowlist, INV-7) is the real gate, so these functions
 * return nothing / fail for anyone else. Import only from admin code
 * (apps/web/app/admin, admin screens in the app). Never from storefront code.
 */
export * from './catalog';
export * from './commerce';
export * from './operations';
