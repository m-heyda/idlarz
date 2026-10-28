# 11 · Server authority: offline progress, spawns, fights, sealed rolls, Luck and gems

For a **signed-in** player the server now decides three things the browser used to decide alone: how long the player was away and what that was worth, which chests and monsters have appeared (and what is in them), and how many gems the player holds. The server also runs every fight (see "Combat"). There is no guest mode (the game needs an account, see the [root README](../README.md)), so these rules apply to every player. Saves and their verification are in [09](09-cloud-saves.md); what is still the browser's and moves here next is in [ROADMAP](ROADMAP.md).

There is no scheduled job and nothing runs while nobody is playing. Everything is computed **lazily on a request**, from timestamps, so the free Supabase tier is enough for idle play (about 10 tiny calls an hour). **That figure does not hold during an open fight**: the browser then polls `/api/spawn` / `/api/fight` every 2 s (8 s when minimised), and each request does an auth check, two reads and a ledger write, see the free-tier notes in [ROADMAP](ROADMAP.md).

## What the server guarantees (and what it cannot)

| Guarantee | How |
|---|---|
| Away time is server time | `now - max(ledger.anchor_at, last accepted save)` on the server clock; the client sends no duration |
| Value only comes from server answers | income while away, chest and kill rewards and gems are computed by the server; the **grant ledger** (`granted`) holds the lifetime totals, and the save verifier allows a gain only up to `income x time + what the server granted since the last save` |
| Rolls cannot be re-rolled or predicted | a reward is seeded by `HMAC(LOOT_SECRET, userId / run / kind / ordinal)` (`lib/offline/seal.ts`); the ordinal is consumed on the server, a repeated request with the same key replays the stored answer |
| Opening 5 chests in 5 seconds earns nothing extra | a chest opens only against a **ticket** the server minted from its own clock; no ticket, no reward. The same logic catches a forged gold jump in the next upload (`gold_jump`, `networth_exceeds`) |
| Gems are the server's | `player_ledger.gems` is the balance; an upload can never raise it (it is checked, flagged `gems_increase`, then replaced); a new account starts at the 1000 gift at most |
| Two browsers cannot both claim | every ledger write is a compare-and-swap on `ver` |

**Known limits.** The browser still holds the game state, so someone editing local memory can add anything that stays inside the verifier's bounds without being caught; flags only un-rank an account (shadow mode), they do not reject. Monsters are placed by the server (`lib/offline/placement.ts`); chests are still placed by the browser (a chest's spot carries no value). The level a kill is paid at is not claimed by the client: it comes from the ticket's spawn level and age (`levelAtAge` in `lib/monsters.ts`).

## The flow

```
login ── GameApp waits for ──> POST /api/offline {claimId}        (useOfflineClaim, before the game loop starts)
                               server: gap -> cap (8 h + Night Watch) -> grant = efficiency (50 % + Steward) x rates x time
                                        castle upgrade finishing mid-gap switches to the higher rates
                                        tickets for the chests/rats/King that would have appeared
                               client: applyOfflineClaim -> income, castle progress, monsters age by the whole absence,
                                        tickets become monsters/chests on the map, welcome-back window (OfflineDialog)
playing ── useSpawnSync ───────> POST /api/spawn      ask again when the next ticket is due (answer says when), on tab focus
           collectChest ───────> POST /api/chest {key}   reward is sealed and returned; the chest leaves the map at once, comes back if the server was unreachable
           fights (auto or by hand) ──> POST /api/fight {sync | use | auto | dismiss}  the server runs the whole fight (HP, hits, potions, rewards) and rolls the loot against the monster's ticket; dismiss gives the ticket back
upload  ── POST /api/save ─────> verifier knows the grants; gems replaced by the ledger balance; a rebirth or new game starts a new run (tickets cleared)
```

