# 30 · Gem sinks and the Gem shop

*Draft (2026-11-08). Nothing here is built: today nothing spends gems.* The decided base is Linear IDL-188 (the gem brainstorm, done 2026-11-07) and its build tasks IDL-189..194. This document keeps the whole picture in one place, adds the sinks proposed on 2026-11-08 (Cap Breaks first among them) and places them in the release order.

## 1. Where gems stand today

| Fact | Value | Where |
| --- | --- | --- |
| Start purse | 1,000 (also granted to saves from before gems existed) | `STARTING_GEMS` in `src/config/economy.ts` |
| Balance | held by the server in `player_ledger.gems`; an upload can never raise it (`gems_increase` flag, then replaced) | [saves and server](../game/saves-and-server.md) |
| Rebirth | keeps gems | [economy](../game/economy.md) |
| Faucet 1: chests | a gem roll on every chest, `min(15%, 3% + 0.06% x Luck)`, 5-50 gems skewed low (about 65-300 gems a day if every chest is collected) | `LUCK.gem`, [saves and server](../game/saves-and-server.md) |
| Faucet 2 (planned) | 12 launch achievements, 25-100 gems each, about 600 in total | IDL-73, [21](21-classes-avatars-achievements-offline-report.md) |
| Faucet 3 (planned) | daily first-login bonus, about 20-50 gems, weekly peak | IDL-194 |
| Faucet 4 (later) | rewarded ads; purchase by SMS or store (a separate project, only the rules are decided) | IDL-188 |
| Not a faucet | monster chests hold **no gems** | [loot](../game/loot.md), IDL-163 |
| Sinks today | **none** | |

Decisions that bind this document: gems may be **sold later**, so every sink obeys the fair-play line in section 2; gambling is **gold only, never gems** (IDL-205).

## 2. The fair-play line (decided in IDL-188)

Gems buy **convenience, time within limits, identity, cosmetics and temporary boosts**. They never buy gold, resources or Embers in bulk and never buy permanent stat power. Everything stays obtainable for free, only slower. Rankings use income without boosts. Every spend is a server operation on the ledger, idempotent by claim id, refused when the balance is short.

**Cap Breaks (section 4) bend this line**: they are permanent, a few percent of economy power. The owner accepted them as an explicit exception on 2026-11-08 (IDL-228), economy ladders only, bounded hard.

## 3. The sink catalogue

Status: **Planned** = decided in IDL-188, task exists. **New** = proposed 2026-11-08, task created. **Parked** = deliberately not scheduled.

| # | Sink and what it does | Rough price | Slice | Linear | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Spend engine: `config/gemShop.ts` catalog, `POST /api/gems`, ledger `gemShop`, claim ids | n/a | G1 | IDL-189 | Planned |
| 2 | Gem shop window: header gem chip opens it, five tabs | n/a | G1 | IDL-230 | New |
| 3 | Identity: class change, paragon respec, attribute respec outside a rebirth, name change (once per 30 days) | 500 / 500 / ~300 / ~200 | G1 | IDL-190 | Planned |
| 4 | Gem sources: achievement rewards, daily bonus | earns 25-100 / 20-50 | G1 | IDL-194, IDL-73 | Planned |
| 5 | QoL: +4 bag slots (max 3 purchases), +2 battle-queue slots, second builder queue | 400 / 800 / 1,200; ~500 each; ~2,500 | G2 | IDL-191 | Planned |
| 6 | Convenience II: +2 h away time (3 purchases), more auto-sell filter slots | 600 / 1,200 / 1,800; ~300 | G2 | IDL-234 | New |
| 7 | Time savers: gem Hourglass (bounded), Chest Beacon, open-next-chest-now | ~150 per hour skipped | G2 | IDL-192 | Planned |
| 8 | Timed production boosts: +25 % for 24 h per resource, all-resources +10 % | ~100 each (gold, XP ~200), ~500 | G2 | IDL-193 | Planned |
| 9 | **Cap Breaks v1**: +1 max level on merchant economy ladders | 300 x 2.5^(n-1) | G3 | IDL-231 | New |
| 10 | **Cap Breaks v2**: farm upgrades, Ember shop | like v1 | G3 | IDL-232 | New |
| 11 | Affix re-roll on one piece of gear | rare 50, epic 120, legendary 400 | G4 | IDL-236 | New |
| 12 | Patron titles, the Monument, premium skins | by lifetime gems spent | G5 | IDL-237, IDL-184 | New |
| 13 | Gem sink balance: faucets vs price book | | G1 (before tuning) | IDL-229 | New |
| 14 | Fair-play decision for Cap Breaks (economy only) | | before G3 | IDL-228 | Decided 2026-11-08 |
| 15 | Castle level 11+ break | | | in IDL-232 | Parked |
| 16 | Gem sockets in gear | | | IDL-137 | Parked |
| 17 | Second loadout slot | needs the loadout feature | | | Parked |

