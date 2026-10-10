-- =============================================================================
-- The admin's review of vendor submissions and the photo worker's queue (D-101, D-102, D-103).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Admin
-- -----------------------------------------------------------------------------
-- Approve: the submission becomes a draft product (admin_create_listing: region from the vendor, priced from the shop
-- price unless a price is given) with the photos the admin picked (already copied to product-media; the first is the
-- main photo). p_listing as admin_create_listing's input; vendor, type and, when left out, category, shop price and
-- sizes come from the submission. p_media: [{path, alt_text}] in order.
create function public.admin_approve_submission(p_submission uuid, p_listing jsonb, p_media jsonb)
returns uuid
language plpgsql volatile security invoker set search_path = public, pg_temp as $$
declare
  v_sub public.vendor_submissions;
  v_product uuid;
  v_item jsonb;
  v_n integer := 0;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  select * into v_sub from public.vendor_submissions where id = p_submission for update;
  if not found or v_sub.status not in ('waiting', 'photos_ready') then
    raise exception 'submission_not_open' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_media) is distinct from 'array' or jsonb_array_length(p_media) = 0 then
    raise exception 'photos_needed' using errcode = 'P0001';
  end if;

  v_product := public.admin_create_listing(
    coalesce(p_listing, '{}'::jsonb) || jsonb_build_object(
      'vendor_id', v_sub.vendor_id,
      'product_type', v_sub.product_type,
      'category_id', coalesce(nullif(p_listing ->> 'category_id', ''), v_sub.category_id::text),
      'shop_price_paise', coalesce(p_listing -> 'shop_price_paise', to_jsonb(v_sub.shop_price_paise)),
      'variants', coalesce(p_listing -> 'variants', v_sub.variants)));

  for v_item in select * from jsonb_array_elements(p_media) loop
    insert into public.product_media (product_id, storage_path, alt_text, sort_order, is_primary)
    values (v_product, v_item ->> 'path', coalesce(v_item ->> 'alt_text', ''), v_n, v_n = 0);
    v_n := v_n + 1;
  end loop;

  update public.vendor_submissions
     set status = 'approved', product_id = v_product, decided_at = now(), decided_by = auth.uid(), updated_at = now()
   where id = p_submission;
  return v_product;
end $$;

-- Ask the vendor for new photos (the reason is a picture on their screen); queued photo jobs stop.
create function public.admin_request_retake(p_submission uuid, p_reason text, p_note text default null)
returns void
language plpgsql volatile security invoker set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  update public.vendor_submissions
     set status = 'needs_retake', retake_reason = p_reason, admin_note = coalesce(p_note, admin_note),
         decided_by = auth.uid(), updated_at = now()
   where id = p_submission and status in ('waiting', 'photos_ready');
  if not found then
    raise exception 'submission_not_open' using errcode = 'P0001';
  end if;
  delete from public.photo_jobs where submission_id = p_submission and status in ('queued', 'failed');
end $$;

create function public.admin_decline_submission(p_submission uuid, p_note text default null)
returns void
language plpgsql volatile security invoker set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  update public.vendor_submissions
     set status = 'declined', admin_note = coalesce(p_note, admin_note), decided_at = now(), decided_by = auth.uid(),
         updated_at = now()
   where id = p_submission and status in ('waiting', 'photos_ready', 'needs_retake');
  if not found then
    raise exception 'submission_not_open' using errcode = 'P0001';
  end if;
  delete from public.photo_jobs where submission_id = p_submission and status in ('queued', 'failed');
end $$;

-- Make a view's AI photos again (another house model, or after a failure).
create function public.admin_rerun_photo_job(p_job uuid, p_house_model uuid default null)
returns void
language plpgsql volatile security invoker set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  update public.photo_jobs
     set status = 'queued', attempts = 0, candidates = '{}', error = null, claimed_by = null, claimed_at = null,
         finished_at = null, house_model_id = coalesce(p_house_model, house_model_id)
   where id = p_job and status in ('done', 'failed')
     and exists (select 1 from public.vendor_submissions s
                 where s.id = submission_id and s.status in ('waiting', 'photos_ready'));
  if not found then
    raise exception 'job_not_rerunnable' using errcode = 'P0001';
  end if;
  update public.vendor_submissions set status = 'waiting', updated_at = now()
   where id = (select submission_id from public.photo_jobs where id = p_job) and status = 'photos_ready';
