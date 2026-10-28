-- offline_ledger: server-held offline progress, sealed rolls and gems (docs/11-offline-and-sealed-rolls.md).
-- Run ONCE on a project that already has the cloud-save schema, BEFORE deploying the code that reads these columns. Additive:
-- player_saves gets one nullable column (rows written before this simply have no `derived` until their next save), and a new table.
alter table public.player_saves add column if not exists derived jsonb;

-- ---- player_ledger: the server's own record of a player (away-time anchor, spawn tickets, sealed-roll counters, gems) -----
-- One small row per player. Written ONLY by the server (service role, compare-and-swap on ver); a player may read their own gems and
-- nothing else.
create table public.player_ledger (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  ver           integer     not null,                 -- compare-and-swap counter
  run_id        integer     not null default 1,       -- bumped by a rebirth or a new game: sealed rolls never repeat across runs
  rebirths      integer     not null default 0,
  anchor_at     timestamptz not null,                 -- away time is counted from the later of this and the last accepted save
  bank          jsonb       not null,                 -- spawn timers and the chest / rat / king tickets (a few dozen numbers)
  ord_chest     integer     not null default 0,       -- chest and kill rewards rolled this run (the next one is sealed on this number)
  ord_kill      integer     not null default 0,
  granted       jsonb       not null,                 -- lifetime totals the server handed out: what a save may contain on top of its income
  granted_seen  jsonb       not null,                 -- the same, as of the last accepted save
  gems          integer     not null,                 -- THE gem balance: a save can never raise it
  last_key      text,                                 -- idempotency key of the last claim / redemption ...
  last_result   jsonb,                                -- ... and its answer, replayed when a response got lost
  updated_at    timestamptz not null default now(),
  constraint ledger_ver_positive check (ver >= 1),
  constraint ledger_gems_range   check (gems >= 0 and gems <= 1000000000)
);
alter table public.player_ledger enable row level security;
revoke all on table public.player_ledger from anon, authenticated, public;
grant select (user_id, gems) on public.player_ledger to authenticated;
create policy "player_ledger_select_own" on public.player_ledger for select to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.player_ledger to service_role;

-- the save RPC now also stores `derived` (castle upgrade, rates after it, Luck, away-time cap and efficiency)
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
