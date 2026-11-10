-- profiles_server_columns (Linear IDL-76): the epoch and the avatar of a profile are the SERVER's to write.
-- Until now a player's own session could update any column of their profile row. With `epoch` and `avatar_id` on it that would let a player skip the new chapter reset
-- (set their own epoch) or pick an avatar they have not unlocked. The route handlers write these two columns with the service role (POST /api/auth/epoch, registration),
-- which is not affected by column grants. Players keep what they could do before: create their row and change name and hero.
-- Applied to the live database 2026-11-10 (the update grant includes `id` because an upsert also sets it). Run ONCE. Safe to run before or after the code that uses the columns (the service role is unaffected); idempotent.
-- Rollback: grant insert, update on table public.profiles to authenticated;
revoke insert, update on table public.profiles from authenticated;
grant insert (id, character_name, player_class) on public.profiles to authenticated;
grant update (id, character_name, player_class) on public.profiles to authenticated;
