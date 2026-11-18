import type { ItemDef } from '@/types/game';

// Junk materials (IDL-312): trade goods with no use but the merchant. They stack by rarity (`JUNK_STACK_MAX`: 100,000 common, 50,000 uncommon, 25,000 rare, 10,000 epic), drop from monsters (config in `lib/loot/junkDrops.ts`) and are what the Bag's Sell junk button sells (`lib/loot/junk.ts`). The cheap ones are plentiful,
// the pricey ones are rare finds and the boss guarantees. Prices are placeholders for the balance pass.

/** How many of a junk material fit in one bag slot, by rarity: the cheap ones drop by the thousand, the pricey ones are rare finds */
export const JUNK_STACK_MAX: Partial<Record<ItemDef['rarity'], number>> = { common: 100_000, uncommon: 50_000, rare: 25_000, epic: 10_000 };

const junk = (id: string, name: string, sellValue: number, description: string, rarity: ItemDef['rarity'] = 'common'): ItemDef => ({
	id: `junk_${id}`,
	name,
	kind: 'consumable',
	rarity,
	tier: 0,
	stackMax: JUNK_STACK_MAX[rarity] ?? 10_000,
	sellValue,
	icon: `art_junk_${id}` as ItemDef['icon'],
	junk: true,
	description,
});

export const JUNK_ITEMS: ItemDef[] = [
	junk('rubble', 'Chipped Rubble', 3, 'Rocks that used to be a wall. Or a hill. Nobody checked.'),
	junk('brush', 'Autumn Brush', 4, 'A bundle of dry twigs and red leaves. Burns badly, sells fine.'),
	junk('bones', 'Gnawed Bones', 5, 'Somebody has already had dinner here. The dog is still negotiating.'),
	junk('feather', 'Ragged Feather', 6, 'Too scruffy for a hat, too proud to be a duster.'),
	junk('scrap', 'Rusty Scrap', 8, 'Was a sword once. Now it is a lesson about maintenance.'),
	junk('tar', 'Tar Glob', 11, 'Sticky, black and smells of bad decisions. Shipwrights pay for it.'),
	junk('sand', 'Gritty Sand', 14, 'Fine sand that gets everywhere, including your boots. Glassblowers love it.'),
	junk('claw', 'Cracked Beast Claw', 45, 'It came off in the fight. The monster would like it back, but monsters do not file complaints.', 'uncommon'),
	junk('rose_dust', 'Rose Pigment', 140, 'A pink powder dyers whisper about. Do not sneeze.', 'uncommon'),
	junk('teal_crystals', 'Teal Crystal Cluster', 650, 'Glows faintly when nobody is looking, and a little when they are.', 'rare'),
	junk('amethyst', 'Void Amethyst Shard', 2400, 'A splinter of something that was never quite here. Collectors pay a royal breakfast for it.', 'epic'),

	// Monster ingredients (the Bestiary drop tables, `catalog/monsterDrops.ts`): junk today (the merchant buys them), the sub-ingredients of crafting later (IDL-358, IDL-226). The art is the spare resource set; ids are append-only.
	junk('bacon', 'Streaky Bacon', 12, 'Smells wonderful and has been in a pocket for days. A hearty meal waits for a cook with no standards.'),
	junk('blood', 'Vial of Blood', 14, 'Warm, which is the worrying part. Alchemists call it a base; everyone else calls it a vial.'),
	junk('horn', 'Curved Horn', 22, 'Polished by years of ramming things. The previous owner has no further use for it.'),
	junk('clay', 'Wet Clay', 6, 'Cold, heavy and very good at sticking to boots. Potters adore it.'),
	junk('sticks', 'Bundle of Sticks', 4, 'Tied with a bit of string. The best arrow shafts start as exactly this.'),
	junk('hollow_log', 'Hollow Log', 10, 'Something lived in it. Something may still live in it. Sold as is.'),
	junk('dried_herbs', 'Dried Herb Bundle', 7, 'Crumbles when looked at hard. Every apothecary swears it is the secret ingredient.'),
	junk('orange_mushrooms', 'Orange Caps', 13, 'They glow a little at dusk. Probably fine. Please do not taste one.'),
	junk('grapes', 'Wild Grapes', 8, 'Sour enough to make a ronin wince. They ferment into something much better.'),
	junk('carrot', 'Gnarled Carrot', 5, 'Dug up by something that wanted it more than you. It is now yours.'),
	junk('beet', 'Beetroot', 5, 'Stains everything it touches deep red, including the evidence.'),
	junk('wheat_sheaf', 'Wheat Sheaf', 6, 'Tied the old way, in a neat bundle. Scarecrows are very particular about their harvest.'),
	junk('jug', 'Cracked Jug', 9, 'Empty now. Its last owner would like a word about that.'),
	junk('coins', 'Pocketful of Coppers', 26, 'Loose change from a bandit who was not saving for anything.'),
	junk('glowberry', 'Glowberry', 18, 'A berry that lights up in the dark. Foragers pick them for night potions, and the pickers are very bright.', 'uncommon'),
	junk('horn_dark', 'Dark Horn', 62, 'Black as a closed door and cold to the touch. It hums when something awful is near.', 'uncommon'),
	junk('copper_ore', 'Copper Ore', 24, 'Green-streaked and heavy. The smith pays by the pound and asks no questions.', 'uncommon'),
	junk('ember_coal', 'Ember Coal', 30, 'Still warm, still thinking about being a fire. Smelters keep it for the stubborn jobs.', 'uncommon'),
	junk('geode', 'Geode', 88, 'Plain on the outside. Crack it open and the inside is a tiny, sparkling apology.', 'uncommon'),
	junk('obsidian', 'Obsidian Chip', 96, 'Black glass with an edge that never dulled. Handle like a rumour.', 'uncommon'),
	junk('dark_shard', 'Dark Shard', 150, 'A sliver of the Blight, grown hard. The dark inside it looks back.', 'uncommon'),
	junk(
		'dark_potion',
		'Murky Phial',
		125,
		'Somebody brewed this and then left in a hurry. The cork is the only thing holding the evening together.',
		'uncommon',
	),
	junk('fire_drop', 'Fire Drop', 380, 'A bead of flame that forgot to go out. It hisses if you stare at it.', 'rare'),
	junk('moon', 'Moonstone Sliver', 420, 'Holds a little of the night and gives it back on cloudy days.', 'rare'),
	junk('emerald_star', 'Emerald Star', 850, 'A green star the size of a thumbnail. Court wizards are not above stealing it.', 'rare'),
	junk('heart_gem', 'Heart Gem', 3200, 'A blue heart-shaped gem with a pulse. Treasure hunters report it is, in fact, beating.', 'epic'),
];
