-- Rollback of ember_refund_v2.sql: puts the old prestige (shop levels and unspent points) back from the backup table.
-- Only accounts that have not bought anything in the new shop since (shopVersion 2, no upgrades, all Embers unspent) are restored,
-- so nobody loses a purchase made after the refund. Run in one transaction.
begin;

update public.player_saves s
set core = jsonb_set(s.core, '{prestige}', b.prestige),
    legacy_points = b.legacy_points
from public.backup_ember_refund_v2 b
where s.user_id = b.user_id
  and (s.core -> 'prestige' ->> 'shopVersion') = '2'
  and s.core -> 'prestige' -> 'upgrades' = '{}'::jsonb
  and s.legacy_points = s.legacy_earned;

-- keep the backup table until you are sure; then: drop table public.backup_ember_refund_v2;
commit;
