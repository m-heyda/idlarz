import type { PixelIconName } from '@/config/pixelIcons';
import type { EquipmentRarity, ItemDef } from '@/types/game';
import { baseStat } from '../stats';
import { ITEM_ICONS } from '@/config/itemIcons';
import { gear, type GearOptions } from './define';
import { GRADE_INFO, LIVE_GRADES, type Grade } from './grades';

// Reserve items: the second equipment art pass (64 px art under public/pixel/items, config/itemIcons/). Every item here is
// DISABLED: it is in the catalog so its id, icon and stats can be checked, but no loot pool, shop or chest hands it out and
// the legacy items above still carry the game. Enabling a category is one flag (`enabled`) plus the tuning in
// docs/28-reuse-items-and-stats.md. Names and set homes are a proposal there too.
//
// Stats stay inside the 13 item stat keys, are whole numbers or `baseStat` values (clean two-decimal numbers), and sit near
// the legacy item of the same tier so the numbers are not a surprise when they go live.

const b = baseStat;
const RARITY_OF_TIER: Record<number, EquipmentRarity> = { 1: 'common', 2: 'uncommon', 3: 'rare', 4: 'epic', 5: 'legendary' };

type Tier = 1 | 2 | 3 | 4;
type Slot = 'feet' | 'legs' | 'neck' | 'ring' | 'offHand' | 'mainHand';

const reserve = (
	id: string,
	name: string,
	slot: Slot,
	tier: Tier,
	stats: Parameters<typeof gear>[4],
	description: string,
	opts: Partial<GearOptions> = {},
): ItemDef =>
	gear(id, name, slot, RARITY_OF_TIER[opts.tier ?? tier], stats, { tier, icon: `art_${id}` as PixelIconName, enabled: false, description, ...opts });

const sword = { weaponType: 'sword' } as const;
const mace = { weaponType: 'mace' } as const;
const maul = { weaponType: 'maul' } as const;
const shield = { weaponType: 'shield' } as const;

