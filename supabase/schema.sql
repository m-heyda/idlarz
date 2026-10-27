-- Idlarz accounts and cloud saves: the schema as it stands on the Supabase project (applied as migrations create_profiles,
-- cloud_save_v2_split, harden_policies_and_rpc, test_account_marker, autosave_history_by_time). Run once in the SQL editor of a fresh project.
-- Design and rules: docs/09-cloud-saves.md.

-- ---- profiles: character name and hero, owner-only ------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  character_name text not null,
  player_class text not null,
  created_at timestamptz not null default now(),
  constraint character_name_len check (char_length(character_name) between 1 and 9),
  constraint player_class_known check (player_class in ('warrior', 'paladin', 'ranger', 'mage'))
);
alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated, public;
grant select, insert, update on table public.profiles to authenticated;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = (select auth.uid()));

-- ---- player_saves: HOT, small, written on every accepted save --------------------------------------------------------
create table public.player_saves (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  rev              integer     not null,
  schema           smallint    not null,
  server_saved_at  timestamptz not null,
  created_at       timestamptz not null,
  core             jsonb       not null,   -- everything but the map (bag, gear, upgrades, monsters, timers...), ~1 KB
  world_hash       text        not null,   -- hash of the map in player_worlds
  -- derived by the server from the save, never taken from the client
  play_seconds     numeric     not null,
  level            integer     not null,
  xp               numeric     not null,
  gold             numeric     not null,
  gems             integer     not null,
  click_level      integer     not null,
  castle_level     integer     not null,
  tiles_owned      integer     not null,
  buildings_owned  integer     not null,
  rebirths         integer     not null,
  legacy_points    integer     not null,
  legacy_earned    integer     not null,
  xp_gain_pct      numeric     not null,
  rates            jsonb       not null,   -- per second, every resource
  gold_per_min     numeric     not null,
  -- verification
  flags            text[]      not null default '{}',
  audit_ratio      numeric     not null,   -- spending check: required / allowed (over 1 is flagged)
  fresh_start      boolean     not null,   -- the first save of the account was a young game: ranking-eligible
  ever_flagged     boolean     not null default false,
  test_account     boolean     not null default false, -- saved through a non-production server: never ranked, flags never count
  last_archive_at  timestamptz not null default now(),  -- when save_history last got a full copy (a new one is due 30 min later)
  constraint rev_positive check (rev >= 1)
);

-- ---- player_worlds: COLD, large; rewritten only when the map changes -------------------------------------------------
create table public.player_worlds (
  user_id     uuid primary key references public.player_saves (user_id) on delete cascade,
  hash        text        not null,
  land        jsonb       not null,
  extra       jsonb       not null,
  tiles       integer     not null,
  updated_at  timestamptz not null default now()
);

-- ---- player_stats: LEADERBOARD, narrow and public, trusted rows only, never game state -------------------------------
create table public.player_stats (
  user_id        uuid primary key references public.player_saves (user_id) on delete cascade,
  display_name   text        not null,
  level          integer     not null,
  tiles_owned    integer     not null,
  castle_level   integer     not null,
  rebirths       integer     not null,
  legacy_earned  integer     not null,
  gold_per_min   numeric     not null,
  play_seconds   numeric     not null,
  trusted        boolean     not null default false,
  updated_at     timestamptz not null default now()
);
create index player_stats_level    on public.player_stats (level desc, play_seconds asc)      where trusted;
create index player_stats_tiles    on public.player_stats (tiles_owned desc)                  where trusted;
create index player_stats_income   on public.player_stats (gold_per_min desc)                 where trusted;
create index player_stats_rebirths on public.player_stats (rebirths desc, legacy_earned desc) where trusted;

-- ---- save_history: sparse full copies for rollback (first save, one per 30 min, new flags; pinned when a game is replaced) -
create table public.save_history (
  id               bigint generated always as identity primary key,
  user_id          uuid        not null references auth.users (id) on delete cascade,
  rev              integer     not null,
  schema           smallint    not null,
  state            jsonb       not null,
  flags            text[]      not null default '{}',
  server_saved_at  timestamptz not null default now(),
  pinned           boolean     not null default false
);
create index save_history_user_rev    on public.save_history (user_id, rev desc);
create index save_history_user_pinned on public.save_history (user_id, rev desc) where pinned;
comment on table public.save_history is 'Deliberately no policies: only the service role reads or writes it.';

