-- D-208 Phases 3 and 4: IWC open in every country ShipGlobal serves (D-209: closed where a US seller may not sell, and
-- where nobody lives). Only the freight inside a price changes with the country: the country's ShipGlobal rate a kg
-- (read 2026-11-24, rounded up to the next ₹500) instead of D-128's ₹2,000; the US stays at ₹2,000 (founder).
-- Prices abroad are worked out here from each piece's priced weight, which never leaves the database (non-negotiable
-- 1: no billed weights on a customer surface): the store asks store_country_prices for the pieces it shows.
-- Size: one table of 246 rows; no page-cache writes (prices abroad are read per visit, outside the page cache).

create table public.ship_countries (
  iso2 text primary key check (iso2 ~ '^[A-Z]{2}$'),
  iso3 text not null unique check (iso3 ~ '^[A-Z]{3}$'),
  name text not null,
  inr_per_kg integer check (inr_per_kg is null or inr_per_kg between 100 and 20000),  -- the freight a kg in its prices
  inr_quote_1kg integer,      -- ShipGlobal's cheapest 1 kg quote it was rounded from (2026-11-24)
  service text,               -- that service's name (admin only: never on the store, non-negotiable 1)
  days_min integer,
  days_max integer,
  open boolean not null default false,
  quoted_at date not null default '2026-11-24'
);
comment on table public.ship_countries is
  'D-208: every country ShipGlobal serves, its freight a kg (rounded up to the next ₹500; the US ₹2,000) and whether IWC sells there (D-209). Admin only.';
alter table public.ship_countries enable row level security;
create policy admin_all on public.ship_countries for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.ship_countries from anon, authenticated;
grant select, update on public.ship_countries to authenticated;  -- RLS: the admin