const RESERVE_BASE: ItemDef[] = [
	// ---- feet (9)
	reserve('wanderer_boots', "Wanderer's Boots", 'feet', 1, { armor: 1, maxHp: 3 }, 'Patched at the toe, buckled at the shin.'),
	reserve('fur_lined_boots', 'Fur-lined Boots', 'feet', 2, { armor: 2, maxHp: 3, regen: b('regen', 2) }, 'Warm enough for the tundra.'),
	reserve('mossweave_boots', 'Mossweave Boots', 'feet', 2, { armor: 2, maxHp: 2, luck: b('luck', 2) }, 'Green leather with a leaf tucked in the strap.'),
	reserve('ironbound_boots', 'Ironbound Boots', 'feet', 2, { armor: 4, maxHp: 2 }, 'Riveted plates over heavy leather.'),
	reserve('plated_sabatons', 'Plated Sabatons', 'feet', 3, { armor: 5, maxHp: 4 }, 'Polished plate from toe to knee.'),
	reserve('shadowstep_boots', 'Shadowstep Boots', 'feet', 3, { armor: 2, dodge: b('dodge', 3) }, 'Black leather that makes no sound.'),
	reserve(
		'frostglass_boots',
		'Frostglass Boots',
		'feet',
		3,
		{ armor: 3, maxMana: b('maxMana', 3), manaRegen: b('manaRegen', 3) },
		'Ice that never melts, however warm the road.',
	),
	reserve('drake_scale_boots', 'Drake-scale Boots', 'feet', 4, { armor: 6, maxHp: 8, critChance: b('critChance', 4) }, 'Claws and embers, cut from one hide.'),
	reserve('sunsilk_boots', 'Sunsilk Boots', 'feet', 4, { armor: 4, maxHp: 8, goldFind: b('goldFind', 4) }, 'Gold thread and crimson silk. Coins follow.'),

	// ---- legs (12)
	reserve('patched_trousers', 'Patched Trousers', 'legs', 1, { armor: 1, maxHp: 2 }, 'One knee mended with a brown square.'),
	reserve('drover_breeches', "Drover's Breeches", 'legs', 1, { armor: 1, maxHp: 3 }, 'Padded where the saddle rubs.'),
	reserve('tanned_leather_pants', 'Tanned Leather Pants', 'legs', 2, { armor: 2, maxHp: 3 }, 'Stiff, orange, and hard to ruin.'),
	reserve('fur_trimmed_leggings', 'Fur-trimmed Leggings', 'legs', 2, { armor: 3, maxHp: 3, regen: b('regen', 2) }, 'Wolf fur at the cuffs and belt.'),
	reserve('chainmail_leggings', 'Chainmail Leggings', 'legs', 2, { armor: 5, maxHp: 3 }, 'Links over leather, studs on the knee.'),
	reserve('ranger_pants', 'Ranger Pants', 'legs', 2, { armor: 3, maxHp: 3, critChance: b('critChance', 2) }, 'Pouches for arrows and bad news.'),
	reserve('shadow_trousers', 'Shadow Trousers', 'legs', 3, { armor: 3, dodge: b('dodge', 3) }, 'Straps and black cloth, made to slip away.'),
	reserve('knightly_legguards', 'Knightly Legguards', 'legs', 3, { armor: 6, maxHp: 5 }, 'Chain and plate, worn in by a long campaign.'),
	reserve('steel_legplates', 'Steel Legplates', 'legs', 3, { armor: 7, maxHp: 4 }, 'Overlapping lames that move like a crab.'),
	reserve(
		'runed_skirt',
		'Runed Skirt',
		'legs',
		3,
		{ armor: 2, maxMana: b('maxMana', 3), spellPower: b('spellPower', 3) },
		'The runes hum when you stand still.',
	),
	reserve('royal_silk_trousers', 'Royal Silk Trousers', 'legs', 4, { armor: 3, maxHp: 8, goldFind: b('goldFind', 4) }, 'Crimson silk with gold braid.'),
	reserve('verdant_greaves', 'Verdant Greaves', 'legs', 4, { armor: 6, maxHp: 9, regen: b('regen', 4) }, 'Green scale and gilded vines.'),

	// ---- neck (12)
	reserve('leaf_amulet', 'Leaf Amulet', 'neck', 2, { maxHp: 3, regen: b('regen', 2) }, 'A green leaf in a bronze setting. It does not wilt.'),
	reserve(
		'fang_necklace',
		'Fang Necklace',
		'neck',
		2,
		{ critChance: b('critChance', 2), lifeLeech: b('lifeLeech', 2) },
		'Teeth on a leather cord, each one earned.',
	),
	reserve(
		'amethyst_shard_necklace',
		'Amethyst Shard Necklace',
		'neck',
		2,
		{ maxMana: b('maxMana', 2), spellPower: b('spellPower', 2) },
		'A wrapped crystal that hums at night.',
	),
	reserve('sun_locket', 'Sun Locket', 'neck', 3, { maxHp: 5, goldFind: b('goldFind', 3) }, 'A smiling sun. Gold likes the company.'),
	reserve('ember_medallion', 'Ember Medallion', 'neck', 3, { maxHp: 4, critChance: b('critChance', 3) }, 'The red stone is always a little warm.'),
	reserve('moon_pendant', 'Moon Pendant', 'neck', 3, { maxMana: b('maxMana', 3), manaRegen: b('manaRegen', 3) }, 'A silver crescent with one small star.'),
	reserve(
		'winged_sapphire_pendant',
		'Winged Sapphire Pendant',
		'neck',
		3,
		{ maxHp: 6, spellPower: b('spellPower', 3) },
		'Silver wings around a deep blue stone.',
	),
	reserve('heartstone_pendant', 'Heartstone Pendant', 'neck', 3, { maxHp: 8, regen: b('regen', 3) }, 'Pink glow, steady beat.'),
	reserve('ruby_teardrop', 'Ruby Teardrop', 'neck', 3, { maxHp: 4, superCrit: b('superCrit', 3) }, 'A single drop on a gold chain.'),
	reserve('emerald_amulet', 'Emerald Amulet', 'neck', 3, { maxHp: 5, luck: b('luck', 3) }, 'Green fire in a gold frame.'),
	reserve('seraph_collar', 'Seraph Collar', 'neck', 4, { armor: 3, maxHp: 12, dodge: b('dodge', 4) }, 'Feathers of silver, a sapphire heart.'),
	reserve(
		'nightshard_pendant',
		'Nightshard Pendant',
		'neck',
		4,
		{ superCrit: b('superCrit', 4), lifeLeech: b('lifeLeech', 3) },
		'A black shard on an iron chain. It drinks the light.',
	),

	// ---- rings (11)
	reserve('iron_band', 'Iron Band', 'ring', 1, { armor: 1, maxHp: 2 }, 'Dull, heavy, honest.'),
	reserve('ruby_signet', 'Ruby Signet', 'ring', 2, { maxHp: 3, critChance: b('critChance', 2) }, 'A gold band with a red stone.'),
	reserve('gold_signet', 'Gold Signet', 'ring', 2, { maxHp: 2, goldFind: b('goldFind', 2) }, 'Stamped with a crest nobody remembers.'),
	reserve('turquoise_band', 'Turquoise Band', 'ring', 2, { maxHp: 2, dodge: b('dodge', 2) }, 'Wooden band inlaid with blue chips.'),
	reserve('emerald_signet', 'Emerald Signet', 'ring', 2, { maxHp: 2, luck: b('luck', 2) }, 'A green stone in bronze.'),
	reserve('thornvine_ring', 'Thornvine Ring', 'ring', 2, { maxHp: 2, regen: b('regen', 2) }, 'Vines wrapped around an orange bead.'),
	reserve('steel_sapphire_ring', 'Steel Sapphire Ring', 'ring', 3, { armor: 2, maxHp: 5 }, 'A broad steel band with a blue stone.'),
	reserve('skull_ring', 'Skull Ring', 'ring', 3, { maxHp: 3, lifeLeech: b('lifeLeech', 3) }, 'Cold to the touch. Warm in a fight.'),
	reserve('amethyst_ring', 'Amethyst Ring', 'ring', 3, { maxMana: b('maxMana', 3), manaRegen: b('manaRegen', 3) }, 'Purple gold, with a spark of light.'),
	reserve(
		'sapphire_teardrop_ring',
		'Sapphire Teardrop Ring',
		'ring',
		4,
		{ maxMana: b('maxMana', 4), spellPower: b('spellPower', 4) },
		'Silver filigree around a blue teardrop.',
	),
	reserve(
		'crimson_crown_ring',
		'Crimson Crown Ring',
		'ring',
		4,
		{ critChance: b('critChance', 4), superCrit: b('superCrit', 4) },
		'A great ruby held up by gold claws.',
	),

	// ---- off hand: shields (12)
	reserve('battered_buckler', 'Battered Buckler', 'offHand', 1, { armor: 3, maxHp: 2 }, 'Cracked wood and a lot of dents.', shield),
	reserve('oak_roundshield', 'Oak Roundshield', 'offHand', 1, { armor: 4, maxHp: 2 }, 'Oak boards inside an iron rim.', shield),
	reserve('bronze_crossbar_shield', 'Bronze Crossbar Shield', 'offHand', 2, { armor: 6, maxHp: 3 }, 'Cross braces, copper bright.', shield),
	reserve('crusader_shield', 'Crusader Shield', 'offHand', 2, { armor: 8, maxHp: 2 }, 'A steel heater with a cross of rivets.', shield),
	reserve('lionguard_shield', 'Lionguard Shield', 'offHand', 3, { armor: 10, maxHp: 4 }, 'A rampant lion on grey steel.', shield),
	reserve('ironbound_pavise', 'Ironbound Pavise', 'offHand', 3, { armor: 12, maxHp: 2 }, 'A wall you can carry.', shield),
	reserve(
		'verdant_kite_shield',
		'Verdant Kite Shield',
		'offHand',
		3,
		{ armor: 7, maxHp: 6, regen: b('regen', 3) },
		'Gold scrollwork around a green gem.',
		shield,
	),
	reserve('steel_tower_shield', 'Steel Tower Shield', 'offHand', 3, { armor: 11, maxHp: 2 }, 'A slab of steel with a viewing slit.', shield),
	reserve(
		'thornspike_shield',
		'Thornspike Shield',
		'offHand',
		4,
		{ armor: 9, maxHp: 8, lifeLeech: b('lifeLeech', 3) },
		'Black spikes around one red eye.',
		shield,
	),
	reserve('runeward_roundel', 'Runeward Roundel', 'offHand', 4, { armor: 8, maxHp: 6, maxMana: b('maxMana', 3) }, 'Cyan runes circle a mossy stone.', shield),
	reserve(
		'frostcrystal_aegis',
		'Frostcrystal Aegis',
		'offHand',
		4,
		{ armor: 9, maxMana: b('maxMana', 3), dodge: b('dodge', 4) },
		'A cluster of living ice.',
		shield,
	),
	reserve(
		'royal_lion_crest',
		'Royal Lion Crest',
		'offHand',
		4,
		{ armor: 11, maxHp: 8, goldFind: b('goldFind', 4) },
		'Blue and gold, with a crowned lion.',
		shield,
	),

	// ---- main hand: swords (12)
	reserve('rusty_broadsword', 'Rusty Broadsword', 'mainHand', 1, { damage: 6 }, 'More rust than sword.', sword),
	reserve('old_rusted_blade', 'Old Rusted Blade', 'mainHand', 1, { damage: 7 }, 'Dug out of a swamp.', sword),
	reserve('arming_sword', 'Arming Sword', 'mainHand', 2, { damage: 12 }, 'Silver steel and a red-wrapped grip.', sword),
	reserve('blue_pommel_longsword', 'Blue Pommel Longsword', 'mainHand', 2, { damage: 12, critChance: b('critChance', 2) }, 'Straight, clean and light.', sword),
	reserve('silver_scimitar', 'Silver Scimitar', 'mainHand', 2, { damage: 11, critChance: b('critChance', 2) + 1 }, 'A curved blade for quick work.', sword),
	reserve('notched_broadsword', 'Notched Broadsword', 'mainHand', 2, { damage: 14 }, 'Wide and chipped. Still cuts.', sword),
	reserve('runed_jade_blade', 'Runed Jade Blade', 'mainHand', 3, { damage: 18, luck: b('luck', 3) }, 'Teal runes run down the flat.', sword),
	reserve('frostbrand', 'Frostbrand', 'mainHand', 3, { damage: 17, critChance: b('critChance', 3) }, 'Ice that never melts in the hand.', sword),
	reserve('cinderfang_sword', 'Cinderfang Sword', 'mainHand', 3, { damage: 19, critChance: b('critChance', 3) }, 'A black guard and a living flame.', sword),
	reserve('voidiron_blade', 'Voidiron Blade', 'mainHand', 4, { damage: 22, superCrit: b('superCrit', 4) }, 'Purple iron, orange cracks.', sword),
	reserve('seraph_blade', 'Seraph Blade', 'mainHand', 4, { damage: 23, lifeLeech: b('lifeLeech', 3) }, 'Winged gold and an emerald.', sword),
	reserve(
		'gilded_longsword',
		'Gilded Longsword',
		'mainHand',
		4,
		{ damage: 24, critChance: b('critChance', 3) },
		'A ruby in the guard, gold to the tip.',
		sword,
	),

	// ---- main hand: maces (9) and mauls (3)
	reserve('knotted_cudgel', 'Knotted Cudgel', 'mainHand', 1, { damage: 9 }, 'A tree limb with ambition.', mace),
	reserve('gnarled_club', 'Gnarled Club', 'mainHand', 1, { damage: 9 }, 'Wrapped in cord where it hurts most.', mace),
	reserve('spiked_mace', 'Spiked Mace', 'mainHand', 2, { damage: 17 }, 'Iron ball, iron temper.', mace),
	reserve('iron_morningstar', 'Iron Morningstar', 'mainHand', 2, { damage: 18, critChance: b('critChance', 2) }, 'Studs on a leather-wrapped haft.', mace),
	reserve('verdigris_mace', 'Verdigris Mace', 'mainHand', 2, { damage: 17 }, 'Old bronze, green with age.', mace),
	reserve('sunburst_mace', 'Sunburst Mace', 'mainHand', 3, { damage: 25, goldFind: b('goldFind', 3) }, 'A golden star on a short haft.', mace),
	reserve('frostcrystal_mace', 'Frostcrystal Mace', 'mainHand', 3, { damage: 24, critChance: b('critChance', 3) }, 'Crystal flanges, blue as a glacier.', mace),
	reserve('deathgrin_mace', 'Deathgrin Mace', 'mainHand', 4, { damage: 30, lifeLeech: b('lifeLeech', 3) }, 'A grinning skull with red eyes.', mace),
	reserve('magma_flail', 'Magma Flail', 'mainHand', 4, { damage: 32, critChance: b('critChance', 4) }, 'Cooled lava, cracked and glowing.', mace),
	reserve('stone_hammer', 'Stone Hammer', 'mainHand', 1, { damage: 12 }, 'A rock lashed to a stick.', maul),
	reserve('iron_warhammer', 'Iron Warhammer', 'mainHand', 2, { damage: 19 }, 'A square head and a hook for a thumb.', maul),
	reserve('runed_warhammer', 'Runed Warhammer', 'mainHand', 3, { damage: 30 }, 'Heavy steel with a carved rune.', maul),

	// ---- legendary: named, tier 5. Perks are only drafted in docs/28 until the perk channel exists (IDL-143..149).
	reserve(
		'runeforged_titanhammer',
		'Runeforged Titanhammer',
		'mainHand',
		4,
		{ damage: 44, critChance: 4, superCrit: 6 },
		'Blue runes in a cloud of pink dust.',
		{ ...maul, tier: 5, named: true, pools: ['legendary_weapons'] },
	),
	reserve(
		'cindercrescent_glaive',
		'Cindercrescent Glaive',
		'mainHand',
		4,
		{ damage: 30, critChance: 8, superCrit: 6 },
		'A black blade with a crescent of flame.',
		{ weaponType: 'spear', tier: 5, named: true, pools: ['legendary_weapons'] },
	),
	reserve(
		'frostbloom_fan',
		'Frostbloom Fan',
		'mainHand',
		4,
		{ damage: 20, spellPower: b('spellPower', 5), manaRegen: b('manaRegen', 5) },
		'Ice blossoms on a silk fan.',
		{ weaponType: 'wand', tier: 5, named: true, pools: ['legendary_weapons'] },
	),
	reserve('voidrune_blade', 'Voidrune Blade', 'mainHand', 4, { damage: 31, critChance: 8, superCrit: 8 }, 'Runes turn in the air around it.', {
		...sword,
		tier: 5,
		named: true,
		pools: ['legendary_weapons'],
	}),
	reserve(
		'reapers_crescent',
		"Reaper's Crescent",
		'mainHand',
		4,
		{ damage: 34, critChance: 6, lifeLeech: b('lifeLeech', 5) },
		'A scythe blade of dark crimson.',
		{ weaponType: 'axe', tier: 5, named: true, pools: ['legendary_weapons'] },
	),
	reserve('nightfall_edge', 'Nightfall Edge', 'mainHand', 4, { damage: 32, critChance: 10, superCrit: 6 }, 'A blade of night with stars caught in it.', {
		...sword,
		tier: 5,
		named: true,
		pools: ['legendary_weapons'],
	}),
	reserve('tidecaller_axe', 'Tidecaller Axe', 'mainHand', 4, { damage: 33, critChance: 6, dodge: b('dodge', 5) }, 'Teal runes and a rolling violet tide.', {
		weaponType: 'axe',
		tier: 5,
		named: true,
		pools: ['legendary_weapons'],
	}),
	reserve('stormtrident', 'Stormtrident', 'mainHand', 4, { damage: 29, critChance: 12, superCrit: 8 }, 'Lightning leaps between the tines.', {
		weaponType: 'spear',
		tier: 5,
		named: true,
		pools: ['legendary_weapons'],
	}),
	reserve(
		'amethyst_spire',
		'Amethyst Spire',
		'mainHand',
		4,
		{ damage: 26, spellPower: b('spellPower', 5), maxMana: b('maxMana', 5) },
		'Floating crystals orbit the head.',
		{ weaponType: 'staff', tier: 5, named: true, pools: ['legendary_weapons'] },
	),
	reserve(
		'dawnbringer_trident',
		'Dawnbringer Trident',
		'mainHand',
		4,
		{ damage: 30, luck: b('luck', 5), goldFind: b('goldFind', 5) },
		'Gold wings and a light that does not go out.',
		{ weaponType: 'spear', tier: 5, named: true, pools: ['legendary_weapons'] },
	),
	reserve('cinderflight_bow', 'Cinderflight Bow', 'mainHand', 4, { damage: 25, critChance: 18, superCrit: 10 }, 'Every arrow leaves a trail of sparks.', {
		weaponType: 'bow',
		tier: 5,
		named: true,
		pools: ['legendary_weapons'],
	}),
];

/** Grade of a reserve item = the grade its art is registered with (config/itemIcons), so one table says it */
const gradeOfIcon = new Map(ITEM_ICONS.flatMap((e) => (e.grade ? [[e.icon, e.grade as Grade] as const] : [])));

/**
 * Reserve items by grade (IDL-224): a base item takes the tag `grade:Gx`, the grade's item level window and rarities, so pools and
 * affixes treat it like a ladder item of its grade. The live grades (G1-G3) are enabled; the rest, and every named item (legendary
 * folder), stay disabled. Ids and icons never change.
 */
export const RESERVE_ITEMS: ItemDef[] = RESERVE_BASE.map((def) => {
	const grade = def.generation === 'named' ? undefined : gradeOfIcon.get(def.icon as string);
	if (!grade) return def;
	const info = GRADE_INFO[grade];
	return {
		...def,
		tags: [...(def.tags ?? []), `grade:${grade}`],
		minItemLevel: info.levels[0],
		maxItemLevel: info.levels[1],
		allowedRarities: [...info.rarities],
		enabled: LIVE_GRADES.includes(grade),
	};
});
