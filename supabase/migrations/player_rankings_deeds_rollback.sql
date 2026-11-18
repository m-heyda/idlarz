-- Rollback of player_rankings_deeds.sql: drops the Deeds columns (cosmetic ranking data only), then restore refresh_rankings() by re-running player_rankings_season.sql (the new function writes the dropped columns).
drop index if exists public.player_rankings_rank_deeds;
alter table public.player_rankings drop column if exists deed_points;
alter table public.player_rankings drop column if exists deeds_changed_at;
alter table public.player_rankings drop column if exists rank_deeds;
alter table public.player_rankings drop column if exists prev_rank_deeds;
