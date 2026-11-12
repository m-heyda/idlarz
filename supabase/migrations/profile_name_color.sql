-- profile_name_color: the colour of a player's nickname (landing, game, rankings) and the admin flag that allows the special gold nickname.
-- name_color: null = the default colour, else one of the twelve ids of config/nickColors.ts, or 'gold' (admin only).
-- is_admin: set by hand (service role / SQL editor) for the owner's account; never written by the game. Default false.
-- name_color is written by the server only (service role, POST /api/auth/badge), which checks it against is_admin and the Name colours purchase (player_ledger.gem_shop.bought.name_colors);
-- neither column is in the authenticated insert/update grants of profiles_server_columns. Additive and nullable/defaulted: safe to run before or after the code; idempotent.
-- Rollback: profile_name_color_rollback.sql
alter table public.profiles add column if not exists name_color text;
alter table public.profiles add column if not exists is_admin boolean not null default false;
