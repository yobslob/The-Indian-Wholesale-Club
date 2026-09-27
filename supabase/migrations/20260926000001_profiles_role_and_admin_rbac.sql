-- =============================================================
-- Migration: profiles.role + admin RBAC helpers (BUGS C1 / M6)
-- =============================================================

-- 1. Application-level role on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'customer';

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('customer', 'staff', 'admin'));

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles (role);

-- 2. is_admin() helper (SECURITY DEFINER so RLS-protected callers can use it)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

-- 3. Bootstrap an admin (edit the email before running):
--    UPDATE profiles SET role = 'admin' WHERE email = 'you@example.com';

-- 4. Storage policies: auth.jwt()->> 'role' is Supabase's connection role
--    ('authenticated'), never 'admin', so those policies could never match.
DROP POLICY IF EXISTS "Admin write access to product images" ON storage.objects;
DROP POLICY IF EXISTS "Admin update access to product images" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete access to product images" ON storage.objects;

CREATE POLICY "Admin write access to product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

CREATE POLICY "Admin update access to product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images' AND public.is_admin())
WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

CREATE POLICY "Admin delete access to product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images' AND public.is_admin());

-- 5. Customers still manage their own avatars (policies unchanged from
--    20260924000004_create_storage.sql - owner check on name = auth.uid()).
