-- Owner, 30 October: each Circle starts with private talks, a new phase between missions and the
-- debate. The games table only accepts known phases, so the list gains PRIVATE_TALKS.
alter table public.games drop constraint games_phase_check;

alter table public.games add constraint games_phase_check check (
  phase in (
    'LOBBY', 'ROLES', 'MISSION', 'PRIVATE_TALKS', 'CIRCLE_DEBATE', 'CIRCLE_VOTE', 'CIRCLE_REVEAL',
    'NIGHT', 'MURDER_REVEAL', 'ENDGAME_VOTE', 'ENDGAME_BANISH', 'FINALE'
  )
);
