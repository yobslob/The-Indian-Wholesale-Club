-- INV-8 for region text (D-019, coding plan C2): drafted greetings, taglines and stories reach no store_* output
-- until approved; changing approved text sends it back to draft (migration 20261001150000).
begin;
select tests.setup();

update public.regions set greeting_latin = 'Test latin', greeting_meaning = 'Test meaning',
  tagline = 'Draft tagline here', story = 'Draft story here', content_status = 'draft'
where id = tests.id('region');

set local role anon;
select tests.assert(
  (select greeting_native is null and greeting_script is null and greeting_latin is null and greeting_meaning is null
          and tagline is null and story is null
   from public.store_regions where id = tests.id('region')),
  'INV-8: every draft text field is hidden in store_regions');
select tests.assert(
  position('Draft tagline here' in public.store_region_page('test-region')::text) = 0
  and position('Draft story here' in public.store_region_page('test-region')::text) = 0
  and position('Test greeting' in public.store_region_page('test-region')::text) = 0,
  'INV-8: draft text is nowhere in store_region_page');
select tests.assert(
  position('Test greeting' in public.store_home()::text) = 0 and position('Draft tagline here' in public.store_home()::text) = 0,
  'INV-8: draft text is nowhere in store_home');
reset role;

update public.regions set content_status = 'approved' where id = tests.id('region');
set local role anon;
select tests.assert(
  (public.store_region_page('test-region') -> 'region' ->> 'tagline') = 'Draft tagline here'
  and (public.store_region_page('test-region') -> 'region' ->> 'story') = 'Draft story here',
  'approved text shows on the region page');
reset role;

-- Approved text changed → draft again; a photo or accent change keeps it approved.
update public.regions set accent_color = '#7A2E23', hero_image_path = 'regions/test-region/x.jpg' where id = tests.id('region');
select tests.assert((select content_status from public.regions where id = tests.id('region')) = 'approved',
  'a photo or accent change leaves approved text approved');
update public.regions set tagline = 'Edited tagline' where id = tests.id('region');
select tests.assert((select content_status from public.regions where id = tests.id('region')) = 'draft',
  'D-019: editing approved text sends it back to draft');
set local role anon;
select tests.assert(position('Edited tagline' in public.store_region_page('test-region')::text) = 0,
  'INV-8: the edited text stays hidden until approved again');
reset role;

rollback;
