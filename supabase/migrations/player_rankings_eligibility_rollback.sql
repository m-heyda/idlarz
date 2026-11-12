-- Rollback of player_rankings_eligibility.sql: put the trusted-only function back by re-running the refresh_rankings block of player_rankings_kills.sql (after dropping this one).
drop function if exists public.refresh_rankings(integer, numeric, integer, integer);