### Rejected on 2026-11-08 (owner)

- **Keep a % of one resource through a rebirth.** It makes rebirth cheaper for gems and breaks the pacing that [pacing targets](../game/pacing-targets.md) and [13](13-rebirth-reset-and-paragon.md) tune around.
- **Skip a stage of the rebirth tile requirement.** The requirement is the rebirth gate (`REBIRTH.tilesNeeded`); selling a way past it sells the game's pacing.
- **Instantly finish a castle upgrade timer.** The bounded time saver of row 7 stays (the Hourglass shares the 3-per-upgrade and 50 %-of-the-upgrade limit with found Hourglasses, IDL-177); a full instant finish does not exist.

A rebirth-payout bonus ("a small, capped extra of Embers") was floated in the same brainstorm and is **not scheduled**: it conflicts with "never Embers in bulk".

## 4. Cap Breaks

**The idea (owner, 2026-11-08):** gems as the late-game currency that permanently raises the cap of upgrade ladders. Today every ladder tops out: merchant ladders at 4-10 levels, farm upgrades at 8-10, the Ember shop at 10, the castle at 10.

**The rule.** A Cap Break is **+1 maximum level on one ladder**, bought once per level, **at most 3 per ladder**. The effect per level is unchanged, only the ceiling moves, so a fully broken Foreman is +13 % income instead of +10 %. It is kept through every rebirth (it lives in the ledger), while the levels themselves still reset on a rebirth exactly as today (merchant ladders, except Pack Rat, start again).

**Price.** `ceil(base x 2.5^(n-1))` gems for the n-th break of a ladder, `base` 300 for economy ladders. Starting guess: all five merchant ladders broken three times is about 14,600 gems, a multi-month goal against the faucets of section 1. `IDL-229` (the gem sim) tunes this before anything ships.

**Gate.** `requires: rebirths >= 2`, read from the ledger, so the first purchase happens after the player has actually met a cap. The levels beyond the old cap still cost gold or Embers on the normal cost curve (`ceil(baseCost x costGrowth^N)` simply continues).

**Which ladders.**

| Group | In v1 / v2 | Why |
| --- | --- | --- |
| Merchant economy: Haggler, Lucky Charm, Foreman, Skinner, Ancestral Tithe | **v1** (IDL-231) | pure economy ladders |
| Farm: Feed Trough, Hen House, Dairy, Tannery, Pasture | **v2** (IDL-232) | Pen Expansion waits for the farm cost scaling decision (RELEASE-PLAN D3) |
| Ember shop: Click Mastery, Provisions, Master Builders, Night Watch | **v2** (IDL-232) | Night Watch stays under `HARD_LIMITS.offlineCapHours` 72 |
| Merchant combat ladders | **out** until IDL-228 | permanent combat power |
| Pack Rat | **out** | bag growth is sold directly (row 5) |
| Bulk Discount, Thrift | **out** | both feed the 45 % tile-discount cap (`REBIRTH.discountCapPercent`), a break would change nothing |
| Steward | **out** | base 0.5 + 10 x 0.05 already equals `HARD_LIMITS.offlineEfficiency` (1.0) |
| Castle level 11+ | **parked** | the castle level feeds the Ember gain `(level - 5)^1.3` and the biome timers; needs its own numbers and sim |

**Server and save.** `sanitizeSave` clamps levels to the static `maxLevel` of the ladder (merchant: `src/lib/sanitizeSave.ts` line 300, farm 400, Ember 431). The change: clamp to `maxLevel + HARD_BREAKS` (3) so no old or new save is refused and no forged save can exceed the hard ceiling, and `acceptSave` clamps to `maxLevel + ledger breaks`. This is the same pattern as `LIMITS` and `HARD_LIMITS` in `src/config/limits.ts`. The Ember conservation test (embers earned = embers spent + unspent) must price the extra levels with `emberUpgradeCost`. `netWorth.ts` must price the extra levels too.

**Power budget (acceptance).** All v1 breaks together raise income by less than 5 %; all v2 breaks by less than a further 5 %. The sim bot gets a gem-spend line so run-2 ratios and `human-rebirth6` / `-rebirth8` stay in their windows ([RELEASE-PLAN](RELEASE-PLAN.md) P6).

**Decided 2026-11-08 (owner, IDL-228).** Cap Breaks are permanent power, which the fair-play line normally forbids. They are accepted as an **explicit exception for economy ladders only**, with the ceilings above. Combat ladders stay out. Unless the owner says otherwise: breaks count in rankings (permanent, unlike timed boosts), and the gate is `rebirths >= 2`.

## 5. The Gem shop window

