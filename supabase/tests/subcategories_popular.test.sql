-- D-191: sub-categories on See all, the Popular order, a weight on every food card, Home's tiles and the renamed categories.
begin;
select tests.setup();
create function pg_temp.cat(p_slug text) returns uuid language sql as $$
  select id from public.categories where slug = p_slug
$$;
insert into public.categories (product_type, slug, name, sort_order)
values ('food', 'snacks-and-namkeen', 'Snacks & Namkeen', 90), ('food', 'bakery-and-biscuits', 'Bakery & Biscuits', 91)
on conflict (slug) do nothing;

insert into public.products (slug, name, product_type, category_id, price_cents, status, published_at)
values ('s-chips', 'Crunchy Potato Chips', 'food', pg_temp.cat('snacks-and-namkeen'), 800, 'live', now()),
       ('s-sev', 'Ratlami Sev', 'food', pg_temp.cat('snacks-and-namkeen'), 800, 'live', now()),
       ('s-other', 'Teekha Chatpata', 'food', pg_temp.cat('snacks-and-namkeen'), 800, 'live', now()),
       ('s-cheap', 'Tiny Namkeen', 'food', pg_temp.cat('snacks-and-namkeen'), 100, 'live', now()),
       ('s-dear', 'Grand Namkeen', 'food', pg_temp.cat('snacks-and-namkeen'), 9000, 'live', now()),
       ('s-cookie', 'Butter Cookies', 'food', pg_temp.cat('snacks-and-namkeen'), 800, 'live', now()),
       ('s-sold', 'Everyday Namkeen', 'food', pg_temp.cat('snacks-and-namkeen'), 800, 'live', now());
insert into public.product_variants (product_id, sku, label, qty_listed, weight_g, weight_source, net_qty, options)
select id, 'SP-' || slug, 'One size', 5, 150,
       case slug when 's-chips' then 'estimated' when 's-sev' then 'shop' end,
       case slug when 's-other' then '400 g' end, '{}'::jsonb
from public.products where slug like 's-%';

select public._refresh_places();

create function pg_temp.sub_of(p_slug text) returns text language sql as $$
  select s.slug from public.product_place pl
  join public.products p on p.id = pl.product_id
  left join public.subcategories s on s.id = pl.subcategory_id
  where p.slug = p_slug
$$;
select tests.assert(pg_temp.sub_of('s-chips') = 'chips-and-wafers', 'a name''s word picks its sub-category');
select tests.assert(pg_temp.sub_of('s-sev') = 'bhujia-and-mixtures', 'whole words, and the first rule that fits');
select tests.assert(pg_temp.sub_of('s-other') = 'namkeen-snacks', 'the rest take the category''s last sub-category');
select tests.assert(
  (select c.slug = 'bakery-and-biscuits' from public.products p join public.categories c on c.id = p.category_id where p.slug = 's-cookie'),
  'a biscuit moves from Snacks & Namkeen to Bakery & Biscuits');
select tests.assert(pg_temp.sub_of('s-cookie') = 'cookies', 'and takes a sub-category there');

select tests.assert(
  (select count(*) = 8 from public.subcategories where category_slug = 'snacks-and-namkeen')
  and (select count(*) = 7 from public.subcategories where category_slug = 'bakery-and-biscuits'),
  'the founder''s sub-categories for Snacks and Bakery');

-- the rail and the filter, one read
set local role anon;
select tests.assert(
  (select exists (select 1 from jsonb_array_elements(b -> 'subcategories') s where s ->> 'slug' = 'chips-and-wafers' and (s ->> 'count')::int = 1)
   from public.store_browse('food', p_category => 'snacks-and-namkeen', p_sort => 'popular') b),
  'store_browse lists a category''s sub-categories with their counts');
