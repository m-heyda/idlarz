# 12 · Rebirth biomes, distance rules and T2 materials (design draft, nothing built)

Five new biomes, one unlocked per rebirth (1 to 5). Each new tile produces a new tier-2 (T2) material, the merchant trades that material only after the biome has been discovered, and *where* a biome can appear depends on the distance from the castle. The same distance counter later drives monster spawns. Status: **design draft for review**; names, numbers and art are proposals marked *(proposal)*.

Related: [02 mechanics](02-mechanics.md) (current biome rules), [11 server authority](11-server-authority.md), [13 rebirth reset](13-rebirth-reset.md), [17 crafting](17-crafting.md) (what the T2 materials are for), [ROADMAP](ROADMAP.md).

## 1. What exists today (read from the code)

- 7 biomes plus the castle: forest, plains, hills, swamp, tundra, lake, coast (`BIOMES` in `config/gameConfig.ts`). A purchase rolls the biome of the new tile in the browser (`rollBiome`, `utils/biomeRules.ts`) from `BIOME_RULES` (`config/biomeRules.ts`): unlock by purchase count (swamp 6, tundra 10), conflicts, `needsWater`, cluster-copy chance, buddy rule, saddle rule, weights (`BIOME_SPAWN`).
- The player picks the *tile*, the game rolls the *biome*. Tile price depends on the **number of owned tiles, not on distance**.
- The saved map is compact runs of one **letter per biome** (`BIOME_CODES` in `lib/saveFormat.ts`, frozen: `K g f p h s t l c` are taken). `sanitizeSave` accepts any key of `BIOMES`.
- The server reads the saved map to place monsters (`lib/offline/placement.ts`). `castleDistance(spot)` (Chebyshev, `lib/monsters.ts`) is already the shared distance counter; `MonsterDef.spawn` already has `biomes`, `minCastleDistance`, `maxCastleDistance`, `minRebirths`.
- Art: a procedural pixel pipeline in `scripts/pixel/` (`terrain_art.py` palettes and textures, `terrain_logic.py` layer order, `terrain_props.py`, `sprites_animals.py`, `ui_art.py`) with a line-for-line TypeScript port (`utils/terrain.ts`) guarded by a parity test.

## 2. The five biomes

| Unlock | Biome *(name: proposal)* | Basic output | New T2 material | Min distance (base, + the global offset 12) |
|---|---|---|---|---|
| Rebirth 1 | **Jungle** | gold, **hide** | **Hardwood** | 10 |
| Rebirth 2 | **Fields** (wheat, scarecrows, ravens) | gold, **eggs** | **Cloth** (flax) | 14 |
| Rebirth 3 | **Blossom Orchard** *(decided)* | gold, **milk** | **Honey** | 18 |
| Rebirth 4 | **Blight** (slug / blob corruption) | **coal** | **Ichor** *(placeholder name)* | 22 |
| Rebirth 5 | **Battlefield** | **stone**, **wood** | **War Medals** (badges of fallen warriors) | 22 |

Why these distances: a compact map of N tiles has a radius of about `sqrt(N)/2` (300 tiles is about 9; 1000 about 16; 2500 about 25). The 5 players saved today own 158 tiles on median and 339 at most (castle level 4, nobody has rebirthed yet), so 10 is "just beyond a first-run map" and 22 asks for a 2000+ tile run or a deliberate expedition. Calibrate with the sim (section 7) before shipping.

### 2.1 The third biome: decided
**Blossom Orchard.** Fruit trees in rows and wild clumps, bees and hives, cows grazing in clover, petals drifting. Milk fits the cows, Honey is the new T2 material. Bees already exist as ambient critters, so the sprite work is smaller. Rejected: Crystal Downs, Highlands/Moor.

### 2.2 Look and feel (art brief per biome; follow `scripts/pixel/reference/STYLE.md`)
Each biome needs: ground texture (flat plus one deeper "interior" tier like forest/hills), a rim/transition set against every neighbour (the dual-grid pipeline already handles ordering through `RANK`), props, decor (the "flowers" pass), building pads (2 variants), 2-3 ambient critters, a minimap colour, a highlight colour and the material icon(s).

