-- autosave_history_by_time: history copies are decided by the clock (30 min since the last copy), not by the revision count.
-- Run ONCE on a project that already has the cloud-save schema (the production project), BEFORE deploying the code that
-- reads the column. Additive: existing rows get now() as their last copy time; nothing is rewritten.
alter table public.player_saves add column if not exists last_archive_at timestamptz not null default now();

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
