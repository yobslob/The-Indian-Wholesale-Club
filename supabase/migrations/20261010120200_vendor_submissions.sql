-- =============================================================================
-- Vendor submissions (D-102, D-103): a piece a vendor uploads (three photos, details, sizes, shop price in rupees).
-- It stays outside `products` until an admin approves it (the products table holds the customer price and costs);
-- approval turns it into a product through admin_create_listing. Photo jobs queue the GPU worker's AI photos (D-101).
-- =============================================================================

create type public.submission_status as enum (
  'adding',        -- the vendor is still taking photos / filling details
  'waiting',       -- sent; the AI photos are being made
  'photos_ready',  -- the AI photos are made (or none are needed); an admin checks it
  'needs_retake',  -- an admin asked for new photos
  'approved',      -- a product was made from it
  'declined');
create type public.photo_view as enum ('front', 'back', 'closeup');
create type public.photo_job_status as enum ('queued', 'running', 'done', 'failed');

create table public.vendor_submissions (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  product_type public.product_type not null default 'clothing',
  category_id uuid,
  -- the vendor's own words: fabric, care, colour, note (only these keys, set by vendor_submit)
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  variants jsonb not null default '[]'::jsonb check (jsonb_typeof(variants) = 'array'),   -- [{label, qty}]
  shop_price_paise integer check (shop_price_paise > 0),
  status public.submission_status not null default 'adding',
  retake_reason text check (retake_reason in ('blurry', 'dark', 'background', 'not_whole', 'wrong_piece', 'other')),
  admin_note text,                       -- admin only, never in a vendor read
  product_id uuid references public.products (id) on delete set null,
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category_id, product_type) references public.categories (id, product_type),
  constraint vendor_submissions_approved_has_product check (status <> 'approved' or product_id is not null)
);
create index vendor_submissions_vendor_idx on public.vendor_submissions (vendor_id, created_at desc);
create index vendor_submissions_status_idx on public.vendor_submissions (status, submitted_at);

-- Bucket vendor-uploads, path <vendor>/<submission>/<file>. One photo per view (a retake replaces it).
create table public.vendor_submission_photos (
  submission_id uuid not null references public.vendor_submissions (id) on delete cascade,
  view public.photo_view not null,
  storage_path text not null,
  checks jsonb not null default '{}'::jsonb check (jsonb_typeof(checks) = 'object'),  -- the phone's photo checks
  created_at timestamptz not null default now(),
  primary key (submission_id, view)
);

-- IWC's 6 - 7 synthetic house models (D-101, D-102). Photos in product-media under house-models/<slug>/.
create table public.house_models (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  label text not null,
  wears text not null check (wears in ('women', 'men')),
  front_path text not null,
  back_path text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- One AI photo per view of a clothing piece. Candidates go to bucket photo-candidates under <job>/.
create table public.photo_jobs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.vendor_submissions (id) on delete cascade,
  view public.photo_view not null check (view in ('front', 'back')),
  house_model_id uuid references public.house_models (id) on delete set null,
  status public.photo_job_status not null default 'queued',
  attempts integer not null default 0,
  candidates text[] not null default '{}',
  error text,
  claimed_by uuid references public.profiles (id) on delete set null,
  claimed_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (submission_id, view)
);
create index photo_jobs_queue_idx on public.photo_jobs (created_at) where status in ('queued', 'running');

-- -----------------------------------------------------------------------------
-- Vendor writes
-- -----------------------------------------------------------------------------
-- May the caller upload to this storage path? <own vendor>/<own submission still open for photos>/<file>
create function public.vendor_may_upload(p_path text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.vendor_submissions s
    where s.vendor_id = public.my_vendor_id()
      and split_part(p_path, '/', 1) = s.vendor_id::text
      and split_part(p_path, '/', 2) = s.id::text
      and split_part(p_path, '/', 3) <> ''
      and split_part(p_path, '/', 4) = ''
      and s.status in ('adding', 'needs_retake'));
$$;

