# Perk family caps: decision sheet (IDL-149)

Read time about 10 minutes. This is analysis only: no game rule or constant is changed by it, and **no family cap exists in the code today** (the gear bucket of each family is the plain sum of item stats and set bonuses, `aggregateStats` in `src/lib/inventory.ts`). IDL-143, IDL-176, IDL-44 and IDL-144 wait for the numbers below.

The tables in the generated block are computed by `npm run perk-caps -- --md` (`scripts/perk-caps.ts`) from the live set bonuses (`setBonusStats`), the live distance bands and spawn rules, and the server's own fight engine. Edit the candidate caps and tiers at the top of that script, rerun it, then run `npm run format` (the script does not format its output). Do not type numbers into this file by hand.

Already decided (IDL-149, owner, 2026-11-07): tiers 8 / 15 / 25 % for every family (damage 4 / 6 / 10 %), each family its own `(1 + sum)` bucket, tight caps income 50, XP 40, kill reward 60, click 40, damage 45 on the gear bucket (sets and legendary perks added together). What is open is whether those numbers survive the sim.

## What to decide

1. Keep the tight caps as decided, or loosen some (the table shows how many points each one cuts).
2. IDL-222: should bosses start at castle distance 13+ or 8+.
3. The legendary slot rule: a 14-piece set loses its top bonus when a legendary takes a slot.

## The numbers

<!-- perk-caps:start -->

#### Legendary tiers and cap candidates

| Family | Common | Rare | Top | Cap: tight | Cap: roomy | Cap: none |
|---|---|---|---|---|---|---|
| Income | 8 | 15 | 25 | 50 | 60 | none |
| XP | 8 | 15 | 25 | 40 | 50 | none |
| Kill reward | 8 | 15 | 25 | 60 | 70 | none |
| Click gold | 8 | 15 | 25 | 40 | 50 | none |
| Damage | 4 | 6 | 10 | 45 | 55 | none |

#### Set bonuses reached, with and without one top legendary

Set only = the live bonuses at the full piece count. Set + legendary adds the Top tier of the family; the legendary takes a slot, so a 14-piece set is counted at 13 pieces (it loses its 14-piece bonus: S2 damage is 28 + 10 = 38 and not 38 + 10 = 48). Obsidian has 12 pieces and the legendary takes a 13th or 14th slot, so it keeps all 12. Cells: gear bucket % (multiplier after the tight cap); `>` marks a total over the tight cap.

**Income** (tight cap 50, top legendary +25)

| Set | Pieces (alone / with legendary) | Set only | Set + top legendary | Legendary alone | Over the tight cap? |
|---|---|---|---|---|---|
| Obsidian Set | 12 / 12 | 26 (x1.26) | 51 > (x1.50) | 25 (x1.25) | yes, 1 points cut |
| Sunhoney Raiment | 14 / 13 | 38 (x1.38) | 53 > (x1.50) | 25 (x1.25) | yes, 3 points cut |
| Ashen Warlord | 14 / 13 | 0 (x1.00) | 25 (x1.25) | 25 (x1.25) | no |
| Blightbound | 14 / 13 | 0 (x1.00) | 25 (x1.25) | 25 (x1.25) | no |

**XP** (tight cap 40, top legendary +25)

| Set | Pieces (alone / with legendary) | Set only | Set + top legendary | Legendary alone | Over the tight cap? |
|---|---|---|---|---|---|
| Obsidian Set | 12 / 12 | 25 (x1.25) | 50 > (x1.40) | 25 (x1.25) | yes, 10 points cut |
| Sunhoney Raiment | 14 / 13 | 32 (x1.32) | 45 > (x1.40) | 25 (x1.25) | yes, 5 points cut |
| Ashen Warlord | 14 / 13 | 0 (x1.00) | 25 (x1.25) | 25 (x1.25) | no |
| Blightbound | 14 / 13 | 0 (x1.00) | 25 (x1.25) | 25 (x1.25) | no |

**Kill reward** (tight cap 60, top legendary +25)

| Set | Pieces (alone / with legendary) | Set only | Set + top legendary | Legendary alone | Over the tight cap? |
|---|---|---|---|---|---|
| Obsidian Set | 12 / 12 | 37 (x1.37) | 62 > (x1.60) | 25 (x1.25) | yes, 2 points cut |
| Sunhoney Raiment | 14 / 13 | 48 (x1.48) | 45 (x1.45) | 25 (x1.25) | no |
| Ashen Warlord | 14 / 13 | 10 (x1.10) | 25 (x1.25) | 25 (x1.25) | no |
| Blightbound | 14 / 13 | 0 (x1.00) | 25 (x1.25) | 25 (x1.25) | no |

**Click gold** (tight cap 40, top legendary +25)

