-- Rollback of identity_server_only: players may update their own name, class and id again (as profiles_server_columns left it).
grant update (id, character_name, player_class) on public.profiles to authenticated;
alter table public.profiles drop column if exists name_changed_at;
