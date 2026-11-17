-- ember_refund_v2: the Ember shop was reworked (new ids, costs and effects). Every account that already rebirthed gets ALL its Embers back
-- (shop levels cleared, legacy_points = legacy_earned) and keeps auto-potion for free (grants: ["potion"]). Run ONCE, right after the code that
-- reads `prestige.shopVersion` is deployed (the code does the same step on load, so a stale browser tab cannot undo it; this SQL makes the stored saves match).
-- Idempotent: it only touches saves whose prestige has no shopVersion yet, and stamps shopVersion 2.
-- Rollback: ember_refund_v2_rollback.sql (restores from the backup table this file creates).
--
-- STEP 1, dry run (read only): how many accounts will change, and how many Embers come back
--   select count(*) as accounts, coalesce(sum(legacy_earned - legacy_points), 0) as embers_returned
--   from public.player_saves
--   where rebirths >= 1 and core -> 'prestige' is not null and (core -> 'prestige' ->> 'shopVersion') is null;

begin;

-- STEP 2, backup of what is about to change (kept until you drop it)
create table if not exists public.backup_ember_refund_v2 (
  user_id        uuid primary key,
  prestige       jsonb       not null,
  legacy_points  integer     not null,
  backed_up_at   timestamptz not null default now()
);
alter table public.backup_ember_refund_v2 enable row level security;
revoke all on table public.backup_ember_refund_v2 from anon, authenticated, public;

insert into public.backup_ember_refund_v2 (user_id, prestige, legacy_points)
select user_id, core -> 'prestige', legacy_points
from public.player_saves
where rebirths >= 1 and core -> 'prestige' is not null and (core -> 'prestige' ->> 'shopVersion') is null
on conflict (user_id) do nothing;

-- STEP 3, the refund: no shop levels, every earned Ember unspent, shop generation 2, auto-potion granted
update public.player_saves
set core = jsonb_set(
      core,
      '{prestige}',
      (core -> 'prestige')
        || jsonb_build_object(
             'upgrades', '{}'::jsonb,
             'legacyPoints', legacy_earned,
             'shopVersion', 2,
             'grants', '["potion"]'::jsonb
           )
    ),
    legacy_points = legacy_earned
where rebirths >= 1 and core -> 'prestige' is not null and (core -> 'prestige' ->> 'shopVersion') is null;

-- STEP 4, check before committing: nothing should be left, and every account must satisfy unspent = earned
--   select count(*) from public.player_saves where rebirths >= 1 and (core -> 'prestige' ->> 'shopVersion') is null;   -- expect 0
--   select count(*) from public.player_saves where rebirths >= 1 and legacy_points <> legacy_earned;                     -- expect 0 right after the run
-- If a number is wrong, run `rollback;` instead of `commit;`.
commit;
