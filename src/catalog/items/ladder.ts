import type { EquipmentSlot, ItemDef, WeaponType } from '@/types/game';
import { MAX_ITEM_LEVEL, STAT_DEFS, baseStat, levelScale, type ItemStatKey, type ItemStats, type StatDef } from '../stats';
import { WEAPON_ATTACK_SPEED } from '../weapons';
import { CLOTH_ITEMS } from './cloth';
import { gear } from './define';
import { LEGENDARY_ITEMS } from './legendary';
import { OBSIDIAN_ITEMS } from './obsidian';
import { RESERVE_ITEMS } from './reuse';
import { WOODEN_ITEMS } from './starter';
import { STEEL_ITEMS } from './steel';
import type { EquipmentRarity } from '@/types/game';

// The grade ladder (IDL-37, 38, 39, 142; art_style_reference/equip/README.md sections 3-5): 9 normal grades G1-G9 and three special
// sets S1-S3 for every slot, as DISABLED data. Nothing here drops, is sold or can be crafted yet: the loot work of phase C (docs/26)
// decides that. The grade is a tag (`grade:G3`), never an id, so pools and recipes select by it.
//
// Where a ladder cell already exists as a live item (Iron Sword, the Steel pieces, the Obsidian family, Emberbrand) the live item
// stays and fills that cell; `LADDER` says which id sits in which cell. Everything else is generated from the tables in this file,
// so tuning the ladder is editing one number: `GRADE_INFO[g].index` for a grade, a slot's row of `SLOT_STATS`, or a weapon type's
// `WEAPON_DPS_FACTOR`. THE NUMBERS ARE PLACEHOLDERS (TODO tune in R2 C5 with loot-sim and fight-sim), not balance decisions; they are
// anchored so that G6 matches the live Obsidian pieces.

export const GRADES = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'S1', 'S2', 'S3'] as const;
export type Grade = (typeof GRADES)[number];

interface GradeInfo {
	/** Name of the grade in the planning doc */
	label: string;
	/** Relative planning strength (not a stat): 1.0 for G1 up to 32 for the strongest set */
	index: number;
	/** The item level window the grade can be generated in */
	levels: readonly [number, number];
	/** The material tier (1-5) the grade belongs to, for the code that still reads `tier` */
	tier: 1 | 2 | 3 | 4 | 5;
	/** Rarities a base of this grade may roll as */
	rarities: readonly EquipmentRarity[];
}

export const GRADE_INFO: Record<Grade, GradeInfo> = {
	G1: { label: 'Starter', index: 1, levels: [1, 8], tier: 1, rarities: ['common'] },
	G2: { label: 'Hide', index: 1.6, levels: [9, 18], tier: 1, rarities: ['common', 'uncommon'] },
	G3: { label: 'Iron', index: 2.4, levels: [19, 30], tier: 2, rarities: ['uncommon'] },
	G4: { label: 'Steel', index: 3.5, levels: [31, 42], tier: 2, rarities: ['uncommon', 'rare'] },
	G5: { label: 'Knight', index: 5, levels: [43, 54], tier: 3, rarities: ['rare'] },
	G6: { label: 'Obsidian', index: 7, levels: [55, 66], tier: 3, rarities: ['rare', 'epic'] },
	G7: { label: 'Runed', index: 10, levels: [67, 78], tier: 4, rarities: ['epic'] },
	G8: { label: 'Ancient', index: 14, levels: [79, 90], tier: 4, rarities: ['epic', 'legendary'] },
	G9: { label: 'Legendary', index: 20, levels: [91, MAX_ITEM_LEVEL], tier: 5, rarities: ['legendary'] },
	S1: { label: 'Sunhoney', index: 22, levels: [MAX_ITEM_LEVEL, MAX_ITEM_LEVEL], tier: 5, rarities: ['legendary'] },
	S2: { label: 'Ashen Warlord', index: 28, levels: [MAX_ITEM_LEVEL, MAX_ITEM_LEVEL], tier: 5, rarities: ['legendary'] },
	S3: { label: 'Blightbound', index: 32, levels: [MAX_ITEM_LEVEL, MAX_ITEM_LEVEL], tier: 5, rarities: ['legendary'] },
};

