# Fight simulation

Real combat rules (rollHit, stepFight, mitigate) against a bot clicking at a steady speed (gaps jittered +-30 %), 300 fights per cell, no potions.
Cells: win % (mean seconds to win). Seed is fixed, so the table is reproducible.

| Loadout | Damage | Armor | Max HP | Crit % | Super % |
|---|---|---|---|---|---|
| starter kit | 6 | 2 | 101 | 3.8 | 5 |
| woodland set + club | 9 | 13 | 139 | 3.8 | 5 |
| apprentice set + wand | 5 | 4 | 145 | 12.8 | 5 |
| knight's set + mace | 21 | 43 | 151 | 3.8 | 5 |
| knight's set + recurve bow | 12 | 43 | 151 | 15.8 | 5 |
| obsidian set + maul | 30 | 57 | 193 | 13.8 | 9 |
| obsidian set + longbow | 18 | 57 | 193 | 28.8 | 12 |
| rattatui set (fang blade) | 30 | 63 | 267 | 22.8 | 17 |
| rattatui + titan maul | 48 | 63 | 242 | 18.8 | 13 |
| rattatui + starfall bow | 27 | 63 | 242 | 34.8 | 17 |

## Rat level 1

| Loadout | 4 cps | 7 cps | 10 cps | 15 cps | 25 cps |
|---|---|---|---|---|---|
| starter kit | 100% (4s) | 100% (2s) | 100% (2s) | 100% (1s) | 100% (1s) |
| woodland set + club | 100% (3s) | 100% (2s) | 100% (1s) | 100% (1s) | 100% (0s) |
| apprentice set + wand | 100% (4s) | 100% (3s) | 100% (2s) | 100% (1s) | 100% (1s) |
| knight's set + mace | 100% (1s) | 100% (1s) | 100% (0s) | 100% (0s) | 100% (0s) |
| knight's set + recurve bow | 100% (2s) | 100% (1s) | 100% (1s) | 100% (1s) | 100% (0s) |
| obsidian set + maul | 100% (1s) | 100% (1s) | 100% (0s) | 100% (0s) | 100% (0s) |
| obsidian set + longbow | 100% (1s) | 100% (1s) | 100% (0s) | 100% (0s) | 100% (0s) |
| rattatui set (fang blade) | 100% (1s) | 100% (0s) | 100% (0s) | 100% (0s) | 100% (0s) |
| rattatui + titan maul | 100% (1s) | 100% (0s) | 100% (0s) | 100% (0s) | 100% (0s) |
| rattatui + starfall bow | 100% (1s) | 100% (0s) | 100% (0s) | 100% (0s) | 100% (0s) |

## Rat level 5

| Loadout | 4 cps | 7 cps | 10 cps | 15 cps | 25 cps |
|---|---|---|---|---|---|
| starter kit | 100% (10s) | 100% (5s) | 100% (4s) | 100% (3s) | 100% (2s) |
| woodland set + club | 100% (6s) | 100% (4s) | 100% (3s) | 100% (2s) | 100% (1s) |
| apprentice set + wand | 100% (10s) | 100% (6s) | 100% (4s) | 100% (3s) | 100% (2s) |
| knight's set + mace | 100% (3s) | 100% (2s) | 100% (1s) | 100% (1s) | 100% (0s) |
| knight's set + recurve bow | 100% (4s) | 100% (2s) | 100% (2s) | 100% (1s) | 100% (1s) |
| obsidian set + maul | 100% (2s) | 100% (1s) | 100% (1s) | 100% (0s) | 100% (0s) |
| obsidian set + longbow | 100% (3s) | 100% (1s) | 100% (1s) | 100% (1s) | 100% (0s) |
| rattatui set (fang blade) | 100% (2s) | 100% (1s) | 100% (1s) | 100% (0s) | 100% (0s) |
| rattatui + titan maul | 100% (1s) | 100% (1s) | 100% (0s) | 100% (0s) | 100% (0s) |
| rattatui + starfall bow | 100% (2s) | 100% (1s) | 100% (1s) | 100% (0s) | 100% (0s) |

## Rat level 9

