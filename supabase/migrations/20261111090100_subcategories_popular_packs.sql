-- =============================================================================
-- D-191 (founder 2026-11-07): sub-categories, Popular, a weight on every food card, the renamed categories and tiles.
-- Sub-categories: rows in `subcategories` (word rules, first match wins, the last of a category takes the rest). A listing's
-- own sub-category and Popular's numbers sit in `product_place`, apart from `products`, so the daily refresh never touches
-- the catalogue's rows or their triggers. Bakery & Biscuits is a new category: biscuits leave Snacks & Namkeen.
-- Popular: pieces ordered in 90 days, weighted towards moderate prices for the category; ties take turns week by week.
-- Cost: about 60 bytes a listing (1 MB at 15,000); one more group in store_browse's single read, about 7 KB of JSON on a
-- whole type's page, less on a category's; no new page-cache write, no index, one short job inside the daily iwc-tidy.
-- =============================================================================

update public.categories set name = 'Noodles, Soups & Staples' where slug = 'rice-flours-and-staples';
update public.categories set name = 'Pooja & Essentials' where slug = 'pooja-and-spiritual';

-- only where the catalogue's categories exist (production: here; a fresh local database: seed/categories.sql)
insert into public.categories (product_type, slug, name, sort_order, default_weight_g, tax_class)
select 'food', 'bakery-and-biscuits', 'Bakery & Biscuits', c.sort_order, c.default_weight_g, c.tax_class
from public.categories c where c.slug = 'snacks-and-namkeen'
on conflict do nothing;

create table public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_slug text not null,
  slug text not null unique,
  name text not null,
  sort_order integer not null,
  -- a regular expression's alternatives, matched as whole words on the listing's name; null = the rest of the category
  words text
);
comment on table public.subcategories is 'D-191: the rail on See all pages. Read only through store_browse.';
alter table public.subcategories enable row level security;
revoke all on table public.subcategories from public, anon, authenticated;

