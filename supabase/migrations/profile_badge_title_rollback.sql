-- Rollback of profile_badge_title.sql (the choices are cosmetic; dropping them loses only the player's pick).
alter table public.profiles drop column if exists badge_id;
alter table public.profiles drop column if exists title_id;
