-- =============================================================================
-- D-120: Publish all drafts in one go (Products → Drafts). The founder asked to publish every draft the auto-sourcing
-- and the imports made. Each draft goes live on its own, so one refusal does not stop the rest; a draft is left as it
-- is when it would look broken on the store: no photo, no active option, or no piece to sell (every option sold out
-- or out of stock at the shop). Demo listings (is_placeholder) and US clearance pieces (checked in hand first, D-072)
-- are never touched. Unlike Auto-sourcing's "Publish the ready", a draft goes live without every detail customers
-- see (fibre content and care, ingredients, allergens and shelf life, material); the result counts those, so the
-- admin can finish them (US labelling expects fibre content on clothing and ingredients and allergens on food).
-- =============================================================================

create function public.admin_publish_drafts()
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  r record;
  v_live integer := 0;
  v_no_photo integer := 0;
  v_no_option integer := 0;
  v_no_stock integer := 0;
  v_refused integer := 0;
  v_missing integer := 0;
  v_note text;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  for r in
    select p.id,
           case p.product_type
             when 'clothing' then coalesce(p.attributes ->> 'fibre_content', '') <> ''
                                  and coalesce(p.attributes ->> 'care', '') <> ''
             when 'food' then coalesce(p.attributes ->> 'ingredients', '') <> ''
                              and jsonb_typeof(p.attributes -> 'allergens') = 'array'
                              and p.attributes ? 'shelf_life_days'
             when 'home' then coalesce(p.attributes ->> 'material', '') <> ''
             else true
           end as has_details,
           exists (select 1 from public.product_media m where m.product_id = p.id) as has_photo,
           exists (select 1 from public.product_variants v where v.product_id = p.id and v.is_active) as has_option,
           exists (select 1 from public.product_variants v
                    where v.product_id = p.id and v.is_active and v.qty_listed > v.qty_reserved) as has_stock
      from public.products p
     where p.status = 'draft' and not p.is_placeholder and not p.is_us_stock
     order by p.created_at
  loop
    if not r.has_photo then
      v_no_photo := v_no_photo + 1;
    elsif not r.has_option then
      v_no_option := v_no_option + 1;
    elsif not r.has_stock then
      v_no_stock := v_no_stock + 1;
    else
      begin
        update public.products set status = 'live', published_at = now() where id = r.id and status = 'draft';
        v_live := v_live + 1;
        if not r.has_details then
          v_missing := v_missing + 1;
        end if;
      exception when others then
        v_refused := v_refused + 1;
        v_note := left(sqlerrm, 200);   -- e.g. food is not cleared (D-074)
      end;
    end if;
  end loop;
  return jsonb_build_object('published', v_live, 'no_photo', v_no_photo, 'no_option', v_no_option,
                            'no_stock', v_no_stock, 'refused', v_refused, 'note', v_note,
                            'live_missing_details', v_missing);
end $$;

revoke all on function public.admin_publish_drafts() from public, anon;
grant execute on function public.admin_publish_drafts() to authenticated;
