# Monster art prompts, per biome

Prompts for the image tool, written in the same shape as the swamp sample ("A slugish purple monster from the swamps with debris in it and trash"): one sentence, a silhouette, a biome cue, two or three concrete details. Paste the **Prompt** line and add your `same style` option.

Source of the biome list: `docs/12-rebirth-biomes.md` (the 7 current biomes and the 5 rebirth biomes) and `docs/20-monster-families-and-rewards.md` (3-4 monsters and one boss per biome).

## How to use

- One prompt = one monster. Generate 2-4 variants and keep the one with the clearest silhouette; the game draws it small (about 40-64 px), so a bold shape beats fine detail.
- Keep the background plain or transparent, one creature, full body, centered, same camera angle as the two swamp samples.
- Every monster has a **colour anchor** (in the prompt) so the biomes read apart on the map: plains yellow-green, forest deep green and brown, hills grey and rust, swamp purple and murk, tundra ice blue and white, coast sand and teal, lake blue-green, jungle saturated teal-green with red, fields gold and straw, orchard pink-white and amber, blight violet-black and toxic green, battlefield mud brown, ash grey and rust red.
- Bosses are meant to be about 1.5-2x bigger than the regular monsters, with one extra feature (crown, banner, glow). The prompts say so; keep it if the tool lets you set a size.
- Names are working names. Rename freely.

> Lake and coast are water biomes, so today's monster rules (`LAND_BIOMES` in `config/combatConfig.ts`) do not spawn on them. Their prompts are ready for when shorelines get monsters; skip them if you do not need them yet.

---

## Plains (grass, gentle, near the castle)

1. **Thistle Boar**: `A stocky wild boar from the grassy plains with long curved tusks, a back covered in thistles and tall grass tufts, dusty yellow-green fur and small angry eyes`
2. **Burrow Badger**: `A big shaggy badger from the plains with a coat that looks like patches of turf and dried grass, huge dirt-caked claws, a striped snout and loose soil spilling off its back`
3. **Dust Strider**: `A tall long-legged ostrich-like bird from the windy plains, ragged tan and cream feathers, a sharp hooked beak, a necklace of bones and a lean mean stare`
4. **Boss, the Great Auroch**: `A colossal shaggy bison bull from the plains, huge crescent horns wrapped in broken fence wire and tattered banners, a crown of dry grass on its hump, snorting dust, much bigger than a normal monster`

## Forest (deep green, wood, moss)

1. **Mossback Wolf**: `A lean grey wolf from the deep forest with moss and ferns growing along its spine, bark-like patches on its shoulders, glowing green eyes and leaves caught in its fur`
2. **Bramble Imp**: `A small hunched woodland imp made of twisted twigs and thorny brambles, a hollow acorn cap for a hat, glowing amber eyes, long root-like fingers and a few red berries hanging off it`
3. **Rotcap Stag**: `A gaunt forest stag with antlers overgrown by glowing mushrooms and hanging moss, a half-hollow chest with fireflies inside, brown and deep green tones`
4. **Boss, the Elder Stag**: `A huge ancient forest stag spirit, antlers like a whole tree crown with leaves, birds' nests and glowing green runes, vines wrapped around its legs, roots trailing behind it, larger than a normal monster`

## Hills (grey stone, rust, mining)

1. **Granite Ram**: `A heavy mountain ram from the rocky hills with horns made of grey granite, a cracked stone-plated forehead, shaggy dirty wool and rust-orange moss on its back`
2. **Cave Goblin Miner**: `A scrawny green goblin miner from the hills with an oversized dented iron helmet and a lit lantern on it, a rusty pickaxe, a sack of ore on its back and a sly grin`
3. **Boulder Beetle**: `A giant armoured beetle from the hills whose shell looks like a lumpy boulder with ore crystals and gravel stuck in it, stubby thick legs, small glowing eyes`
4. **Boss, the Hill Giant**: `A towering brutish hill giant made of stacked grey stone and earth, a goat skull helmet, a massive stone club, moss and tiny pine trees growing on its shoulders, glowing rust-red eyes, much bigger than a normal monster`

## Swamp (purple, murk, junk)

