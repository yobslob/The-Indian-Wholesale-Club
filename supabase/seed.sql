-- =============================================================================
-- Seed Data: US-Facing Apparel E-Commerce Catalog
-- Run with: supabase db reset
-- =============================================================================

-- ==========================================
-- Categories (3 top-level + 5 subcategories)
-- ==========================================
INSERT INTO categories (id, name, slug, description, sort_order) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Men', 'men', 'Men''s Clothing & Accessories', 1),
    ('22222222-2222-2222-2222-222222222222', 'Women', 'women', 'Women''s Clothing & Accessories', 2),
    ('33333333-3333-3333-3333-333333333333', 'Accessories', 'accessories', 'Bags, Belts, Hats & More', 3);

INSERT INTO categories (id, name, slug, description, parent_category_id, sort_order) VALUES
    ('44444444-4444-4444-4444-444444444444', 'Shirts', 'men-shirts', 'Men''s Shirts & Button-Downs', '11111111-1111-1111-1111-111111111111', 1),
    ('55555555-5555-5555-5555-555555555555', 'Pants', 'men-pants', 'Men''s Pants & Trousers', '11111111-1111-1111-1111-111111111111', 2),
    ('66666666-6666-6666-6666-666666666666', 'Dresses', 'women-dresses', 'Women''s Dresses', '22222222-2222-2222-2222-222222222222', 1),
    ('77777777-7777-7777-7777-777777777777', 'Tops', 'women-tops', 'Women''s Tops & Blouses', '22222222-2222-2222-2222-222222222222', 2),
    ('88888888-8888-8888-8888-888888888888', 'Bags', 'bags', 'Totes, Crossbody & Travel Bags', '33333333-3333-3333-3333-333333333333', 1);

-- ==========================================
-- Products (8 products across categories)
-- ==========================================

-- Men's Shirts
INSERT INTO products (id, name, slug, description, long_description, category_id, base_price_cents, compare_at_price_cents, is_featured, tags) VALUES
(
    'aaaa1111-1111-1111-1111-aaaaaaaaaaaa',
    'Classic Oxford Shirt',
    'classic-oxford-shirt',
    'A timeless Oxford cotton shirt with a clean, tailored fit.',
    'Crafted from premium 100% cotton Oxford cloth, this shirt features a button-down collar, chest pocket, and back box pleat. Pre-washed for softness. Imported fabric, assembled with precision. Available in White, Light Blue, and Chambray.',
    '44444444-4444-4444-4444-444444444444',
    4500, 5500, true,
    ARRAY['oxford', 'button-down', 'classic', 'cotton']
),
(
    'aaaa2222-2222-2222-2222-aaaaaaaaaaaa',
    'Heavyweight Pocket Tee',
    'heavyweight-pocket-tee',
    'A substantial, 6.5oz cotton tee with a structured drape.',
    'Our heavyweight pocket tee is made from garment-dyed 6.5oz cotton jersey. Features a reinforced chest pocket, ribbed crew neck, and slightly relaxed fit. The kind of tee you''ll reach for every day. Available in 5 colors.',
    '44444444-4444-4444-4444-444444444444',
    3200, NULL, true,
    ARRAY['tee', 'heavyweight', 'basics', 'cotton']
);

-- Men's Pants
INSERT INTO products (id, name, slug, description, long_description, category_id, base_price_cents, compare_at_price_cents, is_featured, tags) VALUES
(
    'bbbb1111-1111-1111-1111-bbbbbbbbbbbb',
    'Slim Chino Pant',
    'slim-chino-pant',
    'Clean, modern chinos with a slim tapered fit.',
    'Cut from a stretch cotton-twill blend (98% cotton, 2% elastane), these chinos deliver all-day comfort without sacrificing structure. Features a zip fly, interior waistband grip, and clean-finished seams. Available in Khaki, Navy, and Olive.',
    '55555555-5555-5555-5555-555555555555',
    6800, 7800, false,
    ARRAY['chino', 'slim', 'stretch', 'pants']
);

