-- The shared rate limiter (migration 21, B-3): a limit per key and window, independent keys, service role only.
begin;
select tests.assert((public.rate_limit_hit('test:a', 2, 60) ->> 'allowed')::boolean, 'first hit allowed');
select tests.assert((public.rate_limit_hit('test:a', 2, 60) ->> 'allowed')::boolean, 'second hit allowed');
select tests.assert(
  (select (r ->> 'allowed')::boolean = false and (r ->> 'retry_after')::int between 1 and 60
   from public.rate_limit_hit('test:a', 2, 60) r),
  'the third is refused, with the seconds until the window resets');
select tests.assert((public.rate_limit_hit('test:b', 2, 60) ->> 'allowed')::boolean, 'another key has its own count');

set local role anon;
select tests.assert_fails($q$select public.rate_limit_hit('x', 1, 60)$q$, '42501', 'visitors cannot touch the counter');
reset role;
set local role authenticated;
select tests.assert_fails('select count(*) from public.rate_limit_hits', '42501', 'nor read it');
reset role;
rollback;
