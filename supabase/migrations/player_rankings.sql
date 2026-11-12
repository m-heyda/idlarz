-- player_rankings: the Rankings window (Level, Rebirths, Crafting, Tiles), refreshed lazily once per 24 hours (no cron job).
-- player_stats.best_tiles: the most tiles a player ever owned (a rebirth resets the land, the record stays); kept by save_player_state.
-- player_rankings: one row per ranked (trusted) player: the board values, the rank on each board and the rank at the previous refresh (the up/down arrows).
-- ranking_meta: when the last refresh ran. refresh_rankings() does nothing inside 24 hours and is called by GET /api/rankings (service role only).
-- Additive and idempotent: new defaulted column, new tables, new function; the save format is untouched. Run before deploying the code.
-- Rollback: player_rankings_rollback.sql
alter table public.player_stats add column if not exists best_tiles integer not null default 0;
update public.player_stats s
   set best_tiles = greatest(s.tiles_owned, coalesce((select max(h.tiles) from public.rebirth_history h where h.user_id = s.user_id), 0))
 where s.best_tiles = 0;

create or replace function public.save_player_state(p_user uuid, p_base_rev integer, p_save jsonb, p_world jsonb, p_stats jsonb)
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
  rank_level           integer,
  rank_rebirths        integer,
  rank_crafting        integer,
  rank_tiles           integer,
  prev_rank_level      integer,                    -- the rank at the refresh before (null = new on the board)
  prev_rank_rebirths   integer,
  prev_rank_crafting   integer,
  prev_rank_tiles      integer,
  updated_at           timestamptz not null default now()
);
create index if not exists player_rankings_rank_level    on public.player_rankings (rank_level);
create index if not exists player_rankings_rank_rebirths on public.player_rankings (rank_rebirths);
create index if not exists player_rankings_rank_crafting on public.player_rankings (rank_crafting);
create index if not exists player_rankings_rank_tiles    on public.player_rankings (rank_tiles);

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
    prev_rank_level = rank_level, prev_rank_rebirths = rank_rebirths, prev_rank_crafting = rank_crafting, prev_rank_tiles = rank_tiles;

  insert into public.player_rankings (user_id, level, xp, level_maxed_at, rebirths, legacy_earned, craft_xp, craft_maxed_at, best_tiles, updated_at)
  select s.user_id, s.level, coalesce(p.xp, 0), case when s.level >= p_level_cap then now() end,
         s.rebirths, s.legacy_earned,
         least(coalesce((l.craft->>'xp')::numeric, 0), p_craft_max_xp),
         case when coalesce((l.craft->>'xp')::numeric, 0) >= p_craft_max_xp then now() end,
         greatest(s.best_tiles, s.tiles_owned), now()
    from public.player_stats s
    left join public.player_saves p on p.user_id = s.user_id
    left join public.player_ledger l on l.user_id = s.user_id
   where s.trusted
  on conflict (user_id) do update set
    level = excluded.level, xp = excluded.xp,
    level_maxed_at = case when excluded.level_maxed_at is null then null else coalesce(public.player_rankings.level_maxed_at, excluded.level_maxed_at) end,
    rebirths = excluded.rebirths, legacy_earned = excluded.legacy_earned, craft_xp = excluded.craft_xp,
    craft_maxed_at = case when excluded.craft_maxed_at is null then null else coalesce(public.player_rankings.craft_maxed_at, excluded.craft_maxed_at) end,
    best_tiles = excluded.best_tiles, updated_at = now();

  with r as (
    select user_id,
      rank() over (order by level desc, xp desc, level_maxed_at asc nulls last)  as rl,
      rank() over (order by rebirths desc, legacy_earned desc)                   as rr,
      rank() over (order by craft_xp desc, craft_maxed_at asc nulls last)        as rc,
      rank() over (order by best_tiles desc)                                     as rt
    from public.player_rankings
  )
  update public.player_rankings p set rank_level = r.rl, rank_rebirths = r.rr, rank_crafting = r.rc, rank_tiles = r.rt
    from r where p.user_id = r.user_id;

  insert into public.ranking_meta (id, refreshed_at) values (true, now())
  on conflict (id) do update set refreshed_at = excluded.refreshed_at;
  return true;
end;
$$;
revoke execute on function public.refresh_rankings(integer, numeric) from public, anon, authenticated;
grant execute on function public.refresh_rankings(integer, numeric) to service_role;