- **Jungle**: darker, bluer green than forest; broad leaves, hanging vines, giant ferns, orchids as decor, a mist overlay on interior tiles; critters: parrot, monkey, a snake that slides rather than hops. Hardwood icon: dark red-brown log with a pale ring.
- **Fields**: patchwork wheat rows in two golds with a dirt path; props: scarecrow (two variants, one leaning), haystack, broken fence, a half-collapsed barn on rare tiles ("not destroyed, not perfect"); decor: poppies, loose straw; critters: ravens perched on scarecrows, field mice. Cloth icon: folded linen bale.
- **Blossom Orchard**: warm green with pink and white blossom dapples; props: apple/cherry trees (3 variants, one in bloom), beehives on stands, flower beds, a fallen-fruit decor pass, drifting petals on interior tiles; critters: bees, butterflies, cows. Honey icon: a dripping amber comb.
- **Blight**: violet-black ground with sickly green slime pools, blobs as props that gently pulse, tendrils at the rim; critters: tiny slimes. Ichor icon: a drop of viscous green-purple. Uses the existing "lake bog" tint technique for its shores.
- **Battlefield**: churned brown mud and ash grass, broken weapons, banners, bone piles, trampled fences, scorch marks; critters: crows. War Medals icon: tarnished round badge on a torn ribbon.

Pipeline touch list per biome: `terrain_art.py` (`PAL`, `tex_*`, `_WOBBLE`), `terrain_logic.py` (`RANK`, `MAX_DEPTH`, `LAND`, `FOUNDATION_ORDER`), `terrain_props.py`, `terrain_build.py` (manifest), `terrainAtlas.json` (generated), `utils/terrain.ts` (the port; parity test fails if the two drift), `biomePalette.ts`, `AMBIENT_LIFE.byBiome` plus `sprites_animals.py`, `pixelIcons.ts`, `sprites_resources.py`. Estimate: M per biome for art, S for config. Total about 2-3 weeks of art for all five; they can ship one at a time, since each is unlocked by a different rebirth.

## 3. Rules: unlock and distance

New fields in `BIOME_RULES` (names *proposal*):

```ts
unlockAfterRebirths: { jungle: 1, fields: 2, orchard: 3, blight: 4, battlefield: 5 },
minCastleDistance:   { jungle: 10, fields: 14, orchard: 18, blight: 22, battlefield: 22 },
conflicts: [ ...existing, ['blight','lake'], ['blight','coast'], ['blight','orchard'], ['battlefield','swamp'], ['jungle','tundra'] ],   // decided
distanceWeights: {            // how the roll changes with Chebyshev distance d from the castle
  basicFadeFrom: 10, basicFadeTo: 30, basicFloor: 0.25,   // basic biome weight x1 up to 10, down to x0.25 at 30+
  newMaxWeight: 3, rampTiles: 8,                           // a new biome goes from 0 at its min distance to x3 over 8 tiles
}
```

- `biomeVerdicts(tiles, x, y, purchased)` gains the context `{ rebirths, distance }`; a locked or too-near biome is "not allowed" (reason shown in the tile tooltip: "Unlocks after rebirth 2", "Only 14+ tiles from the castle"). That also stops a neighbour's cluster copy from pulling a new biome inside its minimum distance.
- Beyond the minimum the weights favour the new biomes, so at 30+ tiles out most rolls are new biomes, with the occasional basic one for variety. The cluster-copy rule (45-65 %) still builds patches, so you see regions, not confetti.
- One shared helper: `castleDistance` moves to a small `lib/distance.ts` used by biome rolls, monster spawns, chest placement and the danger bonus. Named **bands** live in one config (`DISTANCE_BANDS`: e.g. home 1-6, outskirts 7-12, frontier 13-21, wilds 22+), so biome and monster rules read the same vocabulary and later tweaks are one-line edits.

### 3.1 Weak point to decide: the tile price ignores distance
A player can buy a straight line of tiles outward (about 10 tiles for the jungle, about 22 for the late biomes), so the distance gate costs a few tiles, not a long run. The rebirth unlock is the real gate; the distance only shapes where the biomes appear. If you want the late biomes to be a real late-game reward, options: (a) accept it (exploration is cheap, but you must then still pay for the tiles beside the new biome); (b) add a **frontier toll**: tile price x `(1 + 0.03 x max(0, d - 12))`; (c) require that new biomes only roll when the tile has at least 2 owned neighbours (stops one-tile tunnels). **Decided: (c)** plus the global distance offset (section 9); (b) only if beelining shows up in the sim.

## 4. T2 materials and the merchant

