-- Migration: Storage Buckets and Policies
-- Source: docs/02-database-schema-and-rls.md Section 4

-- ==========================================
-- Create storage buckets
-- ==========================================

-- Product images: publicly readable
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- User avatars: private, user-scoped
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-avatars', 'user-avatars', false)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- RLS for product-images bucket
-- ==========================================

-- Anyone can view product images
CREATE POLICY "Public read access to product images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'product-images');

-- Only admins can upload product images
CREATE POLICY "Admin write access to product images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'product-images' AND auth.jwt() ->> 'role' = 'admin');

-- Only admins can update product images
CREATE POLICY "Admin update access to product images"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'product-images' AND auth.jwt() ->> 'role' = 'admin');

-- Only admins can delete product images
CREATE POLICY "Admin delete access to product images"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'product-images' AND auth.jwt() ->> 'role' = 'admin');

-- ==========================================
-- RLS for user-avatars bucket
-- ==========================================

-- Users can read their own avatar (folder = user_id)
CREATE POLICY "Users can read own avatar"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'user-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can upload their own avatar
CREATE POLICY "Users can upload own avatar"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'user-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can update their own avatar
CREATE POLICY "Users can update own avatar"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'user-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete their own avatar
CREATE POLICY "Users can delete own avatar"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'user-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