-- Women's Dresses
INSERT INTO products (id, name, slug, description, long_description, category_id, base_price_cents, compare_at_price_cents, is_featured, tags) VALUES
(
    'cccc1111-1111-1111-1111-cccccccccccc',
    'Summer Floral Dress',
    'summer-floral-dress',
    'Lightweight floral dress perfect for warm-weather days.',
    'This breezy midi dress features a delicate floral print on lightweight viscose fabric. V-neckline, adjustable tie waist, and tiered skirt for beautiful movement. Fully lined bodice. Pairs perfectly with sandals or sneakers.',
    '66666666-6666-6666-6666-666666666666',
    6500, NULL, true,
    ARRAY['floral', 'midi', 'summer', 'viscose']
),
(
    'cccc2222-2222-2222-2222-cccccccccccc',
    'Linen Shirt Dress',
    'linen-shirt-dress',
    'An effortless linen shirt dress with relaxed proportions.',
    'Made from 100% European flax linen, this shirt dress features a spread collar, rolled sleeves with button tabs, and a self-tie belt. Relaxed fit falls above the knee. The natural texture of linen gives each piece a unique character. Wrinkles are part of the charm.',
    '66666666-6666-6666-6666-666666666666',
    8900, 10500, false,
    ARRAY['linen', 'shirt-dress', 'relaxed', 'european-flax']
);

-- Women's Tops
INSERT INTO products (id, name, slug, description, long_description, category_id, base_price_cents, compare_at_price_cents, is_featured, tags) VALUES
(
    'dddd1111-1111-1111-1111-dddddddddddd',
    'Ribbed Tank Top',
    'ribbed-tank-top',
    'A wardrobe essential in soft, stretchy ribbed cotton.',
    'Our ribbed tank is made from a fine-gauge cotton-modal blend for a luxuriously soft hand feel. Fitted silhouette, scoop neck, and a slightly longer length to tuck or wear loose. Available in Black, White, Oatmeal, and Sage.',
    '77777777-7777-7777-7777-777777777777',
    2400, NULL, true,
    ARRAY['tank', 'ribbed', 'basics', 'cotton-modal']
);

-- Accessories
INSERT INTO products (id, name, slug, description, long_description, category_id, base_price_cents, compare_at_price_cents, is_featured, tags) VALUES
(
    'eeee1111-1111-1111-1111-eeeeeeeeeeee',
    'Canvas Tote Bag',
    'canvas-tote-bag',
    'A durable, oversized canvas tote for everyday carry.',
    'Made from heavyweight 18oz cotton canvas with reinforced leather handles and an interior zip pocket. Unlined for a casual feel. Fits a 15" laptop comfortably. Available in Natural and Washed Black.',
    '88888888-8888-8888-8888-888888888888',
    4800, 5800, true,
    ARRAY['tote', 'canvas', 'everyday', 'leather-handles']
),
(
    'eeee2222-2222-2222-2222-eeeeeeeeeeee',
    'Leather Crossbody Bag',
    'leather-crossbody-bag',
    'A compact, vegetable-tanned leather crossbody.',
    'Handcrafted from vegetable-tanned Italian leather that develops a rich patina over time. Features an adjustable strap, magnetic flap closure, interior card slots, and a rear zip pocket. Fits phone, wallet, and essentials.',
    '88888888-8888-8888-8888-888888888888',
    12500, NULL, false,
    ARRAY['crossbody', 'leather', 'vegetable-tanned', 'italian']
);

-- ==========================================
-- Product Variants (40+ variants across all products)
-- ==========================================

-- Classic Oxford Shirt — White (XS–XL)
INSERT INTO product_variants (product_id, sku, size, color_name, color_hex, inventory_count, weight_grams) VALUES
    ('aaaa1111-1111-1111-1111-aaaaaaaaaaaa', 'OXF-WHT-XS', 'XS', 'White', '#FFFFFF', 15, 220),
    ('aaaa1111-1111-1111-1111-aaaaaaaaaaaa', 'OXF-WHT-S', 'S', 'White', '#FFFFFF', 40, 230),
    ('aaaa1111-1111-1111-1111-aaaaaaaaaaaa', 'OXF-WHT-M', 'M', 'White', '#FFFFFF', 50, 240),
    ('aaaa1111-1111-1111-1111-aaaaaaaaaaaa', 'OXF-WHT-L', 'L', 'White', '#FFFFFF', 30, 260),
    ('aaaa1111-1111-1111-1111-aaaaaaaaaaaa', 'OXF-WHT-XL', 'XL', 'White', '#FFFFFF', 20, 280);

