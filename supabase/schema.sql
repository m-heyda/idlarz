-- Idlarz accounts and cloud saves: the schema as it stands on the Supabase project (applied as migrations create_profiles,
-- cloud_save_v2_split, harden_policies_and_rpc, test_account_marker, autosave_history_by_time, offline_ledger, combat_ledger). Run once in the SQL editor of a fresh project.
-- Design and rules: docs/reference/saves-and-server.md.

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
  derived          jsonb,                  -- castle upgrade + rates after it, Luck, away-time cap and efficiency (migration offline_ledger)
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
  best_tiles     integer     not null default 0,   -- the most tiles ever owned (migration player_rankings): a rebirth resets the land, the record stays
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

-- ---- player_ledger: the server's own record of a player (away-time anchor, spawn tickets, sealed-roll counters, gems) -----
-- One small row per player. Written ONLY by the server (service role, compare-and-swap on ver); a player may read their own gems and
-- nothing else. Design: docs/reference/saves-and-server.md.
create table public.player_ledger (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  ver           integer     not null,                 -- compare-and-swap counter
  run_id        integer     not null default 1,       -- bumped by a rebirth or a new game: sealed rolls never repeat across runs
  rebirths      integer     not null default 0,
  anchor_at     timestamptz not null,                 -- away time is counted from the later of this and the last accepted save
  bank          jsonb       not null,                 -- spawn timers and the chest and monster tickets (a few dozen numbers; a boss is a monster ticket of kind 'boss')
  ord_chest     integer     not null default 0,       -- chest and kill rewards rolled this run (the next one is sealed on this number)
  ord_kill      integer     not null default 0,
  granted       jsonb       not null,                 -- lifetime totals the server handed out: what a save may contain on top of its income
  granted_seen  jsonb       not null,                 -- the same, as of the last accepted save
  gems          integer     not null,                 -- THE gem balance: a save can never raise it
  last_key      text,                                 -- idempotency key of the last claim / redemption ...
  last_result   jsonb,                                -- ... and its answer, replayed when a response got lost
  combat        jsonb,                                -- HP and mana, cooldowns, the open fight, auto-battle switches, recent events (migration combat_ledger)
  inv           jsonb,                                -- the bag, the worn gear, the loot pity and the auto-sell filter: the server's (migration inventory_ledger)
  craft         jsonb,                                -- crafting: { xp, ord, stock, pity, spent, last }; null = never crafted (migration crafting_ledger)
  updated_at    timestamptz not null default now(),
  constraint ledger_ver_positive check (ver >= 1),
  constraint ledger_gems_range   check (gems >= 0 and gems <= 1000000000)
);

-- ---- rebirth_history: one row per rebirth (the Rebirths tab of the Character window; migration rebirth_history) ------------
-- Written ONLY by the server when an accepted save shows a higher rebirth count, from the last accepted save of the run that ended.
create table public.rebirth_history (
  id             bigint generated always as identity primary key,
  user_id        uuid        not null references auth.users (id) on delete cascade,
  rebirth_no     integer     not null,                 -- the rebirth count reached (1 = the first rebirth)
  at             timestamptz not null default now(),
  run_seconds    numeric     not null default 0,       -- play time of the run that ended
  play_seconds   numeric     not null default 0,       -- total play time at the rebirth
  tiles          integer     not null default 0,
  buildings      integer     not null default 0,
  castle_level   integer     not null default 1,
  level          integer     not null default 1,
  xp             numeric     not null default 0,
  gold           numeric     not null default 0,
  gold_per_sec   numeric     not null default 0,       -- the run's gold income when it ended (the "generation")
  click_level    integer     not null default 0,
  embers_gained  integer     not null default 0,
  legacy_earned  integer     not null default 0,       -- Embers ever earned, after this rebirth
  stats          jsonb       not null default '{}'::jsonb,
  unique (user_id, rebirth_no)                         -- a retried save never records one rebirth twice
);
create index rebirth_history_user on public.rebirth_history (user_id, rebirth_no desc);