| Loadout | 4 cps | 7 cps | 10 cps | 15 cps | 25 cps |
|---|---|---|---|---|---|
| starter kit | 28% (21s) | 100% (13s) | 100% (9s) | 100% (6s) | 100% (4s) |
| woodland set + club | 100% (15s) | 100% (8s) | 100% (6s) | 100% (4s) | 100% (2s) |
| apprentice set + wand | 100% (25s) | 100% (14s) | 100% (10s) | 100% (7s) | 100% (4s) |
| knight's set + mace | 100% (6s) | 100% (4s) | 100% (3s) | 100% (2s) | 100% (1s) |
| knight's set + recurve bow | 100% (10s) | 100% (6s) | 100% (4s) | 100% (3s) | 100% (2s) |
| obsidian set + maul | 100% (4s) | 100% (2s) | 100% (2s) | 100% (1s) | 100% (1s) |
| obsidian set + longbow | 100% (6s) | 100% (3s) | 100% (2s) | 100% (1s) | 100% (1s) |
| rattatui set (fang blade) | 100% (4s) | 100% (2s) | 100% (1s) | 100% (1s) | 100% (1s) |
| rattatui + titan maul | 100% (2s) | 100% (1s) | 100% (1s) | 100% (1s) | 100% (0s) |
| rattatui + starfall bow | 100% (4s) | 100% (2s) | 100% (1s) | 100% (1s) | 100% (1s) |

## Rat King (10400 HP, 75 s)

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

# Level 30 builds

The same bot with 25 spare attribute points spent as shown (bonuses count points above the starting 5). Win % (mean seconds).

## Rat level 9

| Build + gear | Damage/hit | Armor | 7 cps | 10 cps | 15 cps |
|---|---|---|---|---|---|
| no points spent, obsidian set + maul (physical) | 30 | 57 | 100% (2s) | 100% (2s) | 100% (1s) |
| warrior: +25 Strength, obsidian set + maul (physical) | 45 | 63.3 | 100% (1s) | 100% (1s) | 100% (1s) |
| mage: +25 Intelligence, obsidian set + maul (physical) | 30 | 57 | 100% (2s) | 100% (2s) | 100% (1s) |
| tank: +15 Vitality, +10 Dexterity, obsidian set + maul (physical) | 30 | 69.5 | 100% (2s) | 100% (2s) | 100% (1s) |
| balanced: +5 each, obsidian set + maul (physical) | 33 | 63.3 | 100% (2s) | 100% (1s) | 100% (1s) |
| no points spent, obsidian set + staff (magic) | 20 | 57 | 100% (3s) | 100% (2s) | 100% (2s) |
| warrior: +25 Strength, obsidian set + staff (magic) | 20 | 63.3 | 100% (3s) | 100% (2s) | 100% (2s) |
| mage: +25 Intelligence, obsidian set + staff (magic) | 32 | 57 | 100% (2s) | 100% (2s) | 100% (1s) |
| tank: +15 Vitality, +10 Dexterity, obsidian set + staff (magic) | 20 | 69.5 | 100% (3s) | 100% (2s) | 100% (2s) |
| balanced: +5 each, obsidian set + staff (magic) | 22.4 | 63.3 | 100% (3s) | 100% (2s) | 100% (1s) |

## Rat King (10400 HP, 75 s)

| Build + gear | Damage/hit | Armor | 7 cps | 10 cps | 15 cps |
|---|---|---|---|---|---|
| no points spent, obsidian set + maul (physical) | 30 | 57 | 100% (63s) | 100% (44s) | 100% (30s) |
| warrior: +25 Strength, obsidian set + maul (physical) | 45 | 63.3 | 100% (40s) | 100% (28s) | 100% (19s) |
| mage: +25 Intelligence, obsidian set + maul (physical) | 30 | 57 | 100% (63s) | 100% (44s) | 100% (30s) |
| tank: +15 Vitality, +10 Dexterity, obsidian set + maul (physical) | 30 | 69.5 | 100% (61s) | 100% (42s) | 100% (28s) |
| balanced: +5 each, obsidian set + maul (physical) | 33 | 63.3 | 100% (54s) | 100% (37s) | 100% (25s) |
| no points spent, obsidian set + staff (magic) | 20 | 57 | 0% | 100% (66s) | 100% (44s) |
| warrior: +25 Strength, obsidian set + staff (magic) | 20 | 63.3 | 0% | 100% (62s) | 100% (42s) |
| mage: +25 Intelligence, obsidian set + staff (magic) | 32 | 57 | 100% (60s) | 100% (42s) | 100% (28s) |
| tank: +15 Vitality, +10 Dexterity, obsidian set + staff (magic) | 20 | 69.5 | 0% | 100% (64s) | 100% (43s) |
| balanced: +5 each, obsidian set + staff (magic) | 22.4 | 63.3 | 2% (74s) | 100% (55s) | 100% (37s) |

# Skills (level 30)

The bot also casts Heal (under 50 % HP) and Stun (whenever it is ready); mana and cooldowns apply, no potions. Skills do no damage, so a fight the bot already wins takes as long as before: they only move the line where gear stops being enough. Cells: win % (mean seconds, mean HP left at the end).

## Rat King (10400 HP, 75 s)

