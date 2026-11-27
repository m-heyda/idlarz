# 30 · Gem sinks: what is left (the shop and its first items are built; the bigger sinks are open)

Reviewed against the code on 2026-11-26; everything built was removed. **Built** (the code and its JSDoc are the record: the price book `config/gemShop.ts`, `POST /api/gems` and the ledger's `gemShop` record, `GemShopDialog.tsx`, `scripts/gemSim.ts` with [gem-sim](../generated/gem-sim.md)): the spend engine (idempotent by claim id, refused when the balance is short, compare-and-swap on the ledger), the Gem shop window (Identity, Upgrades and One-time tabs, a row's `kind` of `service`, `leveled` or `once` decides how it reads), and the items in it: class change, name change, attribute respec, name colours (750), Overnight Orders (750), castle skins and the second builder. Faucets: chests (a gem roll on each), achievements and the daily bonus. The balance is the ledger's; an upload can never raise it. **Numbering is kept because code and a test cite sections 3, 4 and 9.**

**Rules that still stand.** Gems may be **sold later**, so every sink obeys the fair-play line (section 2 of the old draft, decided in IDL-188): gems buy convenience, time within limits, identity, cosmetics and temporary boosts; they never buy gold, resources or Embers in bulk and never buy permanent stat power; everything stays obtainable for free, only slower; rankings use income without boosts; **gambling is gold only, never gems** (IDL-205). Cap Breaks (section 4) are the one explicit exception.

## 3. The sinks that are not built

Status: **Planned** = decided in IDL-188; **New** = proposed 2026-11-08; **Parked** = deliberately not scheduled.

| Sink and what it does | Rough price | Slice | Linear | Status |
| --- | --- | --- | --- | --- |
| QoL: +4 bag slots (max 3 purchases), +2 battle-queue slots | 400 / 800 / 1,200; about 500 each | G2 | IDL-191 | Planned |
| Convenience II: +2 h away time (3 purchases), more auto-sell filter slots | 600 / 1,200 / 1,800; about 300 | G2 | IDL-234 | New |
| Time savers: gem Hourglass (bounded), Chest Beacon, open-next-chest-now | about 150 per hour skipped | G2 | IDL-192 | Planned |
| Timed production boosts: +25 % for 24 h per resource, all-resources +10 % | about 100 each (gold and XP about 200), about 500 | G2 | IDL-193 | Planned |
| **Cap Breaks v1**: +1 max level on merchant economy ladders | 300 x 2.5^(n-1) | G3 | IDL-231 | New |
| **Cap Breaks v2**: farm upgrades, Ember shop | like v1 | G3 | IDL-232 | New |
| Affix re-roll on one piece of gear (below) | rare 50, epic 120, legendary 400 | G4 | IDL-236 | New |
| Patron titles, the Monument, premium skins (below) | by lifetime gems spent | G5 | IDL-237, IDL-184, IDL-185 | New |
| Hero customisation: the Character window's name and badge open a "Customise hero" picker (nickname glow, frames; free ones from achievements, premium ones One-time gem items) | | G5 | IDL-296 | New |
| Gem sink balance: faucets against the price book | | before tuning | IDL-229 | Built as a sim, prices open |
| Castle level 11+ break | | | in IDL-232 | Parked |
| Gem sockets in gear | | | IDL-137 | Parked |
| Second loadout slot | needs the loadout feature | | | Parked |

