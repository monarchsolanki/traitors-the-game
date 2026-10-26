-- Bot seats for solo testing (Step 2): a bot holds a seat with no phone and no PIN.
alter table public.seats add column is_bot boolean not null default false;
alter table public.seats
  add constraint seats_bot_has_no_session check (not is_bot or (user_id is null and pin_hash is null));