insert into public.subcategories (category_slug, slug, name, sort_order, words) values
  ('snacks-and-namkeen', 'nachos', 'Nachos', 10, 'nachos?|tortilla'),
  ('snacks-and-namkeen', 'popcorn', 'Popcorn', 20, 'pop ?corn'),
  ('snacks-and-namkeen', 'chips-and-wafers', 'Chips & Wafers', 30, 'chips?|wafers?|crisps?|kurkure|puffs?|banana fry|tapioca'),
  ('snacks-and-namkeen', 'papad-and-fryums', 'Papad & Fryums', 40, 'papads?|fryums?|appalam'),
  ('snacks-and-namkeen', 'bhujia-and-mixtures', 'Bhujia & Mixtures', 50, 'bhujia|bhujiya|mixtures?|sev|chivda|chiwda|chevdo|dal ?moth|navratt?an|khatta meetha|moong dal|boondi|mix namkeen'),
  ('snacks-and-namkeen', 'healthy-snacks', 'Healthy Snacks', 60, 'makhanas?|protein|millets?|baked|healthy|ragi|quinoa|seeds?|sugar[- ]free|granola|bars?|energy|oats|fox ?nuts?|diet|low[- ]fat|gluten'),
  ('snacks-and-namkeen', 'premium', 'Premium', 70, 'premium|gourmet|luxury|cashews?|kaju|almonds?|badam|walnuts?|pistachios?|pista|dates|dry ?fruits?|nuts|anjeer|figs?|raisins?|apricots?|hazelnuts?|macadamia|peanuts?|groundnuts?'),
  ('snacks-and-namkeen', 'namkeen-snacks', 'Namkeen Snacks', 80, null),
  ('bakery-and-biscuits', 'choco-fills', 'Choco Fills', 10, 'choco|chocolate|chocolatey|hide ?& ?seek|bourbon|dark fantasy|fills?'),
  ('bakery-and-biscuits', 'cream-biscuits', 'Cream Biscuits', 20, 'creams?|jim ?jam|oreo|sandwich'),
  ('bakery-and-biscuits', 'rusks-and-wafers', 'Rusks & Wafers', 30, 'rusks?|toasts?|wafers?|khari|cakes?'),
  ('bakery-and-biscuits', 'glucose-and-marie', 'Glucose & Marie', 40, 'glucose|marie|parle-?g|tiger'),
  ('bakery-and-biscuits', 'healthy-and-digestive', 'Healthy & Digestive', 50, 'digestives?|oats|ragi|millets?|sugar[- ]free|multigrain|nutri|whole ?wheat|fib(er|re)|healthy|protein|jowar|bajra|gluten|keto'),
  ('bakery-and-biscuits', 'cookies', 'Cookies', 60, 'cookies?|nankhatai|naan ?khatai|butter|good ?day'),
  ('bakery-and-biscuits', 'sweet-and-salty', 'Sweet & Salty', 70, null),
  ('sweets', 'chocolates', 'Chocolates', 10, 'chocolates?|choco|cadbury|kit ?kat|nestle|dairy milk|5 star|perk|munch|ferrero|celebrations|silk|snickers|amul dark'),
  ('sweets', 'mouth-fresheners', 'Mouth Fresheners', 20, 'mukhwas|mouth|fresheners?|paan|saunf|supari|digestive'),
  ('sweets', 'candy-and-toffee', 'Candy & Toffee', 30, 'candy|candies|toffees?|lollipops?|imli|mints?|gum|pulse|kismi|jell(y|ies)|aam ?papad|goli|churan|fruit bar'),
  ('sweets', 'chikki-and-gajak', 'Chikki & Gajak', 40, 'chikkis?|gajak|gazak|til|revdi|rewri|sesame|peanut bar'),
  ('sweets', 'laddu-and-barfi', 'Laddu & Barfi', 50, 'laddus?|ladoos?|laddoos?|barfi|burfi|katli|peda|soan|sohan|halwa|mysore|pak|gulab|rasgulla|mithai|petha|ghevar|kaju|ghee|bal mithai|balushahi|mohan ?thal|sweets?'),
  ('sweets', 'gift-boxes', 'Gift Boxes', 60, 'gifts?|box|assorted|hamper'),
  ('sweets', 'more-sweets', 'More Sweets', 70, null),
  ('rice-flours-and-staples', 'noodles', 'Noodles', 10, 'noodles?|hakka|maggi|ramen|yippee|wai wai'),
  ('rice-flours-and-staples', 'soups', 'Soups', 20, 'soups?'),
  ('rice-flours-and-staples', 'pasta-and-vermicelli', 'Pasta & Vermicelli', 30, 'pasta|vermicelli|macaroni|sevai|seviyan|semiya|spaghetti|penne'),
  ('rice-flours-and-staples', 'breakfast-and-cereals', 'Breakfast & Cereals', 40, 'muesli|corn ?flakes?|flakes|oats|poha|upma|idli|dosa|breakfast|kellogg|granola|pancake|chillas?|mixes|instant'),
  ('rice-flours-and-staples', 'atta-and-flours', 'Atta & Flours', 50, 'atta|flours?|besan|maida|rava|sooji|suji|sattu'),
  ('rice-flours-and-staples', 'dal-and-pulses', 'Dal & Pulses', 60, 'dal|dhal|daal|rajma|chana|chole|toor|arhar|moong|urad|masoor|lentils?|kabuli|pulses|lobia|soya|peas'),
  ('rice-flours-and-staples', 'rice', 'Rice', 70, 'rice|basmati|kolam|sona masoori|biryani'),
  ('rice-flours-and-staples', 'millets-and-grains', 'Millets & Grains', 80, 'millets?|ragi|bajra|jowar|quinoa|barley|sabudana|wheat|grains?|daliya|dalia'),
  ('rice-flours-and-staples', 'sugar-and-jaggery', 'Sugar & Jaggery', 90, 'sugar|jaggery|gur|shakkar|honey'),
  ('rice-flours-and-staples', 'more-staples', 'More Staples', 100, null),
  ('tea-and-drinks', 'coffee', 'Coffee', 10, 'coffee|nescafe|bru|filter'),
  ('tea-and-drinks', 'green-and-herbal', 'Green & Herbal', 20, 'green tea|herbal|tulsi|chamomile|kahwa|infusion|detox|hibiscus'),
  ('tea-and-drinks', 'masala-chai', 'Masala Chai', 30, 'chai|masala tea|kadak'),
  ('tea-and-drinks', 'tea', 'Tea', 40, 'tea|teas|assam|darjeeling|ctc'),
  ('tea-and-drinks', 'health-drinks', 'Health Drinks', 50, 'horlicks|complan|bournvita|boost|glucon|protein|energy|nutrition|malt|immunity'),
  ('tea-and-drinks', 'more-drinks', 'More Drinks', 60, null),
  ('pickles-and-chutneys', 'chutneys', 'Chutneys', 10, 'chutneys?|thokku|podi|sauce'),
  ('pickles-and-chutneys', 'non-veg-pickles', 'Non-veg Pickles', 20, 'chicken|mutton|prawns?|fish'),
  ('pickles-and-chutneys', 'mango-pickles', 'Mango Pickles', 30, 'mango|aam|avakaya|kairi'),
  ('pickles-and-chutneys', 'chilli-and-garlic', 'Chilli & Garlic', 40, 'chill?i|mirch|garlic|lasun|lahsun'),
  ('pickles-and-chutneys', 'lime-and-lemon', 'Lime & Lemon', 50, 'limes?|lemons?|nimbu'),
  ('pickles-and-chutneys', 'mixed-pickles', 'Mixed Pickles', 60, 'mixed|mix'),
  ('pickles-and-chutneys', 'murabba', 'Murabba', 70, 'murabb?a'),
  ('pickles-and-chutneys', 'more-pickles', 'More Pickles', 80, null),
  ('masala-blends', 'chicken-and-meat', 'Chicken & Meat', 10, 'chicken|mutton|meat|fish|egg|prawns?|kebabs?|keema'),
  ('masala-blends', 'biryani-and-pulao', 'Biryani & Pulao', 20, 'biryani|biriyani|pulao'),
  ('masala-blends', 'sambar-and-rasam', 'Sambar & Rasam', 30, 'sambar|rasam|podi|idli|gun ?powder|puliyogare|bisi'),
  ('masala-blends', 'chai-masala', 'Chai Masala', 40, 'tea|chai'),
  ('masala-blends', 'veg-curries', 'Chole, Pav Bhaji & Curries', 50, 'pav|bhaji|chole|chana|rajma|kitchen king|paneer|aloo|dal|sabzi|curry|korma|shahi'),
  ('masala-blends', 'garam-masala', 'Garam Masala', 60, 'garam'),
  ('masala-blends', 'seasonings-and-pastes', 'Seasonings & Pastes', 70, 'seasonings?|pastes?|chaat|peri|oregano|chutney'),
  ('masala-blends', 'more-masalas', 'More Masalas', 80, null),
  ('whole-spices', 'saffron', 'Saffron', 10, 'saffron|kesar'),
  ('whole-spices', 'cardamom-and-cloves', 'Cardamom, Cinnamon & Cloves', 20, 'cardamom|elaichi|cinnamon|dalchini|cloves?|laung|star anise|anise|nutmeg|mace|javitri|jaiphal'),
  ('whole-spices', 'pepper-and-chillies', 'Pepper & Chillies', 30, 'peppers?|peppercorns?|kali mirch|chill?i(es)?|mirch'),
  ('whole-spices', 'seeds', 'Seeds', 40, 'seeds?|cumin|jeera|fennel|saunf|methi|fenugreek|mustard|rai|ajwain|kalonji|coriander|dhania'),
  ('whole-spices', 'leaves-and-herbs', 'Leaves & Herbs', 50, 'bay|tej|kasuri|leaf|leaves|patta|herbs?'),
  ('whole-spices', 'more-whole-spices', 'More Whole Spices', 60, null),
  ('ground-spices', 'chilli-powder', 'Chilli Powder', 10, 'chill?i|mirch|kashmiri'),
  ('ground-spices', 'turmeric', 'Turmeric', 20, 'turmeric|haldi|lakadong'),
  ('ground-spices', 'coriander-and-cumin', 'Coriander & Cumin', 30, 'coriander|dhania|dhaniya|cumin|jeera'),
  ('ground-spices', 'hing', 'Hing', 40, 'hing|asafoetida'),
  ('ground-spices', 'salts', 'Salts', 50, 'salt|namak'),
  ('ground-spices', 'more-ground-spices', 'More Ground Spices', 60, null),
  ('papad-and-wadi', 'wadi-and-badi', 'Wadi & Badi', 10, 'wadi|badi|vadi|mangodi|bakarwadi|bhakarwadi'),
  ('papad-and-wadi', 'fryums', 'Fryums', 20, 'fryums?|sabudana|sandige|fry'),
  ('papad-and-wadi', 'papad', 'Papad', 30, null),
  ('pooja-and-spiritual', 'idols-and-murtis', 'Idols & Murtis', 10, 'idols?|murtis?|statues?|ganesh|ganesha|ganpati|laxmi|lakshmi|krishna|gopal|durga|shiva|shivling|hanuman|mata|maa|lord'),
  ('pooja-and-spiritual', 'diyas-and-lamps', 'Diyas & Lamps', 20, 'diyas?|lamps?|deepak|jyot|akhand|deep'),
  ('pooja-and-spiritual', 'incense-and-dhoop', 'Incense & Dhoop', 30, 'incense|agarbatti|dhoop|sambrani|loban|camphor|kapoor|attar'),
  ('pooja-and-spiritual', 'mandirs', 'Mandirs', 40, 'mandir|temple'),
  ('pooja-and-spiritual', 'thalis-and-bells', 'Thalis & Bells', 50, 'thali|aarti|kalash|bells?|ghanti|chowki|chauki|lota'),
  ('pooja-and-spiritual', 'malas-and-beads', 'Malas & Beads', 60, 'malas?|rudraksha|beads?|bracelet'),
  ('pooja-and-spiritual', 'pooja-essentials', 'Pooja Essentials', 70, null),
  ('thaali-and-serveware', 'bottles-and-jugs', 'Bottles & Jugs', 10, 'bottles?|flasks?|thermos|jugs?'),
  ('thaali-and-serveware', 'lunch-and-storage', 'Lunch & Storage', 20, 'lunch|tiffin|dabba|containers?|storage|box|jar'),
  ('thaali-and-serveware', 'cups-and-glasses', 'Cups & Glasses', 30, 'cups?|mugs?|glass|glasses|tumblers?|kulhad'),
  ('thaali-and-serveware', 'cookware', 'Cookware', 40, 'cooker|kadai|kadhai|tawa|pans?|pots?|handi|kitchen|karahi'),
  ('thaali-and-serveware', 'plates-and-bowls', 'Plates & Bowls', 50, 'thalis?|plates?|katori|bowls?|dinner|spoons?|forks?|trays?|platter|serving'),
  ('thaali-and-serveware', 'table-linen-and-coasters', 'Coasters & Table', 60, 'coasters?|table|runner|mats?'),
  ('thaali-and-serveware', 'more-serveware', 'More Serveware', 70, null),
  ('handicrafts-and-decor', 'torans-and-hangings', 'Torans & Hangings', 10, 'toran|hangings?|door|bandhanwar|garlands?|marigold|jhoomar|latkan'),
  ('handicrafts-and-decor', 'candles-and-holders', 'Candles & Holders', 20, 'candles?|tealights?|tea lights?|holders?|wax'),
  ('handicrafts-and-decor', 'rangoli-and-lights', 'Rangoli & Lights', 30, 'rangoli|lights?|lantern|akash|kandil'),
  ('handicrafts-and-decor', 'wall-decor', 'Wall Decor', 40, 'wall|paintings?|art|frames?|mirror'),
  ('handicrafts-and-decor', 'showpieces', 'Showpieces', 50, 'showpieces?|statues?|idols?|elephants?|figurines?|sculptures?|buddha'),
  ('handicrafts-and-decor', 'flowers-and-vases', 'Flowers & Vases', 60, 'flowers?|artificial|vases?|floral'),
  ('handicrafts-and-decor', 'gifting', 'Gifting', 70, 'gifts?|hamper|box'),
  ('handicrafts-and-decor', 'more-decor', 'More Decor', 80, null),
  ('sarees', 'silk-sarees', 'Silk Sarees', 10, 'silk|kanjeevaram|kanjivaram|banarasi|paithani|tussar|mysore'),
  ('sarees', 'cotton-sarees', 'Cotton Sarees', 20, 'cotton|handloom|jamdani|kantha|linen'),
  ('sarees', 'chiffon-and-georgette', 'Chiffon & Georgette', 30, 'chiffon|georgette|organza'),
  ('sarees', 'more-sarees', 'More Sarees', 40, null),
  ('kurtas', 'mens-kurtas', 'Men''s Kurtas', 10, 'men|mens'),
  ('kurtas', 'anarkali', 'Anarkali', 20, 'anarkali'),
  ('kurtas', 'embroidered-kurtis', 'Embroidered', 30, 'embroider\w*|chikan\w*|sequin\w*|thread'),
  ('kurtas', 'printed-kurtis', 'Printed', 40, 'print\w*|bandhani|floral|motifs?'),
  ('kurtas', 'everyday-kurtis', 'Everyday', 50, null),
  ('suits-and-sets', 'mens-sets', 'Men''s Sets', 10, 'men|mens|nehru|pyjamas?'),
  ('suits-and-sets', 'sharara-and-palazzo', 'Sharara & Palazzo', 20, 'sharara|gharara|palazzos?'),
  ('suits-and-sets', 'anarkali-sets', 'Anarkali Sets', 30, 'anarkali'),
  ('suits-and-sets', 'with-dupatta', 'With Dupatta', 40, 'dupatta'),
  ('suits-and-sets', 'kurta-sets', 'Kurta Sets', 50, null),
  ('jeans-and-trousers', 'palazzos-and-flared', 'Palazzos & Flared', 10, 'palazzos?|flared'),
  ('jeans-and-trousers', 'skirts', 'Skirts', 20, 'skirts?'),
  ('jeans-and-trousers', 'shorts', 'Shorts', 30, 'shorts?'),
  ('jeans-and-trousers', 'pants', 'Pants', 40, null),
  ('shirts-and-tops', 'blouses', 'Blouses', 10, 'blouses?'),
  ('shirts-and-tops', 'shirts', 'Shirts', 20, 'shirts?'),
  ('shirts-and-tops', 'tanks-and-corsets', 'Tanks & Corsets', 30, 'cami|tank|corset|halter'),
  ('shirts-and-tops', 'tops', 'Tops', 40, null),
  ('co-ords-and-dresses', 'co-ords', 'Co-ords', 10, 'co-?ords?|sets?'),
  ('co-ords-and-dresses', 'maxi-dresses', 'Maxi', 20, 'maxi'),
  ('co-ords-and-dresses', 'bodycon', 'Bodycon', 30, 'bodycon'),
  ('co-ords-and-dresses', 'skirts-and-more', 'Skirts', 40, 'skirts?'),
  ('co-ords-and-dresses', 'ethnic-dresses', 'Ethnic', 50, 'anarkali|ethnic'),
  ('co-ords-and-dresses', 'dresses', 'Dresses', 60, null),
  ('footwear', 'mojaris-and-juttis', 'Mojaris & Juttis', 10, 'mojaris?|juttis?'),
  ('footwear', 'kolhapuri', 'Kolhapuri', 20, 'kolhapuri'),
  ('footwear', 'sandals-and-flats', 'Sandals & Flats', 30, 'sandals?|slippers?|flats?'),
  ('footwear', 'more-footwear', 'More Footwear', 40, null),
  ('kids', 'girls', 'Girls', 10, 'girls?'),
  ('kids', 'boys', 'Boys', 20, 'boys?'),
  ('kids', 'more-kids', 'More for Kids', 30, null);

