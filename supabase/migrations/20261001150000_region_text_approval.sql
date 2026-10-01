-- =============================================================================
-- D-019 in the database: changing a region's customer-facing text sends it back to draft, whoever edits it. The
-- admin's save already did this; now an edit through any other path can't publish unapproved text either (INV-8).
-- Approving (content_status only) and non-text changes (photo, accent, is_live) leave the status alone.
-- =============================================================================

create function public._region_text_needs_approval() returns trigger
language plpgsql as $$
begin
  if old.content_status = 'approved' and new.content_status = 'approved'
     and (new.greeting_native, new.greeting_script, new.greeting_latin, new.greeting_meaning, new.tagline, new.story)
         is distinct from
         (old.greeting_native, old.greeting_script, old.greeting_latin, old.greeting_meaning, old.tagline, old.story) then
    new.content_status := 'draft';
  end if;
  return new;
end $$;

create trigger regions_text_needs_approval
  before update on public.regions
  for each row execute function public._region_text_needs_approval();

revoke all on function public._region_text_needs_approval() from public, anon, authenticated;