-- Classic Oxford Shirt — Light Blue (S–L)
INSERT INTO product_variants (product_id, sku, size, color_name, color_hex, inventory_count, weight_grams) VALUES
    ('aaaa1111-1111-1111-1111-aaaaaaaaaaaa', 'OXF-LBL-S', 'S', 'Light Blue', '#AEC6CF', 25, 230),
    ('aaaa1111-1111-1111-1111-aaaaaaaaaaaa', 'OXF-LBL-M', 'M', 'Light Blue', '#AEC6CF', 35, 240),
    ('aaaa1111-1111-1111-1111-aaaaaaaaaaaa', 'OXF-LBL-L', 'L', 'Light Blue', '#AEC6CF', 20, 260);

-- Heavyweight Pocket Tee — Black (XS–XXL)
INSERT INTO product_variants (product_id, sku, size, color_name, color_hex, inventory_count, weight_grams) VALUES
    ('aaaa2222-2222-2222-2222-aaaaaaaaaaaa', 'HWT-BLK-XS', 'XS', 'Black', '#171717', 20, 200),
    ('aaaa2222-2222-2222-2222-aaaaaaaaaaaa', 'HWT-BLK-S', 'S', 'Black', '#171717', 45, 210),
    ('aaaa2222-2222-2222-2222-aaaaaaaaaaaa', 'HWT-BLK-M', 'M', 'Black', '#171717', 60, 220),
    ('aaaa2222-2222-2222-2222-aaaaaaaaaaaa', 'HWT-BLK-L', 'L', 'Black', '#171717', 40, 240),
    ('aaaa2222-2222-2222-2222-aaaaaaaaaaaa', 'HWT-BLK-XL', 'XL', 'Black', '#171717', 25, 260),
    ('aaaa2222-2222-2222-2222-aaaaaaaaaaaa', 'HWT-BLK-XXL', 'XXL', 'Black', '#171717', 10, 280);

-- Heavyweight Pocket Tee — Oatmeal (S–XL)
INSERT INTO product_variants (product_id, sku, size, color_name, color_hex, inventory_count, weight_grams) VALUES
    ('aaaa2222-2222-2222-2222-aaaaaaaaaaaa', 'HWT-OAT-S', 'S', 'Oatmeal', '#E8DCC8', 30, 210),
    ('aaaa2222-2222-2222-2222-aaaaaaaaaaaa', 'HWT-OAT-M', 'M', 'Oatmeal', '#E8DCC8', 40, 220),
    ('aaaa2222-2222-2222-2222-aaaaaaaaaaaa', 'HWT-OAT-L', 'L', 'Oatmeal', '#E8DCC8', 25, 240),
    ('aaaa2222-2222-2222-2222-aaaaaaaaaaaa', 'HWT-OAT-XL', 'XL', 'Oatmeal', '#E8DCC8', 15, 260);

-- Slim Chino Pant — Khaki (S–XL)
INSERT INTO product_variants (product_id, sku, size, color_name, color_hex, inventory_count, weight_grams) VALUES
    ('bbbb1111-1111-1111-1111-bbbbbbbbbbbb', 'CHN-KHK-S', 'S', 'Khaki', '#C3B091', 30, 380),
    ('bbbb1111-1111-1111-1111-bbbbbbbbbbbb', 'CHN-KHK-M', 'M', 'Khaki', '#C3B091', 45, 400),
    ('bbbb1111-1111-1111-1111-bbbbbbbbbbbb', 'CHN-KHK-L', 'L', 'Khaki', '#C3B091', 35, 420),
    ('bbbb1111-1111-1111-1111-bbbbbbbbbbbb', 'CHN-KHK-XL', 'XL', 'Khaki', '#C3B091', 20, 440);

-- Slim Chino Pant — Navy (S–L)
INSERT INTO product_variants (product_id, sku, size, color_name, color_hex, inventory_count, weight_grams) VALUES
    ('bbbb1111-1111-1111-1111-bbbbbbbbbbbb', 'CHN-NVY-S', 'S', 'Navy', '#1B2A4A', 25, 380),
    ('bbbb1111-1111-1111-1111-bbbbbbbbbbbb', 'CHN-NVY-M', 'M', 'Navy', '#1B2A4A', 30, 400),
    ('bbbb1111-1111-1111-1111-bbbbbbbbbbbb', 'CHN-NVY-L', 'L', 'Navy', '#1B2A4A', 20, 420);

