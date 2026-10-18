-- =============================================================================
-- D-140 (design plan L1): a listing's name is IWC's (no brand or shop, about six words); the shop's own full title is
-- kept beside it for the admin (finding the piece on the shop, checking it). Admin only: no store_* view lists it
-- (D-003); tests.forbidden_keys() includes it.
-- =============================================================================
alter table public.products
  add column shop_title text check (char_length(shop_title) <= 300);

comment on column public.products.shop_title is
  'D-140: the shop''s own title of an imported piece (admin only); the name customers see is IWC''s.';

update public.products set shop_title = left(name, 300) where source_url is not null and shop_title is null;
