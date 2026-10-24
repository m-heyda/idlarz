# Fight simulation

Real combat rules (rollHit, stepFight, mitigate) against a bot clicking at a steady speed (gaps jittered +-30 %), 300 fights per cell, no potions.
Cells: win % (mean seconds to win). Seed is fixed, so the table is reproducible.

| Loadout | Damage | Armor | Max HP | Crit % | Super % |
|---|---|---|---|---|---|
| starter kit | 2 | 2 | 101 | 3.8 | 5 |
| woodland set + club | 3 | 13 | 139 | 3.8 | 5 |
| apprentice set + wand | 1 | 4 | 145 | 12.8 | 5 |
| knight's set + mace | 7 | 43 | 151 | 3.8 | 5 |
| knight's set + recurve bow | 4 | 43 | 151 | 15.8 | 5 |
| obsidian set + maul | 10 | 57 | 193 | 13.8 | 9 |
| obsidian set + longbow | 6 | 57 | 193 | 28.8 | 12 |
| rattatui set (fang blade) | 10 | 63 | 267 | 22.8 | 17 |
| rattatui + titan maul | 16 | 63 | 242 | 18.8 | 13 |
| rattatui + starfall bow | 9 | 63 | 242 | 34.8 | 17 |

## Rat tier 1

| Loadout | 4 cps | 7 cps | 10 cps | 15 cps | 25 cps |
|---|---|---|---|---|---|
| starter kit | 100% (12s) | 100% (7s) | 100% (5s) | 100% (3s) | 100% (2s) |
| woodland set + club | 100% (8s) | 100% (5s) | 100% (3s) | 100% (2s) | 100% (1s) |
| apprentice set + wand | 100% (22s) | 100% (12s) | 100% (9s) | 100% (6s) | 100% (3s) |
| knight's set + mace | 100% (4s) | 100% (2s) | 100% (1s) | 100% (1s) | 100% (1s) |
| knight's set + recurve bow | 100% (5s) | 100% (3s) | 100% (2s) | 100% (1s) | 100% (1s) |
| obsidian set + maul | 100% (2s) | 100% (1s) | 100% (1s) | 100% (1s) | 100% (0s) |
| obsidian set + longbow | 100% (3s) | 100% (2s) | 100% (1s) | 100% (1s) | 100% (0s) |
| rattatui set (fang blade) | 100% (2s) | 100% (1s) | 100% (1s) | 100% (1s) | 100% (0s) |
| rattatui + titan maul | 100% (1s) | 100% (1s) | 100% (1s) | 100% (0s) | 100% (0s) |
| rattatui + starfall bow | 100% (2s) | 100% (1s) | 100% (1s) | 100% (1s) | 100% (0s) |

## Rat tier 3

| Loadout | 4 cps | 7 cps | 10 cps | 15 cps | 25 cps |
|---|---|---|---|---|---|
| starter kit | 100% (27s) | 100% (15s) | 100% (11s) | 100% (7s) | 100% (4s) |
| woodland set + club | 100% (18s) | 100% (10s) | 100% (7s) | 100% (5s) | 100% (3s) |
| apprentice set + wand | 100% (49s) | 100% (28s) | 100% (20s) | 100% (13s) | 100% (8s) |
| knight's set + mace | 100% (8s) | 100% (5s) | 100% (3s) | 100% (2s) | 100% (1s) |
| knight's set + recurve bow | 100% (12s) | 100% (7s) | 100% (5s) | 100% (3s) | 100% (2s) |
| obsidian set + maul | 100% (5s) | 100% (3s) | 100% (2s) | 100% (1s) | 100% (1s) |
| obsidian set + longbow | 100% (7s) | 100% (4s) | 100% (3s) | 100% (2s) | 100% (1s) |
| rattatui set (fang blade) | 100% (4s) | 100% (3s) | 100% (2s) | 100% (1s) | 100% (1s) |
| rattatui + titan maul | 100% (3s) | 100% (2s) | 100% (1s) | 100% (1s) | 100% (0s) |
| rattatui + starfall bow | 100% (4s) | 100% (2s) | 100% (2s) | 100% (1s) | 100% (1s) |

## Rat tier 5

| Loadout | 4 cps | 7 cps | 10 cps | 15 cps | 25 cps |
|---|---|---|---|---|---|
| starter kit | 0% | 0% | 0% | 100% (16s) | 100% (10s) |
| woodland set + club | 24% (39s) | 100% (23s) | 100% (16s) | 100% (11s) | 100% (6s) |
| apprentice set + wand | 0% | 0% | 100% (44s) | 100% (29s) | 100% (18s) |
| knight's set + mace | 100% (18s) | 100% (10s) | 100% (7s) | 100% (5s) | 100% (3s) |
| knight's set + recurve bow | 100% (27s) | 100% (15s) | 100% (11s) | 100% (7s) | 100% (4s) |
| obsidian set + maul | 100% (11s) | 100% (6s) | 100% (4s) | 100% (3s) | 100% (2s) |
| obsidian set + longbow | 100% (15s) | 100% (9s) | 100% (6s) | 100% (4s) | 100% (2s) |
| rattatui set (fang blade) | 100% (10s) | 100% (5s) | 100% (4s) | 100% (3s) | 100% (2s) |
| rattatui + titan maul | 100% (6s) | 100% (4s) | 100% (3s) | 100% (2s) | 100% (1s) |
| rattatui + starfall bow | 100% (9s) | 100% (5s) | 100% (4s) | 100% (3s) | 100% (2s) |

## Rat King (5200 HP, 75 s)

| Loadout | 4 cps | 7 cps | 10 cps | 15 cps | 25 cps |
|---|---|---|---|---|---|
| starter kit | 0% | 0% | 0% | 0% | 0% |
| woodland set + club | 0% | 0% | 0% | 0% | 0% |
| apprentice set + wand | 0% | 0% | 0% | 0% | 0% |
| knight's set + mace | 0% | 0% | 0% | 100% (47s) | 100% (28s) |
| knight's set + recurve bow | 0% | 0% | 0% | 0% | 100% (44s) |
| obsidian set + maul | 0% | 100% (63s) | 100% (44s) | 100% (30s) | 100% (18s) |
| obsidian set + longbow | 0% | 0% | 100% (62s) | 100% (42s) | 100% (25s) |
| rattatui set (fang blade) | 0% | 100% (55s) | 100% (39s) | 100% (26s) | 100% (16s) |
| rattatui + titan maul | 100% (65s) | 100% (37s) | 100% (26s) | 100% (17s) | 100% (10s) |
| rattatui + starfall bow | 0% | 100% (54s) | 100% (38s) | 100% (25s) | 100% (15s) |
