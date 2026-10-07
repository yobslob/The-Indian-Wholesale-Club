-- =============================================================================
-- The demo round (D-078): the first cycle runs on the placeholder catalogue with free-licence photos and labelled
-- demo reviews, shown to everyone while dev_preview is on, then cleared (`pnpm demo:clear`).
--  - product_media.credit: the attribution a CC BY / BY-SA photo needs, shown under the photo (store_media).
--  - reviews.is_placeholder: a demo review. Like placeholder products (INV-8), it shows only while dev_preview is on,
--    and the store labels it "Demo review". Only the service role can write it; a customer's review never is one.
-- =============================================================================

alter table public.product_media add column credit text check (credit is null or char_length(credit) <= 500);

-- Same columns as migration 1, credit appended (create or replace keeps grants and column order).
create or replace view public.store_media as
select m.id, m.product_id, m.variant_id, m.storage_path, m.alt_text, m.sort_order, m.is_primary, m.credit
from public.product_media m
join public.products p on p.id = m.product_id
where p.status = 'live' and (not p.is_placeholder or public.dev_preview());

alter table public.reviews add column is_placeholder boolean not null default false;

-- Same columns as migration 7, is_demo appended; demo reviews only while dev_preview is on.
create or replace view public.store_reviews as
select r.id, r.product_id, r.rating, r.body, r.display_name, r.is_verified_buyer, r.created_at,
       r.is_placeholder as is_demo   -- named for what the store shows; is_placeholder stays admin-only (INV-1)
from public.reviews r
where r.status = 'approved' and public.is_product_visible(r.product_id)
  and (not r.is_placeholder or public.dev_preview());

-- Whatever a customer sends, a new review starts pending, "verified" comes from their orders, and it is never a demo
-- review (only the demo loader, as the service role, writes those).
create or replace function public._reviews_before_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.status := 'pending';
  new.moderated_at := null;
  new.moderated_by := null;
  new.is_verified_buyer := public._is_verified_buyer(new.user_id, new.product_id);
  new.body := btrim(new.body);
  new.display_name := btrim(new.display_name);
  if coalesce(auth.role(), '') <> 'service_role' then
    new.is_placeholder := false;
  end if;
  return new;
end $$;
