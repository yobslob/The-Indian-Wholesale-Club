-- =============================================================================
-- Initial category tree, PROPOSED by Claude for founder review (not a decision).
-- Categories are plain rows: the founder can rename, add or deactivate them in
-- the admin without a schema change.
-- =============================================================================

insert into public.categories (product_type, slug, name, sort_order) values
  ('clothing', 'sarees', 'Sarees', 1),
  ('clothing', 'kurtas', 'Kurtas & Kurtis', 2),
  ('clothing', 'suits-and-sets', 'Suits & Sets', 3),
  ('clothing', 'lehengas', 'Lehengas', 4),
  ('clothing', 'dupattas-and-stoles', 'Dupattas & Stoles', 5),
  ('clothing', 'shawls', 'Shawls', 6),
  ('clothing', 'dhotis-and-mundus', 'Dhotis & Mundus', 7),
  ('spice', 'whole-spices', 'Whole Spices', 1),
  ('spice', 'ground-spices', 'Ground Spices', 2),
  ('spice', 'masala-blends', 'Masala Blends', 3);
