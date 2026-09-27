/**
 * @repo/db: typed Supabase access. Pick the entry point by caller:
 *   '@repo/db/store'   customer-safe reads (store_* only)       storefront + customer app
 *   '@repo/db/admin'   base tables under admin RLS              /admin + app admin mode
 *   '@repo/db/server'  service-role operations (order creation) server code only
 * This root entry exports only types and error helpers.
 */
export { DbError, toDbError, unwrap } from './client';
export type { Enum, Insert, IwcClient, Row, TableName, Update } from './client';
export type { Database, Json } from './database.types';