-- ---- access ----------------------------------------------------------------------------------------------------------
alter table public.rebirth_history enable row level security;
revoke all on table public.rebirth_history from anon, authenticated, public;
grant select on public.rebirth_history to authenticated;
create policy "rebirth_history_select_own" on public.rebirth_history for select to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.rebirth_history to service_role;
grant usage, select on sequence public.rebirth_history_id_seq to service_role;

alter table public.player_saves  enable row level security;
alter table public.player_worlds enable row level security;
alter table public.player_stats  enable row level security;
alter table public.save_history  enable row level security;
alter table public.player_ledger enable row level security;

revoke all on table public.player_saves, public.player_worlds, public.player_stats, public.save_history, public.player_ledger from anon, authenticated, public;

-- owners read their own save (never write); the leaderboard is readable by everyone, trusted rows and listed columns only
grant select on public.player_saves to authenticated;
create policy "player_saves_select_own" on public.player_saves for select to authenticated using (user_id = (select auth.uid()));
grant select on public.player_worlds to authenticated;
create policy "player_worlds_select_own" on public.player_worlds for select to authenticated using (user_id = (select auth.uid()));
grant select (user_id, display_name, level, tiles_owned, castle_level, rebirths, legacy_earned, gold_per_min, play_seconds, updated_at)
  on public.player_stats to anon, authenticated;
create policy "player_stats_public_trusted" on public.player_stats for select to anon, authenticated using (trusted);

-- a player may read their own gem balance and nothing else of the ledger
grant select (user_id, gems) on public.player_ledger to authenticated;
create policy "player_ledger_select_own" on public.player_ledger for select to authenticated using (user_id = (select auth.uid()));

-- this project does not hand service_role table access by default: be explicit
grant select, insert, update, delete on public.player_saves, public.player_worlds, public.player_stats, public.save_history, public.player_ledger to service_role;
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
      legacy_points = r.legacy_points, legacy_earned = r.legacy_earned, xp_gain_pct = r.xp_gain_pct, rates = r.rates, derived = r.derived,
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

  insert into public.player_stats (user_id, display_name, level, tiles_owned, best_tiles, castle_level, rebirths, legacy_earned, gold_per_min, play_seconds, trusted, updated_at)
  values (p_user, p_stats->>'display_name', (p_stats->>'level')::integer, (p_stats->>'tiles_owned')::integer, (p_stats->>'tiles_owned')::integer,
          (p_stats->>'castle_level')::integer, (p_stats->>'rebirths')::integer, (p_stats->>'legacy_earned')::integer, (p_stats->>'gold_per_min')::numeric,
          (p_stats->>'play_seconds')::numeric, (p_stats->>'trusted')::boolean, now())
  on conflict (user_id) do update set
    display_name = excluded.display_name, level = excluded.level, tiles_owned = excluded.tiles_owned,
    best_tiles = greatest(public.player_stats.best_tiles, excluded.tiles_owned), castle_level = excluded.castle_level,
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

