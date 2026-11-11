-- idols_v1 (Linear IDL-96): the twelve Idols, whose levels the account keeps across rebirths.
-- Run ONCE, BEFORE the code that reads it (SQL before code). Rehearse on a Supabase branch first. Idempotent.
--
-- No table or column changes are needed, on purpose:
--   player_ledger.legacy (jsonb, added by new_chapter_columns, null for every existing row) gains the key  idols = { <biome>: <level> }
--     the server's trusted record of each Idol's level; lazy-seeded: a null column reads as nothing learned and is written the first time an Idol is built.
--   player_saves.core (jsonb) gains the optional keys  idolLevels = { <biome>: <level> }  (the browser's copy, cut back to the ledger by the save pipeline)
--     and  idolFx = { damagePct, hpArmorPct }  (stamped by the server for the fight profile; absent with no Idol).
--   player_saves.derived (jsonb) gains the optional key  idol = { chestSpeedPct, craftXpPct, damagePct, hpArmorPct }.
--   player_worlds.extra: the Idol building ids (idol_<biome>) are values of the existing `building` field.
-- Rows written before this migration simply lack the keys. Nothing a running version reads changes.
--
-- What this migration does: records that contract in the database as a column comment.
--
-- Rollback: see idols_v1_rollback.sql

comment on column public.player_ledger.legacy is 'what the account keeps across rebirths. Key idols = { biome: level } is the trusted Idol level record (idols_v1); null until an Idol is built.';
