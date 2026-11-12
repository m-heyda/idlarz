-- Rollback of player_rankings.sql: drops the rankings tables and function (cosmetic data only). best_tiles is left in place (harmless, defaulted);
-- restore the previous save_player_state from autosave_history_by_time.sql / schema.sql only if the column is also dropped.
drop function if exists public.refresh_rankings(integer, numeric);
drop table if exists public.player_rankings;
drop table if exists public.ranking_meta;