/** The set a special grade's pieces belong to (SetDef ids in catalog/sets.ts) */
export const SPECIAL_SET: Record<'S1' | 'S2' | 'S3', string> = { S1: 'sunhoney', S2: 'ashen_warlord', S3: 'blightbound' };
const isSpecial = (grade: Grade): grade is 'S1' | 'S2' | 'S3' => grade === 'S1' || grade === 'S2' || grade === 'S3';

/** The armour-side cells of a grade; the ring is one cell (it fits both ring slots) */
export const ARMOUR_SLOTS = ['head', 'shoulder', 'chest', 'hands', 'legs', 'feet', 'neck', 'cape', 'ring', 'charm', 'belt'] as const;
type ArmourSlot = (typeof ARMOUR_SLOTS)[number];
export const WEAPON_TYPES = ['sword', 'dagger', 'mace', 'maul', 'axe', 'spear', 'bow', 'crossbow', 'staff', 'wand'] as const satisfies readonly WeaponType[];
type LadderWeapon = (typeof WEAPON_TYPES)[number];

// ---- the stat tables --------------------------------------------------------------------------------------------------
// What one point of strength index buys per slot (the live Obsidian piece divided by its index 7), so a G6 piece lands on the
// Obsidian one and every other grade scales from there. Flat stats are whole numbers (at least 1), the rest have two decimals.

type PerIndex = Partial<Record<ItemStatKey, number>>;
const WHOLE: ReadonlySet<ItemStatKey> = new Set<ItemStatKey>(['damage', 'armor', 'maxHp', 'luck', 'maxMana']);

const SLOT_STATS: Record<ArmourSlot | 'offHand', PerIndex> = {
	head: { armor: 0.86, maxHp: 0.86 },
	shoulder: { armor: 0.71, maxHp: 0.71 },
	chest: { armor: 1.43, maxHp: 1.71 },
	hands: { armor: 0.43, maxHp: 0.43, critChance: 0.21 },
	legs: { armor: 1, maxHp: 1.14 },
	feet: { armor: 0.57, maxHp: 0.57 },
	neck: { armor: 0.29, maxHp: 1.14, critChance: 0.21, goldFind: 0.86 },
	cape: { armor: 0.43, maxHp: 0.71, dodge: 0.29 },
	ring: { maxHp: 0.86, critChance: 0.21 },
	charm: { armor: 0.14, maxHp: 1, superCrit: 0.14 },
	belt: {}, // a belt has no per-index stats: see BELT_STATS
	offHand: { armor: 1.57, maxHp: 1.71 },
};

/**
 * The belt stat ladder (IDL-138, IDL-142), by grade: every belt shortens the potion cooldown (the floor is 4 s, a 50 % cut), heals more per
 * potion, and from the middle grades gives potion hotkey slots and bag slots. Fixed numbers, not scaled by the strength index: a belt is a
 * tool, and its worth is the same at any item level. The set belts sit at the cooldown floor and let the set bonuses carry the rest.
 * PLACEHOLDERS (TODO tune in R2 C5). Normal affixes still roll on top.
 */
const BELT_STATS: Record<Grade, ItemStats> = {
	G1: { potionCooldownPct: 5 },
	G2: { potionCooldownPct: 8 },
	G3: { potionCooldownPct: 12, potionPowerPct: 4, bagSlots: 1 },
	G4: { potionCooldownPct: 16, potionPowerPct: 6, bagSlots: 1 },
	G5: { potionCooldownPct: 20, potionPowerPct: 8, bagSlots: 1, potionSlots: 1 },
	G6: { potionCooldownPct: 25, potionPowerPct: 10, bagSlots: 2, potionSlots: 1 },
	G7: { potionCooldownPct: 32, potionPowerPct: 14, bagSlots: 2, potionSlots: 1 },
	G8: { potionCooldownPct: 40, potionPowerPct: 18, bagSlots: 2, potionSlots: 1 },
	G9: { potionCooldownPct: 50, potionPowerPct: 24, bagSlots: 3, potionSlots: 2 },
	S1: { potionCooldownPct: 50, potionPowerPct: 24, bagSlots: 3, potionSlots: 2 },
	S2: { potionCooldownPct: 50, potionPowerPct: 24, bagSlots: 3, potionSlots: 2 },
	S3: { potionCooldownPct: 50, potionPowerPct: 24, bagSlots: 3, potionSlots: 2 },
};

