-- inventory_ledger: the server owns the bag, the worn gear, the loot pity and the auto-sell filter (docs/ROADMAP.md R3, docs/11-server-authority.md).
-- Run ONCE on a project that already has the offline_ledger and combat_ledger schemas, BEFORE deploying the code that reads this column.
-- Additive and idempotent: one nullable column. The server seeds it from the player's last save the first time it needs it; from then on
-- an uploaded save can no longer change these four things (the stored copy is stamped with the ledger's).
alter table public.player_ledger add column if not exists inv jsonb;  -- { ver, bag, equipment, lootPity, autoSellUpTo } (null until the first request after this migration)
