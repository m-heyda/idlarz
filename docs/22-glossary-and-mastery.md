# 22 · Glossary, unknown monsters and mastery (design draft, nothing built)

The glossary is a discovery game inside the game. **Every monster starts unknown**: a black shape on the map with no HP and no level. Fighting it for the first time unlocks it; every 100 kills reveal more of it; milestones of kills and of mined resources pay permanent rewards. That gives the glossary a purpose beyond reading ([21](21-classes-avatars-achievements-offline-report.md) sections 3-4 hold the achievement and counter side).

## 1. What exists
- Monsters are server tickets drawn on the map; `lucky` ones (decided by the server) are drawn with a golden tint through a CSS flag (`data-lucky`, `components/game/MonsterSprite.tsx`, `styles/Monsters.css`). The unknown state works the same way: a flag decided by the server, a different look in CSS.
- The browser currently learns each monster's `type` and `level` from the spawn/fight answers (`lib/offline/online.ts`, `publicTickets`) and draws its HP in the combat widget.
- There is no bestiary and no per-type kill count today (ROADMAP "bestiary with kill counts"). The new lifetime counters (`player_ledger.stats`, [21](21-classes-avatars-achievements-offline-report.md) section 3) provide it.

## 2. Unknown monsters (the spawn side)
- For a new player (and after the class-release reset, for everyone) **no monster type is known**. A ticket whose type the player has not seen is sent to the browser as `{ n, x, y, unknown: true, sprite }` **without its name, level or HP**, and is drawn as the **real sprite in solid black** (decided; `data-unknown`, a brightness-0 filter on the real sprite, so its shape is visible), with no level badge, no HP and no name. `sprite` is only the art key. This is a **game-feel feature, not a secret**: the catalogs (names, stats) are in the client bundle by design ([14](14-server-audit-and-data-plan.md) section 4), so a determined player can look them up; what is hidden is what the game *shows* and what the server tells the UI about a specific ticket (level and HP).
- **The server decides what is known**: `stats.seen` (the set of monster types fought at least once) lives in the ledger. A click to fight, or auto-battle engaging the monster, **opens the fight, adds the type to `seen`**, and the answer from then on carries the real type, level and HP. Every later monster of that type is drawn normally on the map.
- Rewards and danger are the same as for any monster; unknown only hides information. Auto-battle's win chance is computed on the server from the real stats, so it still skips fights it expects to lose (the player just does not see why until the type is known).
- New biomes get a discovery moment for free: the first black shape in a new biome ([12](12-rebirth-biomes.md)) is a mystery to click. Bosses follow the same rule (a black, larger silhouette).
- The first fight of the **initial tutorial** ([21](21-classes-avatars-achievements-offline-report.md) section 7) unlocks the rat on purpose.

## 3. The glossary (the reading side)
A Glossary overlay (header menu) with tabs: **Monsters, Resources, Biomes, Items, Buildings and Idols**, all generated from the catalogs (a new monster, resource or item appears without a hand-written page). Unknown entries show as black silhouettes with "???" and a hint of how to unlock them.

**Monsters** reveal in layers, per monster type, from `stats.kills[type]`:

| Kills | What the glossary shows (proposal) |
|---|---|
| first fight | unlocked: name, picture, biome(s) it lives in |
| every 100 kills (decided) | one new layer: **100 stats** (HP, attack, armor, crit, speed), **200 drops** (the loot table and rates), **300 rewards** (gold, XP, goods by level), **400 lore** and for bosses the taunts |
| 500 | **mastery** (below) |

**Resources** reveal from the lifetime counters of that resource (`stats.earned[resource]`): the entry is unlocked when the resource is first owned; **1 million** earned reveals its details (what it is for, where it comes from, all sinks); **1 trillion** is a mastery step.

**Biomes, items, buildings and Idols** follow `discovered` and what has been owned/built; items show their stat ranges after being found.