/** The off hand of a caster: a tome (or orb) trades armor for mana and spell power */
const TOME_STATS: PerIndex = { maxHp: 0.86, regen: 0.21, maxMana: 0.43, manaRegen: 0.07, spellPower: 0.57 };

/**
 * Damage per second per point of strength index, by weapon type: one table, so the G-scaling is a single multiplier and a weapon's
 * damage per hit is `dps / attack speed` (catalog/weapons.ts). 3.0 makes the G6 sword hit for the Obsidian Blade's 18.
 */
const DPS_PER_INDEX = 3;
const WEAPON_DPS_FACTOR: Record<LadderWeapon, number> = {
	sword: 1,
	dagger: 0.85,
	mace: 1.05,
	maul: 1.1,
	axe: 1,
	spear: 1,
	bow: 0.9,
	crossbow: 1,
	staff: 0.85,
	wand: 0.75,
};
/** What else a weapon type brings per point of strength index (crit for the light and ranged ones, mana for the casters) */
const WEAPON_EXTRA: Partial<Record<LadderWeapon, PerIndex>> = {
	dagger: { critChance: 0.7 },
	bow: { critChance: 0.9 },
	crossbow: { critChance: 0.6, superCrit: 0.12 },
	axe: { critChance: 0.2 },
	staff: { regen: 0.15, maxMana: 0.4, spellPower: 0.5 },
	wand: { critChance: 0.4, spellPower: 0.3 },
};

/**
 * Stats are authored at the item's `minItemLevel` and grow from there with the level curve, but the live Obsidian pieces the tables are
 * read from were authored at item level 8 and the G6 window starts at 55. So the authored numbers of the ladder are the Obsidian ones
 * grown to level 55, each stat by its own share of the curve (`levelShare`, like `scaleStats`): a G6 piece is then as strong at its own
 * window start as Obsidian is at 55, and the other grades follow the strength index from there.
 */
const ANCHOR_RATIO = levelScale(GRADE_INFO.G6.levels[0]) / levelScale(8);
const anchorFactor = (key: ItemStatKey): number => 1 + (ANCHOR_RATIO - 1) * ((STAT_DEFS[key] as StatDef).levelShare ?? 1);

const scaled = (perIndex: PerIndex, index: number, tier: number): ItemStats => {
	const stats: ItemStats = {};
	for (const [key, per] of Object.entries(perIndex) as [ItemStatKey, number][]) {
		// Gold Find and Dodge always take the tier table's number (tests/loot/items.test.ts)
		if (key === 'goldFind' || key === 'dodge') stats[key] = baseStat(key, tier);
		else {
			const value = per * index * anchorFactor(key);
			stats[key] = WHOLE.has(key) ? Math.max(1, Math.round(value)) : Math.round(value * 100) / 100;
		}
	}
	return stats;
};

const weaponStats = (type: LadderWeapon, index: number, tier: number): ItemStats => {
	const speed = WEAPON_ATTACK_SPEED[type] ?? 1;
	const damage = (DPS_PER_INDEX * WEAPON_DPS_FACTOR[type] * index * anchorFactor('damage')) / speed;
	return { damage: Math.max(1, Math.round(damage)), ...scaled(WEAPON_EXTRA[type] ?? {}, index, tier) };
};

/** Blightbound is the fragile set: no armor and no max HP on its pieces, Luck instead */
const forGrade = (grade: Grade, perIndex: PerIndex): PerIndex => {
	if (grade !== 'S3') return perIndex;
	const { armor, maxHp, ...rest } = perIndex;
	return armor || maxHp ? { ...rest, luck: 0.15 } : rest;
};

// ---- the names (working titles from art_style_reference/equip/README.md section 4) ------------------------------------------
const list = (text: string): string[] => text.split(',').map((n) => n.trim());

