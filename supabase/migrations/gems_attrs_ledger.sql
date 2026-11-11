-- gems_attrs_ledger (Linear IDL-189 gem spend engine, IDL-194 daily bonus, server-held attribute points).
-- Run ONCE, BEFORE deploying the code that reads these columns (SQL before code: the ledger select lists its columns, so a deploy without them fails every ledger read).
-- Additive and idempotent: two nullable jsonb columns on the ledger. Nothing here changes what the current code reads or writes. Rehearse on a Supabase branch first.
--
-- What it adds
--   player_ledger.attrs     the attribute points the player has put into each stat (above the start value), the server's record: `{ ver, alloc: {strength, ...}, freeUsed }`.
--                           null = not seeded yet (the first request after the deploy seeds it from the stored save, so every existing account keeps what it has).
--   player_ledger.gem_shop  what the gem shop has sold: `{ bought: {id: n}, lastAt: {id: epoch s}, daily: {day, streak}, spentSinceSave }`. null = nothing bought, no daily claimed.
--
-- Rollback (only while no code that writes them has shipped; both are unused data until then):
--   see gems_attrs_ledger_rollback.sql

alter table public.player_ledger add column if not exists attrs jsonb;      -- server-held attribute allocation (null = not seeded yet)
alter table public.player_ledger add column if not exists gem_shop jsonb;   -- gem shop purchases and the daily bonus (null = nothing yet)
