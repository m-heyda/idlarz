# farm/ : IGNORE FOR NOW (reference for a future farm update)

**Agents: do not use, cut or implement anything from this folder until the owner starts the farm update.** The current farm UI stays exactly as it is (`scripts/pixel/reference/farm.png`, the pen back and front layers). Nothing here is scheduled in [RELEASE-PLAN](../../docs/plan/RELEASE-PLAN.md).

## What it is for

A far-future update: the farm gets **crops, not only animals**. The idea so far (not a design, not decided):

- Crops grown in **plots the player places by clicking**, in **frames on a grid** (plant, grow through stages, harvest).
- A **top-down view**, **not isometric / 45 degrees**, so a grid of plots reads clearly and clicks are precise; animals and buildings drawn from the same top-down angle in the farm screen.
- It would feed the T1 farm goods ([docs/plan/18-biome-buildings-and-material-tiers.md](../../docs/plan/18-biome-buildings-and-material-tiers.md) section 4) and the Fields and Orchard biomes.

## Files

| File | Contents |
|---|---|
| `3W_gVP.png` | "Farming Crops 1": a corn growth cycle (seed, sprout, three stages, cob) plus a bag, grains, broccoli, wheat and a tomato |
| `crops-preview-animated.gif` | a large grid of about 40 **crops in tilled earth** (pumpkin, cabbage, corn, tomatoes, berries, vines on trellises, peppers...), animated |
| `Top-Down-Farm-with-Animals-Pixel-Art-Asset-Pack5-720x480.webp` | a top-down farm kit: windmill, barns, animals, bushes, trees, a pond |
| `images.jpg` | a top-down pen with cows, pigs, a wooden fence and two crop plots with a cobble path |
| `Rhcseh.png` | a cosy farm screenshot (chickens, house, crop beds) as a mood reference |

## Notes for whoever picks this up later

- The files here are licensed to the owner for free use in the game (root [Licence](../README.md#licence)), so they can be cut directly when the farm update starts. Until then they stay reference only because the farm update is not scheduled, not because of licensing.
- Start with a design doc (grid size, stages, timers on the server clock, where the harvest goes), then the art.
- Check the current farm items and server rules first: [docs/game/economy.md](../../docs/game/economy.md) farm section and [docs/game/saves-and-server.md](../../docs/game/saves-and-server.md).
