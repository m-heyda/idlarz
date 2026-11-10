-- Rollback of buildings_v1 (IDL-91, IDL-92). NOT part of the normal run order: use it only to undo that migration by hand in the SQL editor.
-- It only removes three column comments, so it is always safe and idempotent. Saves that already hold the optional building keys keep loading: the code drops
-- them when BUILDINGS_FLAG is off. To also strip the keys from stored rows (never needed), run by hand:
--   update public.player_saves set core = core - 'buildingUpgrade', derived = derived - 'buildingUpgrade' - 'buildings' where core ? 'buildingUpgrade';
-- (tile extras in player_worlds are dropped on the next save with the flag off).
comment on column public.player_saves.core is null;
comment on column public.player_saves.derived is null;
comment on column public.player_saves.flags is null;
