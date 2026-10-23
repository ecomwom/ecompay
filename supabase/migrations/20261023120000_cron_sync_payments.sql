-- Every 15 minutes, ask the app to re-sync open orders with Confío
-- (POST /api/cron/sync-payments). Safety net for webhooks that never arrive.
-- The bearer key lives in Supabase Vault as 'ecompay_cron_secret' (same value as the
-- app's CRON_SECRET); while it is missing the job does nothing.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.request_payments_sync()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'ecompay_cron_secret';

  if v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := 'https://ecompay.micomunidaddropi.com/api/cron/sync-payments',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 120000
  );
end;
$$;

revoke all on function public.request_payments_sync() from public, anon, authenticated;

select cron.schedule('ecompay-sync-payments', '*/15 * * * *', 'select public.request_payments_sync()');
