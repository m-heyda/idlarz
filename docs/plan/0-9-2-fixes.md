# 0.9.2 fixes: what is left after the 0.9.2 release

Written 2026-11-25 after PR #296 (staging to main, release 0.9.2). Hand-written plan, like the other files here: it lists what is **not built**. Linear holds the tickets; this is the order to take them in, quickest first. It replaces `next-pr-after-0-9-2.md` (the PR #295 list). When a batch is done, delete its section. Nothing here is a player-visible change until its PR says so (changelog rule: `content/changelog/`).

## Batch 0: checks in the game (owner, no code)

Nothing of PR #295 was seen with a login. Walk through with a real account; any bug found goes to the top of Batch 1.

- Bag: double-click and right-click **Open** on a monster chest (2 % per normal kill, every boss, every golden monster; or give one by hand), the notice text, Sell everything skipping chests.
- Item cards: the gold **Legendary perk** block, `Tier II - Item Level ...`, the new stat rows (Armor penetration, Thorns, Heal on kill, Boss timer) in the Stats tab, a ring with the Swift / of Haste affix.
- Tile and building tooltips: "Biome bonus" with milestones, the "Biome milestones" line of the income tooltip, Build Speed and Tile Discount on G4+ gear, a boss fight with Boss Timer gear.
- Rebirth: the +20 attribute points arrive free to spend after a real rebirth; respec gives them back.
- Gem shop: Name colours and Overnight Orders at 750.
- Start hub and castle compass buttons, `/reset` from a real emailed link (recovery cookie, IDL-384).

Owner and dashboard work (no code): Supabase Confirm email, SMTP and redirect URLs, and `supabase/migrations/player_class_open.sql` on a branch first (required before a fifth hero class, IDL-280); Vercel `LOOT_SECRET` per deployment, optional firewall rate rules, the free-plan load check (IDL-126); the two enforcement switches (`ENFORCEMENT`, `EMBER_MODEL.requireServerRebirth`, IDL-208, IDL-211) after `restore-trust` and `check-live-saves`; a raised `GAME_EPOCH` (IDL-300) only when a later chapter is wanted.

## Batch 1: quick wins (one PR, about a day; text, display, small pure code, measurement)

| Item | Where | Why quick |
|---|---|---|
| IDL-174 the "Base: +25 % gold" line in the stat panel and the tutorial wording | `src/components/game/hero/HeroStats.tsx`, `src/catalog/tutorial.ts` | wording only |
| IDL-172 set-weapon tooltip | tooltip code (`src/components/game/itemUi.ts`) | display only |
| IDL-176 Heal on Kill in the win estimate for chained fights | `src/lib/offline/winChance.ts` | pure function plus a unit test |
| IDL-163 per-tier chest art (all eight tiers use `bonus_chest`) | `src/config/pixelIcons.ts`, `public/pixel/` | recolour the existing image (Sprite Fusion first, no generator) |
| IDL-198 and IDL-100 the "run-2 ratio 60-70 %" re-measure | pace sim | measurement; record the number, may reveal a balance item |

## Batch 2: small code with tests (one PR each, 1-2 days)

- IDL-163 chest level from the monster instead of the castle: an optional level on the bag stack (additive; `tests/saves/saveFixtures.test.ts` and `appendOnly.test.ts` stay green, fixtures untouched).
- IDL-176 fixed base-stat authoring of the four combat stats on items (they are affixes only today).
- IDL-172 the unreachable super crit cap (`crit.maxSuperChance` in `src/config/combatConfig.ts`): cap or sources, update the JSDoc, run fight-sim.
- IDL-383 `ItemTooltip.tsx` and `ItemSlot.tsx` onto `GameItemTip`, plus the QA pass at 1240 / 1440 / 1920.

## Batch 3: needs balance tooling or a decision (own PR, slow checks)

- IDL-163 gear and bag-expansion tokens in chest contents; a loot-sim Monte Carlo in place of the config-derived table.
- Pace: the pace sim no longer models chests, so chest balance is by config budget only; teach the bot to open monster chests if chest value should be tuned.
- IDL-172 affix level scaling (design first); IDL-56 golden bosses and per-biome chance.
- IDL-384 item 2: offline bar and save flags, needs a decision on what a flagged save does to the bar.

## Later (each needs its own plan)

- **Needs a decision:** Cap Break prices (IDL-231, IDL-232; the first, 300 gems, is affordable on day 1); Ember Building Slot server check, stone blocks as a building cost, Pack Rat in the net-worth floor (IDL-379, IDL-210); crafting end-game recipe costs x10 (IDL-349) with a `craft-sim` retune, monster reward and cost tuning (IDL-379); gem shop slices after the boosts (IDL-354).
- **Blocked by the server owning the economy (IDL-134):** timed boosts (IDL-193), economy buff potions (IDL-159), Surveyor's Philtre (IDL-180), autobuyers (IDL-195), server-priced merchant (IDL-121). First step is IDL-134: castle upgrades, farm purchases and building costs as server ops.
- **Art and content with no code-only path:** battle backgrounds (IDL-161), biome art (IDL-106, IDL-108, IDL-110), landing v2 (IDL-122), castle art 11-15 (IDL-362), fishing hut and building art (IDL-379), pets (IDL-284, IDL-330).
- **Big systems:** skills v2 and materials (IDL-352, IDL-353, IDL-359, IDL-202), quests (IDL-361, IDL-203), world boss (IDL-345), the Second Realm (IDL-302), Paragon (IDL-186, IDL-187, IDL-114), Monument (IDL-185, IDL-237), combat depth (IDL-204), the lava biome (IDL-371), biome bosses and T4 relics (IDL-111), rebirth salvage (IDL-151), the resource cap past 2^53 (IDL-129).
