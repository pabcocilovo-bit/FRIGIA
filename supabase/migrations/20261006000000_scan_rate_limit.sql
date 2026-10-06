-- Persistent rate limit for /api/analyze (the old in-memory counter reset on every serverless instance).
-- Run once in Supabase: SQL Editor > New query > paste > Run.

create table if not exists public.scan_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  count integer not null default 0
);

-- No policies: only the server (service role) can read or write this table
alter table public.scan_rate_limits enable row level security;

-- Counts one scan and returns true while the user is under p_limit scans per window
create or replace function public.check_scan_rate_limit(p_user_id uuid, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into scan_rate_limits as r (user_id, window_start, count)
  values (p_user_id, now(), 1)
  on conflict (user_id) do update set
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end,
    count        = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.count + 1 end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.check_scan_rate_limit(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.check_scan_rate_limit(uuid, integer, integer) to service_role;
