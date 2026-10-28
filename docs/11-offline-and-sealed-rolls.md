# 11 · Offline progress, sealed rolls, Luck and gems

For a **signed-in** player the server now decides three things the browser used to decide alone: how long the player was away and what that was worth, which chests and monsters have appeared (and what is in them), and how many gems the player holds. A guest (no account) plays exactly as before: local rules, no offline progress, no gems.

There is no scheduled job and nothing runs while nobody is playing. Everything is computed **lazily on a request**, from timestamps, so the free Supabase tier is enough (about 10 tiny calls an hour of play, one small row per player).

## What the server guarantees (and what it cannot)

| Guarantee | How |
|---|---|
| Away time is server time | `now - max(ledger.anchor_at, last accepted save)` on the server clock; the client sends no duration |
| Value only comes from server answers | income while away, chest and kill rewards and gems are computed by the server; the **grant ledger** (`granted`) holds the lifetime totals, and the save verifier allows a gain only up to `income x time + what the server granted since the last save` |
| Rolls cannot be re-rolled or predicted | a reward is seeded by `HMAC(LOOT_SECRET, userId / run / kind / ordinal)` (`lib/offline/seal.ts`); the ordinal is consumed on the server, a repeated request with the same key replays the stored answer |
| Opening 5 chests in 5 seconds earns nothing extra | a chest opens only against a **ticket** the server minted from its own clock; no ticket, no reward. The same logic catches a forged gold jump in the next upload (`gold_jump`, `networth_exceeds`) |
| Gems are the server's | `player_ledger.gems` is the balance; an upload can never raise it (it is checked, flagged `gems_increase`, then replaced); a new account starts at the 1000 gift at most |
| Two browsers cannot both claim | every ledger write is a compare-and-swap on `ver` |

**Known limits.** The browser still holds the game state, so someone editing local memory can add anything that stays inside the verifier's bounds without being caught; flags only un-rank an account (shadow mode), they do not reject. Positions of chests and monsters are chosen by the browser (they carry no value). The level a kill is paid at is claimed by the client but capped by what the ticket's age and the land allow (`maxSpawnLevel`).

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
           hitMonster (kill) ──> POST /api/kill {key,n,level}  loot is rolled against the monster's ticket; the monster stays until the server answers
           dismissMonster ─────> POST /api/kill {dismiss:true} gives the ticket back
upload  ── POST /api/save ─────> verifier knows the grants; gems replaced by the ledger balance; a rebirth or new game starts a new run (tickets cleared)
```

If the server says `409 needClaim` (the player was away more than 15 minutes since it last saw them, for instance a laptop that slept with the tab open) the client runs the claim first and then carries on.

## Data (migration `offline_ledger`, also in `supabase/schema.sql`)

- `player_ledger` (one row per player): `ver`, `run_id`, `rebirths`, `anchor_at`, `bank` (spawn timers and the ticket lists, a few dozen numbers), `ord_chest`, `ord_kill`, `granted`, `granted_seen`, `gems`, `last_key`, `last_result`.
- `player_saves.derived` (jsonb): the castle upgrade and the rates after it, Luck and Gold Find, monster and chest counts, the away-time cap and efficiency. Written by the server from the sanitised save; rows from before the migration have none until their next upload (their first claim answers "no save yet").
- RLS is on; everything is revoked from `anon`/`authenticated`; an owner may `select (user_id, gems)` of their own row and nothing else; the server writes with the service role. There is no SQL logic: the compare-and-swap and all maths live in TypeScript, which is unit-tested against an in-memory repo.

Environment: `LOOT_SECRET` (server only, 16+ characters). Without it `/api/offline` and the reward routes answer 503 `not_configured` and the game falls back to local spawns (as for a guest).

## Offline numbers (`src/config/limits.ts`, read with `limitOf`)

| Limit | Base | Raised by |
|---|---|---|
| `offlineCapHours` | 8 | Legacy **Night Watch**: +1 h per level (max 10), hard ceiling 72 |
| `offlineEfficiency` | 50 % | Legacy **Steward**: +5 % per level (max 10), hard ceiling 100 % |
| `offlineMinGapSec` | 300 | shorter absences pay nothing and show no window |

Income, XP and the arrival of chests/monsters use the efficiency; **castle builds and monster growth run at full speed** for the whole (capped) absence. Both rows are listed in the Character window under *Bonuses* (*Offline progress*), next to the Luck effects. A claim moves the anchor to "now", so claiming again pays nothing.

## Tickets (`lib/offline/tickets.ts`)

A ticket is the server's record of a chest or monster waiting on the map. Chests come every `600 s / (1 + 0.004 x Luck)` (floor 0.6x), the first rat after 120 s then one per 900 s, a King every 10800 s while none waits. At most `min(40, 30 % of the free land)` tickets wait; with no room the timers sit at 0 like the old client timers. Monsters carry their ticket number (`Monster.ticket`) and `lucky`; their age (and so their level) is measured from the ticket's `at`.

## Luck (`src/lib/luck.ts`, `LUCK` in `gameConfig.ts`)

Luck = Charisma + the merchant's Lucky Charm + gear. Besides the gold multipliers it now gives: faster chests, rare-and-better gear odds (x`1 + 0.004 Luck`, cap 1.6), a higher monster gear drop chance, a bonus **gem roll** on every chest (`3 % + 0.06 % x Luck`, cap 15 %, 5 to 50 gems skewed low) and **lucky rats** (`2 % + 0.05 % x Luck`, cap 10 %: golden, x3 gold and XP, one extra gear roll). `npm run loot-sim` prints the effect per Luck level (docs/generated/loot-sim.md). Rarity and drop-chance effects apply to guests too; gems and lucky rats are server-only.

## Monsters

Monsters carry an integer level (there are no tiers any more). New this change: a monster spawns one level higher for every 8 tiles (`COMBAT.spawn.dangerStep`) it stands from the castle, so the frontier is more dangerous than the home land. New monster families are a separate follow-up.

## Where the code is

`src/lib/offline/` (grant, tickets, ledger, seal, service, online, apply, reconcile, limits, types), `src/app/api/{offline,spawn,chest,kill}`, `src/lib/{offlineClient,rewardsClient,offlineFlow,serverSession,offlineRoute,playerRoute}.ts`, `src/hooks/{useOfflineClaim,useSpawnSync}.ts`, `src/components/game/overlays/OfflineDialog.tsx`. Tests: `tests/offline*.test.ts`, `tests/serverSpawns.test.ts`.
