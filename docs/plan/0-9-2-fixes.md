# 0.9.2 fixes: what is left after the 0.9.2 release

Written 2026-11-25, updated 2026-11-26 (0.9.4 and 0.9.5 shipped: paragon points, the Pets tab, Sell junk fix, tile discount cap, rebirth respec boxes, golden-monster check IDL-56 closed). Created after PR #296 (staging to main, release 0.9.2). Hand-written plan, like the other files here: it lists what is **not built**. Linear holds the tickets; this is the order to take them in, quickest first. It replaces `next-pr-after-0-9-2.md` (the PR #295 list). When a batch is done, delete its section. Nothing here is a player-visible change until its PR says so (changelog rule: `content/changelog/`).

## Batch 0: checks in the game (owner, no code)

Nothing of PR #295 was seen with a login. Walk through with a real account; any bug found goes to the top of Batch 1.

- Bag: double-click and right-click **Open** on a monster chest (2 % per normal kill, every boss, every golden monster; or give one by hand), the notice text, Sell everything skipping chests.
- Item cards: the gold **Legendary perk** block, `Tier II - Item Level ...`, the new stat rows (Armor penetration, Thorns, Heal on kill, Boss timer) in the Stats tab, a ring with the Swift / of Haste affix.
- Tile and building tooltips: "Biome bonus" with milestones, the "Biome milestones" line of the income tooltip, Build Speed and Tile Discount on G4+ gear, a boss fight with Boss Timer gear.
- Rebirth: the +20 attribute points arrive free to spend after a real rebirth; respec gives them back.
- Gem shop: Name colours and Overnight Orders at 750.
- Start hub and castle compass buttons, `/reset` from a real emailed link (recovery cookie, IDL-384).

Owner and dashboard work (no code): Supabase Confirm email, SMTP and redirect URLs, and `supabase/migrations/player_class_open.sql` on a branch first (required before a fifth hero class, IDL-280); Vercel `LOOT_SECRET` per deployment, optional firewall rate rules, the free-plan load check (IDL-126); the two enforcement switches (`ENFORCEMENT`, `EMBER_MODEL.requireServerRebirth`, IDL-208, IDL-211) after `restore-trust` and `check-live-saves`; a raised `GAME_EPOCH` (IDL-300) only when a later chapter is wanted.

## Left over from batch 1 (the rest shipped)

IDL-174, the set-weapon note of IDL-172 and the per-tier chest art of IDL-163 shipped; the run-2 ratio was read from the committed pace output and did not move (hardcore-rebirth6 1.8 d to 1.7 d, about 33 % of run 1; human-rebirth6 8.0 d against 7.0 d, castle timers set the pace). **Left over from it:** the Heal on Kill preview in the win estimate (IDL-176): the estimate already starts from the resume HP after a kill, only the Next-strip preview mid-fight lacks it; low value, no sim needed.

## Batch 2: small code with tests (one PR each, 1-2 days)

- IDL-383 **mostly done:** `ItemSlot` now uses `HoverTip` + `GameItemTip` and `ItemTooltip.tsx` (with `FloatingTip`, the unused `TipButton` and their `px-tooltip` CSS) is gone. **Not seen in the game yet:** hover a victory-loot slot and a potion on the fight bar at 1240 / 1440 / 1920 px (needs a real fight); the rest of IDL-383's QA list (Esc order, dock icons, tutorial anchors, `e2e/`) is still open.
- IDL-176 fixed base-stat authoring of the four combat stats on items (they are affixes only today); needs a design pass first (IDL-387).
- **Dropped after reading the code:** a chest level from the monster (IDL-163): an opened chest pays minutes of the player's own income (`rollMonsterChest`) and nothing reads a chest level, so a level on the bag stack would be dead data; it comes back with gear and bag tokens in the contents (Batch 3). The super crit cap of IDL-172 is already pinned (`tests/audit/combat.test.ts`, `tests/economy/merchantUpgrades.test.ts`): `crit.maxSuperChance` stays 50 as the guard for future perks (gear alone reaches about 33 %); only IDL-172 item 3 (affix level scale, a design question) remains.

## Batch 3: needs balance tooling or a decision (own PR, slow checks)

- IDL-163 gear and bag-expansion tokens in chest contents; a loot-sim Monte Carlo in place of the config-derived table.
- Pace: the pace sim no longer models chests, so chest balance is by config budget only; teach the bot to open monster chests if chest value should be tuned.
- IDL-172 affix level scaling (design first).
- IDL-384 item 2: offline bar and save flags, needs a decision on what a flagged save does to the bar.

## Later (each needs its own plan)

- **Needs a decision:** Cap Break prices (IDL-231, IDL-232; the first, 300 gems, is affordable on day 1); Ember Building Slot server check, stone blocks as a building cost, Pack Rat in the net-worth floor (IDL-379, IDL-210); crafting end-game recipe costs x10 (IDL-349) with a `craft-sim` retune, monster reward and cost tuning (IDL-379); gem shop slices after the boosts (IDL-354).
- **Blocked by the server owning the economy (IDL-134):** timed boosts (IDL-193), economy buff potions (IDL-159), Surveyor's Philtre (IDL-180), autobuyers (IDL-195), server-priced merchant (IDL-121). First step is IDL-134: castle upgrades, farm purchases and building costs as server ops.
- **Art and content with no code-only path:** battle backgrounds (IDL-161), biome art (IDL-106, IDL-108, IDL-110), landing v2 (IDL-122), castle art 11-15 (IDL-362), fishing hut and building art (IDL-379), pets (IDL-284: the achievements that unlock them; the Pets tab itself shipped in 0.9.5).
- **Big systems:** skills v2 and materials (IDL-352, IDL-353, IDL-359, IDL-202), quests (IDL-361, IDL-203), world boss (IDL-345), the Second Realm (IDL-302), Paragon milestones and deeds (IDL-394) and the balance sims (IDL-186, IDL-187), Monument (IDL-185, IDL-237), combat depth (IDL-204), the lava biome (IDL-371), biome bosses and T4 relics (IDL-111), rebirth salvage (IDL-151), the resource cap past 2^53 (IDL-129).