create function public.vendor_new_submission(p_type public.product_type default 'clothing')
returns uuid
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_vendor uuid := public._vendor_or_raise();
  v_id uuid;
begin
  if (select count(*) from public.vendor_submissions where vendor_id = v_vendor and status = 'adding') >= 50 then
    raise exception 'too_many_open' using errcode = 'P0001';
  end if;
  insert into public.vendor_submissions (vendor_id, created_by, product_type)
  values (v_vendor, auth.uid(), p_type)
  returning id into v_id;
  return v_id;
end $$;

-- Records a photo the vendor uploaded (the path must be inside their own open submission).
create function public.vendor_add_photo(p_submission uuid, p_view public.photo_view, p_path text,
                                        p_checks jsonb default '{}'::jsonb)
returns void
language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  perform public._vendor_or_raise();
  if not public.vendor_may_upload(p_path) or split_part(p_path, '/', 2) <> p_submission::text then
    raise exception 'not_your_submission' using errcode = '42501';
  end if;
  insert into public.vendor_submission_photos (submission_id, view, storage_path, checks)
  values (p_submission, p_view, p_path, coalesce(p_checks, '{}'::jsonb))
  on conflict (submission_id, view) do update
    set storage_path = excluded.storage_path, checks = excluded.checks, created_at = now();
  update public.vendor_submissions set updated_at = now() where id = p_submission;
end $$;

-- Sends a piece: details checked, then the AI photo jobs are queued (clothing) or it waits for an admin (spices).
-- p_details: {category_id, fabric, care, colour, note, shop_price_paise, variants: [{label, qty}]}
create function public.vendor_submit(p_submission uuid, p_details jsonb)
returns void
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_vendor uuid := public._vendor_or_raise();
  v_sub public.vendor_submissions;
  v_variants jsonb := p_details -> 'variants';
  v_needed public.photo_view[];
  v_text text;
begin
  select * into v_sub from public.vendor_submissions
   where id = p_submission and vendor_id = v_vendor for update;
  if not found then
    raise exception 'not_your_submission' using errcode = '42501';
  end if;
  if v_sub.status not in ('adding', 'needs_retake') then
    raise exception 'already_sent' using errcode = 'P0001';
  end if;

  v_needed := case when v_sub.product_type = 'clothing' then array['front', 'back', 'closeup']::public.photo_view[]
                   else array['front', 'closeup']::public.photo_view[] end;
  if exists (select 1 from unnest(v_needed) n(view)
             where not exists (select 1 from public.vendor_submission_photos ph
                               where ph.submission_id = p_submission and ph.view = n.view)) then
    raise exception 'photos_missing' using errcode = 'P0001';
  end if;

  if nullif(p_details ->> 'category_id', '') is null then
    raise exception 'category_needed' using errcode = 'P0001';
  end if;
  if jsonb_typeof(v_variants) is distinct from 'array' or jsonb_array_length(v_variants) not between 1 and 30 then
    raise exception 'sizes_needed' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_array_elements(v_variants) e
             where jsonb_typeof(e -> 'qty') is distinct from 'number'
                or (e ->> 'qty')::numeric <> trunc((e ->> 'qty')::numeric)
                or (e ->> 'qty')::numeric not between 1 and 999
                or length(btrim(coalesce(e ->> 'label', ''))) not between 1 and 60) then
    raise exception 'size_invalid' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_details -> 'shop_price_paise') is distinct from 'number'
     or (p_details ->> 'shop_price_paise')::numeric <> trunc((p_details ->> 'shop_price_paise')::numeric)
     or (p_details ->> 'shop_price_paise')::numeric not between 1 and 2147483647 then
    raise exception 'price_needed' using errcode = 'P0001';
  end if;
  foreach v_text in array array['fabric', 'care', 'colour', 'note'] loop
    if length(coalesce(p_details ->> v_text, '')) > 500 then
      raise exception 'text_too_long' using errcode = 'P0001';
    end if;
  end loop;

  update public.vendor_submissions
     set category_id = nullif(p_details ->> 'category_id', '')::uuid,
         details = jsonb_strip_nulls(jsonb_build_object(
           'fabric', nullif(btrim(p_details ->> 'fabric'), ''), 'care', nullif(btrim(p_details ->> 'care'), ''),
           'colour', nullif(btrim(p_details ->> 'colour'), ''), 'note', nullif(btrim(p_details ->> 'note'), ''))),
         variants = (select jsonb_agg(jsonb_build_object('label', btrim(e ->> 'label'), 'qty', (e ->> 'qty')::integer))
                     from jsonb_array_elements(v_variants) e),
         shop_price_paise = (p_details ->> 'shop_price_paise')::integer,
         status = case when product_type = 'clothing' then 'waiting' else 'photos_ready' end::public.submission_status,
         retake_reason = null,
         submitted_at = now(),
         updated_at = now()
   where id = p_submission;

  if v_sub.product_type = 'clothing' then
    insert into public.photo_jobs (submission_id, view)
    values (p_submission, 'front'), (p_submission, 'back')
    on conflict (submission_id, view) do update
      set status = 'queued', attempts = 0, candidates = '{}', error = null, claimed_by = null, claimed_at = null,
          finished_at = null, created_at = now();
  end if;
