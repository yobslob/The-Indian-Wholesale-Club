import type { Database } from './database.types';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

/**
 * A Supabase client typed with the generated schema. Each app creates its own
 * client (web: cookie/anon/service, app: SecureStore session) and passes it in.
 */
export type IwcClient = SupabaseClient<Database>;

type PublicSchema = Database['public'];
export type TableName = keyof PublicSchema['Tables'];
export type Row<T extends TableName> = PublicSchema['Tables'][T]['Row'];
export type Insert<T extends TableName> = PublicSchema['Tables'][T]['Insert'];
export type Update<T extends TableName> = PublicSchema['Tables'][T]['Update'];
export type Enum<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];

/**
 * Error thrown by every query helper. `code` is the SQL error code or, for our
 * own business errors raised in SQL (e.g. 'insufficient_stock:<id>'), the part
 * before the colon; see the `raise exception` list in docs/data-model.md.
 */
export class DbError extends Error {
  readonly code: string;
  readonly detail: string | null;

  constructor(code: string, message: string, detail: string | null = null) {
    super(message);
    this.name = 'DbError';
    this.code = code;
    this.detail = detail;
  }
}

export function toDbError(error: PostgrestError): DbError {
  // Business errors are raised with SQLSTATE P0001 and a machine-readable message.
  if (error.code === 'P0001' && /^[a-z_]+(:.*)?$/.test(error.message)) {
    const [code, detail] = error.message.split(':', 2);
    return new DbError(code ?? 'P0001', error.message, detail ?? null);
  }
  return new DbError(error.code || 'unknown', error.message, error.details || null);
}

/** Throws a DbError when a Supabase call failed; returns the data otherwise. */
export function unwrap<T>(result: { data: T; error: PostgrestError | null }): T {
  if (result.error) throw toDbError(result.error);
  return result.data;
}
