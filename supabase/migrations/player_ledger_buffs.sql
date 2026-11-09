-- player_ledger_buffs: the potion buffs a player has running (Linear IDL-155, the `use` operation of POST /api/inventory).
-- Run ONCE on a project that already has the offline_ledger, combat_ledger, inventory_ledger and crafting_ledger schemas, BEFORE deploying the code that reads this column
-- (the code selects `buffs` explicitly, so a deploy without the column fails every ledger read).
-- Additive and idempotent: one nullable column. A row without a value reads as no buffs; the server writes null again when none run.
alter table public.player_ledger add column if not exists buffs jsonb;  -- [{ family, stat, amount, untilSec }] (null = no buffs); an unknown family is dropped on read