Two monsters are already generated (your samples): **Garbage Ogre** (the purple troll with debris on its back) and **Dumpback** (the purple tortoise with a trash-heap shell). The Rot Heron and the boss are new.

1. *(sample)* **Garbage Ogre**
2. *(sample)* **Dumpback**
3. **Rot Heron**: `A tall gaunt heron from the swamps with patchy purple-grey feathers, a long sharp rusty-yellow beak, fishing line and reeds tangled around its legs, a dented tin can stuck on one foot, glowing sickly green eyes and a hunched stalking pose`
4. **Boss, the Mire Matriarch**: `A colossal purple angler toad from the swamps, a glowing lantern lure dangling over its huge jaw, lily pads and drowned treasure and rusty junk piled on its warty back, bioluminescent spots, dripping mud, much bigger than a normal monster`

## Tundra (ice blue, white, frost)

1. **Frost Hare**: `An oversized white hare from the frozen tundra with icicle antlers, frost-blue ears, long sharp front teeth, snow clumped in its fur and cold glowing eyes`
2. **Icetusk Calf**: `A young woolly mammoth calf from the tundra with a thick icy-blue and white shaggy coat, two short ice-crystal tusks, frozen breath clouds and snow piled on its back`
3. **Rime Wraith**: `A hooded ghostly figure made of jagged ice shards from the tundra, a hollow dark face with two pale blue lights, a tattered frozen cloak that fades into snow mist, long icicle claws`
4. **Boss, the Winter Wyrm**: `A huge serpentine ice dragon coiled in the snow, scales like frozen glass, a crown of icicle horns, a frosty mist around its jaws, a cracked glowing blue core in its chest, much bigger than a normal monster`

## Coast (sand, teal, driftwood, shipwreck)

1. **Wreck Crab**: `A giant hermit crab from the coast living in the broken hull of a tiny shipwreck, barnacles and rope all over the shell, one huge orange claw, sandy beige and teal colours`
2. **Net Gull**: `A hulking aggressive seagull from the coast with a fishing net draped over one wing, a torn sailor's scarf, a wicked yellow beak and a stolen golden coin in its talons`
3. **Drowned Sailor**: `A waterlogged undead sailor from the shore, seaweed-green skin, barnacles on his tricorn hat, an old rusty anchor chained to his wrist, dripping water, hollow glowing eyes`
4. **Boss, the Reef Leviathan**: `A giant kraken rising out of the shallows with thick coral-covered tentacles dragging a broken ship mast and tattered sail onto the beach, one huge glowing eye, teal and deep purple, much bigger than a normal monster`

## Lake (blue-green, reeds, water)

1. **Moss Snapper**: `A huge snapping turtle from the lake shore with a mossy shell covered in reeds and lily pads, a spiked tail, a cracked beak and murky blue-green skin`
2. **Reed Nymph**: `A slim spooky water spirit from the lake made of woven reeds and cattails, a pale face with dark eyes, long wet green hair, dripping water, small blue wisps floating around her`
3. **Pike Lurker**: `A long-bodied giant pike fish with stubby legs walking out of the lake, needle teeth, silver-blue scales with green stripes, a fishing hook stuck in its lip`
4. **Boss, the Lake Hydra**: `A three-headed water serpent hydra from the lake, blue-green scales, slimy reeds and lily pads draped over its necks, glowing yellow eyes, water pouring from its jaws, much bigger than a normal monster`

## Jungle (rebirth 1: saturated green, red, hardwood)

1. **Shadow Jaguar**: `A sleek black jaguar from the jungle with glowing emerald eyes, vines and red orchids wrapped around its legs and back, leaf-shaped markings in its fur, bared fangs`
2. **Orchid Spider**: `A giant jungle spider with a hairy body painted with glowing pink and red orchid patterns, long banded legs, many green eyes and silky webs dripping with petals`
3. **Poison Toad**: `A fat jungle poison toad with bright teal and yellow warty skin, red spots, dripping green venom, a big wide grin and a broad leaf stuck on its head`
4. **Boss, the Hardwood Colossus**: `An ancient jungle temple guardian, a huge mossy stone and red hardwood golem with a carved tribal mask face, hanging vines, glowing green eyes, a giant tree root fist, much bigger than a normal monster`

## Fields (rebirth 2: gold, straw, cloth)

