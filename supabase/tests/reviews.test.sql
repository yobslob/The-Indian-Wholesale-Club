-- Reviews (migration 20260930101257, D-051, D-056): who may write, who may add photos, moderation, and what
-- the store shows. Customer A's order is delivered (verified buyer of test-live); customer B's is not.
begin;
select tests.setup();
update public.orders set status = 'delivered' where id = tests.id('order_a');

-- Customer A (verified buyer) tries to publish their own review straight away and to fake nothing: the database
-- still makes it pending, and "verified" comes from the delivered order.
set local role authenticated;
select tests.act_as(tests.id('cust_a'));
insert into public.reviews (product_id, user_id, rating, body, display_name, status, is_verified_buyer)
values (tests.id('p_live'), tests.id('cust_a'), 5, '  Just like home.  ', 'Anu K.', 'approved', false);
select tests.assert(
  (select status = 'pending' and is_verified_buyer and body = 'Just like home.' from public.reviews
   where user_id = tests.id('cust_a')),
  'a new review is pending whatever the customer sends; verified comes from a delivered order');
select tests.assert(
  (public.review_eligibility(tests.id('p_live')) ->> 'is_verified_buyer')::boolean
  and (public.review_eligibility(tests.id('p_live')) ->> 'has_reviewed')::boolean,
  'review_eligibility: A is a verified buyer and has reviewed');
select tests.assert_fails(
  format('insert into public.reviews (product_id, user_id, rating, body, display_name) values (%L, %L, 4, %L, %L)',
         tests.id('p_live'), tests.id('cust_a'), 'Again', 'Anu'),
  '23505', 'one review per customer per product');
insert into public.review_photos (review_id, storage_path, sort_order)
select r.id, format('%s/%s/%s.jpg', tests.id('cust_a'), r.id, n), n
from public.reviews r, generate_series(1, 4) n where r.user_id = tests.id('cust_a');
select tests.assert((select count(*) from public.review_photos) = 4, 'a verified buyer adds up to four photos');
select tests.assert_fails(
  format('insert into public.review_photos (review_id, storage_path) select id, %L from public.reviews where user_id = %L',
         'x/5.jpg', tests.id('cust_a')),
  'review_photos_limit', 'no fifth photo');
select tests.assert(
  tests.rows_affected(format('update public.reviews set status = %L where user_id = %L', 'approved', tests.id('cust_a'))) = 0,
  'a customer cannot approve their own review');
reset role;

-- Customer B (ordered, not delivered): text and rating only.
set local role authenticated;
select tests.act_as(tests.id('cust_b'));
insert into public.reviews (product_id, user_id, rating, body, display_name, is_verified_buyer)
values (tests.id('p_live'), tests.id('cust_b'), 2, 'Colour was not as in the photo.', 'Ben', true);
select tests.assert(
  (select not is_verified_buyer from public.reviews where user_id = tests.id('cust_b')),
  'claiming "verified" does not make it so');
select tests.assert(
  not (public.review_eligibility(tests.id('p_live')) ->> 'is_verified_buyer')::boolean,
  'review_eligibility: B is not a verified buyer');
select tests.assert_fails(
  format('insert into public.review_photos (review_id, storage_path) select id, %L from public.reviews where user_id = %L',
         'b/1.jpg', tests.id('cust_b')),
  'photos_verified_buyers_only', 'photos only from verified buyers');
select tests.assert_fails(
  format('insert into public.reviews (product_id, user_id, rating, body, display_name) values (%L, %L, 1, %L, %L)',
         tests.id('p_draft'), tests.id('cust_a'), 'Not me', 'Fake'),
  '42501', 'nobody can write a review in someone else''s name');
select tests.assert((select count(*) from public.reviews) = 1, 'customers see only their own reviews');
reset role;

set local role anon;
select tests.assert_fails(
  format('insert into public.reviews (product_id, user_id, rating, body, display_name) values (%L, %L, 5, %L, %L)',
         tests.id('p_live'), tests.id('cust_a'), 'Anon', 'Anon'),
  '42501', 'signed-out visitors cannot write reviews');
select tests.assert(
  (public.store_product_page('test-region', 'test-live') -> 'reviews' ->> 'count')::int = 0,
  'pending reviews never show in the store');
reset role;

-- The admin approves A's review and rejects B's.
set local role authenticated;
select tests.act_as(tests.id('admin'));
update public.reviews set status = 'approved', moderated_at = now(), moderated_by = tests.id('admin')
where user_id = tests.id('cust_a');
update public.reviews set status = 'rejected', moderated_at = now(), moderated_by = tests.id('admin')
where user_id = tests.id('cust_b');
reset role;

set local role anon;
select tests.assert(
  (select (d ->> 'count')::int = 1 and (d ->> 'average')::numeric = 5.0 and (d -> 'histogram' ->> '5')::int = 1
          and jsonb_array_length(d -> 'items') = 1 and jsonb_array_length(d -> 'items' -> 0 -> 'photos') = 4
          and (d -> 'items' -> 0 ->> 'is_verified_buyer')::boolean
   from (select public.store_product_page('test-region', 'test-live') -> 'reviews' as d) x),
  'only the approved review shows, with its summary and photos; the rejected one does not');
select tests.assert(
  not exists (select 1 from tests.json_keys(public.store_product_page('test-region', 'test-live')) k
              where k = any (tests.forbidden_keys())),
  'INV-1: no user id or other admin-only key in the reviews');
select tests.assert(
  (select count(*) from public.store_reviews) = 1 and (select count(*) from public.store_review_photos) = 4,
  'store_reviews / store_review_photos hold approved reviews only');
select tests.assert_fails('select * from public.reviews', '42501', 'anon cannot read the reviews table');
reset role;

-- A review of a product that is no longer visible disappears from the store.
update public.products set status = 'paused' where id = tests.id('p_live');
set local role anon;
select tests.assert((select count(*) from public.store_reviews) = 0, 'reviews of hidden products are not shown');
reset role;

rollback;