end $$;

-- -----------------------------------------------------------------------------
-- The photo worker (role 'worker', the founder's laptop)
-- -----------------------------------------------------------------------------
-- Takes the oldest queued job (or one a stopped worker left running for 30 minutes) and returns what it needs:
-- the photo paths in vendor-uploads, the house model's photos in product-media and the category. Null = nothing to do.
create function public.worker_claim_job()
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_job public.photo_jobs;
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  loop
    select * into v_job from public.photo_jobs
     where status = 'queued' or (status = 'running' and claimed_at < now() - interval '30 minutes')
     order by created_at
     limit 1
     for update skip locked;
    if not found then
      return null;
    end if;
    exit when v_job.attempts < 3;
    update public.photo_jobs set status = 'failed', error = coalesce(error, 'too_many_attempts'), finished_at = now()
     where id = v_job.id;
  end loop;

  update public.photo_jobs
     set status = 'running', attempts = attempts + 1, claimed_by = auth.uid(), claimed_at = now()
   where id = v_job.id;

  return (
    select jsonb_build_object(
      'job_id', v_job.id, 'view', v_job.view, 'submission_id', s.id, 'product_type', s.product_type,
      'category', c.slug, 'colour', s.details ->> 'colour', 'fabric', s.details ->> 'fabric',
      'photos', (select jsonb_object_agg(ph.view, ph.storage_path)
                 from public.vendor_submission_photos ph where ph.submission_id = s.id),
      'house_model', (select jsonb_build_object('slug', h.slug, 'wears', h.wears, 'front_path', h.front_path,
                                                'back_path', h.back_path)
                      from public.house_models h
                      where h.id = coalesce(v_job.house_model_id,
                                            (select h2.id from public.house_models h2 where h2.is_active
                                              order by h2.sort_order, h2.slug limit 1))))
    from public.vendor_submissions s
    left join public.categories c on c.id = s.category_id
    where s.id = v_job.submission_id);
end $$;

-- Finishes a job the caller holds: candidates (paths under <job>/ in photo-candidates) or an error (tried again
-- until the third attempt). When every job of the submission is done, it waits for an admin.
create function public.worker_finish_job(p_job uuid, p_candidates text[], p_error text default null)
returns void
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_ok boolean := p_error is null and cardinality(coalesce(p_candidates, '{}')) > 0;
  v_submission uuid;
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(coalesce(p_candidates, '{}')) c(path)
             where split_part(c.path, '/', 1) <> p_job::text or split_part(c.path, '/', 2) = ''
                or split_part(c.path, '/', 3) <> '') then
    raise exception 'candidate_path_invalid' using errcode = 'P0001';
  end if;
  update public.photo_jobs
     set status = case when v_ok then 'done' when attempts >= 3 then 'failed' else 'queued' end::public.photo_job_status,
         candidates = case when v_ok then p_candidates else '{}' end,
         error = case when v_ok then null else coalesce(p_error, 'no_candidates') end,
         finished_at = now()
   where id = p_job and status = 'running' and claimed_by = auth.uid()
  returning submission_id into v_submission;
  if v_submission is null then
    raise exception 'job_not_running' using errcode = 'P0001';
  end if;
  update public.vendor_submissions s set status = 'photos_ready', updated_at = now()
   where s.id = v_submission and s.status = 'waiting'
     and not exists (select 1 from public.photo_jobs j where j.submission_id = s.id and j.status <> 'done');
end $$;

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------
revoke all on function public.admin_approve_submission(uuid, jsonb, jsonb),
  public.admin_request_retake(uuid, text, text), public.admin_decline_submission(uuid, text),
  public.admin_rerun_photo_job(uuid, uuid), public.worker_claim_job(), public.worker_finish_job(uuid, text[], text)
  from public, anon, authenticated;
grant execute on function public.admin_approve_submission(uuid, jsonb, jsonb),
  public.admin_request_retake(uuid, text, text), public.admin_decline_submission(uuid, text),
  public.admin_rerun_photo_job(uuid, uuid), public.worker_claim_job(), public.worker_finish_job(uuid, text[], text)
  to authenticated, service_role;
