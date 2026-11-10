-- buildings_extractors_v1 (Linear IDL-94): the seven T3 extracts (herbs, sap, ironOre, spores, frostshard, pearls, salt) made by the Extractor buildings.
-- Run ONCE, BEFORE the code that makes them (SQL before code). Rehearse on a Supabase branch first. Idempotent.
--
-- No table or column changes are needed, on purpose: a resource is one more optional key inside columns that are already jsonb.
--   player_saves.core -> resources   (jsonb) gains the optional keys herbs, sap, ironOre, spores, frostshard, pearls, salt (a save without them reads 0)
--   player_ledger.granted, granted_seen (jsonb) gain the same keys in their totals (a row without them reads 0; `zeroTotals` fills them)
--   player_worlds.extra / player_saves.derived: the new building ids (herbgarden, saptapper, deepmine, sporecellar, icecutter, pearldiver, saltworks) are values of the
--   existing `building` field; no schema change. Rows written before this migration simply lack the keys.
-- Nothing a running version reads changes, so merging this migration alone changes nothing for players.
--
-- What this migration does: records that contract in the database as column comments.
--
-- Rollback: see buildings_extractors_v1_rollback.sql

comment on column public.player_ledger.granted is 'lifetime totals the server handed out: what a save may contain on top of its income. Optional keys herbs, sap, ironOre, spores, frostshard, pearls, salt (buildings_extractors_v1).';
comment on column public.player_ledger.granted_seen is 'the same totals, as of the last accepted save. Optional keys herbs, sap, ironOre, spores, frostshard, pearls, salt (buildings_extractors_v1).';
