-- Rollback of grant_testers_to_all_players.sql: removes exactly the rows that migration wrote (their fixed earned_at). Accounts that held the testers before it have them from the new chapter reset with another timestamp and keep them.
-- A ledger that already merged the two keeps them as earned (the ledger is the record of payment); that is intended: nothing a player may already have claimed is taken back.
delete from public.player_achievements
 where achievement_id in ('early_tester', 'beta_tester') and earned_at = timestamptz '2026-11-18 12:00:00+00';
