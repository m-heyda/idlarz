-- Rollback of buildings_extractors_v1 (IDL-94). NOT part of the normal run order: use it only to undo that migration by hand in the SQL editor.
-- It only removes two column comments, so it is always safe and idempotent. Saves and ledgers that already hold the T3 keys keep working with the code that knows them;
-- a build without the T3 resources ignores the keys (the save check drops unknown resource keys it does not list). To strip them from stored rows by hand (never needed):
--   update public.player_ledger set granted = granted - 'herbs' - 'sap' - 'ironOre' - 'spores' - 'frostshard' - 'pearls' - 'salt',
--     granted_seen = granted_seen - 'herbs' - 'sap' - 'ironOre' - 'spores' - 'frostshard' - 'pearls' - 'salt';
comment on column public.player_ledger.granted is null;
comment on column public.player_ledger.granted_seen is null;
