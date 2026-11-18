## What

The Bestiary window, with real mastery bonuses, 21 new monsters, monster ingredient drops and a Storybook catalogue. Linear: IDL-322 (window), IDL-336 (mastery system), IDL-360 (roster v2), IDL-310 (bonuses); crafting ideas for the new drops are on IDL-358 and IDL-226.

## Window (`BestiaryWindow`)
- Wires the design-system Bestiary view as a data-driven `BestiaryPanel` (`packages/design-system/src/views/bestiary.tsx`): summary bar, filters (All, Discovered, Near tier, Ready, Bosses, any family), biome goal strips, monster cards with the same level gems as the Merchant tiles, and a paper detail with lore, records, the mastery ladder (Claim per tier, Claim all), stats with +/- level controls and the drop table at that level.
- Drag-resizable like the other windows; the panel lays itself out from its own width with CSS container queries (`ds-bst`: wide, medium, narrow).
- Dock badge counts claimable tiers and biome goals. Claims and refusals go through `notify`.

## Mastery (server, additive, save compatible)
- Structured tier bonuses (`catalog/mastery.ts`): damage dealt, damage taken, gold, XP and gear drop chance, against that monster; boss ladder 1 / 5 / 25 / 100; top tier pays gems (10 normal, 40 boss).
- Biome collection goals (every monster of a biome, boss included, at tier N) with a bonus against the whole biome; `stats.biomeClaimed` is a new optional field with a tolerant reader. `POST /api/mastery` gets `claimBiome`; Claim all includes biome goals.
- `masteryBonusesFor` is the one pure function, applied in the fight (`fightSteps.ts`), the kill reward (`killIncome`, loot chance) and so in offline settlement. Caps per stat in `MASTERY_CAPS`.
- Save fixtures and `tests/saves/*` untouched and green.

## Roster v2 and content
- 21 new monsters (glass cannon, armored wall, brute builds), 5 normals + 1 boss in every biome; placeholder art. Every monster has family, tags and lore (some funny).
- 26 spare resource sprites became monster ingredients (junk materials, sold today, crafting sub-ingredients later): drops per family, per monster and guaranteed per boss, scaling with level (`catalog/monsterDrops.ts`, `@table bestiary-ingredients`).
- New deeds: Scholar IV, Archivist, Field Naturalist.

## Storybook
`Screens/Bestiary`: Window (interactive sample), Narrow, Nothing met, and Monster catalogue (every monster with art, stats and drops at any level, lore and spawn requirements).

## Numbers are proposals
Bonus values, caps, gem amounts and drop chances are starting points for the balance pass (IDL-275). The golden fight fixture was re-recorded on purpose (roster change); win-chance estimates do not include mastery yet.

## Not in this PR
"Last seen" / Mark on map, the "Your odds" map tooltip line, real art for the 21 monsters, harder-biome growth steps.
