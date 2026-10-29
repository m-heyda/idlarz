# farm/ : IGNORE FOR NOW (reference for a future farm update)

**Agents: do not use, cut or implement anything from this folder until the owner starts the farm update.** The current farm UI stays exactly as it is (`scripts/pixel/reference/farm.png`, the pen back and front layers). Nothing here is scheduled in [RELEASE-PLAN](../../docs/RELEASE-PLAN.md).

## What it is for

A far-future update: the farm gets **crops, not only animals**. The idea so far (not a design, not decided):

- Crops grown in **plots the player places by clicking**, in **frames on a grid** (plant, grow through stages, harvest).
- A **top-down view**, **not isometric / 45 degrees**, so a grid of plots reads clearly and clicks are precise; animals and buildings drawn from the same top-down angle in the farm screen.
- It would feed the T1 farm goods ([docs/18](../../docs/18-biome-buildings-and-material-tiers.md) section 4) and the Fields and Orchard biomes.

## Files

| File | Contents |
|---|---|
| `3W_gVP.png` | "Farming Crops 1": a corn growth cycle (seed, sprout, three stages, cob) plus a bag, grains, broccoli, wheat and a tomato |
| `crops-preview-animated.gif` | a large grid of about 40 **crops in tilled earth** (pumpkin, cabbage, corn, tomatoes, berries, vines on trellises, peppers...), animated |
| `Free-Pixel-Art-Plants-for-Farm.webp` | a top-down farm scene with fruit trees, vines, rows of plants, and a cobble path |
| `Top-Down-Farm-with-Animals-Pixel-Art-Asset-Pack5-720x480.webp` | a top-down farm kit: windmill, barns, animals, bushes, trees, a pond |
| `images.jpg` | a top-down pen with cows, pigs, a wooden fence and two crop plots with a cobble path |
| `Rhcseh.png` | a cosy farm screenshot (chickens, house, crop beds) as a mood reference |

## Notes for whoever picks this up later

- The licence of every file here is unknown (root README); treat all as reference.
- Start with a design doc (grid size, stages, timers on the server clock, where the harvest goes), then the art.
- Check the current farm items and server rules first: [docs/02](../../docs/02-mechanics.md) farm section and [docs/11](../../docs/11-server-authority.md).
