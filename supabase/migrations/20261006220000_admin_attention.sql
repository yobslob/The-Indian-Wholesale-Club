-- =============================================================================
-- C8, alerting (B-8): server errors are already stored in admin_error_events (lib/logger.ts) and refused payments in
-- failed_reconciliations, both service-role only. admin_attention() gives Today the counts an admin should act on,
-- without opening those tables to anyone: errors in the last 24 hours, payments refunded or unmatched and not marked
-- resolved, customer emails stuck in the outbox. Admin only.
-- =============================================================================

create function public.admin_attention()
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'errors_24h', (select count(*) from public.admin_error_events where created_at > now() - interval '24 hours'),
    'payments_to_check', (select count(*) from public.failed_reconciliations where resolved_at is null),
    'emails_stuck', (select count(*) from public.email_outbox
                     where status = 'dead_letter' or (status = 'pending' and created_at < now() - interval '1 hour')));
end $$;

revoke all on function public.admin_attention() from public, anon, authenticated;
grant execute on function public.admin_attention() to authenticated, service_role;
