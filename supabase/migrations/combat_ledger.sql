-- combat_ledger: server-run auto-combat (docs/12-roadmap-features-and-bugs.md, docs/11-offline-and-sealed-rolls.md).
-- Run ONCE on a project that already has the offline_ledger schema, BEFORE deploying the code that reads this column. Additive and
-- idempotent: one nullable column. The server seeds it from the player's last save the first time they fight.
alter table public.player_ledger add column if not exists combat jsonb;  -- HP and mana, cooldowns, the open fight, auto-battle switches, recent events (null until the first fight request)