create table public.product_place (
  product_id uuid primary key references public.products (id) on delete cascade,
  subcategory_id uuid references public.subcategories (id) on delete set null,
  sold_90d integer not null default 0,
  band smallint not null default 1,
  score integer not null default 0
);
comment on table public.product_place is 'D-191: a listing''s sub-category and Popular''s numbers, from _refresh_places once a day.';
alter table public.product_place enable row level security;
revoke all on table public.product_place from public, anon, authenticated;

create function public._refresh_places() returns integer
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_n integer;
begin
  -- a new biscuit imported into Snacks & Namkeen moves over
  update public.products p
     set category_id = b.id
    from public.categories s, public.categories b
   where s.slug = 'snacks-and-namkeen' and b.slug = 'bakery-and-biscuits'
     and p.category_id = s.id
     and p.name ~* '\m(biscuits?|cookies?|rusks?|toasts?|crackers?|bourbon|marie|khari|nankhatai|naan ?khatai|cakes?|bakery|digestives?|oreo|hide ?& ?seek|good ?day|dark fantasy|jim ?jam|monaco|krackjack|parle-?g|tiger|cream wafers?|choco\w* wafers?|wafer rolls?|wafer bars?)\M';

  with live as (
    select p.id, p.name, p.price_cents, c.slug as cat
    from public.products p
    join public.categories c on c.id = p.category_id
    where p.status = 'live'),
  mids as (
    select cat, percentile_cont(0.5) within group (order by price_cents) as mid
    from live group by cat),
  sold as (
    select oi.product_id, sum(oi.quantity)::integer as n
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.created_at >= now() - interval '90 days'
      and o.payment_status in ('paid', 'partially_refunded')
      and oi.status = 'active'
    group by oi.product_id),
  worked as (
    select l.id,
           (select s.id from public.subcategories s
             where s.category_slug = l.cat
               and (s.words is null or l.name ~* ('\m(' || s.words || ')\M'))
             order by s.sort_order limit 1) as sub,
           coalesce(so.n, 0) as sold_90d,
           -- moderate for its category: 0.7 to 2 times the middle price; then 0.4 to 4 times; then the rest
           case when l.price_cents between m.mid * 0.7 and m.mid * 2 then 0
                when l.price_cents between m.mid * 0.4 and m.mid * 4 then 1
                else 2 end as band
    from live l
    join mids m on m.cat = l.cat
    left join sold so on so.product_id = l.id)
  insert into public.product_place as pl (product_id, subcategory_id, sold_90d, band, score)
  select w.id, w.sub, w.sold_90d, w.band, w.sold_90d * (3 - w.band) from worked w
  on conflict (product_id) do update
    set subcategory_id = excluded.subcategory_id, sold_90d = excluded.sold_90d, band = excluded.band, score = excluded.score
    where (pl.subcategory_id, pl.sold_90d, pl.band, pl.score)
          is distinct from (excluded.subcategory_id, excluded.sold_90d, excluded.band, excluded.score);
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public._refresh_places() from public, anon, authenticated;

