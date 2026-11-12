-- Rollback of profile_name_color.sql (cosmetic: dropping loses only the picked colours and the admin flag; a bought Name colours unlock stays in the ledger).
alter table public.profiles drop column if exists name_color;
alter table public.profiles drop column if exists is_admin;
