# 19 · Castle costs and the old tables (what is left of the first build steps)

The castle timers (halved, see [18 §5.1](18-biome-buildings-and-material-tiers.md)) and the resource-key registry (`catalog/resources.ts`, `catalog/resourceKeys.ts`) are built; the code and the tests are the record.

## Still open

- **The first five castle costs x0.75** were proposed and never applied. With the halved timers the first rebirth of the `hardcore-rebirth6` bot comes on day 2.8 (the old target was day 5-7, [pacing targets](../reference/pacing.md)), and between upgrades 5 and 6 the castle waits about 12 h for resources: the costs, not the timers, are the limit there. Decide with `npm run sim -- --seeds=3` whether the costs go **up** instead, and re-measure the human bot (its 7-8 day first run is limited by something other than income or timers; find out what).
