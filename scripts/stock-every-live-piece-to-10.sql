-- =============================================================================
-- Every piece on sale in stock, 10 of each (founder 2026-11-03: "put all items in stock except for liquids, all items
-- to 10"). The founder runs this once in Supabase's SQL editor (Claude never writes to the hosted database).
--  - "On sale" is every live listing. Liquids are left out by themselves: D-135's check archives them and shows them as
--    coming soon, so none is live. The result counts the live food and home listings that check has not looked at yet (it
--    runs on the sourcing runner): if that number is not 0, some of them may be liquids.
--  - Each active option gets 10 available: qty_listed = what open orders hold (qty_reserved) + 10, so an order already
--    placed keeps its pieces. Prices do not change (they follow weight and shop price, not stock).
--  - Each change is written to the stock log as an adjustment with this note, like an admin's own.
--  - The sourcing runner's next shop check sets stock from the shops again (D-118); nothing else changes it.
--  - The site shows the new stock within the hour (cached pages refresh after an hour, D-171); a sale refreshes its
--    own page at once.
-- To run: Supabase dashboard → SQL editor → New query → paste all of this → Run. The change is one transaction: if
-- anything fails nothing changes. The editor then shows one row: options_at_10 should equal options_on_sale.
-- =============================================================================
begin;
set local statement_timeout = '5min';

-- The change, logged as an adjustment.
select public._set_stock_context('adjusted', null, null, 'Founder 2026-11-03: every live piece to 10 in stock');
update public.product_variants v
   set qty_listed = v.qty_reserved + 10
  from public.products p
 where p.id = v.product_id
   and p.status = 'live' and not p.is_placeholder and v.is_active
   and v.qty_listed is distinct from v.qty_reserved + 10;

commit;

-- What the editor shows (it shows the last result only): every option on sale should read 10 available, and how many
-- live food and home listings the liquid check has not looked at.
select count(distinct p.id) as live_listings,
       count(*) as options_on_sale,
       count(*) filter (where v.qty_listed - v.qty_reserved = 10) as options_at_10,
       (select count(*) from public.products x
         where x.status = 'live' and not x.is_placeholder and x.product_type in ('food', 'home')
           and x.liquid_checked_at is null) as food_home_not_liquid_checked
from public.products p
join public.product_variants v on v.product_id = p.id
where p.status = 'live' and not p.is_placeholder and v.is_active;
