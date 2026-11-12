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
];