| Loadout | Skills | 7 cps | 10 cps | 12 cps | 15 cps | 25 cps |
|---|---|---|---|---|---|---|
| starter kit | none | 0% | 0% | 0% | 0% | 0% |
| starter kit | Heal + Stun | 0% | 0% | 0% | 0% | 0% |
| woodland set + club | none | 0% | 0% | 0% | 0% | 0% |
| woodland set + club | Heal + Stun | 0% | 0% | 0% | 0% | 22% (66s, 3% HP) |
| knight's set + mace | none | 0% | 0% | 98% (59s, 8% HP) | 100% (48s, 27% HP) | 100% (28s, 56% HP) |
| knight's set + mace | Heal + Stun | 0% | 100% (71s, 28% HP) | 100% (59s, 47% HP) | 100% (48s, 63% HP) | 100% (28s, 64% HP) |
| obsidian set + maul | none | 100% (63s, 33% HP) | 100% (44s, 54% HP) | 100% (37s, 61% HP) | 100% (30s, 70% HP) | 100% (18s, 83% HP) |
| obsidian set + maul | Heal + Stun | 100% (63s, 60% HP) | 100% (44s, 61% HP) | 100% (37s, 68% HP) | 100% (30s, 75% HP) | 100% (18s, 86% HP) |
| rattatui + titan maul | none | 100% (37s, 85% HP) | 100% (26s, 90% HP) | 100% (22s, 91% HP) | 100% (17s, 93% HP) | 100% (10s, 96% HP) |
| rattatui + titan maul | Heal + Stun | 100% (37s, 90% HP) | 100% (26s, 92% HP) | 100% (22s, 94% HP) | 100% (17s, 95% HP) | 100% (10s, 97% HP) |

# The Rat King by level

A boss: level 15 to 25 when he appears (higher with the castle), up to +10 as he grows, armor, 10 % crits, 25 % Stun resistance. HP, attack and armor follow the item level curve. Gear "at the level" is the same set at the item level of the King; "behind" is item level 15. Win % (mean seconds). No skills, no potions.

| King level | Loadout | Gear | 4 cps | 7 cps | 10 cps | 15 cps | 25 cps |
|---|---|---|---|---|---|---|---|
| 15 (10400 HP, armor 20) | knight's set + mace | at the level | 0% | 100% (67s) | 100% (47s) | 100% (31s) | 100% (19s) |
| 15 (10400 HP, armor 20) | obsidian set + maul | at the level | 0% | 100% (48s) | 100% (34s) | 100% (23s) | 100% (13s) |
| 15 (10400 HP, armor 20) | rattatui + titan maul | at the level | 100% (37s) | 100% (21s) | 100% (15s) | 100% (10s) | 100% (6s) |
| 25 (14077 HP, armor 25) | knight's set + mace | at the level | 0% | 100% (73s) | 100% (51s) | 100% (34s) | 100% (20s) |
| 25 (14077 HP, armor 25) | knight's set + mace | behind | 0% | 0% | 95% (68s) | 100% (46s) | 100% (27s) |
| 25 (14077 HP, armor 25) | obsidian set + maul | at the level | 0% | 100% (52s) | 100% (37s) | 100% (25s) | 100% (15s) |
| 25 (14077 HP, armor 25) | obsidian set + maul | behind | 0% | 100% (71s) | 100% (50s) | 100% (33s) | 100% (20s) |
| 25 (14077 HP, armor 25) | rattatui + titan maul | at the level | 100% (40s) | 100% (23s) | 100% (16s) | 100% (11s) | 100% (6s) |
| 25 (14077 HP, armor 25) | rattatui + titan maul | behind | 100% (55s) | 100% (31s) | 100% (22s) | 100% (15s) | 100% (9s) |
| 35 (17754 HP, armor 30) | knight's set + mace | at the level | 0% | 0% | 100% (56s) | 100% (38s) | 100% (22s) |
| 35 (17754 HP, armor 30) | knight's set + mace | behind | 0% | 0% | 0% | 0% | 100% (37s) |
| 35 (17754 HP, armor 30) | obsidian set + maul | at the level | 0% | 100% (57s) | 100% (40s) | 100% (27s) | 100% (16s) |
| 35 (17754 HP, armor 30) | obsidian set + maul | behind | 0% | 0% | 100% (67s) | 100% (45s) | 100% (27s) |
| 35 (17754 HP, armor 30) | rattatui + titan maul | at the level | 100% (42s) | 100% (24s) | 100% (17s) | 100% (11s) | 100% (7s) |
| 35 (17754 HP, armor 30) | rattatui + titan maul | behind | 52% (73s) | 100% (42s) | 100% (30s) | 100% (20s) | 100% (12s) |