## 4. Mastery: permanent rewards that give the glossary a point
- **Monster mastery (decided):** at **500 kills** of a monster type, that type pays **+10 % XP and +5 % loot chance**; the same step repeats at **1,000, 2,500 and 5,000 kills**, up to **+50 % (XP) per type** in total (and the matching loot-chance cap). Account-wide and permanent.
- **Resource mastery (decided):** at **1 million** of a resource earned the glossary entry fully unlocks; at **1 trillion** earned the player gets **+25 % income of that resource, permanently** (that resource only, not total income). Further ladders (1 quadrillion ...) later, with a cap per resource.
- Both are **account-level and persist across rebirth** (lifetime counters), so they are long-term goals like Idols, with the same rule: they go through the soft-cap machinery (`limitOf` / `HARD_LIMITS`, [18](18-biome-buildings-and-material-tiers.md) section 6) and are tested in the sim against the Ember income bonus so they cannot out-scale it.
- Because the counters live in the ledger and the rewards are computed on the server (`payKill` for monster mastery, `summarize()` rates for resource mastery), an edited save cannot grant them. Kill counts are exact server events. Resource counters add the **verified** gain of each accepted save (bounded by income x time + granted), so a forged jump does not move a ladder.

## 5. Server and data
- `player_ledger.stats jsonb` (migration `stats_ledger.sql`, additive nullable, lazy-seeded; see [14](14-server-audit-and-data-plan.md)): `{ kills: { type: n }, seen: [type...], earned: { resource: n }, goldEarned, tilesPlaced, chestsOpened, crafted, ... }`. About 20-60 small numbers; with 3 players today (and the free plan in mind) it is a few hundred bytes.
- `publicTickets` and the fight answers hide the name, `level` and HP for unknown types (they carry only the sprite key); `GET /api/glossary` is **not needed**: the glossary reads the catalogs in the client plus one `stats` object that the existing answers carry only when its version changed (the `invVer` pattern: `statsVer`).
- `payKill` (`lib/offline/reward.ts`) increments `kills[type]`, applies the monster-mastery bonus, and adds the type to `seen`; the fight engine adds `seen` when a fight opens.
- Saves: no save field. The glossary and the silhouettes depend only on the ledger, so a local edit cannot reveal anything (it can only change the client's own display).
- `repairSave`/`sanitizeSave`: nothing to do.

## 6. Art and UI
- **The real sprite in black** (decided): one CSS rule (`filter: brightness(0)`) on the existing monster art, a "?" mark instead of the level badge; a lucky unknown keeps a faint golden outline so it is still worth the walk. No new monster art is needed, which also holds for every future family.
- Glossary cards (known, locked, in-progress with a bar "37 / 100 kills to stats"), a mastery badge, tab icons; resources use the existing icons.
- The guided tutorial links into glossary entries; the Guide journal and the glossary share the same catalog data ([21](21-classes-avatars-achievements-offline-report.md) section 7).

## 7. Impact checks
- **Power creep:** mastery bonuses are permanent and account-wide, so they are capped per type and per resource as decided above. The resource +25 % at 1 trillion is large next to the Ember income (+6 % per Ember ever earned) but contained to one resource each; add a sim line with many resources mastered and with all monster types at 5,000 kills.
- **Free plan:** one small jsonb column and no new calls; the client does not poll the glossary.
- **Early game:** all monsters unknown at first is a mild information loss (no HP, no level). The first fights must stay easy to start (a click fights anything); auto-battle keeps skipping dangerous ones.

## 8. Decisions and open questions

**Decided (2026-10-29):**
- Unknown monsters are the **real sprite in black** (no name, level or HP); the first fight unlocks the type; the hiding is cosmetic, not a security measure.
- Every 100 kills reveals a layer: stats (100), drops (200), rewards (300), lore (400); mastery from 500.
- Monster mastery: +10 % XP and +5 % loot chance at 500, repeating at 1,000 / 2,500 / 5,000 up to +50 % per type.
- Resource mastery: 1 million earned unlocks the full glossary entry; 1 trillion gives +25 % income of that resource permanently.

**Still open:**
1. The exact loot-chance cap per type and what a "loot chance" bonus means for guaranteed drops (bosses) and pity.
2. The resource ladder above 1 trillion (1 quadrillion ...), its reward and the per-resource cap.
3. What the glossary shows for Items, Buildings and Idols at each layer, and the tab order.
4. Whether unknown monsters also hide the `lucky` golden state (proposal: no, a faint golden outline stays).
