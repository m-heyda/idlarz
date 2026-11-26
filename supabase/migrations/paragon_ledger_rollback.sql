-- Rollback of paragon_ledger. Run only after the code that reads or writes this column is rolled back (the data in it is lost).
alter table public.player_ledger drop column if exists paragon;