| Set | Pieces (alone / with legendary) | Set only | Set + top legendary | Legendary alone | Over the tight cap? |
|---|---|---|---|---|---|
| Obsidian Set | 12 / 12 | 10 (x1.10) | 35 (x1.35) | 25 (x1.25) | no |
| Sunhoney Raiment | 14 / 13 | 20 (x1.20) | 39 (x1.39) | 25 (x1.25) | no |
| Ashen Warlord | 14 / 13 | 0 (x1.00) | 25 (x1.25) | 25 (x1.25) | no |
| Blightbound | 14 / 13 | 0 (x1.00) | 25 (x1.25) | 25 (x1.25) | no |

**Damage** (tight cap 45, top legendary +10)

| Set | Pieces (alone / with legendary) | Set only | Set + top legendary | Legendary alone | Over the tight cap? |
|---|---|---|---|---|---|
| Obsidian Set | 12 / 12 | 0 (x1.00) | 10 (x1.10) | 10 (x1.10) | no |
| Sunhoney Raiment | 14 / 13 | 0 (x1.00) | 10 (x1.10) | 10 (x1.10) | no |
| Ashen Warlord | 14 / 13 | 38 (x1.38) | 38 (x1.38) | 10 (x1.10) | no |
| Blightbound | 14 / 13 | 40 (x1.40) | 40 (x1.40) | 10 (x1.10) | no |

#### Points lost to each cap candidate (set + one top legendary)

| Set | Family | Raw total | Cut by tight | Cut by roomy | Cut by none |
|---|---|---|---|---|---|
| Obsidian Set | Income | 51 | 1 | 0 | 0 |
| Obsidian Set | XP | 50 | 10 | 0 | 0 |
| Obsidian Set | Kill reward | 62 | 2 | 0 | 0 |
| Obsidian Set | Click gold | 35 | 0 | 0 | 0 |
| Sunhoney Raiment | Income | 53 | 3 | 0 | 0 |
| Sunhoney Raiment | XP | 45 | 5 | 0 | 0 |
| Sunhoney Raiment | Kill reward | 45 | 0 | 0 | 0 |
| Sunhoney Raiment | Click gold | 39 | 0 | 0 | 0 |
| Ashen Warlord | Damage | 38 | 0 | 0 | 0 |
| Blightbound | Damage | 40 | 0 | 0 | 0 |

#### Top legendaries that fill each cap

| Family | Top | Tight cap | Legendaries alone | With Obsidian 12 | Roomy cap | Legendaries alone | With Obsidian 12 |
|---|---|---|---|---|---|---|---|
| Income | 25 | 50 | 2 | 1 | 60 | 3 | 2 |
| XP | 25 | 40 | 2 | 1 | 50 | 2 | 1 |
| Kill reward | 25 | 60 | 3 | 1 | 70 | 3 | 2 |
| Click gold | 25 | 40 | 2 | 2 | 50 | 2 | 2 |
| Damage | 10 | 45 | 5 | 5 | 55 | 6 | 6 |

#### Damage against the fight engine

Level 30 hero (25 points: 12 Strength, 8 Vitality, 5 Dexterity), Heal, Stun and potions by the fixed auto-use rules, 60 seeded fights per cell, win % (mean seconds). Each boss at the highest level its spawn window reaches at castle level 8. Gear at its authored level, so this shows the shape and not the final balance (the S1-S3 pieces are disabled placeholders today). With a top damage legendary (+10) S2 reaches 38 and S3 40: x1.38 and x1.40 per hit against the tight cap 45 (x1.45), so the cap bites only if more than one damage perk is stacked.

| Loadout | bossGreatAuroch L23 | bossElderStag L28 | bossMireMatriarch L33 | bossWinterWyrm L38 |
|---|---|---|---|---|
| Obsidian 12 + maul (Damage +0 %) | 92% (66s) | 0% | 0% | 0% |
| Ashen Warlord (S2) 14 (Damage +38 %) | 100% (2s) | 100% (5s) | 100% (7s) | 100% (20s) |
| Blightbound (S3) 14 (Damage +40 %) | 100% (3s) | 100% (6s) | 100% (9s) | 100% (23s) |

#### Damage total sweep (Ashen Warlord kit)

Same kit, same hero, only the set's damage total changes: 0 = none, 28 = S2 at 13 pieces, 38 = S2 at 14, 45 = the tight cap, 48 = S2 at 14 plus a top legendary with no cap. Win % (mean seconds), 60 seeded fights.

| Damage total | bossGreatAuroch L23 | bossElderStag L28 | bossMireMatriarch L33 | bossWinterWyrm L38 |
|---|---|---|---|---|
| 0 % | 100% (4s) | 100% (7s) | 100% (10s) | 100% (27s) |
| 28 % | 100% (3s) | 100% (5s) | 100% (8s) | 100% (21s) |
| 38 % | 100% (2s) | 100% (4s) | 100% (7s) | 100% (20s) |
| 45 % | 100% (3s) | 100% (5s) | 100% (7s) | 100% (19s) |
| 48 % | 100% (2s) | 100% (4s) | 100% (7s) | 100% (19s) |

#### IDL-222: the boss band against the live spawn rules

| Band | From (castle distance) | Tiles in the ring at that distance |
|---|---|---|
| home | 1 | 8 |
| outskirts | 7 | 56 |
| frontier | 13 | 104 |
| wilds | 22 | 176 |