insert into public.ship_countries (iso2, iso3, name, inr_per_kg, inr_quote_1kg, service, days_min, days_max, open)
values
  ('AF', 'AFG', 'Afghanistan', 3000, 2666, 'Fedex', 4, 7, true),
  ('AX', 'ALA', 'Aland Islands', 5500, 5053, 'ShipGlobal WorldWide', 13, 18, true),
  ('AL', 'ALB', 'Albania', 3500, 3052, 'Fedex', 4, 7, true),
  ('DZ', 'DZA', 'Algeria', 4000, 3505, 'Fedex', 4, 7, true),
  ('AS', 'ASM', 'American Samoa', 3500, 3375, 'Fedex', 4, 7, true),
  ('AD', 'AND', 'Andorra', 3000, 2741, 'UPS', 4, 7, true),
  ('AO', 'AGO', 'Angola', 4000, 3505, 'Fedex', 4, 7, true),
  ('AI', 'AIA', 'Anguilla', 3500, 3357, 'Fedex', 4, 7, true),
  ('AQ', 'ATA', 'Antarctica', 4000, 3972, 'ShipGlobal WorldWide', 13, 18, false),
  ('AG', 'ATG', 'Antigua And Barbuda', 3500, 3357, 'Fedex', 4, 7, true),
  ('AR', 'ARG', 'Argentina', 5000, 4877, 'ShipGlobal WorldWide', 13, 18, true),
  ('AM', 'ARM', 'Armenia', 3500, 3052, 'Fedex', 4, 7, true),
  ('AW', 'ABW', 'Aruba', 3500, 3357, 'Fedex', 4, 7, true),
  ('AU', 'AUS', 'Australia', 1500, 1033, 'ShipGlobal Direct', 7, 10, true),
  ('AT', 'AUT', 'Austria', 1500, 1336, 'ShipGlobal Direct', 9, 12, true),
  ('AZ', 'AZE', 'Azerbaijan', 3500, 3052, 'Fedex', 4, 7, true),
  ('BS', 'BHS', 'Bahamas The', 3500, 3357, 'Fedex', 4, 7, true),
  ('BH', 'BHR', 'Bahrain', 3000, 2557, 'Fedex', 4, 7, true),
  ('BD', 'BGD', 'Bangladesh', 2500, 2475, 'Fedex', 4, 7, true),
  ('BB', 'BRB', 'Barbados', 3500, 3357, 'Fedex', 4, 7, true),
  ('BY', 'BLR', 'Belarus', 3500, 3052, 'Fedex', 4, 7, false),
  ('BE', 'BEL', 'Belgium', 1500, 1386, 'ShipGlobal Direct', 10, 14, true),
  ('BZ', 'BLZ', 'Belize', 3500, 3357, 'Fedex', 4, 7, true),
  ('BJ', 'BEN', 'Benin', 4000, 3505, 'Fedex', 4, 7, true),
  ('BM', 'BMU', 'Bermuda', 3500, 3357, 'Fedex', 4, 7, true),
  ('BT', 'BTN', 'Bhutan', 2500, 2475, 'Fedex', 4, 7, true),
  ('BO', 'BOL', 'Bolivia', 3500, 3357, 'Fedex', 4, 7, true),
  ('BQ', 'BES', 'Bonaire, Sint Eustatius and Saba', 3500, 3357, 'Fedex', 4, 7, true),
  ('BA', 'BIH', 'Bosnia and Herzegovina', 3500, 3052, 'Fedex', 4, 7, true),
  ('BW', 'BWA', 'Botswana', 4000, 3505, 'Fedex', 4, 7, true),
  ('BV', 'BVT', 'Bouvet Island', 4000, 3769, 'ShipGlobal WorldWide', 13, 18, false),
  ('BR', 'BRA', 'Brazil', 3000, 2791, 'ShipGlobal WorldWide', 13, 18, true),
  ('IO', 'IOT', 'British Indian Ocean Territory', 3500, 3441, 'ShipGlobal WorldWide', 13, 18, true),
  ('BN', 'BRN', 'Brunei', 1500, 1049, 'ShipGlobal Direct', 7, 9, true),
  ('BG', 'BGR', 'Bulgaria', 2000, 1533, 'ShipGlobal Direct', 9, 12, true),
  ('BF', 'BFA', 'Burkina Faso', 4000, 3505, 'Fedex', 4, 7, true),
  ('BI', 'BDI', 'Burundi', 4000, 3505, 'Fedex', 4, 7, true),
  ('KH', 'KHM', 'Cambodia', 3500, 3375, 'Fedex', 4, 7, true),
  ('CM', 'CMR', 'Cameroon', 4000, 3505, 'Fedex', 4, 7, true),
  ('CA', 'CAN', 'Canada', 1500, 1116, 'ShipGlobal CA Post Special', 8, 12, true),
  ('CV', 'CPV', 'Cape Verde', 4000, 3505, 'Fedex', 4, 7, true),
  ('KY', 'CYM', 'Cayman Islands', 3500, 3357, 'Fedex', 4, 7, true),
  ('CF', 'CAF', 'Central African Republic', 4000, 3505, 'Fedex', 4, 7, true),
  ('TD', 'TCD', 'Chad', 4000, 3505, 'Fedex', 4, 7, true),
  ('CL', 'CHL', 'Chile', 3500, 3357, 'Fedex', 4, 7, true),
  ('CN', 'CHN', 'China', 3000, 2565, 'ShipGlobal WorldWide', 13, 18, true),
  ('CX', 'CXR', 'Christmas Island', 4000, 3867, 'ShipGlobal WorldWide', 13, 18, true),
  ('CC', 'CCK', 'Cocos (Keeling) Islands', 4000, 3867, 'ShipGlobal WorldWide', 13, 18, true),
  ('CO', 'COL', 'Colombia', 3500, 3357, 'Fedex', 4, 7, true),
  ('KM', 'COM', 'Comoros', 4000, 3769, 'ShipGlobal WorldWide', 13, 18, true),
  ('CG', 'COG', 'Congo', 4000, 3505, 'Fedex', 4, 7, true),
  ('CK', 'COK', 'Cook Islands', 3500, 3375, 'Fedex', 4, 7, true),
  ('CR', 'CRI', 'Costa Rica', 3500, 3357, 'Fedex', 4, 7, true),
  ('CI', 'CIV', 'Cote D''Ivoire (Ivory Coast)', 4000, 3505, 'Fedex', 4, 7, true),
  ('HR', 'HRV', 'Croatia', 2000, 1706, 'ShipGlobal Direct', 10, 14, true),
  ('CU', 'CUB', 'Cuba', 4000, 3972, 'ShipGlobal WorldWide', 13, 18, false),
  ('CW', 'CUW', 'Curaçao', 3500, 3357, 'Fedex', 4, 7, true),
  ('CY', 'CYP', 'Cyprus', 3000, 2815, 'ShipGlobal Direct', 9, 12, true),
  ('CZ', 'CZE', 'Czech Republic', 1500, 1310, 'ShipGlobal Direct', 10, 14, true),
  ('CD', 'COD', 'Democratic Republic of the Congo', 4000, 3505, 'Fedex', 4, 7, true),
  ('DK', 'DNK', 'Denmark', 1500, 1474, 'ShipGlobal Direct', 10, 14, true),
  ('DJ', 'DJI', 'Djibouti', 4000, 3505, 'Fedex', 4, 7, true),
  ('DM', 'DMA', 'Dominica', 3500, 3357, 'Fedex', 4, 7, true),
  ('DO', 'DOM', 'Dominican Republic', 3500, 3357, 'Fedex', 4, 7, true),
  ('TL', 'TLS', 'East Timor', 3500, 3375, 'Fedex', 4, 7, true),
  ('EC', 'ECU', 'Ecuador', 3500, 3357, 'Fedex', 4, 7, true),
  ('EG', 'EGY', 'Egypt', 3000, 2666, 'Fedex', 4, 7, true),
  ('SV', 'SLV', 'El Salvador', 3500, 3357, 'Fedex', 4, 7, true),
  ('GQ', 'GNQ', 'Equatorial Guinea', 4000, 3505, 'Fedex', 4, 7, true),
  ('ER', 'ERI', 'Eritrea', 4000, 3505, 'Fedex', 4, 7, true),
  ('EE', 'EST', 'Estonia', 2500, 2086, 'ShipGlobal Direct', 10, 14, true),
  ('ET', 'ETH', 'Ethiopia', 4000, 3505, 'Fedex', 4, 7, true),
  ('FK', 'FLK', 'Falkland Islands', 4000, 3972, 'ShipGlobal WorldWide', 13, 18, true),
  ('FO', 'FRO', 'Faroe Islands', 3000, 2958, 'Fedex', 4, 7, true),
  ('FJ', 'FJI', 'Fiji Islands', 3500, 3375, 'Fedex', 4, 7, true),
  ('FI', 'FIN', 'Finland', 2000, 1940, 'ShipGlobal Direct', 9, 12, true),
  ('FR', 'FRA', 'France', 1500, 1390, 'ShipGlobal Direct', 9, 12, true),
  ('GF', 'GUF', 'French Guiana', 3500, 3357, 'Fedex', 4, 7, true),
  ('PF', 'PYF', 'French Polynesia', 3500, 3375, 'Fedex', 4, 7, true),
  ('TF', 'ATF', 'French Southern Territories', 6000, 5874, 'UPS', 4, 7, false),
  ('GA', 'GAB', 'Gabon', 4000, 3505, 'Fedex', 4, 7, true),
  ('GM', 'GMB', 'Gambia The', 4000, 3505, 'Fedex', 4, 7, true),
  ('GE', 'GEO', 'Georgia', 3500, 3052, 'Fedex', 4, 7, true),
  ('DE', 'DEU', 'Germany', 1500, 1230, 'ShipGlobal Direct', 9, 12, true),
  ('GH', 'GHA', 'Ghana', 4000, 3505, 'Fedex', 4, 7, true),
  ('GI', 'GIB', 'Gibraltar', 3500, 3052, 'Fedex', 4, 7, true),
  ('GR', 'GRC', 'Greece', 1500, 1492, 'ShipGlobal Direct', 9, 12, true),
  ('GL', 'GRL', 'Greenland', 3000, 2958, 'Fedex', 4, 7, true),
  ('GD', 'GRD', 'Grenada', 3500, 3357, 'Fedex', 4, 7, true),
  ('GP', 'GLP', 'Guadeloupe', 3500, 3357, 'Fedex', 4, 7, true),
  ('GT', 'GTM', 'Guatemala', 3500, 3357, 'Fedex', 4, 7, true),
  ('GG', 'GGY', 'Guernsey and Alderney', 5000, 4795, 'UPS', 4, 7, true),
  ('GN', 'GIN', 'Guinea', 4000, 3505, 'Fedex', 4, 7, true),
  ('GW', 'GNB', 'Guinea-Bissau', 4000, 3505, 'Fedex', 4, 7, true),
  ('GY', 'GUY', 'Guyana', 3500, 3357, 'Fedex', 4, 7, true),
  ('HT', 'HTI', 'Haiti', 3500, 3357, 'Fedex', 4, 7, true),
  ('HM', 'HMD', 'Heard Island and McDonald Islands', 4000, 3867, 'ShipGlobal WorldWide', 13, 18, false),
  ('HN', 'HND', 'Honduras', 3500, 3357, 'Fedex', 4, 7, true),
  ('HK', 'HKG', 'Hong Kong S.A.R.', 1000, 918, 'ShipGlobal Direct', 7, 9, true),
  ('HU', 'HUN', 'Hungary', 1500, 1415, 'ShipGlobal Direct', 10, 14, true),
  ('IS', 'ISL', 'Iceland', 2500, 2450, 'ShipGlobal WorldWide', 13, 18, true),
  ('ID', 'IDN', 'Indonesia', 2000, 1630, 'ShipGlobal Direct', 7, 9, true),
  ('IR', 'IRN', 'Iran', 3000, 2666, 'Fedex', 4, 7, false),
  ('IQ', 'IRQ', 'Iraq', 3000, 2666, 'Fedex', 4, 7, true),
  ('IE', 'IRL', 'Ireland', 2500, 2363, 'ShipGlobal WorldWide', 13, 18, true),
  ('IL', 'ISR', 'Israel', 3000, 2761, 'ShipGlobal WorldWide', 13, 18, true),
  ('IT', 'ITA', 'Italy', 1500, 1454, 'ShipGlobal Direct', 9, 12, true),
  ('JM', 'JAM', 'Jamaica', 3500, 3357, 'Fedex', 4, 7, true),
  ('JP', 'JPN', 'Japan', 1500, 1236, 'ShipGlobal Direct', 7, 9, true),
  ('JE', 'JEY', 'Jersey', 5000, 4795, 'UPS', 4, 7, true),
  ('JO', 'JOR', 'Jordan', 3000, 2666, 'Fedex', 4, 7, true),
  ('KZ', 'KAZ', 'Kazakhstan', 3500, 3052, 'Fedex', 4, 7, true),
  ('KE', 'KEN', 'Kenya', 4000, 3505, 'Fedex', 4, 7, true),
  ('KI', 'KIR', 'Kiribati', 3500, 3338, 'Fedex', 4, 7, true),
  ('XK', 'XKX', 'Kosovo', 4000, 3673, 'ShipGlobal WorldWide', 13, 18, true),
  ('KW', 'KWT', 'Kuwait', 3000, 2557, 'Fedex', 4, 7, true),
  ('KG', 'KGZ', 'Kyrgyzstan', 3500, 3052, 'Fedex', 4, 7, true),
  ('LA', 'LAO', 'Laos', 3500, 3375, 'Fedex', 4, 7, true),
  ('LV', 'LVA', 'Latvia', 2500, 2248, 'ShipGlobal Direct', 10, 14, true),
  ('LB', 'LBN', 'Lebanon', 3000, 2666, 'Fedex', 4, 7, true),
  ('LS', 'LSO', 'Lesotho', 4000, 3505, 'Fedex', 4, 7, true),
  ('LR', 'LBR', 'Liberia', 4000, 3505, 'Fedex', 4, 7, true),
  ('LY', 'LBY', 'Libya', 4000, 3505, 'Fedex', 4, 7, true),
  ('LI', 'LIE', 'Liechtenstein', 3000, 2741, 'UPS', 4, 7, true),
  ('LT', 'LTU', 'Lithuania', 2000, 1950, 'ShipGlobal Direct', 10, 14, true),
  ('LU', 'LUX', 'Luxembourg', 1500, 1416, 'ShipGlobal Direct', 9, 12, true),
  ('MO', 'MAC', 'Macau S.A.R.', 1000, 918, 'ShipGlobal Direct', 7, 9, true),
  ('MK', 'MKD', 'Macedonia', 3500, 3052, 'Fedex', 4, 7, true),
  ('MG', 'MDG', 'Madagascar', 4000, 3505, 'Fedex', 4, 7, true),
  ('MW', 'MWI', 'Malawi', 4000, 3505, 'Fedex', 4, 7, true),
  ('MY', 'MYS', 'Malaysia', 500, 423, 'ShipGlobal Direct', 8, 12, true),
  ('MV', 'MDV', 'Maldives', 2500, 2475, 'Fedex', 4, 7, true),
  ('ML', 'MLI', 'Mali', 4000, 3505, 'Fedex', 4, 7, true),
  ('MT', 'MLT', 'Malta', 3500, 3052, 'Fedex', 4, 7, true),
  ('IM', 'IMN', 'Man (Isle of)', 6000, 5874, 'UPS', 4, 7, true),
  ('MH', 'MHL', 'Marshall Islands', 3500, 3375, 'Fedex', 4, 7, true),
  ('MQ', 'MTQ', 'Martinique', 3500, 3357, 'Fedex', 4, 7, true),
  ('MR', 'MRT', 'Mauritania', 4000, 3505, 'Fedex', 4, 7, true),
  ('MU', 'MUS', 'Mauritius', 4000, 3505, 'Fedex', 4, 7, true),
  ('YT', 'MYT', 'Mayotte', 4000, 3769, 'ShipGlobal WorldWide', 13, 18, true),
  ('MX', 'MEX', 'Mexico', 3000, 2985, 'UPS', 4, 7, true),
  ('FM', 'FSM', 'Micronesia', 3500, 3375, 'Fedex', 4, 7, true),
  ('MD', 'MDA', 'Moldova', 3500, 3052, 'Fedex', 4, 7, true),
  ('MC', 'MCO', 'Monaco', 3000, 2741, 'UPS', 4, 7, true),
  ('MN', 'MNG', 'Mongolia', 3500, 3375, 'Fedex', 4, 7, true),
  ('ME', 'MNE', 'Montenegro', 3500, 3052, 'Fedex', 4, 7, true),
  ('MS', 'MSR', 'Montserrat', 3500, 3357, 'Fedex', 4, 7, true),
  ('MA', 'MAR', 'Morocco', 4000, 3505, 'Fedex', 4, 7, true),
  ('MZ', 'MOZ', 'Mozambique', 4000, 3505, 'Fedex', 4, 7, true),
  ('MM', 'MMR', 'Myanmar', 3000, 2666, 'Fedex', 4, 7, true),
  ('NA', 'NAM', 'Namibia', 4000, 3505, 'Fedex', 4, 7, true),
  ('NR', 'NRU', 'Nauru', 4000, 3867, 'ShipGlobal WorldWide', 13, 18, true),
  ('NP', 'NPL', 'Nepal', 2500, 2475, 'Fedex', 4, 7, true),
  ('NL', 'NLD', 'Netherlands', 1500, 1306, 'ShipGlobal Direct', 10, 14, true),
  ('NC', 'NCL', 'New Caledonia', 3500, 3375, 'Fedex', 4, 7, true),
  ('NZ', 'NZL', 'New Zealand', 3500, 3172, 'UPS', 4, 7, true),
  ('NI', 'NIC', 'Nicaragua', 3500, 3357, 'Fedex', 4, 7, true),
  ('NE', 'NER', 'Niger', 4000, 3505, 'Fedex', 4, 7, true),
  ('NG', 'NGA', 'Nigeria', 4000, 3505, 'Fedex', 4, 7, true),
  ('NU', 'NIU', 'Niue', 4000, 3867, 'ShipGlobal WorldWide', 13, 18, true),
  ('NF', 'NFK', 'Norfolk Island', 4000, 3867, 'ShipGlobal WorldWide', 13, 18, true),
  ('KP', 'PRK', 'North Korea', 3500, 3441, 'ShipGlobal WorldWide', 13, 18, false),
  ('MP', 'MNP', 'Northern Mariana Islands', 4000, 3867, 'ShipGlobal WorldWide', 13, 18, true),
  ('NO', 'NOR', 'Norway', 3000, 2526, 'UPS Promotional', 4, 7, true),
  ('OM', 'OMN', 'Oman', 3000, 2557, 'Fedex', 4, 7, true),
  ('PK', 'PAK', 'Pakistan', null, null, null, null, null, false),
  ('PW', 'PLW', 'Palau', 3500, 3375, 'Fedex', 4, 7, true),
  ('PS', 'PSE', 'Palestinian Territory Occupied', 3000, 2666, 'Fedex', 4, 7, true),
  ('PA', 'PAN', 'Panama', 3500, 3357, 'Fedex', 4, 7, true),
  ('PG', 'PNG', 'Papua new Guinea', 3500, 3375, 'Fedex', 4, 7, true),
  ('PY', 'PRY', 'Paraguay', 3500, 3357, 'Fedex', 4, 7, true),
  ('PE', 'PER', 'Peru', 3500, 3357, 'Fedex', 4, 7, true),
  ('PH', 'PHL', 'Philippines', 1500, 1236, 'ShipGlobal Direct', 7, 9, true),
  ('PN', 'PCN', 'Pitcairn Island', 4000, 3867, 'ShipGlobal WorldWide', 13, 18, true),
  ('PL', 'POL', 'Poland', 1500, 1138, 'ShipGlobal Direct', 10, 14, true),
  ('PT', 'PRT', 'Portugal', 1500, 1282, 'ShipGlobal Direct', 10, 14, true),
  ('QA', 'QAT', 'Qatar', 3000, 2557, 'Fedex', 4, 7, true),
  ('RE', 'REU', 'Reunion', 4000, 3505, 'Fedex', 4, 7, true),
  ('RO', 'ROU', 'Romania', 2000, 1645, 'ShipGlobal Direct', 9, 12, true),
  ('RU', 'RUS', 'Russia', 3500, 3052, 'Fedex', 4, 7, false),
  ('RW', 'RWA', 'Rwanda', 4000, 3505, 'Fedex', 4, 7, true),
  ('SH', 'SHN', 'Saint Helena', 4000, 3769, 'ShipGlobal WorldWide', 13, 18, true),
  ('KN', 'KNA', 'Saint Kitts And Nevis', 3500, 3357, 'Fedex', 4, 7, true),
  ('LC', 'LCA', 'Saint Lucia', 3500, 3357, 'Fedex', 4, 7, true),
  ('PM', 'SPM', 'Saint Pierre and Miquelon', 4000, 3972, 'ShipGlobal WorldWide', 13, 18, true),
  ('VC', 'VCT', 'Saint Vincent And The Grenadines', 3500, 3357, 'Fedex', 4, 7, true),
  ('BL', 'BLM', 'Saint-Barthelemy', 4000, 3972, 'ShipGlobal WorldWide', 13, 18, true),
  ('MF', 'MAF', 'Saint-Martin (French part)', 3500, 3357, 'Fedex', 4, 7, true),
  ('WS', 'WSM', 'Samoa', 3500, 3375, 'Fedex', 4, 7, true),
  ('SM', 'SMR', 'San Marino', 3000, 2741, 'UPS', 4, 7, true),
  ('ST', 'STP', 'Sao Tome and Principe', 4000, 3769, 'ShipGlobal WorldWide', 13, 18, true),
  ('SA', 'SAU', 'Saudi Arabia', 3000, 2666, 'Fedex', 4, 7, true),
  ('SN', 'SEN', 'Senegal', 4000, 3505, 'Fedex', 4, 7, true),
  ('RS', 'SRB', 'Serbia', 3500, 3052, 'Fedex', 4, 7, true),
  ('SC', 'SYC', 'Seychelles', 4000, 3505, 'Fedex', 4, 7, true),
  ('SL', 'SLE', 'Sierra Leone', 4000, 3505, 'Fedex', 4, 7, true),
  ('SG', 'SGP', 'Singapore', 500, 465, 'ShipGlobal Direct', 7, 10, true),
  ('SX', 'SXM', 'Sint Maarten (Dutch part)', 4000, 3972, 'ShipGlobal WorldWide', 13, 18, true),
  ('SK', 'SVK', 'Slovakia', 1500, 1442, 'ShipGlobal Direct', 9, 12, true),
  ('SI', 'SVN', 'Slovenia', 2000, 1628, 'ShipGlobal Direct', 10, 14, true),
  ('SB', 'SLB', 'Solomon Islands', 3500, 3375, 'Fedex', 4, 7, true),
  ('SO', 'SOM', 'Somalia', 4000, 3769, 'ShipGlobal WorldWide', 13, 18, true),
  ('ZA', 'ZAF', 'South Africa', 3000, 2935, 'Fedex', 4, 7, true),
  ('GS', 'SGS', 'South Georgia', 3500, 3052, 'Fedex', 4, 7, false),
  ('KR', 'KOR', 'South Korea', 3000, 2550, 'ShipGlobal WorldWide', 13, 18, true),
  ('SS', 'SSD', 'South Sudan', 4000, 3505, 'Fedex', 4, 7, true),
  ('ES', 'ESP', 'Spain', 1500, 1287, 'ShipGlobal Direct', 10, 14, true),
  ('LK', 'LKA', 'Sri Lanka', 2500, 2475, 'Fedex', 4, 7, true),
  ('SD', 'SDN', 'Sudan', 4000, 3505, 'Fedex', 4, 7, true),
  ('SR', 'SUR', 'Suriname', 3500, 3357, 'Fedex', 4, 7, true),
  ('SJ', 'SJM', 'Svalbard And Jan Mayen Islands', 5500, 5053, 'ShipGlobal WorldWide', 13, 18, true),
  ('SZ', 'SWZ', 'Swaziland', 4000, 3505, 'Fedex', 4, 7, true),
  ('SE', 'SWE', 'Sweden', 2500, 2041, 'ShipGlobal WorldWide', 13, 18, true),
  ('CH', 'CHE', 'Switzerland', 2500, 2304, 'ShipGlobal WorldWide', 13, 18, true),
  ('SY', 'SYR', 'Syria', 3000, 2666, 'Fedex', 4, 7, false),
  ('TW', 'TWN', 'Taiwan', 1500, 1049, 'ShipGlobal Direct', 7, 9, true),
  ('TJ', 'TJK', 'Tajikistan', 3500, 3441, 'ShipGlobal WorldWide', 13, 18, true),
  ('TZ', 'TZA', 'Tanzania', 4000, 3505, 'Fedex', 4, 7, true),
  ('TH', 'THA', 'Thailand', 2000, 1630, 'ShipGlobal Direct', 7, 9, true),
  ('TG', 'TGO', 'Togo', 4000, 3505, 'Fedex', 4, 7, true),
  ('TK', 'TKL', 'Tokelau', 4000, 3867, 'ShipGlobal WorldWide', 13, 18, true),
  ('TO', 'TON', 'Tonga', 3500, 3375, 'Fedex', 4, 7, true),
  ('TT', 'TTO', 'Trinidad And Tobago', 3500, 3357, 'Fedex', 4, 7, true),
  ('TN', 'TUN', 'Tunisia', 4000, 3505, 'Fedex', 4, 7, true),
  ('TR', 'TUR', 'Turkey', 3000, 2530, 'ShipGlobal WorldWide', 13, 18, true),
  ('TM', 'TKM', 'Turkmenistan', 3000, 2666, 'Fedex', 4, 7, true),
  ('TC', 'TCA', 'Turks And Caicos Islands', 3500, 3357, 'Fedex', 4, 7, true),
  ('TV', 'TUV', 'Tuvalu', 3500, 3375, 'Fedex', 4, 7, true),
  ('UG', 'UGA', 'Uganda', 4000, 3505, 'Fedex', 4, 7, true),
  ('UA', 'UKR', 'Ukraine', 3500, 3052, 'Fedex', 4, 7, true),
  ('AE', 'ARE', 'United Arab Emirates', 1000, 692, 'ShipGlobal Direct', 4, 7, true),
  ('GB', 'GBR', 'United Kingdom', 1000, 831, 'ShipGlobal Direct', 7, 10, true),
  ('US', 'USA', 'United States', 2000, 1489, 'ShipGlobal Direct Commercial', 7, 10, true),
  ('UM', 'UMI', 'United States Minor Outlying Islands', 4000, 3867, 'ShipGlobal WorldWide', 13, 18, false),
  ('UY', 'URY', 'Uruguay', 3500, 3357, 'Fedex', 4, 7, true),
  ('UZ', 'UZB', 'Uzbekistan', 3500, 3052, 'Fedex', 4, 7, true),
  ('VU', 'VUT', 'Vanuatu', 3500, 3375, 'Fedex', 4, 7, true),
  ('VA', 'VAT', 'Vatican City State (Holy See)', 5500, 5053, 'ShipGlobal WorldWide', 13, 18, true),
  ('VE', 'VEN', 'Venezuela', 3500, 3357, 'Fedex', 4, 7, true),
  ('VN', 'VNM', 'Vietnam', 3000, 2935, 'UPS', 4, 7, true),
  ('VG', 'VGB', 'Virgin Islands (British)', 3500, 3357, 'Fedex', 4, 7, true),
  ('WF', 'WLF', 'Wallis And Futuna Islands', 4000, 3867, 'ShipGlobal WorldWide', 13, 18, true),
  ('EH', 'ESH', 'Western Sahara', 4000, 3769, 'ShipGlobal WorldWide', 13, 18, true),
  ('YE', 'YEM', 'Yemen', 3000, 2666, 'Fedex', 4, 7, true),
  ('ZM', 'ZMB', 'Zambia', 4000, 3505, 'Fedex', 4, 7, true),
  ('ZW', 'ZWE', 'Zimbabwe', 4000, 3505, 'Fedex', 4, 7, true);

