-- Per-event usage log for time-series admin analytics.
-- Counter columns on `users` (quicksoap_count etc.) can't be sliced by day/week,
-- so we log one row per successful generation here. Buckets are computed in
-- America/Denver so "per day" matches local calendar days.
-- No historical backfill: PetQuery was never persisted, so all three event
-- types start accumulating from deploy.

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  auth0_user_id text not null,
  event_type text not null check (event_type in ('quicksoap', 'petsoap', 'petquery')),
  created_at timestamptz not null default now()
);

create index if not exists idx_usage_events_type_time on public.usage_events (event_type, created_at);
create index if not exists idx_usage_events_user on public.usage_events (auth0_user_id);
create index if not exists idx_usage_events_time on public.usage_events (created_at);

-- NOTE: RLS disabled to match the rest of the schema, which is accessed via the
-- anon key (Auth0 is the identity provider, not Supabase Auth — so per-user RLS
-- policies keyed on auth.uid() don't apply here yet). This table is written only
-- server-side. Revisit when/if the app migrates to Supabase Auth.
alter table public.usage_events disable row level security;

-- ── Time-series aggregation ────────────────────────────────────────────────
-- Returns one row per bucket in [p_start, p_end], with empty buckets filled as
-- zero via generate_series. Bucket boundaries are truncated in p_tz local time.
create or replace function public.admin_usage_timeseries(
  p_granularity text default 'day',
  p_start timestamptz default (now() - interval '30 days'),
  p_end timestamptz default now(),
  p_tz text default 'America/Denver'
)
returns table (
  bucket timestamptz,
  signups bigint,
  quicksoap bigint,
  petsoap bigint,
  petquery bigint
)
language plpgsql
stable
as $$
declare
  v_gran text := lower(coalesce(p_granularity, 'day'));
begin
  if v_gran not in ('day', 'week', 'month') then
    v_gran := 'day';
  end if;

  return query
  with buckets as (
    select generate_series(
      date_trunc(v_gran, (p_start at time zone p_tz)),
      date_trunc(v_gran, (p_end at time zone p_tz)),
      ('1 ' || v_gran)::interval
    ) as b_local
  ),
  signup_counts as (
    select date_trunc(v_gran, (created_at at time zone p_tz)) as b_local, count(*) as n
    from public.users
    where created_at >= p_start and created_at <= p_end
    group by 1
  ),
  event_counts as (
    select
      date_trunc(v_gran, (created_at at time zone p_tz)) as b_local,
      event_type,
      count(*) as n
    from public.usage_events
    where created_at >= p_start and created_at <= p_end
    group by 1, 2
  )
  select
    (b.b_local at time zone p_tz) as bucket,
    coalesce(max(s.n), 0)::bigint as signups,
    coalesce(sum(e.n) filter (where e.event_type = 'quicksoap'), 0)::bigint as quicksoap,
    coalesce(sum(e.n) filter (where e.event_type = 'petsoap'), 0)::bigint as petsoap,
    coalesce(sum(e.n) filter (where e.event_type = 'petquery'), 0)::bigint as petquery
  from buckets b
  left join signup_counts s on s.b_local = b.b_local
  left join event_counts e on e.b_local = b.b_local
  group by b.b_local
  order by b.b_local;
end;
$$;

-- ── Per-user usage (drill-down) ────────────────────────────────────────────
create or replace function public.admin_user_usage(p_auth0_user_id text)
returns table (event_type text, total bigint, last_30d bigint, last_7d bigint)
language sql
stable
as $$
  select
    event_type,
    count(*) as total,
    count(*) filter (where created_at >= now() - interval '30 days') as last_30d,
    count(*) filter (where created_at >= now() - interval '7 days') as last_7d
  from public.usage_events
  where auth0_user_id = p_auth0_user_id
  group by event_type;
$$;

-- ── All-users usage rollup (for the CRM table columns) ─────────────────────
create or replace function public.admin_usage_by_user()
returns table (auth0_user_id text, quicksoap bigint, petsoap bigint, petquery bigint)
language sql
stable
as $$
  select
    auth0_user_id,
    count(*) filter (where event_type = 'quicksoap') as quicksoap,
    count(*) filter (where event_type = 'petsoap') as petsoap,
    count(*) filter (where event_type = 'petquery') as petquery
  from public.usage_events
  group by auth0_user_id;
$$;
