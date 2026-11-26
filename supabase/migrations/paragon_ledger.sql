-- paragon_ledger (Linear IDL-186 paragon points, docs/plan/paragon.md).
-- Run ONCE, BEFORE deploying the code that reads this column (SQL before code: the ledger select lists its columns, so a deploy without it fails every ledger read).
-- Additive and idempotent: one nullable jsonb column on the ledger. Nothing here changes what the current code reads or writes. Rehearse on a Supabase branch first.
--
-- What it adds
--   player_ledger.paragon   the paragon points the player has put into each upgrade, the server's record: `{ ver, spent: {<upgradeId>: points}, freeUsed }`.
--                           null = nothing spent yet (the points still free are always worked out from the XP, never stored).
--
-- Rollback (only while no code that writes it has shipped; it is unused data until then):
--   see paragon_ledger_rollback.sql

alter table public.player_ledger add column if not exists paragon jsonb;   -- server-held paragon points (null = nothing spent yet)