-- Summer Floral Dress (XS–L)
INSERT INTO product_variants (product_id, sku, size, color_name, color_hex, inventory_count, weight_grams) VALUES
    ('cccc1111-1111-1111-1111-cccccccccccc', 'DRS-FLR-XS', 'XS', 'Floral Print', NULL, 10, 180),
    ('cccc1111-1111-1111-1111-cccccccccccc', 'DRS-FLR-S', 'S', 'Floral Print', NULL, 20, 190),
    ('cccc1111-1111-1111-1111-cccccccccccc', 'DRS-FLR-M', 'M', 'Floral Print', NULL, 15, 200),
    ('cccc1111-1111-1111-1111-cccccccccccc', 'DRS-FLR-L', 'L', 'Floral Print', NULL, 8, 210);

-- Linen Shirt Dress — Natural (XS–L)
INSERT INTO product_variants (product_id, sku, size, color_name, color_hex, inventory_count, weight_grams) VALUES
    ('cccc2222-2222-2222-2222-cccccccccccc', 'LSD-NAT-XS', 'XS', 'Natural', '#E8DCC8', 8, 240),
    ('cccc2222-2222-2222-2222-cccccccccccc', 'LSD-NAT-S', 'S', 'Natural', '#E8DCC8', 15, 250),
    ('cccc2222-2222-2222-2222-cccccccccccc', 'LSD-NAT-M', 'M', 'Natural', '#E8DCC8', 12, 260),
    ('cccc2222-2222-2222-2222-cccccccccccc', 'LSD-NAT-L', 'L', 'Natural', '#E8DCC8', 6, 270);

-- Ribbed Tank Top — Black (XS–XL)
INSERT INTO product_variants (product_id, sku, size, color_name, color_hex, inventory_count, weight_grams) VALUES
    ('dddd1111-1111-1111-1111-dddddddddddd', 'TNK-BLK-XS', 'XS', 'Black', '#171717', 30, 90),
    ('dddd1111-1111-1111-1111-dddddddddddd', 'TNK-BLK-S', 'S', 'Black', '#171717', 50, 95),
    ('dddd1111-1111-1111-1111-dddddddddddd', 'TNK-BLK-M', 'M', 'Black', '#171717', 60, 100),
    ('dddd1111-1111-1111-1111-dddddddddddd', 'TNK-BLK-L', 'L', 'Black', '#171717', 35, 105),
    ('dddd1111-1111-1111-1111-dddddddddddd', 'TNK-BLK-XL', 'XL', 'Black', '#171717', 20, 110);

-- Ribbed Tank Top — White (S–L)
INSERT INTO product_variants (product_id, sku, size, color_name, color_hex, inventory_count, weight_grams) VALUES
    ('dddd1111-1111-1111-1111-dddddddddddd', 'TNK-WHT-S', 'S', 'White', '#FFFFFF', 40, 95),
    ('dddd1111-1111-1111-1111-dddddddddddd', 'TNK-WHT-M', 'M', 'White', '#FFFFFF', 50, 100),
    ('dddd1111-1111-1111-1111-dddddddddddd', 'TNK-WHT-L', 'L', 'White', '#FFFFFF', 30, 105);

-- Canvas Tote Bag — Natural & Washed Black (one size)
INSERT INTO product_variants (product_id, sku, size, color_name, color_hex, inventory_count, weight_grams) VALUES
    ('eeee1111-1111-1111-1111-eeeeeeeeeeee', 'TOT-NAT', NULL, 'Natural', '#E8DCC8', 50, 450),
    ('eeee1111-1111-1111-1111-eeeeeeeeeeee', 'TOT-BLK', NULL, 'Washed Black', '#2C2C2C', 35, 450);

-- Leather Crossbody Bag — Cognac & Black (one size)
INSERT INTO product_variants (product_id, sku, size, color_name, color_hex, inventory_count, weight_grams) VALUES
    ('eeee2222-2222-2222-2222-eeeeeeeeeeee', 'XBD-COG', NULL, 'Cognac', '#9A5B2F', 15, 380),
    ('eeee2222-2222-2222-2222-eeeeeeeeeeee', 'XBD-BLK', NULL, 'Black', '#171717', 12, 380);