-- ---- access ----------------------------------------------------------------------------------------------------------
alter table public.player_saves  enable row level security;
alter table public.player_worlds enable row level security;
alter table public.player_stats  enable row level security;
alter table public.save_history  enable row level security;

revoke all on table public.player_saves, public.player_worlds, public.player_stats, public.save_history from anon, authenticated, public;

-- owners read their own save (never write); the leaderboard is readable by everyone, trusted rows and listed columns only
grant select on public.player_saves to authenticated;
create policy "player_saves_select_own" on public.player_saves for select to authenticated using (user_id = (select auth.uid()));
grant select on public.player_worlds to authenticated;
create policy "player_worlds_select_own" on public.player_worlds for select to authenticated using (user_id = (select auth.uid()));
grant select (user_id, display_name, level, tiles_owned, castle_level, rebirths, legacy_earned, gold_per_min, play_seconds, updated_at)
  on public.player_stats to anon, authenticated;
create policy "player_stats_public_trusted" on public.player_stats for select to anon, authenticated using (trusted);

-- this project does not hand service_role table access by default: be explicit
grant select, insert, update, delete on public.player_saves, public.player_worlds, public.player_stats, public.save_history to service_role;
grant usage, select on sequence public.save_history_id_seq to service_role;

-- ---- the only write path: one atomic call (compare-and-swap on rev, map upsert, leaderboard row) --------------------------
create function public.save_player_state(p_user uuid, p_base_rev integer, p_save jsonb, p_world jsonb, p_stats jsonb)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_rows integer;
begin
  if p_base_rev = 0 then
    insert into public.player_saves
    select * from jsonb_populate_record(null::public.player_saves, p_save || jsonb_build_object('user_id', p_user))
    on conflict (user_id) do nothing;
    get diagnostics v_rows = row_count;
  else
    update public.player_saves t set
      rev = r.rev, schema = r.schema, server_saved_at = r.server_saved_at, core = r.core, world_hash = r.world_hash,
      play_seconds = r.play_seconds, level = r.level, xp = r.xp, gold = r.gold, gems = r.gems, click_level = r.click_level,
      castle_level = r.castle_level, tiles_owned = r.tiles_owned, buildings_owned = r.buildings_owned, rebirths = r.rebirths,
      legacy_points = r.legacy_points, legacy_earned = r.legacy_earned, xp_gain_pct = r.xp_gain_pct, rates = r.rates,
      gold_per_min = r.gold_per_min, flags = r.flags, audit_ratio = r.audit_ratio, ever_flagged = r.ever_flagged,
      test_account = r.test_account, last_archive_at = coalesce(r.last_archive_at, t.last_archive_at)
    from jsonb_populate_record(null::public.player_saves, p_save) r
    where t.user_id = p_user and t.rev = p_base_rev;
    get diagnostics v_rows = row_count;
  end if;
  if v_rows = 0 then
    return false;
  end if;

  if p_world is not null then
    insert into public.player_worlds (user_id, hash, land, extra, tiles, updated_at)
    values (p_user, p_world->>'hash', p_world->'land', p_world->'extra', (p_world->>'tiles')::integer, now())
    on conflict (user_id) do update
      set hash = excluded.hash, land = excluded.land, extra = excluded.extra, tiles = excluded.tiles, updated_at = now();
  end if;

  insert into public.player_stats (user_id, display_name, level, tiles_owned, castle_level, rebirths, legacy_earned, gold_per_min, play_seconds, trusted, updated_at)
  values (p_user, p_stats->>'display_name', (p_stats->>'level')::integer, (p_stats->>'tiles_owned')::integer, (p_stats->>'castle_level')::integer,
          (p_stats->>'rebirths')::integer, (p_stats->>'legacy_earned')::integer, (p_stats->>'gold_per_min')::numeric,
          (p_stats->>'play_seconds')::numeric, (p_stats->>'trusted')::boolean, now())
  on conflict (user_id) do update set
    display_name = excluded.display_name, level = excluded.level, tiles_owned = excluded.tiles_owned, castle_level = excluded.castle_level,
    rebirths = excluded.rebirths, legacy_earned = excluded.legacy_earned, gold_per_min = excluded.gold_per_min,
    play_seconds = excluded.play_seconds, trusted = excluded.trusted, updated_at = now();

  return true;
end;
$$;
revoke execute on function public.save_player_state(uuid, integer, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_player_state(uuid, integer, jsonb, jsonb, jsonb) to service_role;

-- Supabase projects ship a helper that PostgREST exposes to anyone; event triggers do not need callers to hold EXECUTE
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
  end if;
end $$;
