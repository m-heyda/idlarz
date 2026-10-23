# 05 · Balance backlog & upgrade notes

Only **remaining** work. Delivered so far: the first rebalance pass (click limiter, meat price, stacking animals, tile curve + resource costs, castle timers/costs, building costs, critter/chest limits, T1–T10, documented in [06](06-playtest-and-pacing-report.md)) and the endgame (castle levels 7–10, Rebirth/Legacy). The feature roadmap and the work order live in [08](08-followup-plan.md).

## 1. Balance leftovers (each needs approval before changing)

| # | Topic | Observation | Idea |
| --- | --- | --- | --- |
| BL1 | **Gap between active and idle players is small** (hardcore ≈ 32 d, idle ≈ 40 d in the sim) | Gold is only part of the economy; the castle timers (5 d 5 h to level 6) and resource costs dominate | Raise click power further, or let clicks also pay a small share of other resources / tap yields; re-run the sim |
| BL2 | **Levels and stat points barely matter** | ~1 point/level, +2.5 % each on a pool that the castle multiplies | Gate castle levels by player level, or raise per-point effects, or add respec |
| BL3 | **Chests and tile taps are small** next to income | chest = 10–60 min of *passive* gold; tap = 0.5 s of one tile | Scale chests with the click-inclusive income or give resource packs |
| BL4 | **Meat/food is still the strongest engine** (animal stacking × castle multiplier) | animals dominate mid-game income in the sim traces | Revisit `costScaling` (1.5–1.8) or add upkeep once the unfinished systems exist |
| BL5 | **Resource sinks are thin after the castle and tiles** | wood/stone/coal beyond tile and castle needs only sell for 0.5–1 gold | Equipment upgrades (U2), buildings with upgrade levels (U13), storage caps tied to the castle |
| BL6 | **Merchant has no depth** | one flat price per resource, no saturation | optional "market saturation" (price drops with volume sold, recovers over ~30 min) if burst selling shows up again |
| BL7 | **Late tiles are very expensive** | tile 50 ≈ 51 M gold + 5 M wood/stone + 4 M coal/food (curve flattens to ×1.17 past 40 tiles) | fine as an endgame sink; revisit if the Legacy discount (cap 45 %) makes late rebirth runs too cheap |
| BL8 | **Idle tile income** | with `BIOME_YIELD.scale` = 1.3 a tile adds ~0.1–0.5 gold-equivalent/s | consider per-biome specialisation bonuses (e.g. +x % per 4 same biome) |
| BL9 | **Legacy shop is four items** | all of them are flat percentages, so the choice is mostly "which first" | add one or two with a different shape (e.g. longer chest timer cap, extra critter gifts, a free animal slot) |
| BL10 | **Late Legacy runs flatten** | gain grows with `sqrt(tiles)` and the castle level, the shop is capped at 10 levels each; once the shop is maxed points only add the +5 % income each | consider a second prestige tier or a sink for surplus points |
| BL11 | **Biome luck and the 24 h player** | after the Coast/water clustering merge the seed spread is large (hardcore 27–45 d) and the 24 h/day auto-clicker bot is ~25 % faster than the 8 h/day hardcore bot | tune `BIOME_SPAWN` weights (fewer water tiles early or a wood/stone-yielding coast) and re-run `sim --seeds=3` |

## 2. Framework upgrade notes

On Next 15.5.28, React 19.3, Tailwind 4.3, Zustand 5.0, TypeScript 5.9, ESLint 9.39 (all within their majors); linting runs through the ESLint CLI (`npm run lint`) and the workspace root is pinned in `next.config.ts`. Held back deliberately: **Next 16**, **TypeScript 7**, **ESLint 10**, `@types/node` 26.

- Next 16 makes Turbopack the default, needs Node ≥ 20.9, and fixes the two PostCSS advisories bundled inside Next 15 (build-time tooling, not shipped to players).
- TypeScript 7 and ESLint 10: check `typescript-eslint` / `eslint-config-next` peer ranges first; upgrade one at a time and keep `npm run build`, `npm test` and `npm run sim` green.

## 3. Performance backlog

Per-tile store subscriptions (re-render on every tick), the 10 Hz `set()` that rebuilds `resources`, and the sprite/CSS weight of the pixel UI. Measure before optimising; saves are already debounced.