create or replace function public._tidy() returns jsonb
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_batch constant integer := 2000;
  v_rounds constant integer := 20;
  v_n integer;
  v_webhooks integer := 0;
  v_emails integer := 0;
  v_errors integer := 0;
  v_searches integer := 0;
  v_runs integer := 0;
begin
  -- D-191: the rail's sub-categories and Popular's order; a failure here must not stop the clean-up
  begin
    perform public._refresh_places();
  exception when others then
    raise warning '_refresh_places failed: %', sqlerrm;
  end;
  for i in 1 .. v_rounds loop
    delete from public.webhook_events where id in (
      select id from public.webhook_events
      where status = 'done' and processed_at < now() - interval '30 days' limit v_batch);
    get diagnostics v_n = row_count;
    v_webhooks := v_webhooks + v_n;
    exit when v_n < v_batch;
  end loop;
  for i in 1 .. v_rounds loop
    delete from public.email_outbox where id in (
      select id from public.email_outbox
      where status = 'sent' and sent_at < now() - interval '30 days' limit v_batch);
    get diagnostics v_n = row_count;
    v_emails := v_emails + v_n;
    exit when v_n < v_batch;
  end loop;
  for i in 1 .. v_rounds loop
    delete from public.admin_error_events where id in (
      select id from public.admin_error_events where created_at < now() - interval '90 days' limit v_batch);
    get diagnostics v_n = row_count;
    v_errors := v_errors + v_n;
    exit when v_n < v_batch;
  end loop;
  for i in 1 .. v_rounds loop
    delete from public.search_queries where id in (
      select id from public.search_queries where created_at < now() - interval '90 days' limit v_batch);
    get diagnostics v_n = row_count;
    v_searches := v_searches + v_n;
    exit when v_n < v_batch;
  end loop;
  -- pg_cron's own log; a refusal here (permissions on a hosted database) must not undo the rest
  if to_regclass('cron.job_run_details') is not null then
    begin
      for i in 1 .. v_rounds loop
        execute format(
          'delete from cron.job_run_details where runid in (select runid from cron.job_run_details where end_time < now() - interval %L limit %s)',
          '7 days', v_batch);
        get diagnostics v_n = row_count;
        v_runs := v_runs + v_n;
        exit when v_n < v_batch;
      end loop;
    exception when insufficient_privilege then
      v_runs := -1;
    end;
  end if;
  return jsonb_build_object('webhook_events', v_webhooks, 'email_outbox', v_emails, 'admin_error_events', v_errors,
                            'search_queries', v_searches, 'job_run_details', v_runs);