- The gem chip in the header opens it, like the Embers chip opens the rebirth dialog (`RebirthDialog.tsx`). One modal, `GemShopDialog.tsx`, `gemShopOpen` in `uiStore`.
- **Tabs** (a tab is hidden while it has no item): **Limits** (bag, battle queue, away time, Cap Breaks), **Time** (Hourglass, Chest Beacon, boosts), **Identity** (class, name, respec), **Gear** (affix re-roll), **Cosmetics**.
- A row shows icon, name, one line of effect, price or "n of max", a "requires" line when locked, and Buy. A confirm step for anything above 300 gems.
- Balance, ownership and prices come from the server answer; the browser never computes them. Short balance shows how many gems are missing. The Buy button is disabled while the request is pending, and a replayed claim id returns the stored answer (a double click buys once).
- Ledger shape (IDL-189): `ledger.gemShop { bought: { itemId: n }, lastAt: { itemId: sec }, spentTotal }`. A rebirth keeps gems and permanent unlocks and clears run-scoped effects (boosts).

## 6. Gear sink: affix re-roll

Re-roll **one** affix of a bagged or worn piece. The server rolls it with a sealed seed (`HMAC(LOOT_SECRET, user / run / 'reroll' / ordinal)`, [saves and server](../game/saves-and-server.md)), idempotent by claim id. The result is final (no undo; a gem sink must not be a free retry). At most 3 re-rolls per item, never the fixed effect of a legendary, and the new value stays inside the perk family caps of [loot](../game/loot.md) / IDL-149. It ships on the crafting hooks (IDL-117), so it follows crafting v0. **Gem sockets** remain parked; if they ever return, the socketed stone needs another name than "gem".

## 7. Prestige tail

A sink that never runs out and gives no power: **patron titles** by lifetime gems spent (spentTotal), a **Monument** map object (cosmetic, no income) that grows with the same milestones, premium castle skins, map themes and name colours. Embers buy the basic cosmetics (IDL-184), gems the premium ones. Nothing here changes income, combat or any limit. It also gives the rankings board something to show beyond income.

## 8. Release placement

Gems get their own track, **G**, that rides on the numbered phases of [RELEASE-PLAN](RELEASE-PLAN.md) (section 4, "Gem track"). Linear projects hold each task in the release it ships with.

| Slice | Ships with | Contents | Gate |
| --- | --- | --- | --- |
| **G1** Engine, shop shell, identity, sources | P2 New chapter (Linear R5) | IDL-189, IDL-230, IDL-190, IDL-194; IDL-229 (gem sim) before any price is final | the reset release sets up the ledger; class change (500) needs the engine on day one |
| **G2** Convenience and time | after P2, before P6 (R5 to R7) | IDL-191, IDL-234, IDL-192, IDL-193 | IDL-192 and IDL-193 need the server to own the economy actions (IDL-134) and the potion hooks (IDL-177, IDL-159); the second builder queue waits for P6 (R7) |
| **G3** Cap Breaks | after P7 Respec (server rebirth, R8) and before P10 | IDL-228 (decision), IDL-231, IDL-232 | the `rebirths >= 2` gate reads the ledger; the server-run rebirth makes the keep-on-rebirth rule enforceable; `verify.ts` enforcement (IDL-208) should be on |
| **G4** Gear sink | after P11 Crafting (R11) | IDL-236 | crafting v0 sealed-roll hooks |
| **G5** Prestige tail | with P9 Rankings (R10) | IDL-237, IDL-184 | titles are shown on the rankings board |

## 9. Balance targets (sim, IDL-229)

`scripts/gem-sim.ts` prints gems per day from chests (Luck 0 / 100 / 300, 50 and 100 % collection), achievements and the daily bonus, over 30 / 90 / 180 days, against the price book. Targets, each approved before it ships:

- an identity item (name change, attribute respec) is affordable in the first week;
- the first QoL unlock in week 2;
- a first Cap Break in weeks 4-8;
- the whole list is a multi-month goal;
- no sink is cheap enough to empty the purse on day 1 (the 1,000 start purse is not a spending budget).

## 10. Risks

| Risk | Where it bites | Mitigation |
| --- | --- | --- |
| Cap Breaks read as pay-to-win once gems are sold | fair-play line | exception accepted (IDL-228); hard +3 per ladder; economy only; free to earn |
| An old save is refused after the clamp widens | `sanitizeSave` | clamp to `maxLevel + HARD_BREAKS`, never lower; test with breaks 0 |
| The Ember conservation test rejects honest saves with broken Ember upgrades | v2 | price extra levels with `emberUpgradeCost` in the same change |
| Double spend from two tabs or a double click | every sink | compare-and-swap on `ledger.ver`, claim id replay, tests in IDL-189 |
| Boosts and Cap Breaks stack past the pacing targets | G2, G3 | separate multiplier bucket for boosts, 5 % budget for breaks, sim line |
| Gem balance forged in an upload | all sinks | already blocked: the balance is the ledger's, `gems_increase` is flagged |
| Gem income too low for the shop to matter | all sinks | sim first; faucets (achievements, daily bonus) are in G1 |