end $$;

-- Drops a piece the vendor gave up on before sending it. The phone deletes its photos from storage.
create function public.vendor_delete_submission(p_submission uuid)
returns void
language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  delete from public.vendor_submissions
   where id = p_submission and vendor_id = public._vendor_or_raise() and status = 'adding';
  if not found then
    raise exception 'cannot_delete' using errcode = 'P0001';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Vendor reads
-- -----------------------------------------------------------------------------
-- The vendor's pieces, newest first: what they sent (until approved) and their products (made from a submission or
-- listed by an admin). Status pictures are drawn from `kind` + `status`. Never a customer price.
create function public.vendor_pieces(p_offset integer default 0, p_limit integer default 30)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_vendor uuid := public._vendor_or_raise();
begin
  return (
    with pieces as (
      select 'submission' as kind, s.id, s.status::text as status, s.retake_reason, null::text as name,
             c.name as category, s.created_at, 'vendor-uploads' as photo_bucket,
             (select ph.storage_path from public.vendor_submission_photos ph
               where ph.submission_id = s.id and ph.view = 'front') as photo_path,
             null::integer as pieces_left
      from public.vendor_submissions s
      left join public.categories c on c.id = s.category_id
      where s.vendor_id = v_vendor and s.status <> 'approved'
      union all
      select 'product', p.id, p.status::text, null, p.name, c.name, p.created_at, 'product-media',
             (select m.storage_path from public.product_media m where m.product_id = p.id
               order by m.is_primary desc, m.sort_order limit 1),
             (select coalesce(sum(pv.qty_listed - pv.qty_reserved), 0)::integer from public.product_variants pv
               where pv.product_id = p.id and pv.is_active)
      from public.products p
      join public.categories c on c.id = p.category_id
      where p.vendor_id = v_vendor and p.status <> 'archived' and not p.is_placeholder
    )
    select jsonb_build_object(
      'total', (select count(*) from pieces),
      'items', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc)
                         from (select * from pieces order by created_at desc
                               offset greatest(coalesce(p_offset, 0), 0)
                               limit least(greatest(coalesce(p_limit, 30), 1), 50)) x), '[]'::jsonb)));
end $$;

