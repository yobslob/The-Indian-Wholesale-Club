-- =============================================================================
-- D-110: the product type "spice" becomes "food". It always held the whole pantry (masalas, namkeen, sweets,
-- pickles, staples), so the name now says so. Data keeps its rows: an enum value rename rewrites nothing.
-- Function bodies are text, so every one that names the old value or column is replaced here.
-- =============================================================================

alter type public.product_type rename value 'spice' to 'food';
alter table public.pricing_settings rename column spices_cleared to food_cleared;

-- Food goes live only while "Food is cleared" is on (D-074; on in production since D-107).
drop trigger products_spices_cleared on public.products;
drop function public._spices_cleared_check();
create function public._food_cleared_check() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.product_type = 'food' and new.status = 'live'
     and not coalesce((select food_cleared from public.pricing_settings where id = 1), false) then
    raise exception 'products_food_not_live: food is not cleared yet (Settings, D-074)' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger products_food_cleared
  before insert or update of status, product_type on public.products
  for each row execute function public._food_cleared_check();
revoke all on function public._food_cleared_check() from public, anon, authenticated;

-- A category's tax class follows its type (latest: 20261011090100_home_tax).
create or replace function public._category_tax_class() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  new.tax_class := coalesce(new.tax_class, case new.product_type when 'food' then 'food'
                                                                 when 'home' then 'general'
                                                                 else 'clothing' end::public.tax_class);
  return new;
end $$;

-- The business details' wording.
update public.business_details set key = 'hs_food', label = 'HS codes for food (by category)' where key = 'hs_spices';
update public.business_details set group_name = 'Food (FDA)' where group_name = 'Spices (FDA)';