end $$;

revoke all on function public._tidy() from public, anon, authenticated;

-- ---------------------------------------------------------------- a weight on the card (D-129, D-191)

-- The pack's words when the label or the shop gave them are already read first (_store_pack). Else the option's own weight:
-- food always, "About" when it is an estimate from similar pieces; home & gifts only a known one, since its estimates come
-- from the price. Never the billed weight, which stays in the database (D-003).
create function public._pack_by_weight(p_product uuid, p_type public.product_type) returns text
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select case when known then shown when p_type = 'food' then 'About ' || shown end
  from (select v.weight_source in ('shop', 'admin', 'weighed', 'packed') and v.weight_source is not null as known,
               case when v.weight_g >= 1000 then trim_scale(round(v.weight_g / 1000.0, 2))::text || ' kg'
                    else v.weight_g::text || ' g' end as shown
        from public.product_variants v
        where v.product_id = p_product and v.is_active and v.weight_g > 0
        order by (v.qty_listed - v.qty_reserved > 0) desc, v.price_cents, v.sort_order
        limit 1) x;
$$;
revoke all on function public._pack_by_weight(uuid, public.product_type) from public, anon, authenticated;
grant execute on function public._pack_by_weight(uuid, public.product_type) to service_role;

create or replace function public._store_pack(p_product uuid, p_name text, p_type public.product_type)
returns text
language sql stable set search_path = public, pg_temp as $$
  select case when p_type in ('food', 'home') then coalesce(
    (select sv.options ->> 'pack' from public.store_variants sv
      where sv.product_id = p_product and coalesce(sv.options ->> 'pack', '') <> ''
      order by (sv.available > 0) desc, sv.price_cents, sv.sort_order limit 1),
    (select sv.net_qty from public.store_variants sv
      where sv.product_id = p_product and coalesce(sv.net_qty, '') <> ''
      order by (sv.available > 0) desc, sv.price_cents, sv.sort_order limit 1),
    regexp_replace(substring(lower(p_name) from '([0-9]+(\.[0-9]+)? ?(kg|gms|gm|g|ml|l))([^a-z]|$)'),
                   '([0-9]) ?(kg|gms|gm|g|ml|l)$', '\1 \2'),
    public._pack_by_weight(p_product, p_type))
  end;
$$;

-- ---------------------------------------------------------------- the reads

drop function public.store_browse(text, text, text, integer, integer, integer, integer, text, text, text);

create function public.store_browse(p_type text, p_region text default null, p_category text default null,
                                    p_offset integer default 0, p_limit integer default 24,
                                    p_min_cents integer default null, p_max_cents integer default null,
                                    p_sizes text default null, p_sort text default null, p_for text default null,
                                    p_sub text default null)
