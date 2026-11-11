-- Rollback of idols_v1 (IDL-96). NOT part of the normal run order: use it only to undo that migration by hand in the SQL editor.
-- It only removes one column comment, so it is always safe and idempotent. Ledgers that already hold legacy.idols keep it; a build without Idols ignores the key.
-- To clear it by hand (this FORGETS every player's Idol levels, so only on a test database): update public.player_ledger set legacy = null;
comment on column public.player_ledger.legacy is null;
