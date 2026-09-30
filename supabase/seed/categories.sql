-- =============================================================================
-- Initial category tree, PROPOSED by Claude for founder review (not a decision).
-- Categories are plain rows: the founder can rename, add or deactivate them in
-- the admin without a schema change. The catalogue (D-059) added everything after
-- Dhotis & Mundus. "Spice" is the database's name for the whole pantry (D-002).
-- =============================================================================

insert into public.categories (product_type, slug, name, sort_order) values
  ('clothing', 'sarees', 'Sarees & Drapes', 1),
  ('clothing', 'kurtas', 'Kurtas & Kurtis', 2),
  ('clothing', 'suits-and-sets', 'Suits & Sets', 3),
  ('clothing', 'lehengas', 'Lehengas', 4),
  ('clothing', 'dupattas-and-stoles', 'Dupattas & Stoles', 5),
  ('clothing', 'shawls', 'Shawls', 6),
  ('clothing', 'dhotis-and-mundus', 'Dhotis & Mundus', 7),
  ('clothing', 'jeans-and-trousers', 'Jeans & Trousers', 8),
  ('clothing', 'shirts-and-tops', 'Shirts, Tees & Tops', 9),
  ('clothing', 'co-ords-and-dresses', 'Co-ords & Dresses', 10),
  ('clothing', 'jackets-and-knitwear', 'Jackets & Knitwear', 11),
  ('clothing', 'headwear', 'Turbans & Headwear', 12),
  ('clothing', 'footwear', 'Footwear', 13),
  ('clothing', 'accessories', 'Accessories', 14),
  ('clothing', 'kids', 'Kids', 15),
  ('clothing', 'fabrics', 'Fabrics', 16),
  ('spice', 'whole-spices', 'Whole Spices', 1),
  ('spice', 'ground-spices', 'Ground Spices', 2),
  ('spice', 'masala-blends', 'Masala Blends', 3),
  ('spice', 'pickles-and-chutneys', 'Pickles & Chutneys', 4),
  ('spice', 'papad-and-wadi', 'Papad & Wadi', 5),
  ('spice', 'snacks-and-namkeen', 'Snacks & Namkeen', 6),
  ('spice', 'sweets', 'Sweets', 7),
  ('spice', 'rice-flours-and-staples', 'Rice, Flours & Staples', 8),
  ('spice', 'tea-and-drinks', 'Tea & Drinks', 9);
