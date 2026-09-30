-- =============================================================================
-- Reviews (D-051, D-056): a rating (1-5) and text from signed-in customers; photos only from verified
-- buyers (a delivered order with the product); an admin checks every review before it appears (D-052).
-- The database decides status and "verified buyer", never the browser. Customers read their own reviews;
-- the store reads approved reviews through store_reviews / store_review_photos only (INV-1: no user id).
-- =============================================================================

create type public.review_status as enum ('pending', 'approved', 'rejected');

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  is_verified_buyer boolean not null default false,
  status public.review_status not null default 'pending',
  moderated_at timestamptz,
  moderated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_one_per_customer unique (product_id, user_id)
);
create index reviews_product_status on public.reviews (product_id, status, created_at desc);

create table public.review_photos (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  storage_path text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);
create index review_photos_review on public.review_photos (review_id, sort_order);

create trigger reviews_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

-- A verified buyer has a delivered order (on their account) that holds the product.
create function public._is_verified_buyer(p_user uuid, p_product uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.orders o join public.order_items i on i.order_id = o.id
    where o.user_id = p_user and i.product_id = p_product and o.status = 'delivered' and i.status = 'active');
$$;

-- Whatever a customer sends, a new review starts pending and "verified" comes from their orders.
create function public._reviews_before_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.status := 'pending';
  new.moderated_at := null;
  new.moderated_by := null;
  new.is_verified_buyer := public._is_verified_buyer(new.user_id, new.product_id);
  new.body := btrim(new.body);
  new.display_name := btrim(new.display_name);
  return new;
end $$;
create trigger reviews_before_insert before insert on public.reviews
  for each row execute function public._reviews_before_insert();

-- Photos: verified reviews only, at most four per review.
create function public._review_photos_before_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.reviews r where r.id = new.review_id and r.is_verified_buyer) then
    raise exception 'photos_verified_buyers_only' using errcode = '42501';
  end if;
  if (select count(*) from public.review_photos p where p.review_id = new.review_id) >= 4 then
    raise exception 'review_photos_limit' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger review_photos_before_insert before insert on public.review_photos
  for each row execute function public._review_photos_before_insert();

-- The review form asks this before showing the photo field (signed-in customers only).
create function public.review_eligibility(p_product uuid)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'is_verified_buyer', public._is_verified_buyer(auth.uid(), p_product),
    'has_reviewed', exists (select 1 from public.reviews r where r.product_id = p_product and r.user_id = auth.uid()));
$$;

-- Row level security: admins manage all; customers insert and read their own.
alter table public.reviews enable row level security;
alter table public.review_photos enable row level security;
create policy admin_all on public.reviews for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.review_photos for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy reviews_own_select on public.reviews for select to authenticated using (user_id = auth.uid());
create policy reviews_own_insert on public.reviews for insert to authenticated with check (user_id = auth.uid());
create policy review_photos_own_select on public.review_photos for select to authenticated
  using (exists (select 1 from public.reviews r where r.id = review_id and r.user_id = auth.uid()));
create policy review_photos_own_insert on public.review_photos for insert to authenticated
  with check (exists (select 1 from public.reviews r
                      where r.id = review_id and r.user_id = auth.uid() and r.status = 'pending'));

-- Store read path: approved reviews of visible products only, no user id (INV-1).
create view public.store_reviews as
select r.id, r.product_id, r.rating, r.body, r.display_name, r.is_verified_buyer, r.created_at
from public.reviews r
where r.status = 'approved' and public.is_product_visible(r.product_id);

create view public.store_review_photos as
select p.id, p.review_id, p.storage_path, p.sort_order
from public.review_photos p
join public.store_reviews r on r.id = p.review_id;

