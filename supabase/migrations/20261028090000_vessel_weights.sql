-- Founder, 2026-10-24: "the bottles are 450-550gms, the lunch boxes are 600-800gms". Their litres had been read as
-- their weight ("1 L" = 1 kg, then its packing), so a bottle cost $48 and a lunch box $73. The runner no longer does
-- (packages/shared vesselWeight); this corrects the listings already made: a bottle's or lunch box's option whose weight
-- no person set (hub-weighed or typed in the admin) and that is above the founder's range is priced on its middle,
-- 500 g or 700 g, packing included. The reprice trigger moves its price (D-128's rules unchanged).
-- Writes: one update of the matching options (a few hundred rows at most); no new data.

update public.product_variants v
   set weight_g = x.grams,
       weight_source = 'packed',
       weight_note = left(x.what || ': the founder''s typical weight, packed (2026-10-24); its litres are what it holds', 200)
  from (select p.id,
               case when p.name ~* '\m(lunch ?box(es)?|tiffins?)\M' then 700 else 500 end as grams,
               case when p.name ~* '\m(lunch ?box(es)?|tiffins?)\M' then 'a lunch box' else 'a bottle' end as what
          from public.products p
         where p.product_type = 'home'
           and p.name ~* '\m(lunch ?box(es)?|tiffins?|bottles?|flasks?)\M') x
 where v.product_id = x.id
   and coalesce(v.weight_source, '') not in ('weighed', 'admin')
   and v.weight_g > case when x.grams = 700 then 800 else 550 end;
