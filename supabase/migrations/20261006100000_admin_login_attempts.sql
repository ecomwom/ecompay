-- Admin login attempts, used for per-client rate limiting of /admin/login.
-- ip_hash is an HMAC-SHA256 of the client IP keyed with SESSION_SECRET: raw IPs are never stored.
create table public.admin_login_attempts (
  id bigserial primary key,
  ip_hash text not null,
  succeeded boolean not null,
  attempted_at timestamptz not null default now()
);

create index admin_login_attempts_ip_hash_attempted_at_idx
  on public.admin_login_attempts (ip_hash, attempted_at);

-- Server-side only (service_role): RLS on with no policies, no access for API roles.
alter table public.admin_login_attempts enable row level security;

revoke all on table public.admin_login_attempts from anon, authenticated;
revoke all on sequence public.admin_login_attempts_id_seq from anon, authenticated;

grant select, insert, delete on table public.admin_login_attempts to service_role;
grant usage on sequence public.admin_login_attempts_id_seq to service_role;
