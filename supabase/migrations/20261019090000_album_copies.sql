-- D-140, the photo fix: a photo gets fixed-size copies when it is stored, and moves into a c/ folder beside them
-- (regions/<slug>/album/c/<name>.jpg + <name>.w320.webp, .w640.webp, .w1280.webp; packages/shared media.ts). The album's
-- path rule allows that folder; everything else about it stays.
alter table public.region_photos drop constraint region_photos_storage_path_check;
alter table public.region_photos add constraint region_photos_storage_path_check
  check (storage_path ~ '^regions/[a-z0-9-]+/album/(c/)?[^/]+$');