/** Per armour cell: G1..G9 then S1..S3 */
const ARMOUR_NAMES: Record<ArmourSlot, string[]> = {
	head: list(
		"Rag Hood, Hide Cap, Iron Cap, Steel Helm, Knight's Greathelm, Obsidian Visage, Runed Circlet, Ancient Warhelm, Crown of Embers, Sunhoney Crown, Ashen Warlord's Visor, Blightbound Cowl",
	),
	shoulder: list(
		"Patched Mantle, Hide Pauldrons, Iron Spaulders, Steel Pauldrons, Knight's Spaulders, Obsidian Shoulders, Runed Epaulets, Ancient Mantle, Titan's Pauldrons, Sunhoney Shawl, Warlord's Bulwark, Shroud Mantle",
	),
	chest: list(
		"Rag Tunic, Hide Jerkin, Iron Mail, Steel Cuirass, Knight's Breastplate, Obsidian Plate, Runed Hauberk, Ancient Cuirass, Dragonheart Plate, Sunhoney Vestments, Ashen Plate, Blightbound Robe",
	),
	hands: list(
		"Rag Wraps, Hide Gloves, Iron Gauntlets, Steel Gauntlets, Knight's Gauntlets, Obsidian Grips, Runed Gloves, Ancient Handguards, Titan's Fists, Sunhoney Gloves, Warlord's Gauntlets, Shroud Claws",
	),
	legs: list(
		"Rag Trousers, Hide Leggings, Iron Chausses, Steel Greaves, Knight's Legplates, Obsidian Cuisses, Runed Leggings, Ancient Legguards, Giantstride Plate, Sunhoney Skirt, Warlord's Cuisses, Blightbound Leggings",
	),
	feet: list(
		"Rag Shoes, Hide Boots, Iron Boots, Steel Sabatons, Knight's Boots, Obsidian Treads, Runed Striders, Ancient Boots, Windwalker Greaves, Sunhoney Slippers, Warlord's Sabatons, Shroud Treads",
	),
	neck: list(
		'Cord Pendant, Bone Beads, Copper Pendant, Silver Chain, Sapphire Amulet, Obsidian Choker, Runed Torc, Ancient Talisman, Heart of the Mountain, Honeydrop Amulet, Medal of the Fallen, Ichor Locket',
	),
	cape: list(
		"Rag Cloak, Hide Cloak, Traveller's Cape, Steel-clasp Cloak, Knight's Mantle, Obsidian Cloak, Runed Cape, Ancient Shroud, Royal Mantle, Sunhoney Cape, Warlord's Banner Cloak, Blightbound Shroud",
	),
	ring: list(
		"Twig Ring, Copper Band, Iron Signet, Silver Ring, Sapphire Ring, Obsidian Band, Runed Ring, Ancient Seal, Ring of Ages, Honeycomb Ring, Warlord's Signet, Ichor Ring",
	),
	charm: list(
		'Acorn Charm, Rabbit Foot, Bone Token, Bronze Medal, Lucky Coin, Obsidian Idol, Runed Totem, Ancient Relic, Heartstone, Hive Charm, War Medal Charm, Core Charm',
	),
	// docs/28 section 3 names the belt art; the sets take the Sunhoney, Warlord and hunter belts
	belt: list(
		"Worn Leather Belt, Tanned Sash, Ironbuckle Belt, Chain Girdle, Knight's Girdle, Obsidian Belt, Runebound Girdle, Ancient Cincture, Alchemist Bandolier, Sunforged Cincture, Warden Plate Belt, Hunter Trophy Belt",
	),
};

/** G1..G9 */
const SHIELD_NAMES = list(
	"Wooden Buckler, Hide Shield, Iron Kite Shield, Steel Heater, Knight's Tower Shield, Obsidian Aegis, Runed Bulwark, Ancient Shield, Dragon Aegis",
);
/** The caster off hands of the normal grades (the README lists shields only; tomes are the caster half of `WeaponType`) */
const TOME_NAMES = list('Bound Scraps, Hide Primer, Iron Codex, Steel Grimoire, Knights Tome, Obsidian Tome, Runed Tome, Ancient Tome, Legendary Tome');