**Rejected on 2026-11-08 (owner):** keeping a % of one resource through a rebirth (it makes rebirth cheaper for gems and breaks the pacing); skipping a stage of the rebirth tile requirement (it sells the game's pacing); an instant finish of a castle upgrade timer (the bounded Hourglass stays: 3 per upgrade and 50 % of the upgrade, shared with found Hourglasses, IDL-177). A rebirth-payout bonus of Embers is not scheduled: it conflicts with "never Embers in bulk".

**Affix re-roll.** Re-roll **one** affix of a bagged or worn piece. The server rolls it with a sealed seed (`HMAC(LOOT_SECRET, user / run / 'reroll' / ordinal)`), idempotent by claim id. The result is final (a gem sink must not be a free retry), at most 3 re-rolls per item, never the fixed effect of a legendary, and the new value stays inside the perk family caps. It ships on the crafting hooks (IDL-117).

**Prestige tail.** A sink that never runs out and gives no power: patron titles by lifetime gems spent (`spentTotal`), a **Monument** (cosmetic here, see IDL-185 for the Ember-era gold version), premium castle skins and map themes. Nothing changes income, combat or any limit.

## 4. Cap Breaks

**The idea (owner, 2026-11-08):** gems as the late-game currency that permanently raises the cap of upgrade ladders. Every ladder tops out today (merchant 4-10 levels, farm 8-10, Ember shop 10, castle 10).

- **Rule:** a Cap Break is **+1 maximum level on one ladder**, bought once per level, **at most 3 per ladder**. The effect per level is unchanged, only the ceiling moves. It is kept through every rebirth (it lives in the ledger); the levels themselves reset as today (merchant ladders except Pack Rat).
- **Price:** `ceil(base x 2.5^(n-1))` gems for the n-th break, `base` 300 for economy ladders. Starting guess: all five merchant ladders broken three times is about 14,600 gems, a multi-month goal. The gem sim tunes it before anything ships.
- **Gate:** `rebirths >= 2`, read from the ledger. The levels beyond the old cap cost gold or Embers on the normal curve (`ceil(baseCost x costGrowth^N)` continues).
- **Which ladders:** v1 the merchant economy ladders (Haggler, Lucky Charm, Foreman, Skinner, Ancestral Tithe); v2 the farm (Feed Trough, Hen House, Dairy, Tannery, Pasture; Pen Expansion waits for the farm cost scaling, IDL-81) and the Ember shop (Click Mastery, Provisions, Master Builders, Night Watch, which stays under `HARD_LIMITS.offlineCapHours` 72). **Out:** the merchant combat ladders (permanent combat power), Pack Rat (bag growth is sold directly), Bulk Discount and Thrift (both feed the 45 % tile-discount cap), Steward (already at `HARD_LIMITS.offlineEfficiency`). **Parked:** castle level 11+ (it feeds the Ember gain and the biome timers; needs its own sim).
- **Server and save:** `sanitizeSave` clamps ladder levels to the static `maxLevel` (merchant, farm and Ember clamps in `src/lib/sanitizeSave.ts`). The change: clamp to `maxLevel + HARD_BREAKS` (3) so no old or new save is refused and no forged save exceeds the hard ceiling, and `acceptSave` clamps to `maxLevel` plus the ledger's breaks (the pattern of `LIMITS` and `HARD_LIMITS` in `src/config/limits.ts`). The Ember conservation test must price the extra levels with `emberUpgradeCost`, and `netWorth.ts` must price them too.
- **Power budget (acceptance):** all v1 breaks together raise income by less than 5 %, all v2 breaks by less than a further 5 %; the sim bot gets a gem-spend line so run-2 ratios and the long human profiles stay in their windows.
- **Decided (owner, IDL-228):** Cap Breaks are an explicit exception to the fair-play line, for economy ladders only. Unless the owner says otherwise: breaks count in rankings (permanent, unlike boosts) and the gate is `rebirths >= 2`.

## Where it ships

Gems ride on the numbered releases of [RELEASE-PLAN](RELEASE-PLAN.md): **G2** (convenience and time: IDL-191, 234, 192, 193) after the new chapter and before the later economy phases, IDL-192 and IDL-193 needing the server-owned economy actions (IDL-134) and the potion hooks (IDL-177, IDL-159); **G3** (Cap Breaks: IDL-231, 232) after the server-run rebirth; **G4** (affix re-roll, IDL-236) after crafting; **G5** (prestige tail, IDL-237, IDL-184) with the rankings.

## 9. Targets (the gem sim)

`npm run gem-sim -- --md` prints gems per day from chests (Luck 0 / 100 / 300, 50 and 100 % collection), the daily bonus and the achievement, milestone and mastery pools, over 7 / 30 / 90 / 180 days, against the price book in `config/gemShop.ts`. Targets, each approved before it ships:

- an identity item (name change, attribute respec) is affordable in the first week;
- the first QoL unlock in week 2;
- a first Cap Break in weeks 4 to 8;
- the whole list is a multi-month goal;
- no sink is cheap enough to empty the purse on day 1 (the 1,000 start purse is not a spending budget).

**Still open:** the first Cap Break (300) is affordable on day 1 for every profile, so the weeks 4 to 8 target holds only if the rebirth gate sets the pace; decide gate versus a higher base price (`CAP_BREAK` in the sim, IDL-231) before the Cap Breaks are built.

## Risks that still apply

An old save refused after the clamp widens (clamp to `maxLevel + HARD_BREAKS`, never lower, test with breaks 0); the Ember conservation test rejecting honest saves with broken Ember upgrades (price the extra levels in the same change); boosts and Cap Breaks stacking past the pacing targets (a separate multiplier bucket for boosts, the 5 % budget for breaks); gem income too low for the shop to matter (sim first).
