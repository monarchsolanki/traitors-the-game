-- Traitors: The Game: initial schema (Step 1, 26 October 2026). See PROJECT_CONTEXT.md section 9.7.
--
-- Privacy model (section 9.4): clients never read game tables. Every read goes through a server
-- route that calls viewFor(state, viewer); the server uses the secret key. The only table a browser
-- may read is game_pings (room code + version), which realtime uses to say "something changed,
-- refetch your view".

-- ---------------------------------------------------------------------------
-- Hosts: who may create games. Players are anonymous Supabase Auth users; the host signs in
-- with email and password, and must be listed here.

create table public.hosts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Games: the whole engine state as JSON, saved only through apply_game_action (version-checked).

create table public.games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{4,8}$'),
  host_user_id uuid not null references auth.users (id) on delete restrict,
  version bigint not null default 0 check (version >= 0),
  phase text not null check (
    phase in (
      'LOBBY', 'ROLES', 'MISSION', 'CIRCLE_DEBATE', 'CIRCLE_VOTE', 'CIRCLE_REVEAL',
      'NIGHT', 'MURDER_REVEAL', 'ENDGAME_VOTE', 'ENDGAME_BANISH', 'FINALE'
    )
  ),
  day integer not null default 0 check (day >= 0),
  status text not null default 'active' check (status in ('active', 'finished', 'closed')),
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint games_state_matches_version check ((state ->> 'version')::bigint = version),
  constraint games_state_matches_code check (state ->> 'code' = code),
  constraint games_state_matches_phase check (state ->> 'phase' = phase)
);

create index games_host_idx on public.games (host_user_id, created_at desc);

create function public.games_version_only_increases()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.version <= old.version then
    raise exception 'stale write: version % is not after %', new.version, old.version
      using errcode = '40001';
  end if;
  new.updated_at := now();
  return new;
end
$$;

create trigger games_version_only_increases
before update on public.games
for each row execute function public.games_version_only_increases();

-- ---------------------------------------------------------------------------
-- Seats: which phone (anonymous auth user) holds which player, and the hashed PIN. Server only.

create table public.seats (
  game_id uuid not null references public.games (id) on delete cascade,
  player_id text not null check (player_id ~ '^p[0-9]+$'),
  user_id uuid references auth.users (id) on delete set null,
  pin_hash text check (pin_hash is null or char_length(pin_hash) between 20 and 300),
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked boolean not null default false,
  last_seen timestamptz,
  primary key (game_id, player_id)
);

-- One seat per phone per game.
create unique index seats_one_per_session on public.seats (game_id, user_id) where user_id is not null;

-- ---------------------------------------------------------------------------
-- Game actions: the append-only ledger. Gives idempotency (one row per key), a full audit trail,
-- and a snapshot after every action for host undo and recovery.

create table public.game_actions (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games (id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 100),
  actor jsonb not null,
  action jsonb not null,
  version_before bigint not null,
  version_after bigint not null,
  state_after jsonb not null,
  created_at timestamptz not null default now(),
  constraint game_actions_one_step check (version_after = version_before + 1),
  constraint game_actions_unique_key unique (game_id, idempotency_key),
  constraint game_actions_unique_version unique (game_id, version_after)
);

-- ---------------------------------------------------------------------------
-- Pings: the only thing realtime sends. Public by design: a room code and a number.

create table public.game_pings (
  code text primary key references public.games (code) on delete cascade on update cascade,
  version bigint not null check (version >= 0),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Presets: saved settings and rosters for reuse (tier 2).

create table public.presets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  settings jsonb not null,
  roster jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint presets_unique_name unique (owner_user_id, name)
);

-- ---------------------------------------------------------------------------
-- Writes (section 9.3). Each runs in one transaction.

create function public.create_game(p_code text, p_host uuid, p_state jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.games (code, host_user_id, version, phase, day, status, state)
  values (
    p_code,
    p_host,
    (p_state ->> 'version')::bigint,
    p_state ->> 'phase',
    (p_state ->> 'day')::integer,
    'active',
    p_state
  )
  returning id into v_id;
  insert into public.game_pings (code, version) values (p_code, (p_state ->> 'version')::bigint);
  return v_id;
end
$$;

-- Saves the engine's next state only if nobody else saved first (optimistic version check), and
-- only once per idempotency key. Returns {result: applied | duplicate | stale, version}.
create function public.apply_game_action(
  p_game_id uuid,
  p_expected_version bigint,
  p_idempotency_key text,
  p_actor jsonb,
  p_action jsonb,
  p_state jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_existing_version bigint;
  v_new_version bigint := (p_state ->> 'version')::bigint;
  v_rows integer;
  v_status text;
begin
  select version_after into v_existing_version
    from public.game_actions
   where game_id = p_game_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('result', 'duplicate', 'version', v_existing_version);
  end if;

  if v_new_version is distinct from p_expected_version + 1 then
    raise exception 'the new state must be exactly one version after the expected one'
      using errcode = '22023';
  end if;

  v_status := case
    when p_state ->> 'phase' <> 'FINALE' then 'active'
    when coalesce((p_state ->> 'closed')::boolean, false) then 'closed'
    else 'finished'
  end;

  update public.games
     set state = p_state,
         version = v_new_version,
         phase = p_state ->> 'phase',
         day = (p_state ->> 'day')::integer,
         status = v_status
   where id = p_game_id
     and version = p_expected_version;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    return jsonb_build_object(
      'result', 'stale',
      'version', (select g.version from public.games g where g.id = p_game_id)
    );
  end if;

  insert into public.game_actions (game_id, idempotency_key, actor, action, version_before, version_after, state_after)
  values (p_game_id, p_idempotency_key, p_actor, p_action, p_expected_version, v_new_version, p_state);

  update public.game_pings
     set version = v_new_version, updated_at = now()
   where code = p_state ->> 'code';

  return jsonb_build_object('result', 'applied', 'version', v_new_version);
end
$$;

-- ---------------------------------------------------------------------------
-- Access rules. Row Level Security is on everywhere; only game_pings has a read policy.
-- The server's secret key (service_role) bypasses RLS; browsers get nothing else.

alter table public.hosts enable row level security;
alter table public.games enable row level security;
alter table public.seats enable row level security;
alter table public.game_actions enable row level security;
alter table public.game_pings enable row level security;
alter table public.presets enable row level security;

revoke all on table public.hosts, public.games, public.seats, public.game_actions, public.presets
  from anon, authenticated;
revoke all on table public.game_pings from anon, authenticated;
grant select on table public.game_pings to anon, authenticated;

create policy "Anyone can read game version pings"
  on public.game_pings for select
  to anon, authenticated
  using (true);

revoke execute on function public.create_game(text, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.apply_game_action(uuid, bigint, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.games_version_only_increases() from public, anon, authenticated;
grant execute on function public.create_game(text, uuid, jsonb) to service_role;
grant execute on function public.apply_game_action(uuid, bigint, text, jsonb, jsonb, jsonb) to service_role;

-- Realtime: clients subscribe to version pings for their room and refetch their own view.
alter publication supabase_realtime add table public.game_pings;

-- ---------------------------------------------------------------------------
-- Player photos: a private bucket. No storage policies, so only the server can read or write;
-- screens get short-lived signed links.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'player-photos',
  'player-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;