-- ---------------------------------------------------------------- a price in a country

-- The freight a kg in a country's prices; null when IWC does not sell there.
create function public._country_rate(p_country text) returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select c.inr_per_kg from public.ship_countries c
   where c.iso2 = upper(coalesce(nullif(p_country, ''), 'US')) and c.open and c.inr_per_kg is not null;
$$;

-- A piece's price in a country: its US price plus the difference in freight on the weight its price was worked out on
-- (D-128: ₹2 a gram; a heavy piece on half its weight, D-155), through its category's divisor and ₹92 a dollar, to the
-- cent. A price set by hand moves by the same freight. The US (₹2,000 a kg) gets exactly its price.
create function public._country_price_cents(p_variant uuid, p_country text) returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(v.price_cents, p.price_cents)
         + case when coalesce(r.rate, 2000) = 2000 then 0
                else round(public._priced_weight(coalesce(v.weight_g, public._pricing_weight_g(p.id), 0), p.heavy_item)
                           * (r.rate - 2000)
                           / (920.0 * case p.product_type when 'food' then 0.80 when 'home' then 0.50 else 0.60 end))::integer
           end
  from public.product_variants v
  join public.products p on p.id = v.product_id
  cross join (select public._country_rate(p_country) as rate) r
  where v.id = p_variant;