-- One submission as its vendor sees it: photos (signed URLs are made from the paths), details, sizes, status and,
-- once approved, the product with its published photo.
create function public.vendor_submission(p_submission uuid)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_vendor uuid := public._vendor_or_raise();
begin
  return (
    select jsonb_build_object(
      'id', s.id, 'status', s.status, 'retake_reason', s.retake_reason, 'product_type', s.product_type,
      'category_id', s.category_id, 'details', s.details, 'variants', s.variants,
      'shop_price_paise', s.shop_price_paise, 'created_at', s.created_at, 'submitted_at', s.submitted_at,
      'photos', coalesce((select jsonb_object_agg(ph.view, ph.storage_path)
                          from public.vendor_submission_photos ph where ph.submission_id = s.id), '{}'::jsonb),
      'product', (select jsonb_build_object('id', p.id, 'name', p.name, 'status', p.status,
                    'photo_path', (select m.storage_path from public.product_media m where m.product_id = p.id
                                    order by m.is_primary desc, m.sort_order limit 1))
                  from public.products p where p.id = s.product_id and p.vendor_id = v_vendor))
    from public.vendor_submissions s
    where s.id = p_submission and s.vendor_id = v_vendor);
end $$;

-- -----------------------------------------------------------------------------
-- Storage: vendor-uploads (private: the vendor's own folder, admins, the worker), photo-candidates (private: the
-- worker writes, admins read)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('vendor-uploads', 'vendor-uploads', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('photo-candidates', 'photo-candidates', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create function public.is_worker() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'worker');
$$;

create policy "iwc vendor uploads read" on storage.objects for select to authenticated
  using (bucket_id = 'vendor-uploads'
         and (split_part(name, '/', 1) = public.my_vendor_id()::text or public.is_admin() or public.is_worker()));
create policy "iwc vendor uploads insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'vendor-uploads' and public.vendor_may_upload(name));
create policy "iwc vendor uploads update" on storage.objects for update to authenticated
  using (bucket_id = 'vendor-uploads' and public.vendor_may_upload(name))
  with check (bucket_id = 'vendor-uploads' and public.vendor_may_upload(name));
create policy "iwc vendor uploads delete" on storage.objects for delete to authenticated
  using (bucket_id = 'vendor-uploads' and (public.vendor_may_upload(name) or public.is_admin()));

create policy "iwc candidates read" on storage.objects for select to authenticated
  using (bucket_id = 'photo-candidates' and (public.is_admin() or public.is_worker()));
create policy "iwc candidates insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'photo-candidates' and public.is_worker());
create policy "iwc candidates update" on storage.objects for update to authenticated
  using (bucket_id = 'photo-candidates' and public.is_worker())
  with check (bucket_id = 'photo-candidates' and public.is_worker());
create policy "iwc candidates delete" on storage.objects for delete to authenticated
  using (bucket_id = 'photo-candidates' and (public.is_admin() or public.is_worker()));

-- -----------------------------------------------------------------------------
-- Row level security and privileges
-- -----------------------------------------------------------------------------
alter table public.vendor_submissions enable row level security;
alter table public.vendor_submission_photos enable row level security;
alter table public.house_models enable row level security;
alter table public.photo_jobs enable row level security;

create policy admin_all on public.vendor_submissions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.vendor_submission_photos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.house_models for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.photo_jobs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Supabase grants new tables to everyone by default: take it back, then grant what RLS narrows down.
revoke all on public.vendor_submissions, public.vendor_submission_photos, public.house_models, public.photo_jobs
  from anon, authenticated;
grant select, insert, update, delete on public.vendor_submissions, public.vendor_submission_photos,
  public.house_models, public.photo_jobs to authenticated;
grant all on public.vendor_submissions, public.vendor_submission_photos, public.house_models, public.photo_jobs
  to service_role;

revoke all on function public.vendor_may_upload(text), public.vendor_new_submission(public.product_type),
  public.vendor_add_photo(uuid, public.photo_view, text, jsonb), public.vendor_submit(uuid, jsonb),
  public.vendor_delete_submission(uuid), public.vendor_pieces(integer, integer), public.vendor_submission(uuid),
  public.is_worker()
  from public, anon, authenticated;
grant execute on function public.vendor_may_upload(text), public.vendor_new_submission(public.product_type),
  public.vendor_add_photo(uuid, public.photo_view, text, jsonb), public.vendor_submit(uuid, jsonb),
  public.vendor_delete_submission(uuid), public.vendor_pieces(integer, integer), public.vendor_submission(uuid),
  public.is_worker()
  to authenticated, service_role;
