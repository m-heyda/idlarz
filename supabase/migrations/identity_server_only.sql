-- identity_server_only (Linear IDL-190 gem identity services): the name and the class of a profile become the SERVER's to change.
-- Until now a player's own session could update `character_name` and `player_class` straight through PostgREST. With class change (500 gems) and name change (200 gems, once per 30 days)
-- as gem services that would be a free bypass, so the update grant on the whole profile row is withdrawn. Players keep what they need to CREATE their row (insert of id, name and class,
-- first registration and the new chapter screen); every later change goes through POST /api/gems, which writes with the service role (not affected by column grants).
-- Run ONCE, BEFORE deploying the code that uses it is not required (the service role is unaffected), but the new routes assume it. Idempotent.
--
-- What it adds
--   profiles.name_changed_at   epoch of the last PAID name change; null = never changed (the first change is allowed at once, then 30 days apart). Lives on the profile so it survives a game reset.
--
-- Rollback: see identity_server_only_rollback.sql

alter table public.profiles add column if not exists name_changed_at timestamptz;

revoke update on table public.profiles from authenticated;
