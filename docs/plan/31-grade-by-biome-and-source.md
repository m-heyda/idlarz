# 31 · Which grade drops where (IDL-244 table, written with IDL-238)

*Measured 2026-11-09 with the loot pipeline (200,000 rolls per row, seed 2026) after G1-G6 went live. The rules are in the JSDoc of `LIVE_GRADES`, `gradeLevels`, `gradeRarities` and `BIOME_LOOT`; this page only holds the numbers so the owner can approve them.*

## 1. Item levels each source reaches

| Source | Item levels | Pool |
| --- | --- | --- |
| Normal monster, plains | 1-20, grown up to 30 (+1 variance) | `equipment_plains`, ceiling G4 |
| Normal monster, forest | 4-24, grown up to 34 | ceiling G4 |
| Normal monster, swamp | 8-28, grown up to 38 | ceiling G5 |
| Normal monster, tundra | 12-30, grown up to 40 | ceiling G7 |
| Boss | 15-45 | all grades |
| Chest | 4 + 3 per castle level (castle 10 = 31) | all grades |
| Merchant shelf | same as the chest, held to the best grade worn | all grades up to that |

## 2. Grade by item level (windows, rarities, share of drops)

| Grade | Item levels | Rarities it carries | Drops from |
| --- | --- | --- | --- |
| G1 | 1-8 | common | every source at those levels |
| G2 | 9-18 | common, uncommon | likewise |
| G3 | 19-30 | uncommon | likewise |
| G4 | 31-42 | uncommon, rare | grown monsters of forest, swamp, tundra; bosses 31-42; chests of castle 10 (2 of 3 drops) |
| G5 | 43-54 | rare | bosses 43-45 only (every drop of a level 43+ boss) |
| G6 (Obsidian set) | 55-66, then open | rare, epic, legendary and the rest | nothing reaches it yet (a safe no-op) |

Per source and level (share of the gear that drops, grade mix; rarity after it):

| Source | Level | Gear per kill | Grades | Rarity |
| --- | ---: | ---: | --- | --- |
| forest | 24 | 0.349 | G3 100 % | uncommon 100 % |
| forest | 30 | 0.410 | G3 67 %, G4 33 % | uncommon 92 %, rare 8 % |
| forest, swamp, tundra | 34 | 0.450 | G4 100 % | uncommon 76 %, rare 24 % |
| forest, swamp, tundra | 40 | 0.51 | G4 100 % | uncommon 76 %, rare 24 % |
| boss | 15 | 1.0 | G2 100 % | common 40 %, uncommon 60 % |
| boss | 19-30 | 1.0 | G3 100 % | uncommon 100 % |
| boss | 31-42 | 1.0 | G4 100 % | uncommon 50 %, rare 50 % |
| boss | 43-45 | 1.0 | G5 100 % | rare 100 % |
| chest | castle 1 / 5 / 8-9 | 0.80 | G1 / G2 / G3 | follows the grade |
| chest | castle 10 | 0.80 | G3 33 %, G4 67 % | |

## 3. Expected sources to the first G4 and G5 piece, per slot

Number of sources (kills, bosses, chests) until the first piece of that slot, on average (1 / the chance per source). A chest comes every 10 minutes at Luck 0; a boss is one kill; a grown level 36 monster is the monster row.

| Slot | Monster 36 (G4) | Boss 35 (G4) | Chest castle 10 (G4) | Boss 44 (G5) |
| --- | ---: | ---: | ---: | ---: |
| weapon | 11 | 5 | 10 | 5 |
| off hand | 18 | 8 | 15 | 7 |
| ring | 13 | 6 | 12 | 9 |
| neck | 27 | 12 | 23 | 5 |
| feet, legs | 26-27 | 12-13 | 23 | 14-28 |
| head, shoulder, chest, hands, cape, charm, belt | 52-53 | 25 | 45-48 | 28 |

So from chests alone at castle 10 a G4 weapon takes about 1.7 hours and a given armour slot (head, chest...) about 8 hours, a boss pays a G4 piece of a given armour slot every 25 kills, and G5 is a trickle (bosses 43-45).

## 4. What changed for rarity

A rarity follows its grade, and G6 is now the open top grade instead of G3. So **rare** gear drops only at item level 31+ (G4 and G5), **epic and legendary** non-named gear drops nowhere until G6 content exists, and item levels 19-30 give uncommon only (before: the usual 70 / 22 / 7 / 1 / 0.2 mix of common to legendary). The loot validator reports these weights as unreachable (a warning, not an error).

## 5. The plains ceiling (decided 2026-11-09, owner)

The plains pool used to stop at G3, whose window ends at item level 30, so a plains monster grown past that (levels 1-20 plus 10 levels of growth) rolled item level 31 and found no base (0.142 gear per kill at monster level 31). The plains ceiling is now G4. Plains monsters now drop 0.309 gear per kill at level 20, 0.359 at 25, 0.409 at 30 (G3 67 %, G4 33 %) and 0.420 at 31 (G4 66 %, G3 34 %), with no empty-pool warnings.

## 6. Rarity (decided 2026-11-09, owner)

G3-G5 carry only their own rarities (uncommon-only at item level 19-30) and the loot validator reports the unreachable epic and legendary weights as a warning. Accepted.
