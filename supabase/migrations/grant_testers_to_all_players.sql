-- grant_testers_to_all_players: every account that exists today gets the Early tester and the Beta tester achievements (IDL-321, owner request 2026-11-18), not only the accounts that predate the new chapter.
-- The server merges the two into each player's ledger the next time it handles a request (`mergeManual`, once per ledger, guarded by stats.manualSynced); a ledger that already merged is told to merge again by dropping that flag.
-- Data only and idempotent: `on conflict do nothing`, and every row written here carries the fixed earned_at below so the rollback can find exactly these rows. Accounts created after this date do not get them.
-- Rollback: grant_testers_to_all_players_rollback.sql
insert into public.player_achievements (user_id, achievement_id, earned_at)
select p.id, a.achievement_id, timestamptz '2026-11-18 12:00:00+00'
  from public.profiles p
 cross join (values ('early_tester'), ('beta_tester')) as a(achievement_id)
on conflict (user_id, achievement_id) do nothing;

-- a ledger that merged the manual achievements before now has to merge again
update public.player_ledger
   set stats = stats - 'manualSynced'
 where stats is not null and stats ? 'manualSynced';
