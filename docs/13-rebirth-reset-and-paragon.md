# 13 · Rebirth reset, bonus points and Paragon (design draft, nothing built)

What a rebirth keeps and resets once the character, the crafting skill ([17](17-crafting.md)) and the biomes ([12](12-rebirth-biomes.md)) are the long-term progression, plus the endless level track after level 100.

## 1. Today (read from `rebirth()` in `stores/gameStore.ts` and [11](11-server-authority.md))

| Kept | Reset |
|---|---|
| lifetime XP and level; **attributes as spent** (and unspent points); **bag, worn gear, loot pity, auto-sell filter**; gems; Embers and the Ember shop; Pack Rat; name, class, play time | map, resources, castle, farm, buildings, the other merchant upgrades, monsters and chests |

On the server the rebirth is only *noticed*: the upload carries `rebirths + 1`, the ledger starts a new run (`run_id`, tickets cleared) and **keeps `inv`** ("a rebirth keeps the gear and the bag").

## 2. Decided

On every rebirth:
1. **Respec**: all attribute points return to the pool.
2. **Bonus pool**: the pool grows by **+20 per rebirth**. Total bonus points = `20 x rebirths` (20 after the first, 40 after the second ... 100 after the fifth). *(Decided: the flat reading; the cumulative 20/60/120/200/300 reading would exceed the 157 points level 100 gives today.)*
3. **Inventory wipe**: the **bag and the worn gear** are cleared and the **loot pity resets** (decided). Kept (decided): gems, Embers and shop, Pack Rat (it is a bag-size upgrade, not items), character level and XP, crafting level and crafting XP, discovered biomes, name/class/play time.
4. Map, **biomes**, resources, castle, farm and all Producers/Extractors reset as today (the map is always rolled anew).
5. **Kept and growing**: Idol levels ([18](18-biome-buildings-and-material-tiers.md) section 6: persistent, re-placed for free at their level, cap 5 raised with Embers) and the other soft caps; they are the long-term sinks for legacy points (Embers).

Total attribute points available after a rebirth: `totalStatPoints(level) + 20 x rebirths` (`totalStatPoints` in `utils/gameUtils.ts`: 87 at level 30, 157 at level 100).

## 3. Impact on the game (what to check before building)

- **Power.** At rebirth 1 (level about 30-43) +20 is about +20-25 % points; at rebirth 5 it is +100 on top of 157 (+64 %). Resource modifiers are +2.5 % per point, so income rises a few percent per rebirth beyond the Ember income; that partly answers BL2 ("levels barely matter"). Re-run `npm run sim -- --seeds=3 hardcore-rebirth6` with the new pool; the sim bot allocates by a fixed policy (B7) and must learn the respec.
- **The gear wipe changes the combat loop.** Gear is the only way to beat the Rat King (the only source of Rattatui pieces, 1000 HP, 75 s clock; R8 says steel and wood already cannot). After a wipe a new run starts from the starter kit every time. Auto-battle unlocks at rebirth 1, so the first thing a rebirthed player has is *no gear*. Consequences: (a) the run's early game is slower for fights; (b) crafting ([17](17-crafting.md)) becomes the answer to "I have nothing": the crafted tier follows the persistent crafting level, so re-gearing gets faster with each rebirth, which is the intended synergy; (c) loot-pity and the premium drops are worth less. Ship crafting *with or before* the wipe, otherwise rebirth 1 feels like a punishment. If crafting is not ready, ship respec + bonus points first and the wipe with crafting.
- **Gear-gated economy sets** (Obsidian: income, XP, away time) are lost on rebirth too, so the first days of each run lose that bonus: the run-2 speed target in [06](06-pacing-targets.md) ("at most about 65-70 % of run 1") needs a re-measure; the sim's `GEAR_SCHEDULE` assumption (obsidian from day 5) then has to restart per run.
- **Respec UX.** Rebirth dialog shows "Your attributes will be refunded (N points) and you get +20 points. Your bag and gear will be cleared" with a second confirm that lists worn legendary/set pieces. Offer **Sell all for gold before rebirth** (the sale price is server-computed already) so the wipe is not a pure loss.

