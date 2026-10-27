-- Step 5 (27 October): Live reactions for ghosts, and presets that keep the mission catalogue.

-- Live reactions: emoji that float across the big screen during the debate (section 8). A row holds
-- only the room code, the emoji and the time: no player, nothing secret. Written only by the server
-- (after it checks the sender is a ghost), readable by everyone, and sent over Realtime like the pings.
create table public.game_reactions (
  id bigint generated always as identity primary key,
  code text not null references public.games (code) on delete cascade on update cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now()
);

create index game_reactions_code_time on public.game_reactions (code, created_at desc);

alter table public.game_reactions enable row level security;
revoke all on table public.game_reactions from anon, authenticated;
grant select on table public.game_reactions to anon, authenticated;

create policy "Anyone can read reactions"
  on public.game_reactions for select
  to anon, authenticated
  using (true);

alter publication supabase_realtime add table public.game_reactions;

-- Presets: saved settings, roster (names and copied photos) and now the mission catalogue.
alter table public.presets add column missions jsonb not null default '[]'::jsonb;