$$;

-- A heavy piece's Heavy-item shipping (its other half, D-155) in a country, the same way.
create function public._country_heavy_cents(p_variant uuid, p_country text) returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select case when not (p.heavy_item and p.price_auto) then 0
              else coalesce(v.heavy_cents, 0)
                   + case when coalesce(r.rate, 2000) = 2000 then 0
                          else round((coalesce(v.weight_g, public._pricing_weight_g(p.id), 0)
                                      - public._priced_weight(coalesce(v.weight_g, public._pricing_weight_g(p.id), 0), true))
                                     * (r.rate - 2000) / (920.0 * 0.50))::integer
                     end end
  from public.product_variants v
  join public.products p on p.id = v.product_id
  cross join (select public._country_rate(p_country) as rate) r
  where v.id = p_variant;
$$;

-- The store's one read for prices abroad: the pieces, cards and kits a page shows, priced in the visitor's country (no
-- weight, no rate: only the dollars). At most 200 of each a call. Null for a country IWC does not sell in.
create function public.store_country_prices(p_country text, p_variants uuid[] default '{}', p_products uuid[] default '{}',
                                            p_recipes text[] default '{}') returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select case when public._country_rate(p_country) is null then null else jsonb_build_object(
    'country', upper(p_country),
    'variants', coalesce((select jsonb_object_agg(sv.id, jsonb_build_object(
                                 'price', public._country_price_cents(sv.id, p_country),
                                 'heavy', public._country_heavy_cents(sv.id, p_country)))
                            from public.store_variants sv
                           where sv.id = any (p_variants[1:200])), '{}'::jsonb),
    -- a card's price: its cheapest option in stock (else its cheapest), as the card's "From" is
    'products', coalesce((select jsonb_object_agg(x.product_id, x.price)
                            from (select sv.product_id,
                                         coalesce(min(public._country_price_cents(sv.id, p_country)) filter (where sv.available > 0),
                                                  min(public._country_price_cents(sv.id, p_country))) as price
                                    from public.store_variants sv
                                   where sv.product_id = any (p_products[1:200])
                                   group by sv.product_id) x), '{}'::jsonb),
    -- a recipe's kit (by its slug): its pieces in stock, as _store_recipe_kit adds them
    'recipes', coalesce((select jsonb_object_agg(x.slug, x.cents)
                           from (select r.slug, sum(public._country_price_cents(sv.id, p_country))::integer as cents
                                   from public.recipes r
                                   join public.recipe_ingredients i on i.recipe_id = r.id
                                   join public.store_variants sv on sv.id = i.variant_id and sv.available > 0
                                  where r.slug = any (p_recipes[1:200])
                                  group by r.slug) x), '{}'::jsonb)) end;
