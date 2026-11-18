import type { MonsterFamily, MonsterTag } from './monsters';

// The Bestiary's view of every monster (IDL-336, IDL-360): what it is (family), its traits (tags) and the lore line of the ones that had none. Pure data, ids never change. The older lore (rebirth biomes, hills ...) stays in `LORE` in monsters.ts.

/**
 * Family and tags of every monster. The family drives the Bestiary's family filter and the family bonuses of mastery ("+x% against beasts"); the tags are flavour chips. A monster without a row here reads as a Beast with no tags (a test fails on the gap).
 *
 * @category Monsters/Bestiary
 * @order 1
 */
export const META: Readonly<Record<string, { family: MonsterFamily; tags: readonly MonsterTag[] }>> = {
	// plains
	thistleBoar: { family: 'Beast', tags: ['Pack'] },
	burrowBadger: { family: 'Beast', tags: ['Armored'] },
	dustStrider: { family: 'Bird', tags: ['Fast'] },
	gravelQuail: { family: 'Bird', tags: ['Fast', 'Pack'] },
	stonehornBison: { family: 'Beast', tags: ['Armored'] },
	bossGreatAuroch: { family: 'Beast', tags: ['Boss', 'Pack'] },
	// forest
	mossbackWolf: { family: 'Beast', tags: ['Pack', 'Night'] },
	brambleImp: { family: 'Demon', tags: ['Magic'] },
	rotcapStag: { family: 'Beast', tags: ['Poison'] },
	emberSquirrel: { family: 'Beast', tags: ['Fire', 'Fast'] },
	pineconeWarden: { family: 'Plant', tags: ['Armored'] },
	bossElderStag: { family: 'Beast', tags: ['Boss', 'Magic'] },
	// hills
	magmaKnight: { family: 'Humanoid', tags: ['Fire', 'Armored'] },
	magmaCrab: { family: 'Vermin', tags: ['Fire', 'Armored'] },
	mawhornBrute: { family: 'Demon', tags: ['Poison'] },
	quarryDrake: { family: 'Dragon', tags: ['Fast', 'Fire'] },
	cairnSentinel: { family: 'Construct', tags: ['Armored'] },
	bossIronhorn: { family: 'Construct', tags: ['Boss', 'Armored', 'Fire'] },
	graniteRam: { family: 'Beast', tags: ['Armored'] },
	caveGoblinMiner: { family: 'Humanoid', tags: ['Pack'] },
	boulderBeetle: { family: 'Vermin', tags: ['Armored'] },
	bossHillGiant: { family: 'Humanoid', tags: ['Boss'] },
	// swamp
	toxicZombie: { family: 'Undead', tags: ['Poison'] },
	dumpback: { family: 'Beast', tags: ['Poison', 'Armored'] },
	rotHeron: { family: 'Bird', tags: ['Poison', 'Fast'] },
	scrapGolem: { family: 'Construct', tags: ['Armored'] },
	bogfireWisp: { family: 'Elemental', tags: ['Fire', 'Magic', 'Night'] },
	bossMireMatriarch: { family: 'Aquatic', tags: ['Boss', 'Poison'] },
	garbageOgre: { family: 'Humanoid', tags: ['Poison'] },
	// tundra
	frostHare: { family: 'Beast', tags: ['Frost', 'Fast'] },
	icetuskCalf: { family: 'Beast', tags: ['Frost', 'Armored'] },
	rimeWraith: { family: 'Undead', tags: ['Frost', 'Elite', 'Night'] },
	frostMoth: { family: 'Vermin', tags: ['Frost', 'Passive'] },
	glacierYeti: { family: 'Beast', tags: ['Frost', 'Elite'] },
	bossWinterWyrm: { family: 'Dragon', tags: ['Boss', 'Frost'] },
	// coast
	wreckCrab: { family: 'Vermin', tags: ['Water', 'Armored'] },
	netGull: { family: 'Bird', tags: ['Water', 'Pack'] },
	drownedSailor: { family: 'Undead', tags: ['Water', 'Night'] },
	tideglassJelly: { family: 'Aquatic', tags: ['Water', 'Poison', 'Passive'] },
	barnacleBrute: { family: 'Aquatic', tags: ['Water', 'Armored'] },
	bossReefLeviathan: { family: 'Aquatic', tags: ['Boss', 'Water'] },
	// lake
	mossSnapper: { family: 'Aquatic', tags: ['Water', 'Armored'] },
	reedNymph: { family: 'Plant', tags: ['Water', 'Magic'] },
	tidepoolGolem: { family: 'Construct', tags: ['Water', 'Armored'] },
	siltEel: { family: 'Aquatic', tags: ['Water', 'Fast', 'Magic'] },
	lilypadWarden: { family: 'Aquatic', tags: ['Water', 'Armored'] },
	pikeLurker: { family: 'Aquatic', tags: ['Water', 'Fast'] },
	bossLakeHydra: { family: 'Aquatic', tags: ['Boss', 'Water', 'Poison'] },
	// jungle
	skullVine: { family: 'Plant', tags: ['Poison'] },
	eyeHorror: { family: 'Demon', tags: ['Magic', 'Fast'] },
	zombieTriceratops: { family: 'Undead', tags: ['Armored'] },
	vinewhipPanther: { family: 'Beast', tags: ['Fast', 'Night'] },
	mossbackIdol: { family: 'Construct', tags: ['Armored', 'Magic'] },
	bossHardwoodColossus: { family: 'Plant', tags: ['Boss', 'Armored'] },
	bossBrainstorm: { family: 'Fungus', tags: ['Boss', 'Magic', 'Poison'] },
	// fields
	barnGargoyle: { family: 'Construct', tags: ['Fast'] },
	bucketKnight: { family: 'Humanoid', tags: ['Pack', 'Armored'] },
	hedgeBandit: { family: 'Humanoid', tags: ['Poison'] },
	crowMarshal: { family: 'Bird', tags: ['Pack', 'Fast'] },
	millstoneGolem: { family: 'Construct', tags: ['Armored'] },
	bossHarvestMatron: { family: 'Bird', tags: ['Boss'] },
	// orchard
	greenscaleWarden: { family: 'Dragon', tags: ['Armored'] },
	blossomRonin: { family: 'Humanoid', tags: ['Fast'] },
	grayGleaner: { family: 'Undead', tags: ['Night'] },
	mushroomWizard: { family: 'Fungus', tags: ['Magic', 'Poison'] },
	rootboundGardener: { family: 'Plant', tags: ['Armored'] },
	bossBlossomReaper: { family: 'Undead', tags: ['Boss', 'Fire', 'Magic'] },
	// blight
	gasketGoblin: { family: 'Humanoid', tags: ['Poison', 'Pack'] },
	blightedHusk: { family: 'Undead', tags: ['Poison', 'Armored'] },
	mothwingHexer: { family: 'Vermin', tags: ['Magic', 'Night'] },
	gloomCerberus: { family: 'Demon', tags: ['Elite', 'Night'] },
	sporebackOgre: { family: 'Fungus', tags: ['Poison', 'Elite'] },
	bossEyedMaw: { family: 'Demon', tags: ['Boss', 'Magic'] },
	// battlefield
	boneCleaver: { family: 'Undead', tags: ['Armored'] },
	frostguardKnight: { family: 'Undead', tags: ['Frost', 'Armored'] },
	gildedChampion: { family: 'Undead', tags: ['Fast'] },
	bannerWraith: { family: 'Undead', tags: ['Night', 'Magic'] },
	frostFlameKnight: { family: 'Elemental', tags: ['Fire', 'Frost', 'Armored'] },
	bossCinderWarlord: { family: 'Undead', tags: ['Boss', 'Fire'] },
};

