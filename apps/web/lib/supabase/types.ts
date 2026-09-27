import type { Database } from '@repo/shared/types';
import type { SupabaseClient } from '@supabase/supabase-js';


// Normalized client type used by query helpers. @supabase/ssr instantiates
// `SupabaseClient` with an older 3-generic signature that conflicts with the
// installed supabase-js 4-generic class, so the factories in server.ts and
// client.ts re-type their return values to this computed 2-arg form with a
// single cast each at the boundary. This keeps queries fully typed instead of
// erasing them to `any` (M13).
export type Client = SupabaseClient<Database, 'public'>;
