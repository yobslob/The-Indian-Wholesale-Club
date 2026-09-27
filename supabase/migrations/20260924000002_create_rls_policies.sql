-- Migration: Row Level Security Policies
-- Source: docs/02-database-schema-and-rls.md Section 2

-- ==========================================
-- Enable RLS on all tables
-- ==========================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- Profiles: Users can read/update their own profile
-- ==========================================
CREATE POLICY "Users can read own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- ==========================================
-- Addresses: Users can CRUD their own addresses
-- ==========================================
CREATE POLICY "Users can view own addresses"
    ON addresses FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own addresses"
    ON addresses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own addresses"
    ON addresses FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own addresses"
    ON addresses FOR DELETE
    USING (auth.uid() = user_id);

-- ==========================================
-- Categories: Publicly readable
-- ==========================================
CREATE POLICY "Categories are publicly readable"
    ON categories FOR SELECT
    USING (true);

-- ==========================================
-- Products: Publicly readable (active only)
-- ==========================================
CREATE POLICY "Products are publicly readable"
    ON products FOR SELECT
    USING (is_active = true);

-- ==========================================
-- Product Variants: Publicly readable (active only)
-- ==========================================
CREATE POLICY "Variants are publicly readable"
    ON product_variants FOR SELECT
    USING (is_active = true);

-- ==========================================
-- Product Images: Publicly readable
-- ==========================================
CREATE POLICY "Images are publicly readable"
    ON product_images FOR SELECT
    USING (true);

-- ==========================================
-- Cart Items: Users can manage their own cart
-- ==========================================
CREATE POLICY "Users can view own cart"
    ON cart_items FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert to own cart"
    ON cart_items FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cart"
    ON cart_items FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete from own cart"
    ON cart_items FOR DELETE
    USING (auth.uid() = user_id);

-- ==========================================
-- Wishlists: Users can manage their own wishlist
-- ==========================================
CREATE POLICY "Users can view own wishlist"
    ON wishlists FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert to own wishlist"
    ON wishlists FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete from own wishlist"
    ON wishlists FOR DELETE
    USING (auth.uid() = user_id);

-- ==========================================
-- Orders: Users can read and create their own orders
-- ==========================================
CREATE POLICY "Users can view own orders"
    ON orders FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create orders"
    ON orders FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- Order Items: Users can read items from their own orders
-- ==========================================
CREATE POLICY "Users can view own order items"
    ON order_items FOR SELECT
    USING (
        order_id IN (SELECT id FROM orders WHERE user_id = auth.uid())
    );

-- ==========================================
-- Reviews: Public read (approved), authenticated write
-- ==========================================
CREATE POLICY "Reviews are publicly readable"
    ON reviews FOR SELECT
    USING (is_approved = true);

CREATE POLICY "Users can create reviews"
    ON reviews FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews"
    ON reviews FOR UPDATE
    USING (auth.uid() = user_id);

-- ==========================================
-- Tracking Events: Users can view tracking for own orders
-- ==========================================
CREATE POLICY "Users can view own order tracking"
    ON tracking_events FOR SELECT
    USING (
        order_id IN (SELECT id FROM orders WHERE user_id = auth.uid())
    );

-- ==========================================
-- Promo Codes: Readonly for users (active only)
-- ==========================================
CREATE POLICY "Active promo codes are readable"
    ON promo_codes FOR SELECT
    USING (is_active = true);
