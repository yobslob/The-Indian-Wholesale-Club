-- =============================================================================
-- D-140 (design plan L4): a clothing listing goes live only with its care (the label US customers are owed, ops.md
-- §Compliance), as a listing goes live only with its weights (D-129) and who it is for (20261018100000). Placeholders and
-- US clearance pieces are exempt as before. Otherwise as 20261018100000_wears_and_rows.
-- =============================================================================
create or replace function public._product_wears() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.product_type = 'clothing' and new.wears is null then
    new.wears := coalesce(public._wears_from_name(new.name),
                          public._wears_from_category((select slug from public.categories where id = new.category_id)));
  end if;
  if new.status = 'live' and (tg_op = 'INSERT' or old.status is distinct from 'live')
     and new.product_type = 'clothing' and not new.is_placeholder then
    if new.wears is null then
      raise exception 'wears_missing: % needs who it is for (women, men, kids or unisex) before it sells (D-140)', new.name
        using errcode = '23514';
    end if;
    if coalesce(btrim(new.attributes ->> 'care'), '') = '' and not new.is_us_stock then
      raise exception 'care_missing: % needs its care (how to wash it) before it sells (D-140)', new.name
        using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

drop trigger products_wears on public.products;
create trigger products_wears
  before insert or update of status, name, category_id, wears, product_type, attributes on public.products
  for each row execute function public._product_wears();
