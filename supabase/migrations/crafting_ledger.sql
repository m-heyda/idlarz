-- crafting_ledger: the server owns the crafting level XP and the component stock (docs/plan/crafting-v0.md, Linear IDL-117).
-- Run ONCE on a project that already has the offline_ledger, combat_ledger and inventory_ledger schemas, BEFORE deploying the code that reads this column.
-- Additive and idempotent: one nullable column. A row without a value reads as zeros (level 1, no components); the server writes null again
-- for a player who never crafted, so the column stays empty for most rows.
alter table public.player_ledger add column if not exists craft jsonb;  -- { xp, ord, stock, pity, spent, last } (null = never crafted)