returns jsonb
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  with wanted as (
    select nullif(array_remove(array(select public._size_norm(x) from unnest(string_to_array(p_sizes, '|')) x), null), '{}') as sizes,
           case when p_for in ('women', 'men') then p_for end as for_,
           coalesce(p_sort, 'new') as sort_,
           -- D-191: Popular's long tail takes turns week by week
           to_char(current_date, 'IYYY-IW') as week,
           -- D-144: Clothing's default view, the only one with a drawer and the step-up order
           (coalesce(p_sort, 'new') in ('low', 'popular') and p_type = 'clothing' and p_category is null and p_sub is null) as drawer_on),
  typed as (
    select p.id, p.slug, p.name, p.product_type, p.region_slug, p.region_name, p.category_slug, p.category_name,
           p.price_cents, p.published_at, bp.wears,
           -- D-191: the sub-category and Popular's numbers, worked out once a day (_refresh_places)
           sb.slug as sub_slug, coalesce(pl.score, 0) as score, coalesce(pl.band, 1) as band,
           md5(p.id::text || w.week) as pop_turn,
           (p_sub is null or sb.slug = p_sub) as b_ok,
           -- L8: pieces published at the same moment take turns by shop and category
           row_number() over (partition by p.published_at, bp.source_site, p.category_slug order by md5(p.id::text)) as turn,
           md5(coalesce(bp.source_site, '') || coalesce(p.category_slug, '')) as lane,
           (p_region is null or p.region_slug = p_region or p.region_slug is null) as r_ok,
           (p_category is null or p.category_slug = p_category) as c_ok,
           ((p_min_cents is null and p_max_cents is null)
             or (p.price_cents >= coalesce(p_min_cents, 0)
                 and p.price_cents <= coalesce(p_max_cents, 2147483647))) as p_ok,
           (w.sizes is null or exists (
              select 1 from public.product_variants v
              where v.product_id = p.id and v.is_active
                and public._variant_size(v.options, p.product_type) = any (w.sizes))) as s_ok,
           (w.for_ is null or bp.wears in (w.for_, 'unisex')) as f_ok,
           -- D-144: a finishing touch, drawn in the drawer instead of the list
           (w.drawer_on and p.category_slug in ('accessories', 'headwear')) as touch
    from public.store_products p
    join public.products bp on bp.id = p.id
    left join public.product_place pl on pl.product_id = p.id
    left join public.subcategories sb on sb.id = pl.subcategory_id
    cross join wanted w
    where p.product_type::text = p_type),
  shown as (select * from typed where r_ok and c_ok and b_ok and p_ok and s_ok and f_ok and not touch),
  touches as (select * from typed where r_ok and c_ok and b_ok and p_ok and s_ok and f_ok and touch),
  -- the active variants of the pieces in view, read once (typed holds only pieces customers may see)
  vs as materialized (
    select t.id, t.product_type, coalesce(v.options ->> 'size', '') as sz, coalesce(v.options ->> 'pack', '') as pk
    from typed t
    join public.product_variants v on v.product_id = t.id and v.is_active
    where t.r_ok and t.c_ok and t.b_ok and t.p_ok and t.f_ok),
  -- each distinct raw size or pack spelled once (materialized: else _variant_size is inlined into every option)
  spelled as materialized (
    select d.sz, d.pk, d.product_type,
           public._variant_size(jsonb_build_object('size', nullif(d.sz, ''), 'pack', nullif(d.pk, '')), d.product_type) as size
    from (select distinct sz, pk, product_type from vs) d)
  select jsonb_build_object(
    'total', (select count(*) from shown),
    'all_total', (select count(*) from typed),
    'states_total', (select count(*) from typed where p_ok and s_ok and f_ok),
    'regions', coalesce((
      select jsonb_agg(jsonb_build_object('slug', g.region_slug, 'name', g.region_name,
                                'count', g.n + (select count(*) from typed where region_slug is null and p_ok and s_ok and f_ok))
             order by g.region_name)
      from (select region_slug, region_name, count(*) filter (where p_ok and s_ok and f_ok) as n
            from typed where region_slug is not null
            group by region_slug, region_name) g), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('slug', g.category_slug, 'name', g.category_name, 'count', g.n)
                       order by g.n desc, g.category_name)
      from (select category_slug, category_name, count(*) as n from typed where r_ok and p_ok and s_ok and f_ok
            group by category_slug, category_name) g),
      '[]'::jsonb),
    -- D-191: the rail: the sub-categories in view with their counts and the photo of each one's first piece (a chosen
    -- category's in their order; all of a type's, biggest first)
    'subcategories', coalesce((
      select jsonb_agg(jsonb_build_object('slug', g.sub_slug, 'name', sc.name, 'category_slug', sc.category_slug, 'count', g.n,
                                          'image_path', (select sp.primary_image_path from public.store_products sp where sp.id = g.first_id))
                       order by case when p_category is null then -g.n end, sc.sort_order, sc.name)
      from (select sub_slug, count(*) as n, (array_agg(id order by score desc, band, pop_turn))[1] as first_id
            from typed where r_ok and c_ok and p_ok and s_ok and f_ok and sub_slug is not null
            group by sub_slug) g
      join public.subcategories sc on sc.slug = g.sub_slug), '[]'::jsonb),
    -- D-140: For, counted with every other filter applied (unisex pieces count under both)
    'wears', (select jsonb_build_object(
                'women', count(*) filter (where wears in ('women', 'unisex')),
                'men', count(*) filter (where wears in ('men', 'unisex')))
              from typed where r_ok and c_ok and b_ok and p_ok and s_ok),
    -- each distinct size or pack is spelled once (a few dozen), then pieces are counted per spelling
    'sizes', coalesce((
      select jsonb_agg(jsonb_build_object('value', g.size, 'count', g.n) order by g.size)
      from (select sp.size, count(distinct vs.id) as n
            from vs
            join spelled sp on sp.sz = vs.sz and sp.pk = vs.pk and sp.product_type = vs.product_type
            where sp.size is not null
            group by sp.size) g), '[]'::jsonb),
    'prices', (
      select case when count(*) > 0 then jsonb_build_object(
               'min', min(price_cents), 'max', max(price_cents),
               'q1', percentile_disc(0.25) within group (order by price_cents),
               'q2', percentile_disc(0.5) within group (order by price_cents),
               'q3', percentile_disc(0.75) within group (order by price_cents)) end
      from typed where r_ok and c_ok and b_ok and s_ok and f_ok),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'slug', s.slug, 'name', s.name, 'product_type', s.product_type,
               'region_slug', s.region_slug, 'region_name', s.region_name,
               'category_slug', s.category_slug, 'category_name', s.category_name,
               'price_cents', s.price_cents, 'primary_image_path', (select sp.primary_image_path from public.store_products sp where sp.id = s.id),
               'pack', public._store_pack(s.id, s.name, s.product_type),
               -- D-140 (F9): the card's + picks a size or pack right there
               'options', public._store_card_options(s.id)) || public._offer_key(s.id)
             order by s.k)
      from (select x.*,
                   row_number() over (order by
                     -- L2, founder 2026-11-03: the state's own pieces before the all-India ones, whatever the sort
                     case when p_region is not null then region_slug is null end,
                     -- D-144: one of each, then step up. D-191: on Popular too, by each category's best
                     case when w.drawer_on or w.sort_ = 'popular' then step end,
                     case when w.sort_ = 'popular' then score end desc,
                     case when w.sort_ = 'popular' then band end,
                     case when w.sort_ = 'popular' then pop_turn end,
                     case when w.sort_ in ('price-asc', 'low') then price_cents end,
                     case when w.sort_ = 'price-desc' then price_cents end desc,
                     published_at desc nulls last, turn, lane, name, id) as k
            from (select shown.*,
                         row_number() over (partition by (p_region is not null and region_slug is null), category_slug
                                            order by case when v.sort_ = 'popular' then score end desc,
                                                     case when v.sort_ = 'popular' then band end,
                                                     case when v.sort_ = 'popular' then pop_turn end,
                                                     price_cents, id) as step
                  from shown cross join wanted v) x
            cross join wanted w
            order by k
            offset greatest(coalesce(p_offset, 0), 0)
            limit least(greatest(coalesce(p_limit, 24), 1), 500)) s), '[]'::jsonb),
    -- D-144: the finishing touches by price, 12 for every 24 cards drawn
    'drawer_total', (select count(*) from touches),
    'drawer', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'slug', t.slug, 'name', t.name, 'product_type', t.product_type,
               'region_slug', t.region_slug, 'region_name', t.region_name,
               'category_slug', t.category_slug, 'category_name', t.category_name,
               'price_cents', t.price_cents, 'primary_image_path', (select sp.primary_image_path from public.store_products sp where sp.id = t.id),
               'pack', public._store_pack(t.id, t.name, t.product_type),
               'options', public._store_card_options(t.id)) || public._offer_key(t.id)
             order by t.k)
      from (select touches.*,
                   row_number() over (order by case when p_region is not null then region_slug is null end,
                                               price_cents, published_at desc nulls last, name, id) as k
            from touches
            order by k
            offset greatest(coalesce(p_offset, 0), 0) / 2
            limit (least(greatest(coalesce(p_limit, 24), 1), 500) + 1) / 2) t), '[]'::jsonb));