$$;

-- The countries IWC sells in, for Profile's list and checkout's country field (names only).
create function public.store_countries() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('code', lower(c.iso2), 'name', c.name) order by c.name), '[]'::jsonb)
  from public.ship_countries c where c.open and c.inr_per_kg is not null;
$$;

-- ---------------------------------------------------------------- the bag's heavy-item shipping in a country

drop function public.store_bag_charges(jsonb, integer, text, text);
create function public.store_bag_charges(p_items jsonb, p_discount_cents integer default 0,
                                         p_state text default null, p_line1 text default null, p_country text default null)
returns jsonb
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  s public.pricing_settings;
  v_ship jsonb;
  v_from_india boolean;
  v_next record;
  v_heavy record;
  v_food_from date;
  v_food_to date;
  v_country text := upper(coalesce(nullif(p_country, ''), 'US'));
begin
  select * into s from public.pricing_settings where id = 1;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid_bag' using errcode = 'P0001';
  end if;
  -- D-208: abroad there is no US state; the shipments follow the US's rules (D-209)
  v_ship := public._bag_shipments(p_items, p_discount_cents, case when v_country = 'US' then p_state end, p_line1);
  v_from_india := (v_ship ->> 'billed_grams')::integer > 0;
  select * into v_next from public.store_next_delivery() limit 1;
  v_food_from := public._add_business_days(current_date, s.food_delivery_days_min);
  v_food_to := public._add_business_days(current_date, s.food_delivery_days_max);
  select coalesce(sum(public._country_heavy_cents(sv.id, v_country)
                      * least(greatest(coalesce((i ->> 'quantity')::integer, 0), 0), 99)), 0)::integer as cents,
         coalesce(jsonb_agg(sv.id) filter (where sv.heavy_cents > 0), '[]'::jsonb) as ids
    into v_heavy
    from jsonb_array_elements(p_items) i
    join public.store_variants sv on sv.id::text = i ->> 'variant_id';
  return jsonb_build_object(
    'free_min_cents', s.free_shipping_min_cents,
    'bulk_saving_from_cents', s.bulk_saving_from_cents,
    'shipping_cents', (v_ship ->> 'shipping_cents')::integer,
    'past_line_cents', 0,
    'retailer_cents', case when v_from_india then coalesce(s.small_order_retailer_cents, 0) else 0 end,
    'retailer_pct', case when v_from_india then coalesce(s.retailer_pct, 0) else 0 end,
    'bulk_saving_pct', coalesce(s.bulk_saving_pct, 0),
    'bulk_saving_cap_cents', coalesce(s.bulk_saving_cap_cents, 0),
    'shown_shipping_cents', (v_ship ->> 'shipping_cents')::integer,
    'heavy_cents', v_heavy.cents,
    'heavy_line_off_pct', coalesce(s.heavy_line_off_pct, 0),
    'heavy_ids', v_heavy.ids,
    'shipments', (v_ship - 'food_variant_ids' - 'billed_grams' - 'food_shipping_cents')
                 || jsonb_build_object('quick_cents', v_ship -> 'food_cents', 'quick_only', v_ship -> 'food_only',
                                       'min_cents', null, 'gap_cents', null),
    'food_ids', coalesce(v_ship -> 'food_variant_ids', '[]'::jsonb),
    'quick_ids', coalesce(v_ship -> 'food_variant_ids', '[]'::jsonb),
    'dates', jsonb_build_object(
      'food_from', v_food_from,
      'food_to', v_food_to,
      'quick_from', v_food_from,
      'quick_to', v_food_to,
      'standard_from', v_next.est_delivery_from,
      'standard_to', v_next.est_delivery_to));