/** Lore for the monsters that had none (plains to lake, the jungle, and the 21 of roster v2). Funny where it can be, one or two lines each. The rest of the lore is `LORE` in monsters.ts. */
export const MORE_LORE: Readonly<Record<string, string>> = {
	// plains and forest: the old farm country, where everything is a little too confident
	thistleBoar: 'Rooted up the thistle patch on purpose and now wears it as a crown. It has never lost an argument it could ram.',
	burrowBadger: 'Digs a new hole every night and forgets where the old ones are. Every farmer in the valley has stepped in at least one.',
	dustStrider: 'Long legs, short temper, and a theory that anything slower than it is a snack. The dust it kicks up is mostly spite.',
	gravelQuail: 'Scratches up the dust where the boar roots, and is gone before it settles.',
	stonehornBison: 'A bison that never learned to run, only to arrive.',
	bossGreatAuroch: 'The herd follows it because it is the only one who remembers where the grass was. It does not like being asked for directions.',
	mossbackWolf: 'The moss on its back is a good place to hide a snack. Nobody has ever asked what the snack is.',
	brambleImp: 'Born in a hedge, raised by a thorn, and quite sure the forest belongs to whoever bites hardest. It bites hardest.',
	rotcapStag: 'A mushroom grew on its antlers and the stag decided it was a crown. The forest has not had the heart to correct it.',
	emberSquirrel: 'Carries acorns and a grudge, and throws both.',
	pineconeWarden: 'Needles for armour, patience for a weapon.',
	bossElderStag: 'Older than the road, older than the toll, and rather tired of both. The forest turns to look when it lowers its head.',
	// hills
	quarryDrake: 'A young drake that decided the quarry is its nest.',
	cairnSentinel: 'A heap of stones that remembers being a wall.',
	// swamp
	dumpback: 'Wears a rubbish heap as a shell and keeps the best bits at the bottom. It is surprisingly proud of its collection.',
	rotHeron: 'It stands in the shallows for hours and looks wise. Then it eats a frog and ruins the effect.',
	bogfireWisp: 'A light that wants travellers to stand very still.',
	bossMireMatriarch: 'Every drain, pond and puddle in the swamp is a room in her house, and you are tracking mud through all of them.',
	// tundra
	frostHare: 'Fast enough to outrun a blizzard, and it does, daily, mostly to show off.',
	icetuskCalf: 'Still growing into its tusks, which makes it cross and clumsy in equal measure. Its mother is somewhere nearby, and worse.',
	rimeWraith: 'The cold keeps what it takes. This one kept a shape, a grudge and a faint memory of a warm fire.',
	glacierYeti: 'Hides in blizzards and hits like the thaw.',
	bossWinterWyrm: 'The first snow of every year is its breath. It likes to watch the villages light their fires, then count how many go out.',
	// coast
	wreckCrab: 'Moved into a shipwreck and redecorated with the ship. The cannon is a doorbell now.',
	netGull: 'It learned that a fishing net is a free lunch with extra steps, and has been tangled and indignant ever since.',
	drownedSailor: 'He still thinks the tide is coming in, and keeps checking the horizon for a ship that was salvaged years ago.',
	tideglassJelly: 'Pretty, drifting, and stinging all the way down.',
	barnacleBrute: 'Wears the reef it was born on.',
	bossReefLeviathan: 'The reef is its back and the lighthouse is a toothpick. Sailors do not name it; they just stop talking.',
	// lake
	mossSnapper: 'Sits so still that moss grows on it, and then snaps at whatever mistakes it for a rock. A very patient kind of rude.',
	reedNymph: 'She sings from the reeds to lure travellers close, then asks them to hold her very heavy harp.',
	siltEel: 'A shock in the shallows that you never see twice.',
	lilypadWarden: 'A frog the size of a boat and twice as stubborn.',
	bossLakeHydra: 'Seven heads, seven opinions, and not one of them agrees that you should leave.',
	// jungle
	skullVine: 'It grows around whatever it finds and wears the skulls like a trophy shelf. The shelf is getting full.',
	eyeHorror: 'One big eye, two small ones, and a permanent look of surprise. It sees everything and still walks into the trees.',
	zombieTriceratops: 'It died a long time ago and nobody told the legs. It is still very good at charging.',
	vinewhipPanther: 'Moves along the canopy and strikes from above.',
	mossbackIdol: 'A carved god that woke up annoyed.',
	// fields, orchard, blight, battlefield (roster v2)
	crowMarshal: 'Commands the crows, and the crows listen.',
	millstoneGolem: 'Grinds the grain and anything standing near it.',
	mushroomWizard: 'Found a hat and became a scholar.',
	rootboundGardener: 'Prunes trespassers, and files the cuttings in a very tidy shed.',
	sporebackOgre: 'Grew a second back out of the fungus and a third out of spite.',
	bannerWraith: 'Still carries the colours of an army that no longer exists.',
	frostFlameKnight: 'Armour half ice, half ember, fully unwilling to retire.',
};
