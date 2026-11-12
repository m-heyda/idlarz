-- Rollback of player_rankings_kills.sql: drops the Kills columns (cosmetic ranking data only). Restore refresh_rankings() from player_rankings.sql afterwards, since the version of the
-- kills migration writes the dropped columns.
drop index if exists public.player_rankings_rank_kills;
alter table public.player_rankings drop column if exists kills;
alter table public.player_rankings drop column if exists rank_kills;
alter table public.player_rankings drop column if exists prev_rank_kills;
