-- Private phone lookup and persistent rate limiting for tournament sign-in.
create table if not exists public.phone_logins (
  phone text primary key check (phone ~ '^[0-9]{10}$'),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  player_id text not null
);
alter table public.phone_logins enable row level security;
revoke all on public.phone_logins from anon, authenticated;

create table if not exists public.phone_login_limits (
  bucket text primary key,
  attempts integer not null default 0,
  window_start timestamptz not null default now()
);
alter table public.phone_login_limits enable row level security;
revoke all on public.phone_login_limits from anon, authenticated;

create or replace function public.check_phone_login_limit(p_bucket text)
returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into public.phone_login_limits(bucket, attempts, window_start)
  values (p_bucket, 1, now())
  on conflict (bucket) do update
  set attempts = case when phone_login_limits.window_start < now() - interval '15 minutes'
    then 1 else phone_login_limits.attempts + 1 end,
      window_start = case when phone_login_limits.window_start < now() - interval '15 minutes'
    then now() else phone_login_limits.window_start end
  returning attempts into n;
  return n <= 5;
end;
$$;
revoke all on function public.check_phone_login_limit(text) from public, anon, authenticated;
grant execute on function public.check_phone_login_limit(text) to service_role;
