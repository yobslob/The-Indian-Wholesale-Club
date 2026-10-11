-- =============================================================================
-- Home & gifts (D-106): a new category takes its tax class from its type. Home goods are general merchandise (taxed
-- where IWC is registered, D-073); clothing and food stay as they were.
-- =============================================================================
create or replace function public._category_tax_class() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  new.tax_class := coalesce(new.tax_class, case new.product_type when 'spice' then 'food'
                                                                 when 'home' then 'general'
                                                                 else 'clothing' end::public.tax_class);
  return new;
end $$;

-- Their shipping documents need their own HS codes, filled by the founder like the others (D-074).
insert into public.business_details (key, label, group_name, sort_order, value) values
  ('hs_home', 'HS codes for home & gifts (by category)', 'Shipping documents', 6, 'TO FILL')
on conflict (key) do nothing;
