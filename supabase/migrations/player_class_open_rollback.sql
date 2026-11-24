-- Rollback of player_class_open (Linear IDL-280). NOT part of the normal run order: use it only to undo that migration by hand in the SQL editor.
-- Puts the original CHECK back (the four launch classes). It fails, and changes nothing, if a row already holds another class id: move or remove those accounts first
-- (the same rule as removing a class from the game, see docs/plan/save-compatibility.md: ids are never removed once shipped).
-- Idempotent: every statement is guarded.
alter table public.profiles drop constraint if exists player_class_shape;
alter table public.profiles drop constraint if exists player_class_known;
alter table public.profiles add constraint player_class_known check (player_class in ('warrior', 'paladin', 'ranger', 'mage'));
