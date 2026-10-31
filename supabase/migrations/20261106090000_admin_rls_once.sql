-- =============================================================================
-- The admin's row checks run once per query, not once per row (founder 2026-10-31: "the admin panel takes so much
-- load, most of the time it is slow, breaks and shows try again, mostly /catalog and products section").
-- Every admin_all-style policy said `using (is_admin())`. is_admin() is SECURITY DEFINER with its own search_path, so
-- Postgres cannot inline it and called it for every row it looked at: the Products page's 50 rows with their options
-- read 8,078 products and 72,884 options, about 80,000 calls, 1.45 s of database time locally (each tab count 0.2 s);
-- on the free plan's small machine, beside the sourcing runner, that came near the 8 s statement limit (D-146) and
-- the page failed. Written `(select public.is_admin())`, it becomes one InitPlan per statement (Supabase's own RLS
-- advice): the same rule (role + admin_emails, D-006), the same answer, evaluated once.
-- Only policies whose whole condition is is_admin() change; the storage policies and the ones that mix is_admin()
-- with other checks are left as they are (small tables, or already narrowed by the bucket).
-- Size: none. Egress: none. Page cache: none.
-- Tests: admin_rls_once.test.sql.
-- =============================================================================

do $$
declare
  p record;
begin
  for p in
    select tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (qual = 'is_admin()' or with_check = 'is_admin()')
       and coalesce(qual, 'is_admin()') = 'is_admin()'
       and coalesce(with_check, 'is_admin()') = 'is_admin()'
  loop
    execute format('alter policy %I on public.%I %s %s', p.policyname, p.tablename,
                   case when p.qual is not null then 'using ((select public.is_admin()))' else '' end,
                   case when p.with_check is not null then 'with check ((select public.is_admin()))' else '' end);
  end loop;
end $$;