select tests.assert(
  (select (b ->> 'total')::int = 1 and b -> 'products' -> 0 ->> 'slug' = 's-chips'
          and jsonb_array_length(b -> 'subcategories') > 1
   from public.store_browse('food', p_category => 'snacks-and-namkeen', p_sub => 'chips-and-wafers', p_sort => 'popular') b),
  'a sub-category narrows the cards and the rail still lists its neighbours');
select tests.assert(
  (select jsonb_array_length(b -> 'categories') >= 2
   from public.store_browse('food', p_sub => 'chips-and-wafers', p_sort => 'popular') b),
  'and the Category filter keeps every category');
reset role;

-- Popular: what sells first, then moderate prices; the very cheap and the very dear after
create function pg_temp.first_slugs(n integer) returns text[] language sql as $$
  select array_agg(e ->> 'slug')
  from jsonb_array_elements(public.store_browse('food', p_category => 'snacks-and-namkeen', p_sort => 'popular', p_limit => n) -> 'products') e
$$;
select tests.assert(
  (select (band = 2) from public.product_place pl join public.products p on p.id = pl.product_id where p.slug = 's-dear')
  and (select (band = 2) from public.product_place pl join public.products p on p.id = pl.product_id where p.slug = 's-cheap')
  and (select (band = 0) from public.product_place pl join public.products p on p.id = pl.product_id where p.slug = 's-chips'),
  'moderate is measured against the category''s middle price');
select tests.assert(
  not ('s-dear' = any (pg_temp.first_slugs(3))) and not ('s-cheap' = any (pg_temp.first_slugs(3))),
  'with no sales yet, moderate prices come first');

insert into public.orders (email, status, est_delivery_from, est_delivery_to, subtotal_cents, total_cents, payment_status, shipping_address, payment_intent_id)
values ('pop@example.com', 'confirmed', current_date, current_date, 16000, 16000, 'paid', '{}'::jsonb, 'pi_popular');
insert into public.order_items (order_id, variant_id, product_id, product_name, variant_label, quantity, unit_price_cents, total_price_cents)
select o.id, v.id, p.id, p.name, v.label, 2, p.price_cents, 2 * p.price_cents
from public.orders o, public.products p join public.product_variants v on v.product_id = p.id
where o.payment_intent_id = 'pi_popular' and p.slug = 's-dear';
select public._refresh_places();
select tests.assert((pg_temp.first_slugs(1))[1] = 's-dear', 'what sells comes first, and a dearer piece can get there');

select tests.assert(
  (select public._refresh_places() = 0),
  'a refresh with nothing new writes no row');

-- a week's turn keeps one list stable between pages
select tests.assert(
  (select (select array_agg(e ->> 'slug') from jsonb_array_elements(public.store_browse('food', p_category => 'snacks-and-namkeen', p_sort => 'popular', p_limit => 2) -> 'products') e)
        = (pg_temp.first_slugs(4))[1:2]),
  'pages of one list agree');

-- a weight on every food card
create function pg_temp.pack(p_slug text) returns text language sql as $$
  select public._store_pack(p.id, p.name, p.product_type) from public.products p where p.slug = p_slug
$$;
select tests.assert(pg_temp.pack('s-chips') = 'About 150 g', 'an estimate says About');
select tests.assert(pg_temp.pack('s-sev') = '150 g', 'a known weight says so');
select tests.assert(pg_temp.pack('s-other') = '400 g', 'the label''s words first');
update public.product_variants set weight_g = 1250, weight_source = 'shop' where sku = 'SP-s-sev';
select tests.assert(pg_temp.pack('s-sev') like '%1.25 kg', 'kilos read as kilos');
select tests.assert(
  has_function_privilege('anon', 'public._pack_by_weight(uuid, public.product_type)', 'execute') is false,
  'the weight helper is not callable from outside');

-- Home's tiles and the names
select tests.assert(
  (select count(*) = 0 from jsonb_array_elements(public.store_home() -> 'categories') t where t ->> 'name' = 'Gifts'),
  'no Gifts tile: it merged into Pooja & Essentials');

rollback;