- New tier `t2` in `catalog/resources.ts` (`RESOURCE_TIERS`), new keys `hardwood`, `cloth`, `honey`, `ichor`, `medals` *(proposal)*, drawn as one more boxed header group, **hidden until discovered**.
- **Discovered** means "this account has owned at least one tile of that biome". Stored as a small optional list in the save core (`discovered: string[]`), checked by the server against the map on upload (a biome letter present in the land makes it legal). It survives rebirth (decision: yes, since the Guide and the merchant stay unlocked; *confirm*).
- Merchant: sells and buys a T2 material only when discovered (UI and the store action; the server prices it once the merchant moves to the server, [ROADMAP](ROADMAP.md) item 4). Ichor and War Medals are crafting-only and **not sold** *(proposal)*; hardwood, cloth and honey sell above hide's price (hide 2): about 4, 4, 5 *(proposal)*.
- Production: each new-biome tile adds the T2 rate (**decided: 0.1/s, a third of a T0 tile's 0.3/s**) plus the basic outputs in the table. The adjacency bonus applies as for other biomes.
- Rules from the roadmap's T2 checklist apply: key lists to touch together are `Resources`, `INITIAL_RESOURCES`, `BASE_GENERATION_RATES`, `CASTLE_BASE_RATES`, `zeroResources`, `sanitizeSave` `OPTIONAL_RESOURCES`, `offline/grant.ts`, `offline/ledger.ts` `zeroTotals`; at least two sources and one sink on day one (sources: tile, later kill drops; sinks: crafting, [17](17-crafting.md), plus the merchant); a "minutes to cover" line in the sim. Decide whether chests and offline income include T2 (`LIMITS`, `CHEST.bundle`): proposal, offline yes at the normal efficiency, chests no.
- T2 materials reset on rebirth (as the roadmap proposed), except what the Ember shop later buys back.

## 5. Monsters per biome and the distance rule (placeholders)

> The reward model (absolute caps multiplied by level, goods drops, tiered items, spawn pressure and relevance fade) and the families template are in [20](20-monster-families-and-rewards.md).

Today: rat (and the Rat King) on `LAND_BIOMES`, distance 2-9 (`MONSTERS` in `config/combatConfig.ts`). Change: **rats 2-6** (weak monsters only near the castle; your "5-6 at most"), and the freed bands are for new families. `canSpawnOn` already does this; the change is data plus the shared `DISTANCE_BANDS`. Existing monsters standing beyond the new maximum are put on a new tile by the next `placeTickets` pass (`settle`), so no migration is needed. This also closes roadmap item R7 (the danger bonus was 0 or 1 because of the 9-tile cap): the danger offset becomes a per-band value.

Each biome gets **3-4 monsters and one boss** (names are placeholders; ideas in brackets are suggestions to confirm):

| Biome | Monsters (3-4) | Boss |
|---|---|---|
| Home land (plains, forest, hills, swamp, tundra) | Rat; *later* wolf (forest), bog thing (swamp), frost hare (tundra) | Rat King |
| Jungle | M1, M2, M3, M4 *(jaguar, giant spider, viper, poison toad)* | B-jungle |
| Fields | M1, M2, M3 *(crow flock, scarecrow, field boar)* | B-fields |
| Blossom Orchard | M1, M2, M3 *(hornet swarm, bear, thorn dryad)* | B-orchard |
| Blight | M1, M2, M3, M4 *(slime, blob swarm, tendril, husk)* | B-blight |
| Battlefield | M1, M2, M3, M4 *(skeleton soldier, deserter, siege remnant, war hound)* | B-battlefield |

**Prerequisite hidden in the server:** the ticket bank is hard-wired to rats and one king (`TicketBank.rats` / `king`, `typeOf` in `placement.ts`, `MonsterType` unions). More families need a generic ticket list `{n, type, at, x, y, spawnLevel}` plus a spawn timer per family or biome. That is the real cost of the monster work (size M-L, including a `player_ledger.bank` shape change that `upgradeBank` must read from old rows). It is **not** needed for the biome core, so monsters are the last phase.

## 6. Server and save compatibility

- **No SQL migration.** The map is jsonb runs of letters; biome rules live in code. New letters are additive: proposal `j` jungle, `d` fields, `o` orchard, `b` blight, `w` battlefield (frozen once shipped; add them to `BIOME_CODES`, a test checks every biome has one). `SAVE_SCHEMA` (6 on all 5 live saves) does **not** need a bump: new resource keys are optional (`OPTIONAL_RESOURCES`), `discovered` is optional, old saves have none of them. Add a fixture test: load every file in `tests/fixtures/saves/` after the change.
- **Anti-cheat on the map** (the biome roll is in the browser, tile buying stays client-side, see ROADMAP): add two cheap checks to `cloudSave/verify.ts` (shadow flags first, enforcing later together with `verify.ts` item 1): `biome_locked` (a tile whose biome needs more rebirths than the ledger's `rebirths`) and `biome_too_near` (a gated biome closer than its minimum). Both are O(tiles) over data the server already reads on upload.
- Rates/offline: the server derives `summary.rates` from the saved map, so T2 income flows into offline grants and `netWorth.ts` once the keys are added; `netWorth` must price T2 (or ignore it explicitly).
- `placement.ts` already reads the biome from the map, so a monster allowlist that names a new biome works without server code beyond the generic ticket list above.

## 7. Dev tools and testing

- Dev panel (`GameDebug`): set rebirths, **unlock all biomes**, "grow N tiles outward" (extends `utils/growWorld.ts`, which already builds seeded worlds with `rollBiome`), paint a biome patch, teleport the camera. The unlock override is a parameter of the rule context, not a hack in the rules, and works only in dev builds; saves from a non-production server are already marked `test_account` and never ranked.
- Tests: `tests/biomeSpawn.test.ts` gains distance and rebirth cases; a distribution test (1000 rolls at distance 12, 20, 35: new-biome share rises, basic never reaches 0); a no-regression test that with `rebirths = 0` the roll is identical to today's for the same seed (so existing saves and sim baselines do not move).
- `npm run sim`: add a rebirth-aware expansion pattern so the sim can say how far a `human-rebirth6` run reaches by rebirth 5 (the real calibration of the minimum distances).

## 8. Game Guide and rollout

Update the in-game Guide (`overlays/Tutorial.tsx`): a **Biomes** page (what each does, when it unlocks, how far out it appears, its materials) and a line in the Rebirth dialog ("Rebirth 2 unlocks Fields"). The Guide is reworked into a guided tutorial that unlocks entries when a biome is discovered ([21](21-classes-avatars-achievements-offline-report.md) section 7); keep the biome text as data in `catalog/` so that rework reuses it.

Phases (each shippable): **P0** rules, config and dev tools with placeholder colours; **P1** art, one biome per release; **P2** T2 resources, merchant gating, `discovered`; **P3** server flags in `verify.ts`; **P4** Guide and Rebirth dialog text; **P5** distance bands, rats 2-6 and the generic ticket list; **P6** monster families and bosses.

## 9. Decisions and open questions

**Decided (2026-10-29):**
- Third biome: Blossom Orchard (milk + Honey).
- Distances stay as in section 3 **plus one global offset constant** `BIOME_DISTANCE_OFFSET` (proposal +12) added to every biome minimum, so the biomes sit far out for players but stay testable: the dev panel's "unlock all" ignores it. Lower it when the art and balance are ready.
- Beelining: a new (gated) biome only rolls on a tile with **at least 2 owned neighbours** (4-neighbourhood), which stops one-tile tunnels outward. Watch the sim; the distance toll stays an option.
- Ichor and War Medals are crafting-only (not sold). Hardwood, Cloth and Honey were to be tradable once discovered, **but that was overridden (decided): the merchant trades T0-T1 only, so no T2 material is sold ([18](18-biome-buildings-and-material-tiers.md)).** Section 4's merchant bullet is void; "discovered" now only unlocks the header slot and the Guide entry.
- Discovery is permanent across rebirth (header slot, Guide entry); only the stock resets. **The map and its biomes reset on every rebirth, always** (a new map is rolled; only `discovered` and the Idol levels of [18](18-biome-buildings-and-material-tiers.md) persist).
- The castle's area bonus (radius up to 4) can never reach these biomes (they start 10+ tiles out); see [18](18-biome-buildings-and-material-tiers.md) rule 7.

**Decided in the detail round (2026-10-29):**
- **Global distance offset +12.** Effective minimums: Jungle 22, Fields 26, Orchard 30, Blight 34, Battlefield 34 (the table above lists the base values). The biggest live map today is 339 tiles (radius about 9), so these are reachable only by 800+ tile maps or a deliberate expedition and are tested with the dev tools until art and balance land. The frontier bonus of [18](18-biome-buildings-and-material-tiers.md) counts the real distance from the castle, not the offset.
- **Conflicts** (no biome may touch another in its 8-neighbourhood): the existing tundra/swamp, tundra/coast, hills/coast, plus **blight x lake, blight x coast, blight x orchard, battlefield x swamp, jungle x tundra**. Fields and orchard are mild neighbours of most land.
- **T2 production 0.1/s per tile** (a third of T0).

**Still open:**
1. When to remove or lower the offset; the base minimums (10/14/18/22/22) calibrate with the sim once expedition play exists.
2. The basic-output rates of each new biome (gold, hide, eggs, milk, coal, stone, wood) next to the T2 rate: set with the sim and the "minutes to cover" check.
3. Which neighbouring biomes make a good natural *transition* for each new biome (a coast-like beach for the jungle, a farm fringe for fields) for the art, not the rules.