$$;

revoke all on function public.store_browse(text, text, text, integer, integer, integer, integer, text, text, text, text) from public;
grant execute on function public.store_browse(text, text, text, integer, integer, integer, integer, text, text, text, text) to anon, authenticated, service_role;

create or replace function public.store_product_page(p_region_slug text, p_product_slug text) returns jsonb
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select jsonb_build_object(
    -- D-191: its weight, as the cards show it
    'product', (to_jsonb(p) - 'search' - 'is_curated') || public._offer_key(p.id)
               || jsonb_build_object('pack', public._store_pack(p.id, p.name, p.product_type)),
    'variants', coalesce((
      select jsonb_agg(to_jsonb(v) order by v.sort_order, v.label)
      from public.store_variants v where v.product_id = p.id), '[]'::jsonb),
    'media', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.is_primary desc, m.sort_order)
      from public.store_media m where m.product_id = p.id), '[]'::jsonb),
    'similar', coalesce((
      select jsonb_agg(public._store_product_card(s.id) order by s.same_region desc, s.published_at desc nulls last, s.name)
      from (select u.* from (
              (select o.id, o.published_at, o.name, true as same_region
               from public.store_products o
               where o.category_id = p.category_id and o.id <> p.id
                 and coalesce(o.region_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p.region_id, '00000000-0000-0000-0000-000000000000'::uuid)
               order by o.published_at desc nulls last, o.name limit 12)
              union all
              (select o.id, o.published_at, o.name, false
               from public.store_products o
               where o.category_id = p.category_id
                 and coalesce(o.region_id, '00000000-0000-0000-0000-000000000000'::uuid) <> coalesce(p.region_id, '00000000-0000-0000-0000-000000000000'::uuid)
               order by o.published_at desc nulls last, o.name limit 12)) u
            order by u.same_region desc, u.published_at desc nulls last, u.name
            limit 12) s), '[]'::jsonb),
    'curated', coalesce((
      select jsonb_agg(public._store_product_card(c.id) order by c.published_at desc nulls last, c.name)
      from (select o.id, o.published_at, o.name from public.store_products o
            where coalesce(o.region_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p.region_id, '00000000-0000-0000-0000-000000000000'::uuid) and o.is_curated and o.id <> p.id
            order by o.published_at desc nulls last, o.name limit 12) c), '[]'::jsonb),
    'reviews', jsonb_build_object(
      'count', (select count(*) from public.store_reviews r where r.product_id = p.id),
      'average', (select round(avg(r.rating), 1) from public.store_reviews r where r.product_id = p.id),
      'histogram', (select jsonb_build_object(
                      '5', count(*) filter (where r.rating = 5), '4', count(*) filter (where r.rating = 4),
                      '3', count(*) filter (where r.rating = 3), '2', count(*) filter (where r.rating = 2),
                      '1', count(*) filter (where r.rating = 1))
                    from public.store_reviews r where r.product_id = p.id),
      'items', coalesce((
        select jsonb_agg(to_jsonb(r) || jsonb_build_object('photos', coalesce((
                 select jsonb_agg(ph.storage_path order by ph.sort_order)
                 from public.store_review_photos ph where ph.review_id = r.id), '[]'::jsonb))
               order by r.created_at desc)
        from (select * from public.store_reviews r where r.product_id = p.id
              order by r.created_at desc limit 6) r), '[]'::jsonb)),
    'delivery', (select to_jsonb(d) from public.store_next_delivery() d limit 1),  -- TODO(D-187): drop when app <next version> is the minimum
    'quick_delivery', null,  -- TODO(D-187): drop when app <next version> is the minimum
    -- A piece already in the US ships at once: its window is today + the US delivery days.
    'ships_from_us', case when p.is_us_stock then (
      select jsonb_build_object('est_delivery_from', current_date + s.domestic_days_min,
                                'est_delivery_to', current_date + s.domestic_days_max)
      from public.pricing_settings s
      where s.id = 1 and s.domestic_days_min is not null and s.domestic_days_max is not null) end
  )
  from public.store_products p
  where coalesce(p.region_slug, 'india') = p_region_slug and p.slug = p_product_slug;
