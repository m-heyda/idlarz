# Release plan: what is left on the way to the rebirth world

Status: **cleaned on 2026-11-19 against the code, the closed Linear tickets and the git history: everything that is built was removed.** What is built is described by the JSDoc in the code (`grep -rn "@category" src scripts`) and, per version, in `content/changelog/`. Linear (team IDL, projects R0-R12) is the truth for status; this file keeps the **order and the product brief** of what is still open. The phase numbers (P3, P11 ...) and gem slices (G1-G5) stay as names other documents point to. Drafts [12](12-rebirth-biomes.md)-[22](22-glossary-and-mastery.md) and [26](26-next-updates-plan.md) hold the detail; [ROADMAP](ROADMAP.md) holds the long lists.

Legend: **S** half a day, **M** 1-2 days, **L** about a week. 🎨 = needs art. 🧱 = ships with a placeholder asset first. Every step is its own pull request to `m-heyda/idlarz` and must leave `tsc`, `lint`, `npm test` and the pacing guard green. The game is desktop only (screens 1240 px and wider); mobile and phone layouts are dropped.

## Already shipped (not repeated below)

P0 foundation, **P1 front door** (landing, `/play`, offline bar, password reset), **P2 New chapter** (the one reset, `GAME_EPOCH` 2, classes, avatars, achievements, tutorial, gem shop, early testers), the monster engine (generic ticket bank, placeholder art mechanism, reward model, monster roster v2), monster discovery and the **Bestiary** with its mastery tiers and claims, the **Hall of Deeds** (grind ladders included), the home-biome buildings with levels, one shared builder queue, **Idols and Extractors with T3 materials**, the Ember-shop caps (Idol Mastery, building and castle caps, Extra Builder, build-time cuts), live biomes at rebirth 1-5 (the unlock rule and a stand-in roster), the server-run rebirth with its preview and result, server-held attribute points with paid respec, crafting v0 (recipes G1-G4, odds panel, queue, XP), rankings and `verify.ts` enforcement, the Playwright smoke test, the farm and castle rework, rocks and ores, the UI revamp onto the design system. Gem slice **G1** (spend engine, class and name change, respec, cosmetics, daily bonus, Builder #2) is shipped too.

## 1. Rules every step follows

1. **Additive saves only**: optional fields, new ids appended, nullable ledger columns; no `SAVE_SCHEMA` bump unless an upgrade step and a fixture come with it ([save-compatibility](save-compatibility.md)).
2. **SQL before code**: apply a migration on the project first (rehearse it on a Supabase branch), then deploy the code that reads it.
3. **Run `npm run check-live-saves`** against the real rows before every release that touches save or ledger rules.
4. **Dark first, switch later**: server code and data shapes ship before the UI or the content that uses them, behind a constant, so the release moment is a one-line change.
5. **Placeholder art never blocks mechanics**: new content ships with the nearest existing sprite (🧱); real art replaces it later without a code change (the sprite is a catalog key).
6. **Sim and docs travel with the change**: the pacing sims, the JSDoc block of any rule you change, and a changelog line when players can see it.
7. One small behaviour change per release where possible, so a bad number is easy to attribute and roll back.

## 2. What is left, in order

| Phase | Release name | Player sees | Size | Art |
|---|---|---|---|---|
| **P3** | Monster engine, finish | monsters spawn by distance band, outgrown families fade out | M | none |
| **P4** | Glossary and mastery, finish | glossary for resources, biomes, items, buildings; resource mastery | M | none |
| **P5** | Biome engine, finish | nothing (rules and checks) | M | none |
| **P6** | Buildings, finish | position bonus; real building art | M + L (art) | 🎨 |
| **P7** | Rebirth respec, finish | +20 attribute points per rebirth | S | none |
| **P8** | Jungle (rebirth 1) | the first new biome with its own material, buildings, art | L | 🎨 |
| **P9** | Rankings, finish | paragon level display, preview of another player's map | M | small |
| **P10** | Fields + Orchard (rebirth 2, 3) | two biomes with their buildings and extracts; art | L | 🎨 |
| **P11** | Crafting, finish | enchanted craft button, then the rest of crafting v1 | S then L | small |
| **P12** | Blight + Battlefield (rebirth 4, 5) | the two **special** biomes, Ichor, War Medals, bosses | L | 🎨 fancy |
| **P13** | **MVP: landing v2** | new landing with all biomes; public-release checklist | M | 🎨 |

Gem slices G2-G5 and the parked ideas are at the end.

## 3. The phases

### P3 · Monster engine: finish

| Step | What | Size |
|---|---|---|
| 3.4 | **Spawn tables per distance band and relevance fade** (outgrown families rarer, floor 0.1, never gone); per-band danger offset (closes R7). IDL-215 already built the first slice: the type pick is weighted by the hero's win chance and new spawns and their growth are capped near what the hero beats (`offline/spawnWeights.ts`); 3.4 replaces the window-midpoint estimate with per-band weights and keeps the floor. IDL-53 | M |

### P4 · Glossary and mastery: finish

The monster half is built as the Bestiary (kill tiers 10 / 100 / 500 / 2,500, boss tiers 1 / 5 / 25 / 100, structured bonuses, biome goals, claims). What is left:

| Step | What | Size |
|---|---|---|
| 4.2 | **Glossary overlay for the rest**: resources, biomes, items, buildings, generated from the catalogs; `statsVer` pattern, no new endpoint. IDL-83 | M |
| 4.3 | **Resource mastery**: 1 million unlocks, 1 trillion +25 % income of that resource, computed on the server, sim line against the Ember bonus. IDL-84 (its monster half is superseded by the Bestiary) | M |

Clarify: the ladder above 1 trillion.

### P5 · Biome engine: finish

| Step | What | Size |
|---|---|---|
| 5.2 | `discovered: string[]` optional in the save core, with a legal-by-map server check; discovery survives rebirth (the five biome letters `j d o b w` exist and are frozen). Critical path of P8. IDL-87 | S |
| 5.4 | `verify.ts` shadow flags `biome_locked` and `biome_too_near`. IDL-89 | S |
| 5.5 | Sim: rebirth-aware expansion pattern to calibrate the minimum distances and the +12 offset. IDL-90 | M |

### P6 · Buildings: finish

| Step | What | Size |
|---|---|---|
| 6.5 | **Position bonus** `positionBonus(distance, castleLevel)` (castle area bonus on every building in range, frontier bonus beyond), folded into `buildingEconomy(world)` so offline grants, `verify.ts` and `netWorth.ts` agree. IDL-95 | M |
| 6.9 | 🎨 Real building sprites: 21 for the home biomes, 2 looks each (levels 1-2 and 3-5, glow on level 5), replace the old sprites. IDL-99, IDL-245 | L (art) |

Open numbers: whether the frontier bonus counts the +12 offset; the combined build-time cut stays at 60 % (see [18](18-biome-buildings-and-material-tiers.md) and [perk-caps](perk-caps.md)).

### P7 · Rebirth respec: finish

| Step | What | Size |
|---|---|---|
| 7.1 | **+20 attribute points per rebirth** (`totalStatPoints(level) + 20 x rebirths`); today there are none per rebirth. IDL-100 | S |
| 7.2 | Server sum check: `reconcileCharacter` gets the `20 x rebirths` term; a save above the maximum is clamped, not refused. IDL-101 | S |

### P8 · Jungle (rebirth 1)

The unlock rule, the roster (placeholder art) and the intro screen are live; Jungle is still data and art. The pattern for every biome release: **rules exist, so a biome release is art + catalog data + its three buildings + Guide text.**

| Step | What |
|---|---|
| 8.1 🎨 | Biome art: ground, deep tier, rim against every neighbour, props, decor, building pads, ambient critters, minimap and highlight colour (IDL-106) |
| 8.2 | Built in 0.9.0: the Jungle's Producer and Extractor (Canopy Camp, Venom Press) with the Venom extract. The planned T2 material Hardwood is dropped (decided 2026-11-24, IDL-107 closed): the extracts replace the T2 tier. |
| 8.3 | Jungle Logging Camp, Serpent Pit (Venom), Totem of the Wild 🎨 (placeholders first) |
| 8.4 | Guide and glossary entries for the biome and its monsters |

### P9 · Rankings: finish

| Step | What | Size |
|---|---|---|
| 9.2 | **Paragon display only**: level past 100 derived from clamped XP; no bonuses yet. IDL-114 | S |
| 9.3 | Preview map: `GET /api/world/<token>` returns `land` only, rate-limited, a separate `previewStore` with **no path to the save**; banner and close button. IDL-115 | M |

Paragon **bonuses** (points to spend) wait for their own design after P9 (IDL-104, IDL-186, IDL-187).

### P10 · Fields and Blossom Orchard (rebirth 2 and 3)

Same pattern as P8, twice: art 🎨 and Guide entries. Built in 0.9.0: the Producer and Extractor of both biomes (Windmill Farmstead and Dye Works, Blossom Yard and Royal Apiary) with the Dye and Royal Jelly extracts; Cloth and Honey as T2 materials are dropped (decided 2026-11-24, IDL-109 closed), and crafting makes Cloth Bolts from wool. The mild, pastoral biomes, closest to the current look, so the cheapest art. IDL-108, IDL-109.

### P11 · Crafting: finish

Crafting v0 is built (recipes G1-G4, odds panel, queue, XP, sealed rolls, pity) and a rebirth wipes bag and gear.

| Step | What | Size |
|---|---|---|
| 11.5 | Enchanted craft button present but disabled ("Needs Ichor from the Blight"); the feature itself waits for P12. IDL-120 | S |
| 11.x | Crafting v1: G5-G9 recipes with T2/T3 materials, item classes, workbench upgrades. IDL-152, IDL-226, IDL-235 | L |

### P12 · Blight and Battlefield (the two special biomes)

The same release pattern, with a deliberately **richer look**: the last two, unlocked at rebirth 4 and 5, they should feel like a reward for the whole journey while still reading as the same map (same tile size, outline rules and palette discipline). Extra animated layer (pulsing slime pools, drifting embers and ash, flapping banners), a deeper interior tier with its own props, two building pad variants, a fuller rim set, building sprites with a glow from level 3.

| Step | What |
|---|---|
| 12.1 🎨 | Blight: violet-black ground, slime pools, pulsing blob props, tendril rims; **Ichor** (crafting only); Tar Pit, Ooze Vat (Corrupted Core), Maw Idol |
| 12.2 🎨 | Battlefield: churned mud and ash, banners, bone piles, broken weapons, scorch marks; **War Medals** (crafting only); Siege Works, Salvage Yard (Scrap Steel), War Memorial |
| 12.3 | Bosses with their own timers and distances; **T4 relics** from bosses (they survive rebirth). IDL-111 |
| 12.4 | Enchanted craft unlocked (needs Ichor), legendary tier gated on War Medals |
| 12.5 | `verify.ts` and `netWorth.ts` price T2 and relics; Guide and glossary entries |

Linear: IDL-110. The Lava biome after Battlefield is IDL-371.

### P13 · MVP: landing v2 and public readiness

| Step | What |
|---|---|
| 13.1 🎨 | Landing v2: all twelve biomes and the new buildings in view, a new Open Graph image. IDL-122. Landing v1 and its refresh are built; the baked-strip tooling was removed, so v2 is a new background image plus a copy edit, with no change to the route or the login flow |
| 13.3 | Framework upgrades one at a time (Next 16, TypeScript 7, ESLint 10, `@types/node` 26). IDL-125 |
| 13.4 | Public checklist: email confirmation on (IDL-65), rotated secrets, rate limits, free-plan load check, the real flagged saves reviewed (IDL-208). IDL-126 |
| 13.5 | Drop `BIOME_DISTANCE_OFFSET` to the calibrated value if the 5.5 sim says so. IDL-127 |

### Gem track (G2-G5): the remaining gem sinks ride on the phases above

G1 is shipped. Full design, prices and tasks: [30](30-gem-sinks.md). Every spend is a server operation on the ledger, idempotent by claim id; gems never buy permanent combat power.

| Slice | Ships with | What the player gets | Linear | Size |
|---|---|---|---|---|
| **G2** | any time | bigger bag (+4 slots, max 3), longer battle queue, longer away time, auto-sell slots; Hourglass, Chest Beacon and timed boosts (Builder #2 is built) | IDL-191, 234, 192, 193 | M |
| **G3** | before P10 | **Cap Breaks**: +1 max level (at most 3) on merchant economy ladders, then farm and Ember shop. Decided: economy only, counted in rankings, gate `rebirths >= 2`; waits for the gem sim IDL-229 | IDL-231, 232 | M-L |
| **G4** | after P11 | re-roll one affix of a piece of gear for gems | IDL-236 | M |
| **G5** | with P9 | patron titles on the board, the Monument (castle and name effects are built) | IDL-237, 184 | S-M |

Why these slots: G3 needs the server-run rebirth to enforce "kept through a rebirth" (built) and a ledger `rebirths` count for its gate; G4 needs the crafting sealed-roll hooks (built); G5 needs the rankings board to show titles.

### Not in this plan (parked, see the ROADMAP lists)

Item upgrading (replaced by crafting's enchant), the Quests and Gambling merchant tabs, ambient weather, zoom 0.5, market saturation, caravans, second Ember currency, gem sockets, skill tree.

## 4. Art still to make

Placeholders are catalog keys, so art swaps in without a code change. New pictures are made in Sprite Fusion (see `CLAUDE.md`).

| Asset group | Placeholder until real art |
|---|---|
| Buildings: 3 per biome, 36 in all (21 home biomes, 15 new), 2 looks each | the old sprites |
| New biomes: Jungle, Fields, Orchard, Blight, Battlefield (ground, rim, props, decor, pads, critters, minimap colour) | flat-colour dev palettes |
| Icons: Ichor, War Medals and the T4 relics (Hardwood, Cloth and Honey are dropped) | tinted existing icons, a generic crate |
| Monsters: the 20 stand-in monsters of roster v2 and the later biomes | stand-in pictures (IDL-373) |
| Equipment pass 3: the starter families, chest, shoulders, gloves, capes, charms, tomes and the three special sets | the old `item_*` icons; the old icons and gear scripts go when the pass ends (IDL-218, IDL-33 to IDL-36, IDL-41) |
| Landing v2 | the current landing image |

## 5. Risks still live

| Risk | Where it bites | Mitigation |
|---|---|---|
| Preview map overwriting the viewer's own save | P9.3 | a separate `previewStore`, cloud sync blocked, a dedicated test |
| Build-time bonuses stack past the run-2 target | P6, gem time savers | the combined cut cap of 60 % (IDL-145), sim check |
| Placeholder art mistaken for final | P8, P10, P12 | placeholders are catalog keys listed in section 4, swapped per phase |
| Cap Breaks make gems feel pay-to-win once gems are sold; an old save refused after the level clamp widens | G3 | economy ladders only; clamp to `maxLevel + 3`, never lower; sim budget under 5 % income ([30](30-gem-sinks.md) section 4) |
| Players rebirth before a biome's art and data ship | P8, P10, P12 | the unlock is count-based, so they get the biome later without loss |
| A new biome roll drifts the sim baselines | P8, P10, P12 | the `rebirths = 0` identical-roll regression test stays green |