| Boss | Biomes | Spawn distance (min-max) | Spawn level at castle 1 | At castle 8 |
|---|---|---|---|---|
| bossGreatAuroch | plains | 2-9 | 15-18 | 20-23 |
| bossElderStag | forest | 2-9 | 20-23 | 25-28 |
| bossMireMatriarch | swamp | 2-9 | 25-28 | 30-33 |
| bossWinterWyrm | tundra | 2-9 | 30-33 | 35-38 |

Live fact: no boss can stand farther than 9 tiles from the castle, the outskirts start at 7 and the frontier at 13. A "13+" boss band is empty under today's spawn rules.

<!-- perk-caps:end -->

## Reading the tables

- **Income, kill reward**: with Obsidian 12 plus one top legendary the totals are 51 and 62 against caps of 50 and 60. The cap cuts 1 and 2 points: the owner's "a choice of set or legendary, not both" holds, but the cut is so small a player will not notice it. Sunhoney 14 alone is already 38 income and 48 kill reward.
- **XP is where the tight cap hurts.** Obsidian 12 is 25, a top legendary adds 25, the cap is 40: 10 of the legendary's 25 points (40 %) are thrown away, and Sunhoney 14 (32) loses 5. A top XP legendary is worth +15 on an XP set, which reads as a trap in a tooltip that says +25.
- **Click gold** never reaches the tight cap (35 and 39 with a legendary). The cap is only a guard against two click legendaries.
- **Damage**: no set plus one top damage legendary reaches 45 (S2 28 + 10 = 38, S3 30 + 10 = 40). Five top damage legendaries are needed to fill it. In the fight engine the S2 kit already beats every boss at 100 % at castle 8 gear levels, and the time to win barely moves between 38, 45 and 48 % (about one second on the hardest boss), so damage is not what limits those fights. The cap protects against stacking, not against a single item.
- **A legendary can cost more than it gives.** Sunhoney 14 alone is 48 kill reward; with a top kill-reward legendary in one slot it drops to 13 pieces and totals 20 + 25 = 45, lower than without it. That is the 14th-piece rule, not the cap, and it will affect every 14-piece economy set.
- **Caveats**: the S1-S3 sets are `enabled: false` placeholders (their numbers are "70-90 % of the caps" by design), and no legendary exists yet (IDL-144), so "top legendary" here is the +25 headline from the tier table, not an item.

## Recommendation

- Keep **income 50, kill reward 60, click 40 and damage 45** as decided: they cut little or nothing today and leave real headroom for the later set re-tune.
- Raise **XP from 40 to 50.** At 40 an Obsidian player gains 15 of 25 from the headline legendary and an XP set is capped by its own bonuses; at 50 the cut is gone for Sunhoney and Obsidian plus one legendary lands exactly on the cap (50). If the owner wants XP slow on purpose, keep 40 but then lower the XP top tier or print the capped total in the tooltip (already planned for build time).
- Do not tune damage from this sheet: the fight engine shows no boss pressure at 38-48 %, so 45 is a guard, not a balance lever. Re-check it with the real S2/S3 pieces after the placeholder bonuses are tuned (R2 C5).
- Decide the **14th-piece rule** before IDL-144 fixes the legendary slots (open question 2).

## IDL-222: 13+ or 8+

The code supports neither number as written:

- Every monster, bosses included, may stand only 2 to 9 tiles from the castle (`MonsterSpawnRule`, `maxCastleDistance` 9 in `src/config/combatConfig.ts`). The frontier band starts at 13 (`DISTANCE_BANDS`), so "bosses from 13+" means **no boss would ever spawn** unless the spawn range is widened in the same change (IDL-53).
- With today's range an **8+ band** is non-empty (tiles at distance 8 and 9), and it sits just past the outskirts start (7), so it keeps bosses out of the home ring where a new player lives.
- Win chance gives no help in choosing the number: at castle 8 gear levels an Obsidian 12 hero (level 30) beats the plains boss most of the time and none of the other three, so a distance band alone does not make them fair; only the weighting and level cap of option (b) would.

Recommendation: use **8+ now** (it works with today's rules and needs only a `minCastleDistance` change on the four bosses), and move to 13+ together with the IDL-53 spawn tables that widen the spawn range, not before.

## Open questions

1. XP cap: 40 (as decided) or 50 (recommended)?
2. Should a legendary that takes a set slot keep the set's top bonus (a 14-piece set counts 13 pieces plus the legendary as the 14th), or is the loss deliberate to make "set or legendary" a real choice?
3. Does the damage cap need to be 45 while the tier is 10 and one legendary gets nowhere near it, or should it follow the tier (a cap of 40 would make the second damage legendary matter)?
4. Boss band: 8+ now and 13+ with IDL-53, or wait and decide once?
5. Offline efficiency, offline cap hours, max HP % and chest speed are not in this sheet: offline keeps `HARD_LIMITS`, the rest need their own rows once the set tuning is final.
