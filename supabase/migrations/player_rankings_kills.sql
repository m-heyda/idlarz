-- player_rankings_kills: the Kills board of the Rankings = every monster a player ever killed (the sum of player_ledger.stats.kills, which counts per monster type).
-- Additive and idempotent: new defaulted column and two nullable rank columns on player_rankings, and refresh_rankings() replaced by a version that also fills them.
-- Run after player_rankings.sql. Clearing ranking_meta makes the next GET /api/rankings rebuild the places at once, so the new board is not empty until tomorrow.
-- Rollback: player_rankings_kills_rollback.sql
alter table public.player_rankings add column if not exists kills bigint not null default 0;
alter table public.player_rankings add column if not exists rank_kills integer;
alter table public.player_rankings add column if not exists prev_rank_kills integer;
create index if not exists player_rankings_rank_kills on public.player_rankings (rank_kills);

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
    prev_rank_kills = rank_kills
  where true;

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

delete from public.ranking_meta;
