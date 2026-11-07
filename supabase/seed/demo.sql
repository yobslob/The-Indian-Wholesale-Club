-- =============================================================================
-- DEV ONLY. NEVER run against production (INV-8, data-model.md §Seed).
-- Every row here is fake: is_placeholder = true. Numbers below (prices,
-- quantities, delivery days, dates) are DEV PLACEHOLDERS, not business decisions.
-- =============================================================================

-- Let store_* views show placeholder products and draft region text locally.
update public.app_settings set value = 'true'::jsonb where key = 'dev_preview';

-- DEV PLACEHOLDER delivery days so checkout can compute a window locally.
update public.pricing_settings set domestic_days_min = 3, domestic_days_max = 7 where id = 1;

update public.regions set is_live = true where slug in ('kerala', 'rajasthan', 'punjab');

insert into public.products (id, slug, name, product_type, region_id, category_id,
                             summary, price_cents, shop_price_paise, status, is_placeholder, published_at)
select p.id::uuid, p.slug, p.name, 'clothing', r.id, c.id,
       'Demo product for local development.', p.price_cents, p.shop_price_paise, 'live', true, now()
from (values
  ('00000000-0000-4000-8000-000000000201', 'demo-kerala-kasavu-saree', 'Demo Kasavu Saree', 'kerala', 'sarees', 9900, 250000),
  ('00000000-0000-4000-8000-000000000202', 'demo-kerala-mundu', 'Demo Mundu', 'kerala', 'dhotis-and-mundus', 3900, 90000),
  ('00000000-0000-4000-8000-000000000203', 'demo-rajasthan-bandhani-dupatta', 'Demo Bandhani Dupatta', 'rajasthan',
   'dupattas-and-stoles', 4900, 120000),
  ('00000000-0000-4000-8000-000000000204', 'demo-punjab-phulkari-dupatta', 'Demo Phulkari Dupatta', 'punjab',
   'dupattas-and-stoles', 5900, 150000)
) as p (id, slug, name, region_slug, category_slug, price_cents, shop_price_paise)
join public.regions r on r.slug = p.region_slug
join public.categories c on c.slug = p.category_slug;

insert into public.product_variants (product_id, sku, label, options, qty_listed)
values
  ('00000000-0000-4000-8000-000000000201', 'DEMO-KER-SAR-1', 'Free size', '{"size": "Free size"}', 3),
  ('00000000-0000-4000-8000-000000000202', 'DEMO-KER-MUN-1', 'Free size', '{"size": "Free size"}', 5),
  ('00000000-0000-4000-8000-000000000203', 'DEMO-RAJ-DUP-1', 'Red', '{"colour": "Red"}', 4),
  ('00000000-0000-4000-8000-000000000204', 'DEMO-PUN-DUP-1', 'Orange', '{"colour": "Orange"}', 2);

-- DEV: one Curated for you pick (D-056) so the section shows locally.
update public.products set is_curated = true where id = '00000000-0000-4000-8000-000000000202';

-- DEV: two listings with looks (D-194), so e2e can pick one and see its photo. The files don't exist locally: the tests
-- answer the photo requests themselves.
insert into public.products (id, slug, name, product_type, region_id, category_id,
                             summary, price_cents, shop_price_paise, status, is_placeholder, published_at)
select p.id::uuid, p.slug, p.name, p.product_type::public.product_type, r.id, c.id,
       'Demo product for local development.', p.price_cents, p.shop_price_paise, 'live', true, now()
from (values
  ('00000000-0000-4000-8000-000000000301', 'demo-looks-kurta', 'Demo Looks Kurta', 'clothing', 'punjab', 'kurtas', 3900, 90000),
  ('00000000-0000-4000-8000-000000000302', 'demo-looks-masala', 'Demo Looks Masala', 'food', 'punjab', 'masala-blends', 900, 20000)
) as p (id, slug, name, product_type, region_slug, category_slug, price_cents, shop_price_paise)
join public.regions r on r.slug = p.region_slug
join public.categories c on c.slug = p.category_slug;

insert into public.product_variants (id, product_id, sku, label, options, qty_listed)
values
  ('00000000-0000-4000-8000-000000000311', '00000000-0000-4000-8000-000000000301', 'DEMO-LOOK-N-S', 'Navy · S', '{"colour": "Navy", "size": "S"}', 5),
  ('00000000-0000-4000-8000-000000000312', '00000000-0000-4000-8000-000000000301', 'DEMO-LOOK-N-M', 'Navy · M', '{"colour": "Navy", "size": "M"}', 5),
  ('00000000-0000-4000-8000-000000000313', '00000000-0000-4000-8000-000000000301', 'DEMO-LOOK-N-L', 'Navy · L', '{"colour": "Navy", "size": "L"}', 5),
  ('00000000-0000-4000-8000-000000000314', '00000000-0000-4000-8000-000000000301', 'DEMO-LOOK-M-S', 'Maroon · S', '{"colour": "Maroon", "size": "S"}', 5),
  ('00000000-0000-4000-8000-000000000315', '00000000-0000-4000-8000-000000000301', 'DEMO-LOOK-M-M', 'Maroon · M', '{"colour": "Maroon", "size": "M"}', 5),
  ('00000000-0000-4000-8000-000000000316', '00000000-0000-4000-8000-000000000301', 'DEMO-LOOK-M-L', 'Maroon · L', '{"colour": "Maroon", "size": "L"}', 5),
  ('00000000-0000-4000-8000-000000000321', '00000000-0000-4000-8000-000000000302', 'DEMO-LOOK-1', 'Single', '{"pack": "Single"}', 5),
  ('00000000-0000-4000-8000-000000000322', '00000000-0000-4000-8000-000000000302', 'DEMO-LOOK-F', 'Family pack', '{"pack": "Family pack"}', 5);

insert into public.product_media (product_id, variant_id, storage_path, alt_text, sort_order, is_primary)
values
  ('00000000-0000-4000-8000-000000000301', null, 'products/00000000-0000-4000-8000-000000000301/s/main.jpg', 'Demo Looks Kurta', 0, true),
  ('00000000-0000-4000-8000-000000000301', null, 'products/00000000-0000-4000-8000-000000000301/s/shared.jpg', 'Demo Looks Kurta', 1, false),
  -- tagged to Navy M and Maroon L: every size of the colour shows it
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000312', 'products/00000000-0000-4000-8000-000000000301/s/navy.jpg', 'Demo Looks Kurta, Navy', 2, false),
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000316', 'products/00000000-0000-4000-8000-000000000301/s/maroon.jpg', 'Demo Looks Kurta, Maroon', 3, false),
  ('00000000-0000-4000-8000-000000000302', null, 'products/00000000-0000-4000-8000-000000000302/s/main.jpg', 'Demo Looks Masala', 0, true),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000322', 'products/00000000-0000-4000-8000-000000000302/s/family.jpg', 'Demo Looks Masala, Family pack', 1, false);