-- ---- season_reset (migration season_reset): per-player reset time and the global last reset --------------------------------
alter table public.player_ledger add column if not exists reset_at timestamptz;  -- when this player's game was last reset (null = never recorded)
create table if not exists public.app_settings (
  key text primary key, value jsonb not null, updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
revoke all on table public.app_settings from anon, authenticated, public;
grant select, insert, update, delete on public.app_settings to service_role;

-- ---- new_chapter_columns (migration new_chapter_columns, IDL-68): epoch, avatar, unique name, achievements, lifetime counters --------
do $$
declare
  v_dupes integer;
begin
  select count(*) into v_dupes from (
    select lower(character_name) from public.profiles group by lower(character_name) having count(*) > 1
  ) d;
  if v_dupes > 0 then
    raise exception 'new_chapter_columns: % character name(s) collide ignoring case; resolve them first', v_dupes;
  end if;
end $$;
alter table public.profiles add column if not exists epoch integer;       -- null = old game (epoch 0)
alter table public.profiles add column if not exists avatar_id text;
create unique index if not exists profiles_character_name_ci on public.profiles (lower(character_name));
create table if not exists public.player_achievements (
  user_id         uuid        not null references auth.users (id) on delete cascade,
  achievement_id  text        not null,
  earned_at       timestamptz not null default now(),
  primary key (user_id, achievement_id)
);
alter table public.player_achievements enable row level security;
revoke all on table public.player_achievements from anon, authenticated, public;
grant select on public.player_achievements to authenticated;
create policy "player_achievements_select_own" on public.player_achievements for select to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.player_achievements to service_role;
alter table public.player_ledger add column if not exists stats jsonb;    -- lifetime counters (null = not counted yet); stats.seen (monster type -> first fight, epoch ms) and stats.kills (type -> count) are the bestiary data
alter table public.player_ledger add column if not exists legacy jsonb;   -- Idol levels that survive a rebirth (null = none)

-- ---- profiles_server_columns (migration profiles_server_columns, IDL-76): epoch and avatar_id are written by the server only --------------------
revoke insert, update on table public.profiles from authenticated;
grant insert (id, character_name, player_class) on public.profiles to authenticated;
grant update (id, character_name, player_class) on public.profiles to authenticated;

-- ---- profile_badge_title (migration profile_badge_title): the badge and title a player shows; server-written only (not in the authenticated grants above) ----
alter table public.profiles add column if not exists badge_id text;   -- null = default, 'none' = hidden, else an earned achievement id
alter table public.profiles add column if not exists title_id text;   -- null = no title, else an earned achievement's title id

-- ---- profile_name_color (migration profile_name_color): the nickname colour and the admin flag; server-written only (not in the authenticated grants above) ----
alter table public.profiles add column if not exists name_color text;                      -- null = default, else a colour id of config/nickColors.ts, or 'gold' (admin only)
alter table public.profiles add column if not exists is_admin boolean not null default false; -- the owner's account: free name colours and the gold nickname; set by hand, never by the game

-- ---- player_rankings (migration player_rankings): the Rankings window, refreshed lazily once per 24 h by GET /api/rankings; service role only ----
create table if not exists public.player_rankings (
  user_id              uuid primary key references public.player_stats (user_id) on delete cascade,
  level                integer     not null default 1,
  xp                   numeric     not null default 0,
  level_maxed_at       timestamptz,                -- first refresh that saw the level cap (ties at the cap go to the earliest)
  rebirths             integer     not null default 0,
  legacy_earned        integer     not null default 0,
  craft_xp             numeric     not null default 0,  -- crafting XP, capped at the XP of the maximum crafting level
  craft_maxed_at       timestamptz,                -- first refresh that saw the maximum crafting level
  best_tiles           integer     not null default 0,
  kills                bigint      not null default 0,   -- every monster killed: the sum of player_ledger.stats.kills (migration player_rankings_kills)
  rank_level           integer,
  rank_rebirths        integer,
  rank_crafting        integer,
  rank_tiles           integer,
  rank_kills           integer,
  prev_rank_level      integer,                    -- the rank at the refresh before (null = new on the board)
  prev_rank_rebirths   integer,
  prev_rank_crafting   integer,
  prev_rank_tiles      integer,
  prev_rank_kills      integer,
  updated_at           timestamptz not null default now()
);
create index if not exists player_rankings_rank_level    on public.player_rankings (rank_level);
create index if not exists player_rankings_rank_rebirths on public.player_rankings (rank_rebirths);
create index if not exists player_rankings_rank_crafting on public.player_rankings (rank_crafting);
create index if not exists player_rankings_rank_tiles    on public.player_rankings (rank_tiles);
create index if not exists player_rankings_rank_kills    on public.player_rankings (rank_kills);

create table if not exists public.ranking_meta (
  id            boolean primary key default true check (id),   -- one row
  refreshed_at  timestamptz not null
);

alter table public.player_rankings enable row level security;
alter table public.ranking_meta enable row level security;
revoke all on table public.player_rankings, public.ranking_meta from anon, authenticated, public;
grant select, insert, update, delete on public.player_rankings, public.ranking_meta to service_role;

-- p_level_cap: the maximum character level; p_craft_max_xp: the crafting XP of the maximum crafting level (both from the game's config)
create or replace function public.refresh_rankings(p_level_cap integer, p_craft_max_xp numeric)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_last timestamptz;
begin
  if not pg_try_advisory_xact_lock(7340211) then
    return false;   -- another request is refreshing right now
  end if;
  select refreshed_at into v_last from public.ranking_meta where id;
  if v_last is not null and v_last > now() - interval '24 hours' then
    return false;
  end if;

  delete from public.player_rankings r
   where not exists (select 1 from public.player_stats s where s.user_id = r.user_id and s.trusted);

  update public.player_rankings set
    prev_rank_level = rank_level, prev_rank_rebirths = rank_rebirths, prev_rank_crafting = rank_crafting, prev_rank_tiles = rank_tiles,
    prev_rank_kills = rank_kills;

  insert into public.player_rankings (user_id, level, xp, level_maxed_at, rebirths, legacy_earned, craft_xp, craft_maxed_at, best_tiles, kills, updated_at)
  select s.user_id, s.level, coalesce(p.xp, 0), case when s.level >= p_level_cap then now() end,
         s.rebirths, s.legacy_earned,
         least(coalesce((l.craft->>'xp')::numeric, 0), p_craft_max_xp),
         case when coalesce((l.craft->>'xp')::numeric, 0) >= p_craft_max_xp then now() end,
         greatest(s.best_tiles, s.tiles_owned),
         -- every monster killed: the ledger counts them per monster type, so the board adds the types up
         coalesce((select sum(e.value::numeric) from jsonb_each_text(case when jsonb_typeof(l.stats->'kills') = 'object' then l.stats->'kills' else '{}'::jsonb end) e
                    where e.value ~ '^[0-9]+$'), 0)::bigint,
         now()
    from public.player_stats s
    left join public.player_saves p on p.user_id = s.user_id
    left join public.player_ledger l on l.user_id = s.user_id
   where s.trusted
  on conflict (user_id) do update set
    level = excluded.level, xp = excluded.xp,
    level_maxed_at = case when excluded.level_maxed_at is null then null else coalesce(public.player_rankings.level_maxed_at, excluded.level_maxed_at) end,
    rebirths = excluded.rebirths, legacy_earned = excluded.legacy_earned, craft_xp = excluded.craft_xp,
    craft_maxed_at = case when excluded.craft_maxed_at is null then null else coalesce(public.player_rankings.craft_maxed_at, excluded.craft_maxed_at) end,
    best_tiles = excluded.best_tiles, kills = excluded.kills, updated_at = now();

  with r as (
    select user_id,
      rank() over (order by level desc, xp desc, level_maxed_at asc nulls last)  as rl,
      rank() over (order by rebirths desc, legacy_earned desc)                   as rr,
      rank() over (order by craft_xp desc, craft_maxed_at asc nulls last)        as rc,
      rank() over (order by best_tiles desc)                                     as rt,
      rank() over (order by kills desc)                                          as rk
    from public.player_rankings
  )
  update public.player_rankings p set rank_level = r.rl, rank_rebirths = r.rr, rank_crafting = r.rc, rank_tiles = r.rt, rank_kills = r.rk
    from r where p.user_id = r.user_id;

  insert into public.ranking_meta (id, refreshed_at) values (true, now())
  on conflict (id) do update set refreshed_at = excluded.refreshed_at;
  return true;
end;
$$;
revoke execute on function public.refresh_rankings(integer, numeric) from public, anon, authenticated;
grant execute on function public.refresh_rankings(integer, numeric) to service_role;