**Chest counts and the poll race.** Every ticket answer carries `tickets.opened`, the number of chests the run has opened when the server made it. The browser places a missing chest on the map only from an answer that is not older than its own opens (none in flight, and `opened` at least the count the server returned for the player's last open; the guard lasts 15 s and starts again with every run). Without it a poll answered just before the server opened a chest still counted that chest, and while a fight is open (a poll every 2 s) the map put it back a moment after the player opened it. Extra chests on the map are always taken off. A chest that could not be opened because the server has no readable save yet (`404`, for example an account whose save predates the ledger, until its next upload) stays on the map with a message saying so.

If the server says `409 needClaim` (the player was away more than 15 minutes since it last saw them, for instance a laptop that slept with the tab open) the client runs the claim first and then carries on.

## Data (migrations `offline_ledger` and `combat_ledger`, both also in `supabase/schema.sql`)

- `player_ledger` (one row per player): `ver`, `run_id`, `rebirths`, `anchor_at`, `bank` (spawn timers and the ticket lists, a few dozen numbers), `ord_chest`, `ord_kill`, `granted`, `granted_seen`, `gems`, `last_key`, `last_result`, `combat` (the fight state, see Combat).
- `player_saves.derived` (jsonb): the castle upgrade and the rates after it, Luck and Gold Find, monster and chest counts, the away-time cap and efficiency. Written by the server from the sanitised save; rows from before the migration have none until their next upload (their first claim answers "no save yet").
- RLS is on; everything is revoked from `anon`/`authenticated`; an owner may `select (user_id, gems)` of their own row and nothing else; the server writes with the service role. There is no SQL logic: the compare-and-swap and all maths live in TypeScript, which is unit-tested against an in-memory repo.

Environment: `LOOT_SECRET` (server only, 16+ characters). Without it `/api/offline`, `/api/spawn`, `/api/chest` and `/api/fight` answer 503 `not_configured`: the game still loads (the retry screen is only for missing Supabase variables), the offline claim gives up after 6 s, and nothing spawns or fights, because there is no local fallback. `SUPABASE_SERVICE_ROLE_KEY` is needed too: the routes cannot reach the ledger without it.

## Offline numbers (`src/config/limits.ts`, read with `limitOf`)

| Limit | Base | Raised by |
|---|---|---|
| `offlineCapHours` | 8 | Ember **Night Watch**: +1 h per level (max 10), hard ceiling 72 |
| `offlineEfficiency` | 50 % | Ember **Steward**: +5 % per level (max 10), hard ceiling 100 % |
| `offlineMinGapSec` | 300 | shorter absences pay nothing and show no window |

Income, XP and the arrival of chests/monsters use the efficiency; **castle builds and monster growth run at full speed** for the whole (capped) absence. Both rows are listed in the Character window under *Bonuses* (*Offline progress*), next to the Luck effects. A claim moves the anchor to "now", so claiming again pays nothing.

## Tickets (`lib/offline/tickets.ts`)

A ticket is the server's record of a chest or monster waiting on the map. Chests come every `600 s / (1 + 0.004 x Luck)` (floor 0.6x), the first rat after 120 s then one per 900 s, a King every 10800 s while none waits. At most `min(40, 30 % of the free land)` tickets wait; with no room the timers sit at 0 like the old client timers. Monsters carry their ticket number (`Monster.ticket`) and `lucky`; their age (and so their level) is measured from the ticket's `at`.

## Luck (`src/lib/luck.ts`, `LUCK` in `gameConfig.ts`)

Luck = Charisma + the merchant's Lucky Charm + gear. Besides the gold multipliers it now gives: faster chests, rare-and-better gear odds (x`1 + 0.004 Luck`, cap 1.6), a higher monster gear drop chance, a bonus **gem roll** on every chest (`3 % + 0.06 % x Luck`, cap 15 %, 5 to 50 gems skewed low) and **lucky rats** (`2 % + 0.05 % x Luck`, cap 10 %: golden, x3 gold and XP, one extra gear roll). `npm run loot-sim` prints the effect per Luck level ([generated/loot-sim.md](generated/loot-sim.md)).

**Set bonuses that pay the economy** (the Obsidian set: income, XP, kill rewards, away time and efficiency; [generated/item-catalog.md](generated/item-catalog.md)) are derived the server's way: `summarize()` computes them from the saved gear with the pure `gearEconomy(equipment)` (`lib/gearEconomy.ts`), folds the income into `summary.rates` (so offline grants, kill gold, chest gold, `verify.ts`, `netWorth.ts` and the XP model all follow), adds the XP to `xpGainPct`, the away hours and efficiency to the limits (`LimitContext.gear`) and stores the Kill Rewards % in `derived.killRewardPct` for `payKill`. The percent damage and health of the Rattatui set go through the shared `damagePerHit` / `maxHp`, which the server's fights already use. The gear itself is still the last accepted save's: until the ledger owns the inventory ([ROADMAP](ROADMAP.md) R3), a forged save could claim a set it never found.

## Monsters

Monsters carry an integer level (there are no tiers any more). A monster spawns one level higher for every 8 tiles (`COMBAT.spawn.dangerStep`) it stands from the castle.

**Where they stand is the server's** (`lib/offline/placement.ts`). Each ticket gets a tile from the land of the last accepted save and the monster's `spawn` rule (`MonsterDef.spawn` in `config/combatConfig.ts`): a biome allowlist (water and the castle never), a castle distance of **2 to 9 tiles** (Chebyshev: never beside the castle), not on a building, a chest or another monster, outside the castle's ward from level 7. The map row is read only when the land changed (`TicketBank.sitesKey`) or a monster waits for a tile; `TicketBank.sites` counts the tiles there are, and monsters stop coming when they are all taken. A ticket with no tile stays hidden; a monster whose tile stops being valid is placed again. The kill no longer takes a level from the browser: the ticket knows the level it appeared at and its age says the rest.

## Combat (`lib/offline/fight.ts`, `POST /api/fight`, `POST /api/spawn`)

Combat is the server's. Nothing in the browser hits a monster: a click on a monster only starts a fight, and auto-battle (unlocked by the first rebirth) chains the next ones.

- **A tick of `COMBAT.tickSec` (0.1 s).** There is no background process: every request fast-forwards the player's combat from where it stopped to the server clock (at most `COMBAT.maxCatchUpSec` of fighting, then it says `behind` and the next request goes on), so a missed poll loses nothing and asking more often does not speed anything up. The random numbers are sealed per swing (`fight`, ordinal of the fight and swing).
- **Speed.** The player swings every `1 / attacksPerSecond` (weapon speed and Dexterity), a monster every `1 / attackSpeed` (`MonsterDef.attackSpeed`, attacks per second). Crits, armor, dodge, life leech, stun and the King's clock follow `lib/combat.ts`. The player's numbers are frozen into the fight when it starts (`PlayerProfile`).
- **Click to fight** (`use` command `{ kind: 'fight', n }`): opens the fight against that ticket at the server clock, with auto-battle off or on, whatever the HP and the retry time; refused with a fight open, 0 HP, an unknown ticket or while the request is still catching up. It is "accepted" when an `engage` event for that ticket was added. The fight is then carried on lazily like any other and does not chain into the next monster unless auto-battle is on.
- **Auto-battle** (switch, default off, locked until `ledger.rebirths >= COMBAT.auto.minRebirths`: before that the engine keeps it off, drops it from an older save and ignores a request for it; a click to fight is never locked): with HP at `COMBAT.auto.resumeHpPct` or more the server engages the next monster - the weakest waiting one first, the King last - one fight at a time. A monster that beat the player (or ran out the King's clock) is left alone for `retryCooldownSec` (a boss `bossRetryCooldownSec`); a defeat leaves the player at `knockoutHpFraction` of max HP, resting up to the resume line. Switching it off calls an open fight off (no reward, the monster stays).
- **Auto-use** (switch, default on): a fixed preset, `COMBAT.auto`: a potion below 40 % HP, Heal below 50 %, Stun whenever it is ready. Hotkeys 1-3 (potions) and 4-5 (Heal, Stun) are requests the server checks (level, mana, cooldown, stock); nothing else can be pressed.
- **State** is `player_ledger.combat` (migration `combat_ledger`): HP and mana (the server's numbers: the save's `playerHp` only seeds them), cooldowns, the open fight, the switches, the retry times, potions drunk (`consumed`, and `consumedSeen` as of the last accepted save, like `granted`) and a numbered log of events. A result (a win with its loot) stays in the log until the browser acknowledges it with its `since`; the browser keeps its position in `localStorage` (`lib/combatCursor.ts`).
- **A win** pays through `payKill` (`lib/offline/reward.ts`): the sealed kill roll, gold and XP into `granted`, loot in the event. A real absence (more than 15 minutes) rests the player (full regen, no fight left open); a page reload does not.
- **Polling** is the one `useSpawnSync` loop: `COMBAT.poll.fightSec` (2 s) with the panel open, `minimizedSec` (8 s) when minimized or hidden, and whatever the server says (`nextPollSec`: up to 10 minutes) when nothing can change.

## Where the code is

`src/lib/offline/` (grant, tickets, placement, ledger, seal, service, online, fight, fightTypes, profile, reward, apply, reconcile, limits, types), `src/app/api/{offline,spawn,chest,fight}`, `src/lib/{offlineClient,rewardsClient,offlineFlow,serverSession,offlineRoute,playerRoute,combatCursor}.ts`, `src/hooks/{useOfflineClaim,useSpawnSync}.ts`, `src/stores/rewardPendingStore.ts`, `src/components/game/overlays/{OfflineDialog,CombatWidget,RewardPendingChest,ChestNotification}.tsx`. Tests: `tests/offline*.test.ts`, `tests/serverSpawns.test.ts`, `tests/fightEngine.test.ts`, `tests/fightBalance.test.ts`, `tests/clientCombat.test.ts`, `tests/spawnPlacement.test.ts`, `tests/monsterConfig.test.ts`, `tests/serverBoundary.test.ts`.
