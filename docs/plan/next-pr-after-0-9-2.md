# What is left after PR #295 (the 0.9.2 batch)

Written 2026-11-25 when PR #295 went to staging. Hand-written plan, like the other files here: it lists what is **not built**. Linear holds the tickets; this is the order I would take them in.

## 1. Check in the game first (nothing of PR #295 was seen with a login)

A walk-through with a real account, before or right after the deploy to staging:

- Bag: double-click and right-click **Open** on a monster chest (needs a drop: 2 % per normal kill, every boss, every golden monster; or give one by hand), the notice text, Sell everything shown skipping chests.
- Item cards: the gold **Legendary perk** block, `Tier II - Item Level ...`, the new stat rows (Armor penetration, Thorns, Heal on kill, Boss timer) in the Stats tab, a ring with the Swift / of Haste affix.
- Tile and building tooltips: "Biome bonus" with milestones, the "Biome milestones" line of the income tooltip, Build Speed and Tile Discount on G4+ gear, a boss fight with Boss Timer gear.
- Rebirth: the +20 attribute points arrive free to spend after a real rebirth; respec gives them back.
- Gem shop: Name colours and Overnight Orders at 750.
- Start hub and castle compass buttons (design-system restyle), `/reset` from a real emailed link (the recovery cookie, IDL-384).

## 2. Owner and dashboard work (no code)

- Supabase: Confirm email, SMTP and redirect URLs; apply `supabase/migrations/player_class_open.sql` on a branch first (optional now, required before a fifth hero class, IDL-280).
- Vercel: a new `LOOT_SECRET` per deployment; optional firewall rate rules; the free-plan load check (IDL-126).
- The two enforcement switches (`ENFORCEMENT`, `EMBER_MODEL.requireServerRebirth`, IDL-208 and IDL-211), after `restore-trust` and `check-live-saves`.
- The two-browser reset and the tab lock with a raised `GAME_EPOCH` (IDL-300), only when a later chapter is wanted.

## 3. Small code follow-ups from this PR

- Monster chests (IDL-163): per-tier art (all eight use `bonus_chest`), the chest level from the monster instead of the castle (needs a level on the bag stack), gear and bag-expansion tokens in the contents, a loot-sim Monte Carlo in place of the config-derived table.
- Item stats (IDL-176): Heal on Kill in the win estimate for chained fights; fixed base-stat authoring of the four combat stats on items (they are affixes only).
- Attribute rules (IDL-174): the "Base: +25 % gold" line in the stat panel and the tutorial wording (`src/catalog/tutorial.ts`).
- Stat audit (IDL-172): affix level scaling (design), the unreachable super crit cap, the set-weapon tooltip.
- Golden monsters (IDL-56): golden bosses and per-biome chance (balance).
- UI restyle (IDL-383): `ItemTooltip.tsx` and `ItemSlot.tsx` onto `GameItemTip`, plus the QA pass at 1240 / 1440 / 1920.
- Offline bar and save flags (IDL-384 item 2): needs a decision on what a flagged save does to the bar.
- Biome milestones (IDL-198): the "run-2 ratio 60-70 %" check was not measured separately.
- +20 attribute points (IDL-100): the same run-2 ratio re-measure.
- Pace: the pace sim no longer models chests, so any chest balance is by config budget only; teach the bot to open monster chests if chest value should be tuned.

## 4. Needs a decision before it can be built

- Cap Break prices (IDL-231, IDL-232): the first one (300 gems) is affordable on day 1; rebirth gate or a higher base price.
- Ember Building Slot server check, stone blocks as a building cost, Pack Rat in the net-worth floor (IDL-379, IDL-210).
- Crafting end-game recipe costs x10 (IDL-349) with a `craft-sim` retune; monster reward tuning and cost tuning (IDL-379).
- Gem shop rework slices after the boosts (IDL-354): skins, potions, automation.

## 5. Blocked by the server owning the economy (IDL-134)

Timed boosts (IDL-193), economy buff potions (IDL-159), Surveyor's Philtre (IDL-180), autobuyers (IDL-195), server-priced merchant (IDL-121). The first step is IDL-134: castle upgrades, farm purchases and building costs as server ops.

## 6. Art and content with no code-only path

Battle backgrounds (IDL-161), the biome art tickets (IDL-106, IDL-108, IDL-110), landing v2 (IDL-122), castle art 11-15 (IDL-362), fishing hut and building art (IDL-379), pets (IDL-284, IDL-330).

## 7. Big systems (each its own project)

Skills v2 and materials (IDL-352, IDL-353, IDL-359, IDL-202), quests (IDL-361, IDL-203), world boss (IDL-345), the Second Realm (IDL-302), Paragon (IDL-186, IDL-187, IDL-114), Monument (IDL-185, IDL-237), combat depth (IDL-204), the lava biome (IDL-371), biome bosses and T4 relics (IDL-111), rebirth salvage (IDL-151), the resource cap past 2^53 (IDL-129).
