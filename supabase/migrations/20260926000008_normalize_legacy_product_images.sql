-- Keep databases created from older seeds from breaking next/image.
-- The current seed uses picsum.photos, but older rows may still contain
-- placeholder-service URLs.
UPDATE product_images
SET url = 'https://picsum.photos/seed/legacy-product-' || id::text || '/600/800'
WHERE url LIKE 'https://placehold.co/%'
   OR url LIKE 'https://via.placeholder.com/%';
