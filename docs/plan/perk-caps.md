# Perk family caps: decision sheet (IDL-149)

Read time about 10 minutes. This is analysis only: no game rule or constant is changed by it, and **no family cap exists in the code today** (the gear bucket of each family is the plain sum of item stats and set bonuses, `aggregateStats` in `src/lib/inventory.ts`). IDL-143, IDL-176, IDL-44 and IDL-144 wait for the numbers below.

The tables in the generated block are computed by `npm run perk-caps -- --md` (`scripts/perk-caps.ts`) from the live set bonuses (`setBonusStats`), the live distance bands and spawn rules, and the server's own fight engine. Edit the candidate caps and tiers at the top of that script, rerun it, then run `npm run format` (the script does not format its output). Do not type numbers into this file by hand.

## Decided

- IDL-149 (owner, 2026-11-07): tiers 8 / 15 / 25 % for every family (damage 4 / 6 / 10 %), each family its own `(1 + sum)` bucket, caps on the gear bucket (sets and legendary perks added together): income 50, XP 40, kill reward 60, click 40, damage 45.
- Owner, 2026-11-09, answering this sheet: **XP cap is 50** (not 40). **A legendary that takes a set slot costs the set its top bonus on purpose**: it is a choice of set or legendary, so legendaries are meant to be powerful. **Weapon legendaries should be a little overpowered.** **The IDL-222 boss band waits** (noted in Linear). Nothing below has been applied to the code yet.

## The numbers

<!-- perk-caps:start -->

#### Legendary tiers and cap candidates

| Family | Common | Rare | Top | Cap: tight | Cap: roomy | Cap: none |
|---|---|---|---|---|---|---|
| Income | 8 | 15 | 25 | 50 | 60 | none |
| XP | 8 | 15 | 25 | 50 | 60 | none |
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

**XP** (tight cap 50, top legendary +25)

| Set | Pieces (alone / with legendary) | Set only | Set + top legendary | Legendary alone | Over the tight cap? |
|---|---|---|---|---|---|
| Obsidian Set | 12 / 12 | 25 (x1.25) | 50 (x1.50) | 25 (x1.25) | no |
| Sunhoney Raiment | 14 / 13 | 32 (x1.32) | 45 (x1.45) | 25 (x1.25) | no |
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
| Obsidian Set | XP | 50 | 0 | 0 | 0 |
| Obsidian Set | Kill reward | 62 | 2 | 0 | 0 |
| Obsidian Set | Click gold | 35 | 0 | 0 | 0 |
| Sunhoney Raiment | Income | 53 | 3 | 0 | 0 |
| Sunhoney Raiment | XP | 45 | 0 | 0 | 0 |
| Sunhoney Raiment | Kill reward | 45 | 0 | 0 | 0 |
| Sunhoney Raiment | Click gold | 39 | 0 | 0 | 0 |
| Ashen Warlord | Damage | 38 | 0 | 0 | 0 |
| Blightbound | Damage | 40 | 0 | 0 | 0 |

#### Top legendaries that fill each cap

| Family | Top | Tight cap | Legendaries alone | With Obsidian 12 | Roomy cap | Legendaries alone | With Obsidian 12 |
|---|---|---|---|---|---|---|---|
| Income | 25 | 50 | 2 | 1 | 60 | 3 | 2 |
| XP | 25 | 50 | 2 | 1 | 60 | 3 | 2 |
| Kill reward | 25 | 60 | 3 | 1 | 70 | 3 | 2 |
| Click gold | 25 | 40 | 2 | 2 | 50 | 2 | 2 |
| Damage | 10 | 45 | 5 | 5 | 55 | 6 | 6 |

#### Damage: what a stronger weapon legendary does to S2 / S3 (13 pieces plus the weapon)

| Weapon legendary damage | Ashen Warlord total | Blightbound total | Cut at cap 45 / 50 / 55 (S2, S3) |
|---|---|---|---|
| +10 | 38 | 40 | 0/0/0, 0/0/0 |
| +15 | 43 | 45 | 0/0/0, 0/0/0 |
| +20 | 48 | 50 | 3/0/0, 5/0/0 |
| +25 | 53 | 55 | 8/3/0, 10/5/0 |

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

## Reading the tables (caps: income 50, XP 50, kill reward 60, click 40, damage 45)

- **Income, kill reward**: Obsidian 12 plus one top legendary totals 51 and 62 against caps of 50 and 60, so the cap cuts 1 and 2 points. "Set or legendary, not both" holds, and the cut is too small for a player to notice.
- **XP at 50**: Obsidian 12 (25) plus a top legendary (25) lands exactly on the cap, and Sunhoney (45 with the legendary) is under it. The headline +25 is fully paid for these builds, which the old cap of 40 was not (it threw away 10 points).
- **Click gold** never reaches 40 with one legendary (35 and 39); the cap guards only against two click legendaries.
- **Damage**: one top damage legendary leaves S2 at 38 and S3 at 40, under 45. In the fight engine the S2 kit beats every boss at 100 % at castle 8 gear levels and the time to win moves by about a second between 38, 45 and 48 %, so damage is not what limits those fights (gear at authored level; placeholder sets).
- **Legendary versus set**: Sunhoney 14 alone is 48 kill reward; with a top kill-reward legendary it is 20 + 25 = 45. That is the intended "set or legendary" choice, but it means a legendary can be worth less than the set piece it replaces. Tuning the set bonuses (R2 C5) should keep that in mind.
- **Caveats**: S1-S3 are `enabled: false` placeholders and no legendary exists yet (IDL-144), so "top legendary" is the headline tier, not an item.

## Recommendation

- Set the caps to **income 50, XP 50, kill reward 60, click 40, damage 45**.
- **Damage and weapon legendaries (owner: higher than +15, a little OP):** set weapon legendaries to a **top damage tier of +20** (other slots stay +10) and raise the damage cap from 45 to **50**. The weapon table shows S2 at 48 and S3 at 50 with a +20 weapon: the best set plus the best weapon sits exactly on the cap, nothing is wasted, and only a second damage perk is cut. At cap 45 the same weapon would waste 3 and 5 points. +25 would need cap 55 to waste nothing. This changes the decided damage cap (45), so it needs your explicit yes.
- The 14th-piece loss stays as designed; no code change is needed for it.

## IDL-222: boss band (waiting)

Owner decision: wait and decide later; a note is on the Linear issue. The evidence for when it is picked up:

- Every monster, bosses included, stands only 2 to 9 tiles from the castle (`maxCastleDistance` 9 in `src/config/combatConfig.ts`), while the frontier band starts at 13 (`DISTANCE_BANDS`). A "13+" band therefore needs the spawn range widened in the same change (IDL-53) or no boss ever spawns.
- With today's range an 8+ band is not empty (distances 8 and 9) and sits past the outskirts start (7).
- A distance band does not make bosses fair: at castle 8 gear levels an Obsidian 12 hero (level 30) beats the plains boss most of the time and none of the other three; only the weighting and level cap of IDL-222 option (b) would.

## Not in this sheet

Offline efficiency, offline cap hours, max HP % and chest speed. Offline keeps `HARD_LIMITS` (100 % and 72 h); the others need their own rows once the set tuning is final.
