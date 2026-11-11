-- profile_badge_title: the badge and the title a player shows next to their name (character window, landing, rankings).
-- badge_id: null = the default (the Early tester badge when the account holds it), 'none' = the player hid their badge, else the id of an earned achievement.
-- title_id: null = no title, else the title id of an earned achievement (`rewards.titleId`).
-- Both are written by the server only (service role, POST /api/auth/badge), which checks them against `player_achievements`; the authenticated grants of profiles_server_columns do not include them.
-- Additive and nullable: safe to run before or after the code that uses it; idempotent.
-- Rollback: profile_badge_title_rollback.sql
alter table public.profiles add column if not exists badge_id text;
alter table public.profiles add column if not exists title_id text;
