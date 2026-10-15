-- Weighing at the hub (migration 20261015170000, D-130): a picked piece's scale weight becomes its option's weight
-- (weighed), the listing is repriced, other sizes that still guess follow, and the pickup keeps what changed.
-- Admins only; only a picked piece.
begin;
select tests.setup();
update public.pricing_settings set beta_pricing = true where id = 1;

set local role authenticated;
select tests.act_as(tests.id('admin'));
select public.cutoff_cycle(tests.id('cycle'));
select tests.remember('pick_a', (select p.id from public.pickups p join public.order_items oi on oi.id = p.order_item_id
                                 where oi.order_id = tests.id('order_a')));
select tests.remember('pick_b', (select p.id from public.pickups p join public.order_items oi on oi.id = p.order_item_id
                                 where oi.order_id = tests.id('order_b')));

select tests.assert_fails(format('select public.admin_weigh_pickup(%L, 400)', tests.id('pick_a')), 'pickup_not_picked',
  'a piece is weighed once it is in hand (picked)');
select public.mark_pickup(tests.id('pick_a'), 'picked');
select tests.assert_fails(format('select public.admin_weigh_pickup(%L, 0)', tests.id('pick_a')), 'weight_invalid',
  'a weight is at least 1 g');

-- A hand-set price does not move.
select tests.assert((public.admin_weigh_pickup(tests.id('pick_a'), 400) ->> 'note')
                      = 'Weighed 400 g (it had no weight): the price is set by hand, unchanged',
  'a hand-set price stays, and the note says so');
reset role;
select tests.assert((select weight_g = 400 and weight_source = 'weighed' and weight_note like 'Weighed at the hub, order %'
                       from public.product_variants where id = tests.id('v_live')),
  'the option takes the scale''s weight, marked weighed');
select tests.assert((select weight_g = 400 and weight_source = 'similar' from public.product_variants where id = tests.id('v_live2')),
  'another size of the same piece without a weight takes it, marked as from a matching item');
select tests.assert((select weighed_g = 400 and weigh_note like 'Weighed 400 g%' from public.pickups where id = tests.id('pick_a')),
  'the pickup keeps what was weighed and what it changed');

-- An automatic price follows the scale: (₹1,000 ÷ 0.90 + 400 g × ₹2) ÷ 0.60 ÷ 92 = $34.62; at 600 g $41.87.
update public.products set price_auto = true where id = tests.id('p_live');
select tests.assert((select price_cents = 3462 from public.products where id = tests.id('p_live')),
  'the listing is priced on the weighed 400 g');
set local role authenticated;
select tests.act_as(tests.id('admin'));
create temp table w on commit drop as select public.admin_weigh_pickup(tests.id('pick_a'), 600) as j;
select tests.assert((select j ->> 'note' = 'Weighed 600 g (listed 400 g, +50%): price now $41.87, was $34.62'
                            and (j ->> 'big_change')::boolean from w),
  'weighing again reprices and says by how much the weight and the price moved');
reset role;
select tests.assert((select weight_g = 600 and weight_source = 'similar' from public.product_variants where id = tests.id('v_live2')),
  'a size that only had a matching item''s weight follows the new weighing, still marked similar (D-131)');
update public.product_variants set weight_g = 650, weight_source = 'admin' where id = tests.id('v_live2');
set local role authenticated;
select tests.act_as(tests.id('admin'));
select public.admin_weigh_pickup(tests.id('pick_a'), 610);
reset role;
select tests.assert((select weight_g = 650 and weight_source = 'admin' from public.product_variants where id = tests.id('v_live2')),
  'a typed weight on another size is left alone');

set local role authenticated;
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails(format('select public.admin_weigh_pickup(%L, 400)', tests.id('pick_a')), 'admin_only',
  'customers cannot weigh pieces');
select tests.act_as(tests.id('fake_admin'));
select tests.assert_fails(format('select public.admin_weigh_pickup(%L, 400)', tests.id('pick_a')), 'admin_only',
  'nor an admin role without the allowlist');
reset role;

rollback;
