-- Rollback of gems_attrs_ledger. Run only after the code that reads or writes these columns is rolled back (the data in them is lost).
alter table public.player_ledger drop column if exists attrs, drop column if exists gem_shop;