end $$;

-- ---------------------------------------------------------------- an order from any country

-- As 20261109090000's create_order (renamed _create_order_goods by 20261126090000), with the price of each piece in the
-- order's country (shipping_address.country, the US when absent) and no US state abroad. A closed country is refused.
create or replace function public._create_order_goods(p_order jsonb)
returns table (order_id uuid, order_number text)
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_settings public.pricing_settings%rowtype;
  v_order public.orders%rowtype;
  v_method public.shipping_method;
  v_from date;
  v_to date;
  v_item jsonb;
  v_variant record;
  v_qty integer;
  v_unit integer;
  v_sum integer := 0;
  v_food_only boolean;
  v_split boolean;
  v_ship jsonb;
  v_first uuid;
  v_second uuid;
  v_food_share integer;
  v_country text := upper(coalesce(nullif(p_order -> 'shipping_address' ->> 'country', ''), 'US'));
begin
  if public._country_rate(v_country) is null then
    raise exception 'country_closed:%', v_country using errcode = 'P0001';
  end if;
  select * into v_settings from public.pricing_settings where id = 1;
  v_method := coalesce(nullif(p_order ->> 'shipping_method', ''), 'standard')::public.shipping_method;

  -- The same shipments the bag and checkout showed (_bag_shipments): food in its days, the rest in theirs; a bag with
  -- both is two shipments; outside the 48 states and DC everything is one, in the standard days.
  if jsonb_typeof(p_order -> 'items') = 'array' then
    -- D-208: abroad there is no US state; the shipments follow the US's rules (D-209: the same days everywhere)
    v_ship := public._bag_shipments(p_order -> 'items', coalesce((p_order ->> 'discount_cents')::integer, 0),
                                    case when v_country = 'US' then p_order -> 'shipping_address' ->> 'state' end,
                                    p_order -> 'shipping_address' ->> 'line1');
  end if;
  v_food_only := v_method = 'standard' and coalesce((v_ship ->> 'food_only')::boolean, false);
  v_split := v_method = 'standard' and coalesce((v_ship ->> 'split')::boolean, false);

  if v_method = 'express' then
    -- TODO(D-187): drop after the release. A payment priced with Express before the Deploy still becomes an order,
    -- with the days it was promised (Settings' 15 – 18 until now).
    v_from := current_date + 15;
    v_to := current_date + 18;
  elsif v_food_only then
    v_from := public._add_business_days(current_date, v_settings.food_delivery_days_min);
    v_to := public._add_business_days(current_date, v_settings.food_delivery_days_max);
  else
    if v_settings.delivery_days_min is null or v_settings.delivery_days_max is null then
      raise exception 'delivery_window_unconfigured' using errcode = 'P0001';
    end if;
    v_from := public._add_business_days(current_date, v_settings.delivery_days_min);
    v_to := public._add_business_days(current_date, v_settings.delivery_days_max);
  end if;

  if jsonb_typeof(p_order -> 'items') is distinct from 'array' or jsonb_array_length(p_order -> 'items') = 0 then
    raise exception 'order_has_no_items' using errcode = 'P0001';
  end if;

  insert into public.orders (
    user_id, email, status, est_delivery_from, est_delivery_to, shipping_method,
    subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
    promo_code_id, payment_intent_id, payment_status, shipping_address)
  values (
    nullif(p_order ->> 'user_id', '')::uuid,
    lower(p_order ->> 'email'),
    'confirmed',
    v_from, v_to, v_method,
    (p_order ->> 'subtotal_cents')::integer,
    coalesce((p_order ->> 'discount_cents')::integer, 0),
    coalesce((p_order ->> 'shipping_cents')::integer, 0),
    coalesce((p_order ->> 'tax_cents')::integer, 0),
    (p_order ->> 'total_cents')::integer,
    nullif(p_order ->> 'promo_code_id', '')::uuid,
    p_order ->> 'payment_intent_id',
    'paid',
    p_order -> 'shipping_address')
  returning * into v_order;

  -- Variant-id order: every order locks pieces in the same order, so no deadlocks (PR-9).
  for v_item in select value from jsonb_array_elements(p_order -> 'items') order by value ->> 'variant_id'
  loop
    v_qty := (v_item ->> 'quantity')::integer;
    v_unit := (v_item ->> 'unit_price_cents')::integer;

    select v.id, v.label, v.product_id, coalesce(v.price_cents, p.price_cents) as price_cents,
           p.name as product_name, r.name as region_name
      into v_variant
    from public.product_variants v
    join public.products p on p.id = v.product_id
    left join public.regions r on r.id = p.region_id
    where v.id = (v_item ->> 'variant_id')::uuid
      and v.is_active
      and p.status = 'live'
      and (not p.is_placeholder or public.dev_preview());
    if not found then
      raise exception 'variant_unavailable:%', v_item ->> 'variant_id' using errcode = 'P0001';
    end if;
    -- D-208: the piece's price in the order's country (the US price there; abroad its freight at that country's rate)
    if v_unit is distinct from public._country_price_cents(v_variant.id, v_country) then
      raise exception 'price_mismatch:%', v_variant.id using errcode = 'P0001';
    end if;

    -- INV-3: one conditional statement; fails instead of overselling.
    perform public._set_stock_context('reserved', 'order', v_order.id, null);
    update public.product_variants
       set qty_reserved = qty_reserved + v_qty
     where id = v_variant.id
       and qty_listed - qty_reserved >= v_qty;
    if not found then
      raise exception 'insufficient_stock:%', v_variant.id using errcode = 'P0001';
    end if;
    perform public._set_stock_context(null, null, null, null);

    insert into public.order_items (order_id, variant_id, product_id, product_name, variant_label,
                                    region_name, quantity, unit_price_cents, total_price_cents)
    values (v_order.id, v_variant.id, v_variant.product_id, v_variant.product_name, v_variant.label,
            v_variant.region_name, v_qty, v_unit, v_qty * v_unit);
    v_sum := v_sum + v_qty * v_unit;
  end loop;

  if v_sum <> v_order.subtotal_cents then
    raise exception 'subtotal_mismatch' using errcode = 'P0001';
  end if;

  insert into public.order_events (order_id, kind, visible_to_customer)
  values (v_order.id, 'order_confirmed', true);

  -- Every piece from India goes on the buy list at once (D-115). A piece already in the US is not bought (D-072).
  insert into public.pickups (order_item_id, variant_id, quantity, shop_price_paise)
  select oi.id, oi.variant_id, oi.quantity, p.shop_price_paise
  from public.order_items oi
  join public.products p on p.id = oi.product_id
  where oi.order_id = v_order.id and not p.is_us_stock;

  -- An order of only US pieces has just moved to the US days (_us_stock_order): its shipment follows the order.
  select o.est_delivery_from, o.est_delivery_to into v_from, v_to from public.orders o where o.id = v_order.id;

  -- The order's shipments. Shipping is one parcel's (the whole bag), shared by weight so the two add up.
  if v_split then
    v_food_share := case when coalesce((v_ship ->> 'shipping_cents')::integer, 0) = 0 then 0
                         else round(v_order.shipping_cents * (v_ship ->> 'food_shipping_cents')::numeric
                                    / (v_ship ->> 'shipping_cents')::numeric)::integer end;
    insert into public.order_shipments (order_id, seq, kind, est_delivery_from, est_delivery_to, shipping_cents)
    values (v_order.id, 1, 'food', public._add_business_days(current_date, v_settings.food_delivery_days_min),
            public._add_business_days(current_date, v_settings.food_delivery_days_max), v_food_share)
    returning id into v_first;
    insert into public.order_shipments (order_id, seq, kind, est_delivery_from, est_delivery_to, shipping_cents)
    values (v_order.id, 2, 'standard', v_from, v_to, v_order.shipping_cents - v_food_share)
    returning id into v_second;
    update public.order_items oi
       set shipment_id = case when oi.variant_id in (select jsonb_array_elements_text(v_ship -> 'food_variant_ids')::uuid)
                              then v_first else v_second end
     where oi.order_id = v_order.id;
  else
    insert into public.order_shipments (order_id, seq, kind, est_delivery_from, est_delivery_to, shipping_cents)
    values (v_order.id, 1, case when v_food_only then 'food' when v_method = 'express' then 'express' else 'standard' end,
            v_from, v_to, v_order.shipping_cents)
    returning id into v_first;
    update public.order_items oi set shipment_id = v_first where oi.order_id = v_order.id;
  end if;

  return query select v_order.id, v_order.order_number;
end $$;

revoke all on function public._country_rate(text), public._country_price_cents(uuid, text),
  public._country_heavy_cents(uuid, text), public._create_order_goods(jsonb) from public, anon, authenticated;
revoke all on function public._create_order_goods(jsonb) from service_role;
grant execute on function public.store_country_prices(text, uuid[], uuid[], text[]), public.store_countries(),
  public.store_bag_charges(jsonb, integer, text, text, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
