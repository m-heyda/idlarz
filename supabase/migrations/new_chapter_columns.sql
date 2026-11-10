-- new_chapter_columns (Linear IDL-68, the data for the "new chapter" release, see the plan in Linear IDL-253 / IDL-254).
-- Run ONCE, BEFORE deploying any code that reads these columns (SQL before code). Rehearse on a Supabase branch first.
-- Additive and idempotent: nullable columns, one new table, one unique index. Nothing here changes what the current code reads or writes,
-- so merging this migration alone changes nothing for players.
--
-- What it adds
--   profiles.epoch         which chapter this account's game belongs to; null = the old game (epoch 0). Read by the epoch gate (IDL-76).
--   profiles.avatar_id     the chosen avatar (a catalog id, validated by the server, IDL-71); null = none chosen yet.
--   profiles_character_name_ci   one reserved name per player, case-insensitive ("Bob" and "bob" collide).
--   player_achievements    one row per achievement earned (IDL-73); written only by the server, readable by its owner.
--   player_ledger.stats    lifetime counters from verified gains: kills per type, chests, tiles, resources (IDL-69). null = not counted yet.
--   player_ledger.legacy   room for the Idol levels that survive a rebirth (IDL-96). null = none.
--
-- Name collisions: the unique index fails when two accounts share a name ignoring case. The block below stops BEFORE changing anything and
-- lists the colliding names (counts only in the error; run the SELECT by hand to see them). Rule (owner, 2026-11-09): the oldest account keeps
-- the name, the later one gets a free forced rename on the new chapter screen. Resolve them before re-running, e.g. rename the later account.
--   select lower(character_name) as name, count(*) as accounts, min(created_at) as oldest from public.profiles
--   group by lower(character_name) having count(*) > 1;
--
-- Rollback (only if something goes wrong before the code that reads these ships; all of it is unused data until then):
--   drop index if exists public.profiles_character_name_ci;
--   alter table public.profiles drop column if exists epoch, drop column if exists avatar_id;
--   drop table if exists public.player_achievements;
--   alter table public.player_ledger drop column if exists stats, drop column if exists legacy;

do $$
declare
  v_dupes integer;
begin
  select count(*) into v_dupes from (
    select lower(character_name) from public.profiles group by lower(character_name) having count(*) > 1
  ) d;
  if v_dupes > 0 then
    raise exception 'new_chapter_columns: % character name(s) collide ignoring case; resolve them first (see the SELECT in the header of this file)', v_dupes;
  end if;
end $$;

alter table public.profiles add column if not exists epoch integer;       -- null = old game (epoch 0)
alter table public.profiles add column if not exists avatar_id text;
create unique index if not exists profiles_character_name_ci on public.profiles (lower(character_name));

create table if not exists public.player_achievements (
  user_id         uuid        not null references auth.users (id) on delete cascade,
  achievement_id  text        not null,
  earned_at       timestamptz not null default now(),
  primary key (user_id, achievement_id)                  -- an achievement is earned once; a retried request cannot pay it twice
);
alter table public.player_achievements enable row level security;
revoke all on table public.player_achievements from anon, authenticated, public;
grant select on public.player_achievements to authenticated;
create policy "player_achievements_select_own" on public.player_achievements for select to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.player_achievements to service_role;

alter table public.player_ledger add column if not exists stats jsonb;    -- lifetime counters (null = not counted yet)
alter table public.player_ledger add column if not exists legacy jsonb;   -- Idol levels that survive a rebirth (null = none)
