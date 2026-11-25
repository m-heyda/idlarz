-- player_class_open (Linear IDL-280): the database no longer keeps its own copy of the hero list.
-- Run ONCE, BEFORE deploying the code of a fifth hero class (SQL before code). Rehearse on a Supabase branch first. Today's four classes keep working either way.
-- Idempotent and additive in effect: it drops the CHECK that spelled out the four classes (`player_class_known` in schema.sql) and puts a loose one in its place
-- (a lowercase word of 1 to 32 characters), so a new class id no longer needs SQL first. Which classes exist is decided in code only: `PLAYER_CLASSES` in
-- src/config/playerClasses.ts, enforced by `checkPlayerClass` (src/lib/authValidation.ts) on every write; `profiles.player_class` is writable only by the server (identity_server_only.sql).
-- No row changes: every existing class id passes the new check. Merging this migration alone changes nothing for players.
alter table public.profiles drop constraint if exists player_class_known;
alter table public.profiles drop constraint if exists player_class_shape;
alter table public.profiles add constraint player_class_shape check (player_class ~ '^[a-z][a-z_]{0,31}$');