-- The product page gains its reviews: summary over every approved review + the six newest with photos.
create or replace function public.store_product_page(p_region_slug text, p_product_slug text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'product', to_jsonb(p) - 'search' - 'is_curated',
    'variants', coalesce((
      select jsonb_agg(to_jsonb(v) order by v.sort_order, v.label)
      from public.store_variants v where v.product_id = p.id), '[]'::jsonb),
    'media', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.is_primary desc, m.sort_order)
      from public.store_media m where m.product_id = p.id), '[]'::jsonb),
    'similar', coalesce((
      select jsonb_agg(public._store_product_card(s.id) order by s.same_region desc, s.published_at desc nulls last, s.name)
      from (select o.id, o.published_at, o.name, (o.region_id = p.region_id) as same_region
            from public.store_products o
            where o.category_id = p.category_id and o.id <> p.id
            order by (o.region_id = p.region_id) desc, o.published_at desc nulls last, o.name
            limit 5) s), '[]'::jsonb),
    'curated', coalesce((
      select jsonb_agg(public._store_product_card(c.id) order by c.published_at desc nulls last, c.name)
      from (select o.id, o.published_at, o.name from public.store_products o
            where o.region_id = p.region_id and o.is_curated and o.id <> p.id
            order by o.published_at desc nulls last, o.name limit 4) c), '[]'::jsonb),
    'reviews', jsonb_build_object(
      'count', (select count(*) from public.store_reviews r where r.product_id = p.id),
      'average', (select round(avg(r.rating), 1) from public.store_reviews r where r.product_id = p.id),
      'histogram', (select jsonb_build_object(
                      '5', count(*) filter (where r.rating = 5), '4', count(*) filter (where r.rating = 4),
                      '3', count(*) filter (where r.rating = 3), '2', count(*) filter (where r.rating = 2),
                      '1', count(*) filter (where r.rating = 1))
                    from public.store_reviews r where r.product_id = p.id),
      'items', coalesce((
        select jsonb_agg(to_jsonb(r) || jsonb_build_object('photos', coalesce((
                 select jsonb_agg(ph.storage_path order by ph.sort_order)
                 from public.store_review_photos ph where ph.review_id = r.id), '[]'::jsonb))
               order by r.created_at desc)
        from (select * from public.store_reviews r where r.product_id = p.id
              order by r.created_at desc limit 6) r), '[]'::jsonb)),
    'delivery', (select to_jsonb(d) from public.store_next_delivery() d limit 1)
  )
  from public.store_products p
  where p.region_slug = p_region_slug and p.slug = p_product_slug;
$$;

-- Review photos: public bucket (they show on product pages once approved), uploaded into the customer's own
-- folder, only while they have a pending verified review. Admins can remove any.
insert into storage.buckets (id, name, public) values ('review-media', 'review-media', true)
on conflict (id) do nothing;
create policy "iwc review photo insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'review-media' and (storage.foldername(name))[1] = auth.uid()::text
              and exists (select 1 from public.reviews r
                          where r.user_id = auth.uid() and r.is_verified_buyer and r.status = 'pending'));
create policy "iwc review photo admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'review-media' and public.is_admin());

-- Privileges (Supabase grants everything by default; narrow it down).
revoke all on public.reviews, public.review_photos, public.store_reviews, public.store_review_photos
  from anon, authenticated;
grant select, insert, update, delete on public.reviews, public.review_photos to authenticated; -- RLS narrows
grant select on public.store_reviews, public.store_review_photos to anon, authenticated;
grant all on public.reviews, public.review_photos to service_role;
grant select on public.store_reviews, public.store_review_photos to service_role;
revoke all on function public._is_verified_buyer(uuid, uuid), public._reviews_before_insert(),
  public._review_photos_before_insert(), public.review_eligibility(uuid) from public, anon, authenticated;
grant execute on function public.review_eligibility(uuid) to authenticated;
grant execute on function public._is_verified_buyer(uuid, uuid), public.review_eligibility(uuid) to service_role;
grant execute on function public.store_product_page(text, text) to anon, authenticated, service_role;