1. **Murder Crow**: `An oversized black crow from the wheat fields with ragged feathers, a sharp beak, a torn scrap of cloth tied to its leg, glowing red eyes and a few golden wheat ears in its claws`
2. **Living Scarecrow**: `A stitched burlap scarecrow come alive from the fields, straw poking out of every seam, a broken wooden pole in its back, a pumpkin-like patched head with a jagged grin and glowing orange eyes`
3. **Harvest Boar**: `A big muscular boar from the farmland with a hay-coloured coat, a rusty plough blade strapped to its snout, a torn feed sack on its back and chewed wheat stalks hanging from its mouth`
4. **Boss, the Harvest King**: `A towering scarecrow lord from the fields wearing a crown of crows and wheat, a giant rusty scythe, a ragged flax cape, a hollow dark face with glowing eyes, a hay and cloth body, much bigger than a normal monster`

## Blossom Orchard (rebirth 3: pink, white, amber honey)

1. **Giant Hornet**: `A huge striped hornet from the blossom orchard, amber and black with translucent pink-tinted wings, a dripping honey stinger, angry compound eyes and a few petals stuck to its body`
2. **Honey Bear**: `A big round brown bear from the orchard with a beehive stuck on its head, golden honey dripping down its fur, a few bees circling, blossom petals in its shaggy coat`
3. **Thorn Dryad**: `A pale tree spirit woman from the orchard with pink cherry blossoms for hair, bark skin with thorny branches for arms, glowing amber eyes and an apple held in one hand`
4. **Boss, the Blossom Treant**: `A gigantic ancient apple tree monster in full bloom with a gnarled face in the trunk, pink and white blossoms, hanging golden honeycombs, beehives in its branches, glowing amber eyes, much bigger than a normal monster`

## Blight (rebirth 4: violet-black, toxic green, corruption)

1. **Ichor Slime**: `A shiny violet-black slime blob from the blighted land with sickly green veins glowing inside, a half-melted skull sinking in its body, dripping toxic green ooze and two uneven eyes`
2. **Tendril Horror**: `A grotesque mass of writhing violet and black tendrils with one big sickly green eye in the middle, sharp thorn tips, bubbling green pustules and a puddle of ichor underneath`
3. **Blighted Husk**: `The hollow corpse of a large beast from the blighted land, its ribcage split open with a toxic green glow inside, black tar leaking out of its eye sockets, purple fungal growths over the bones`
4. **Boss, the Blight Heart**: `A huge pulsing violet-black corruption mass with many glowing green eyes and long tendrils, fused fragments of armour and bones inside, ichor dripping from it, a giant beating heart in its centre, much bigger than a normal monster`

## Battlefield (rebirth 5: mud brown, ash grey, rust red)

1. **Skeleton Soldier**: `A skeleton soldier from the battlefield in a dented iron helmet and rusty chainmail scraps, a broken sword and a cracked round shield, tattered red cloth, glowing orange eye sockets`
2. **Siege Remnant**: `A hulking undead creature built from the wreck of a siege engine, broken catapult arm, wooden wheels, bones and spears stuck in it, rusty chains, scorched planks, glowing red embers inside`
3. **War Hound**: `An armoured undead war hound from the battlefield, patchy grey fur over exposed ribs, a spiked iron collar, a scrap of banner on its back, glowing red eyes and snarling teeth`
4. **Boss, the Undead Warlord**: `A massive undead warlord in battered black plate armour with a torn crimson cloak, a horned helmet, a giant notched greatsword and a broken banner, rows of tarnished war medals on his chest, glowing red eyes, much bigger than a normal monster`

---

## Where the finished art goes

`public/pixel/enemies/<biome>/<monster-id>.png`, one folder per biome (created when the art is sorted, bosses included). Ids are the kebab-case name from this file (`garbage-ogre`, `dumpback`, `rot-heron`); bosses use a `boss-` prefix (`boss-mire-matriarch`). Transparent background, one creature, full body. The folder is hand-supplied and untouched by `scripts/pixel/build.py`. Details: `public/pixel/enemies/README.md`. Nothing in the game reads these files yet; wiring them into `MONSTERS` is part of the monster rework ([20](20-monster-families-and-rewards.md)).