## 4. Server and save changes

- **Inventory wipe is server-side.** The ledger owns `inv`; make `acceptSave` clear `bag` and `equipment` (keep `lootPity`? proposal: reset, a fresh run starts a fresh pity) when it records `rebirths` rising. The browser cannot skip it: a forged "I did not wipe" upload cannot restore items, because uploads never change `inv`. Protect against a double wipe with the same `run_id` compare-and-swap that already guards a run change. Order of events when the upload is lost: the browser wipes locally at once; the next accepted upload carries the higher `rebirths`; until then the server's bag is the old one and the next inventory answer would put the old gear back on screen, so the client should call a small `POST /api/inventory { action: 'rebirthWipe' }` (idempotent on `rebirths`) from the rebirth action, ahead of the upload. This is the first step of a server-owned `/api/rebirth` ([ROADMAP](ROADMAP.md) item 2).
- **Attributes are client-authoritative today.** `reconcileCharacter(stats, xp)` resets attributes if spent points exceed what the level earned. Extend it with the bonus pool: `maxPoints = totalStatPoints(level) + 20 x rebirths`, where `rebirths` comes from the ledger on the server. That one sum check closes most of the "forge my attributes" hole the fight profile has today ([11](11-server-authority.md)) and needs no new table.
- **Save compatibility.** No schema bump: the pool is derived (`rebirths` already exists), not stored. Existing players have 0 rebirths (all 5 live saves), so nobody is migrated mid-run; the first rebirth after release applies the new rules. A player who rebirthed before the release (none today) would keep their old state and get the bonus from the next rebirth only; say so in the release note rather than backfilling.
- **Tests:** `tests/rebirth.test.ts` (respec returns all points, pool = 20 x rebirths, bag and gear empty, gems/Embers/crafting kept), `tests/serverInventory.test.ts` (the wipe is idempotent, an upload cannot restore items), `tests/repairSave.test.ts` (a save with spent points above the new maximum is repaired, not refused).

## 5. Paragon (after level 100)

You still level past 100: the same lifetime XP keeps counting and each further level is a **paragon level**. This extends the draft in [ROADMAP](ROADMAP.md) ("Paragon levels"):

- The level curve ends at `LEVELING.maxLevel` 100 with anchors up to 1.85e10 XP. Past it the step to the next level grows by a constant factor `paragonGrowth` (proposal 1.06, so a paragon level takes about as long as the late 90s) up to a cap (proposal paragon 1000) well below `XP_CAP` 1e21.
- A paragon level gives **1 paragon point**, spent on a few small, capped, account-wide bonuses (income, XP gain, Luck, offline efficiency, crafting luck). It gives **no attribute points**, so combat and the economy are not fed by an infinite loop. Paragon points are *not* wiped by a rebirth; whether they can be respecced is open.
- **Leaderboard order**: level, then paragon level, then lifetime XP ([15](15-leaderboard-and-world-preview.md)). `player_stats` stores `xp` (or `level` + `paragon`), derived by the server from the save, never from the client.
- Server: the XP model (`cloudSave/xpModel.ts`) already clamps XP; paragon level is a pure function of clamped XP, so the server can always recompute it. Display only until the bonuses are designed.

## 6. Decisions and open questions

**Decided (2026-10-29):**
- On the wipe, **loot pity resets and Pack Rat is kept** (it is a bag-size capacity, not items).
- **Timing: the bag and gear wipe ships with crafting, not before.** Respec and the +20 point pool ship first, on their own.
- **Paragon points buy small, capped, account-wide bonuses** (income, XP gain, Luck, offline efficiency, crafting luck); no attribute points; not wiped on rebirth.
- **Rebirth dialog preview**: it shows the refunded attribute points, the +20 pool, exactly what is wiped, and a confirm that lists worn rare-or-better and set pieces.

**Still open:**
1. Paragon numbers: points per level, the cap of each bonus, respec yes/no, and a paragon cap (proposal 1000).
2. A "sell all for gold before rebirth" button (cheap, softens the wipe even later).