$$;

create or replace function public.store_home() returns jsonb
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  with ranked as (
    select p.id, p.product_type, p.published_at, p.name,
           row_number() over (partition by p.published_at, bp.source_site, p.category_slug order by md5(p.id::text)) as turn,
           md5(coalesce(bp.source_site, '') || coalesce(p.category_slug, '')) as lane
    from public.store_products p
    join public.products bp on bp.id = p.id),
  newest as (
    select x.*,
           row_number() over (partition by x.product_type order by x.published_at desc nulls last, x.turn, x.lane, x.name) as k,
           row_number() over (order by x.published_at desc nulls last, x.name) as overall
    from ranked x),
  -- The tiles (D-190, D-191; their photos: apps/web/features/home/tile-photos.ts), each with its count, biggest first. A
  -- tile with a `who` counts as that filter does: pieces for them and unisex pieces.
  tile_list (category_slug, label, who) as (
    values ('snacks-and-namkeen', null, null), ('bakery-and-biscuits', null, null), ('sweets', null, null),
           ('rice-flours-and-staples', null, null), ('masala-blends', null, null), ('pickles-and-chutneys', null, null),
           ('whole-spices', null, null), ('tea-and-drinks', null, null), ('papad-and-wadi', null, null),
           ('pooja-and-spiritual', null, null), ('thaali-and-serveware', null, null), ('handicrafts-and-decor', null, null),
           ('shirts-and-tops', 'Shirts', 'men'), ('shirts-and-tops', 'Tops', 'women'),
           ('jeans-and-trousers', 'Pants', null), ('co-ords-and-dresses', 'Dresses', null),
           ('kurtas', 'Kurtis', 'women'), ('sarees', 'Sarees', null)),
  tiles as (
    select l.category_slug, coalesce(l.label, min(p.category_name)) as category_name, min(p.product_type::text)::public.product_type as product_type,
           l.who, count(*) as n,
           -- the photo of its newest piece that has one
           (array_agg(p.primary_image_path order by p.published_at desc nulls last, p.id)
              filter (where p.primary_image_path is not null))[1] as image_path
    from tile_list l
    join public.store_products p on p.category_slug = l.category_slug
    join public.products bp on bp.id = p.id
    where l.who is null or bp.wears in (l.who, 'unisex')
    group by l.category_slug, l.label, l.who),
  -- Pieces ordered this week (paid, not cancelled), only to order the row: the counts never leave (D-003)
  ordered as (
    select oi.product_id as id, sum(oi.quantity) as n, max(p.published_at) as published_at
    from public.order_items oi
    join public.orders od on od.id = oi.order_id
    join public.products p on p.id = oi.product_id
    where od.created_at >= now() - interval '7 days'
      and od.payment_status in ('paid', 'partially_refunded')
      and od.status not in ('pending_payment', 'cancelled', 'refunded')
      and oi.status = 'active'
      and p.status = 'live' and (not p.is_placeholder or public.dev_preview())
    group by oi.product_id
    order by n desc, published_at desc nulls last, oi.product_id
    limit 12),
  cheap as (
    select p.id, p.price_cents
    from public.store_products p
    where p.price_cents < 500
    order by p.price_cents, p.id
    limit 12)
  select jsonb_build_object(
    'regions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'slug', r.slug, 'name', r.name, 'is_live', r.is_live, 'accent_color', r.accent_color,
               'hero_image_path', r.hero_image_path, 'greeting_native', r.greeting_native,
               'greeting_script', r.greeting_script, 'greeting_latin', r.greeting_latin, 'tagline', r.tagline)
             order by r.sort_order, r.name)
      from public.store_regions r), '[]'::jsonb),
    -- D-169: the founder's Home photos only, in the admin's order
    'album', coalesce((
      select jsonb_agg(jsonb_build_object('storage_path', a.storage_path, 'alt_text', a.alt_text)
                       order by a.sort_order, a.created_at)
      from (select h.storage_path, h.alt_text, h.sort_order, h.created_at
            from public.home_photos h
            order by h.sort_order, h.created_at
            limit 60) a), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
               'slug', t.category_slug, 'name', t.category_name, 'product_type', t.product_type, 'count', t.n,
               'for', t.who, 'image_path', t.image_path)
             order by t.n desc, t.category_name)
      from tiles t), '[]'::jsonb),
    'most_ordered', coalesce((
      select jsonb_agg(public._store_product_card(o.id) order by o.n desc, o.published_at desc nulls last, o.id)
      from ordered o), '[]'::jsonb),
    'under_5', coalesce((
      select jsonb_agg(public._store_product_card(c.id) order by c.price_cents, c.id)
      from cheap c), '[]'::jsonb),
    'just_listed', coalesce((  -- TODO(D-187): drop when app <next version> is the minimum (its Home's only row)
      select jsonb_agg(public._store_product_card(n.id) order by n.overall)
      from newest n where n.overall <= 12), '[]'::jsonb),
    'just_listed_types', (
      select jsonb_object_agg(t.product_type, coalesce((
               select jsonb_agg(public._store_product_card(n.id) order by n.k)
               from newest n where n.product_type = t.product_type and n.k <= 12), '[]'::jsonb))
      from (values ('clothing'::public.product_type), ('home'::public.product_type)) t(product_type)),
    'delivery', (select to_jsonb(d) from public.store_next_delivery() d limit 1),  -- TODO(D-187): drop when app <next version> is the minimum
    -- D-140 (L7): the band under Just listed, from the same numbers as the Shipping & returns page
    'band', (select jsonb_build_object('free_min_cents', p -> 'free_shipping_min_cents',
                                       'return_claim_days', p -> 'return_claim_days')
             from public.store_policy() p)
  );
$$;

select public._refresh_places();

notify pgrst, 'reload schema';