-- ==========================================
-- Product Images (2 per product: primary + alternate)
-- ==========================================
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary) VALUES
    -- Classic Oxford Shirt
    ('aaaa1111-1111-1111-1111-aaaaaaaaaaaa', 'https://picsum.photos/seed/oxford-shirt-front/600/800', 'Classic Oxford Shirt - Front View', 0, true),
    ('aaaa1111-1111-1111-1111-aaaaaaaaaaaa', 'https://picsum.photos/seed/oxford-shirt-detail/600/800', 'Classic Oxford Shirt - Collar Detail', 1, false),
    -- Heavyweight Pocket Tee
    ('aaaa2222-2222-2222-2222-aaaaaaaaaaaa', 'https://picsum.photos/seed/pocket-tee-front/600/800', 'Heavyweight Pocket Tee - Front View', 0, true),
    ('aaaa2222-2222-2222-2222-aaaaaaaaaaaa', 'https://picsum.photos/seed/pocket-tee-back/600/800', 'Heavyweight Pocket Tee - Back View', 1, false),
    -- Slim Chino Pant
    ('bbbb1111-1111-1111-1111-bbbbbbbbbbbb', 'https://picsum.photos/seed/chino-pant-front/600/800', 'Slim Chino Pant - Front View', 0, true),
    ('bbbb1111-1111-1111-1111-bbbbbbbbbbbb', 'https://picsum.photos/seed/chino-pant-detail/600/800', 'Slim Chino Pant - Fabric Detail', 1, false),
    -- Summer Floral Dress
    ('cccc1111-1111-1111-1111-cccccccccccc', 'https://picsum.photos/seed/floral-dress-front/600/800', 'Summer Floral Dress - Front View', 0, true),
    ('cccc1111-1111-1111-1111-cccccccccccc', 'https://picsum.photos/seed/floral-dress-back/600/800', 'Summer Floral Dress - Back View', 1, false),
    -- Linen Shirt Dress
    ('cccc2222-2222-2222-2222-cccccccccccc', 'https://picsum.photos/seed/linen-dress-front/600/800', 'Linen Shirt Dress - Front View', 0, true),
    ('cccc2222-2222-2222-2222-cccccccccccc', 'https://picsum.photos/seed/linen-dress-detail/600/800', 'Linen Shirt Dress - Belt Detail', 1, false),
    -- Ribbed Tank Top
    ('dddd1111-1111-1111-1111-dddddddddddd', 'https://picsum.photos/seed/tank-top-front/600/800', 'Ribbed Tank Top - Front View', 0, true),
    ('dddd1111-1111-1111-1111-dddddddddddd', 'https://picsum.photos/seed/tank-top-back/600/800', 'Ribbed Tank Top - Back View', 1, false),
    -- Canvas Tote Bag
    ('eeee1111-1111-1111-1111-eeeeeeeeeeee', 'https://picsum.photos/seed/canvas-tote-front/600/800', 'Canvas Tote Bag - Front View', 0, true),
    ('eeee1111-1111-1111-1111-eeeeeeeeeeee', 'https://picsum.photos/seed/canvas-tote-detail/600/800', 'Canvas Tote Bag - Interior Detail', 1, false),
    -- Leather Crossbody Bag
    ('eeee2222-2222-2222-2222-eeeeeeeeeeee', 'https://picsum.photos/seed/crossbody-bag-front/600/800', 'Leather Crossbody Bag - Front View', 0, true),
    ('eeee2222-2222-2222-2222-eeeeeeeeeeee', 'https://picsum.photos/seed/crossbody-bag-detail/600/800', 'Leather Crossbody Bag - Strap Detail', 1, false);

-- ==========================================
-- Promo Codes
-- ==========================================
INSERT INTO promo_codes (code, discount_type, discount_value, min_order_cents, max_uses, valid_from, valid_until) VALUES
    ('WELCOME10', 'percentage', 10, 5000, 1000, NOW(), NOW() + INTERVAL '1 year'),
    -- FREESHIP's benefit is the shipping waiver itself (shared checkout
    -- calculator special-cases the code); the item-subtotal discount must be
    -- 0 or it double-discounts (H5/N11 - matches migration 20260925000005).
    ('FREESHIP', 'fixed', 0, 7500, NULL, NOW(), NOW() + INTERVAL '6 months'),
    -- ROOT20 is referenced by scripts/test-checkout-intent.ts; seeding it
    -- keeps the tooling and the database promo set aligned.
    ('ROOT20', 'percentage', 20, NULL, NULL, NOW(), NOW() + INTERVAL '1 year');