/** G1..G9 */
const WEAPON_NAMES: Record<LadderWeapon, string[]> = {
	sword: list("Rusty Shortsword, Bronze Sword, Iron Sword, Steel Longsword, Knight's Blade, Obsidian Edge, Runed Claymore, Ancient Greatsword, Emberbrand"),
	dagger: list("Bone Knife, Bronze Dirk, Iron Dagger, Steel Stiletto, Knight's Misericord, Obsidian Fang, Runed Kris, Ancient Shiv, Nightbite"),
	mace: list("Wooden Club, Bronze Mace, Iron Mace, Steel Flanged Mace, Knight's Morningstar, Obsidian Crusher, Runed Scepter, Ancient Mace, Sunforged Maul"),
	maul: list("Log Maul, Bronze Hammer, Iron Maul, Steel Sledge, Knight's Warhammer, Obsidian Breaker, Runed Maul, Ancient Titanhammer, Worldbreaker"),
	axe: list("Hatchet, Bronze Axe, Iron Axe, Steel Battle Axe, Knight's Poleaxe, Obsidian Cleaver, Runed Greataxe, Ancient Executioner, Dawnsplitter"),
	spear: list("Sharpened Stick, Bronze Spear, Iron Spear, Steel Glaive, Knight's Lance, Obsidian Pike, Runed Halberd, Ancient Trident, Skyreach"),
	bow: list("Twig Bow, Hunting Bow, Yew Bow, Steel Recurve, Knight's Longbow, Obsidian Bow, Runed Bow, Ancient Warbow, Stormstring"),
	crossbow: list(
		"Wooden Crossbow, Bronze Crossbow, Iron Crossbow, Steel Arbalest, Knight's Crossbow, Obsidian Repeater, Runed Crossbow, Ancient Siegebow, Doomhook",
	),
	staff: list(
		"Walking Stick, Hide-bound Staff, Iron-shod Staff, Steel Staff, Knight's Quarterstaff, Obsidian Staff, Runed Staff, Ancient Staff, Archmage's Spire",
	),
	wand: list("Twig Wand, Bronze Wand, Iron Wand, Steel Wand, Knight's Wand, Obsidian Wand, Runed Wand, Ancient Wand, Starlight Wand"),
};

/** A special set carries one signature weapon and one off hand besides its eleven armour cells (README sections 4 and 5) */
const SET_SIGNATURE: Record<'S1' | 'S2' | 'S3', { weapon: LadderWeapon; weaponName: string; offHand: string; offHandType: 'shield' | 'tome' }> = {
	S1: { weapon: 'mace', weaponName: 'Honeycomb Scepter', offHand: 'Golden Ledger', offHandType: 'tome' },
	S2: { weapon: 'axe', weaponName: "Ashen Warlord's Greataxe", offHand: 'Ashen Tower Shield', offHandType: 'shield' },
	S3: { weapon: 'staff', weaponName: 'Blight Staff', offHand: 'Blight Orb', offHandType: 'tome' },
};

/**
 * The live Obsidian family is the G6 row (README section 4: "the Obsidian set (G6)"): its pieces keep their ids and fill the G6 cells
 * instead of the generated names, which would be a second Obsidian set. Cells the family lacks (mace, axe, spear, wand, tome, belt)
 * are generated, the belt as a piece of the Obsidian set so the set stays complete with 14 slots (IDL-142).
 */
const OBSIDIAN_CELLS: Partial<Record<string, string>> = {
	head: 'obsidian_helm',
	shoulder: 'obsidian_pauldrons',
	chest: 'obsidian_cuirass',
	hands: 'obsidian_gauntlets',
	legs: 'obsidian_greaves',
	feet: 'obsidian_sabatons',
	neck: 'obsidian_pendant',
	cape: 'obsidian_cloak',
	ring: 'obsidian_ring',
	charm: 'obsidian_charm',
	shield: 'obsidian_aegis',
	sword: 'obsidian_blade',
	dagger: 'obsidian_kris',
	maul: 'obsidian_maul',
	bow: 'obsidian_longbow',
	crossbow: 'obsidian_crossbow',
	staff: 'obsidian_staff',
};

