-- Rollback of new_chapter_columns (IDL-68). NOT part of the normal run order: use it only to undo that migration by hand in the SQL editor.
-- Safe while no deployed code reads or writes the new columns (until the new chapter code ships they hold nothing but nulls and an empty table).
-- After the new chapter code is live, do not run this: it deletes earned achievements, chosen avatars and the lifetime counters.
-- Idempotent: every statement is guarded, so running it twice or on a database that never had the migration does nothing.
drop index if exists public.profiles_character_name_ci;
alter table public.profiles drop column if exists epoch, drop column if exists avatar_id;
drop table if exists public.player_achievements;
alter table public.player_ledger drop column if exists stats, drop column if exists legacy;
