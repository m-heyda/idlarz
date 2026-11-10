-- buildings_v1 (Linear IDL-91, IDL-92): the per-biome building system, built dark behind BUILDINGS_FLAG (src/config/buildings.ts, ships OFF).
-- Run ONCE, BEFORE the code that turns the flag on (SQL before code). Rehearse on a Supabase branch first. The flag stays off until after the "new chapter" release.
--
-- No table or column changes are needed, on purpose: the whole save shape the system adds lives inside columns that are already jsonb or text[].
--   player_saves.core           (jsonb)  gains the optional key  buildingUpgrade = { x, y, toLevel, remainingSec }  or null
--   player_worlds.extra         (jsonb)  tiles gain the optional extra keys  building (catalog id, text)  and  bl (level 2-5; absent means level 1)
--   player_saves.derived        (jsonb)  gains the optional keys  buildingUpgrade  and  buildings = { <id>: <level> }
--   player_saves.flags          (text[]) gains the value  timer_jump  (building level or timer faster than real time)
-- All of it is written only while the flag is on. With the flag off the code reads such keys and drops them, so a save written with the flag on still loads after
-- the flag is switched back off (no SAVE_SCHEMA bump). Rows written before this migration simply lack the keys.
--
-- What this migration does: records that contract in the database as column comments (idempotent, no locks of note, nothing a running version reads).
--
-- Rollback (only comments change, so it is optional; the data keys need no cleanup because the code ignores them with the flag off):
--   see buildings_v1_rollback.sql

comment on column public.player_saves.core is 'everything but the map. Optional key buildingUpgrade {x,y,toLevel,remainingSec} | null exists only while BUILDINGS_FLAG is on (buildings_v1).';
comment on column public.player_saves.derived is 'castle upgrade + rates after it, Luck, away-time cap and efficiency. Optional keys buildingUpgrade and buildings {id: level} exist only while BUILDINGS_FLAG is on (buildings_v1).';
comment on column public.player_saves.flags is 'plausibility flags raised by the last save (verify.ts SaveFlag); timer_jump is the building timer (buildings_v1).';
