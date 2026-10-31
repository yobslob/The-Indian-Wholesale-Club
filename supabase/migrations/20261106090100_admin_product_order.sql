-- =============================================================================
-- The admin's Products list in its usual order (recently updated first, D-136), all products or one status tab, read
-- from an index: Postgres walks it and stops after the page's 50 rows, instead of attaching every product's options
-- and then sorting all of them (locally, 8,078 products: about 150 ms down to about 10 ms a page). The id breaks ties,
-- as the list's own order does (packages/db admin/catalog.ts). The status one also serves the tabs' counts.
-- Size: about 0.75 MB at 8,000 listings (both indexes). Egress: none. Page cache: none.
-- =============================================================================

create index if not exists products_admin_updated_idx on public.products (updated_at desc, id);
create index if not exists products_admin_status_updated_idx on public.products (status, updated_at desc, id);