// ---- building ----------------------------------------------------------------------------------------------------------
const slug = (name: string): string =>
	name
		.toLowerCase()
		.replace(/['’]/g, '')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_|_$/g, '');

/** Items that exist outside the ladder: a cell whose id is one of these is not generated again, the live item fills it. */
const existingIds = new Set<string>(
	[...WOODEN_ITEMS, ...CLOTH_ITEMS, ...STEEL_ITEMS, ...OBSIDIAN_ITEMS, ...LEGENDARY_ITEMS, ...RESERVE_ITEMS].map((def) => def.id),
);

/** A cell of the ladder: a slot, a weapon type, `shield` or `tome` (normal grades), or a special set's `weapon` and `offHand` */
export type LadderCell = ArmourSlot | LadderWeapon | 'shield' | 'tome' | 'weapon' | 'offHand';
/** Ladder cell -> item id: `LADDER.G4.head`, `LADDER.G9.sword`, `LADDER.S2.offHand`. */
export const LADDER: Record<Grade, Partial<Record<LadderCell, string>>> = Object.fromEntries(GRADES.map((grade) => [grade, {}])) as Record<
	Grade,
	Partial<Record<LadderCell, string>>
>;

const generated: ItemDef[] = [];

const cell = (grade: Grade, key: LadderCell, name: string, slot: NonNullable<ItemDef['slot']>, stats: ItemStats, weaponType?: WeaponType): void => {
	const id = slug(name);
	const obsidian = grade === 'G6' ? OBSIDIAN_CELLS[key] : undefined;
	LADDER[grade][key] = obsidian ?? id;
	if (obsidian || existingIds.has(id) || generated.some((def) => def.id === id)) return;
	const info = GRADE_INFO[grade];
	// the Obsidian belt is the only generated piece of the Obsidian set; the other G6 gaps are plain items
	const set = isSpecial(grade) ? SPECIAL_SET[grade] : grade === 'G6' && key === 'belt' ? 'obsidian' : undefined;
	// No icon here: the registry (config/itemIcons, lane A) binds icons to items by grade and slot; until then the slot silhouette shows.
	const def = gear(id, name, slot, info.rarities[0], stats, {
		tier: info.tier,
		grade,
		levelWindow: info.levels,
		enabled: false,
		...(set ? { set } : {}),
		...(weaponType ? { weaponType } : {}),
		description: `${info.label} grade, placeholder numbers.`,
	});
	generated.push({ ...def, allowedRarities: [...info.rarities] });
};

GRADES.forEach((grade, g) => {
	const { index, tier } = GRADE_INFO[grade];
	for (const slot of ARMOUR_SLOTS) {
		const stats = slot === 'belt' ? BELT_STATS[grade] : scaled(forGrade(grade, SLOT_STATS[slot]), index, tier);
		cell(grade, slot, ARMOUR_NAMES[slot][g], slot, stats);
	}
	if (isSpecial(grade)) {
		const sig = SET_SIGNATURE[grade];
		cell(grade, 'weapon', sig.weaponName, 'mainHand', weaponStats(sig.weapon, index, tier), sig.weapon);
		const offHand = forGrade(grade, sig.offHandType === 'shield' ? SLOT_STATS.offHand : TOME_STATS);
		cell(grade, 'offHand', sig.offHand, 'offHand', scaled(offHand, index, tier), sig.offHandType);
		return;
	}
	cell(grade, 'shield', SHIELD_NAMES[g], 'offHand', scaled(SLOT_STATS.offHand, index, tier), 'shield');
	cell(grade, 'tome', TOME_NAMES[g], 'offHand', scaled(TOME_STATS, index, tier), 'tome');
	for (const type of WEAPON_TYPES) cell(grade, type, WEAPON_NAMES[type][g], 'mainHand', weaponStats(type, index, tier), type);
});

/** The generated ladder items, every one `enabled: false`. Live items that fill a cell (Iron Sword, Emberbrand, the Steel pieces, the Obsidian family) are not repeated. */
export const LADDER_ITEMS: ItemDef[] = generated;

/** Slots a full set fills, for tests (`EquipmentSlot` names; both rings) */
export const SET_SLOTS: readonly EquipmentSlot[] = [
	'head',
	'shoulder',
	'chest',
	'hands',
	'legs',
	'feet',
	'neck',
	'cape',
	'ring1',
	'ring2',
	'charm',
	'belt',
	'mainHand',
	'offHand',
];
