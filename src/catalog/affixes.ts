import type { ItemStatKey } from './stats';

/**
 * Affixes: extra stats rolled onto gear. How many an item gets comes from its rarity (`RARITIES[r].minAffixes..maxAffixes`);
 * which ones can roll comes from the item level (`minItemLevel`) and the item's tags. An affix's value is derived, never
 * stored: `affixMagnitude(stat, itemLevel) x power x (roll range)`, so the level curve stays the one place power grows.
 */
export interface AffixDef {
	id: string;
	/** Shown as "Keen Iron Sword" (prefix) or "Iron Sword of Precision" (suffix) */
	name: string;
	position: 'prefix' | 'suffix';
	stat: ItemStatKey;
	/** Multiplier on the stat's level-1 value (`STAT_BASE_BY_TIER[stat][0]`) */
	power: number;
	/** The value range as a multiple of the base value; the item's 0-100 roll picks the point inside it */
	roll: readonly [number, number];
	/** The affix only rolls on items of at least this level */
	minItemLevel: number;
	/** Relative chance among the affixes an item can take */
	weight: number;
	/** The item needs at least one of these tags (see ItemDef.tags); empty = any gear */
	tags: readonly string[];
	/** An item never rolls two affixes of the same group (here: the stat, so no double Armor or contradictory pairs) */
	group: string;
	/** Lowest rarity rank that can roll it (omit = any rarity that has affixes) */
	minRarityRank?: number;
	enabled: boolean;
}

const WEAPON = ['weapon'];
const DEFENCE = ['head', 'shoulder', 'chest', 'hands', 'legs', 'feet', 'offhand', 'cape'];
const TRINKET = ['neck', 'ring', 'charm', 'cape'];
const MAGIC = ['staff', 'wand', 'tome'];

interface Pair {
	stat: ItemStatKey;
	prefix: string;
	suffix: string;
	power: number;
	tags: readonly string[];
	minItemLevel?: number;
	weight?: number;
	roll?: readonly [number, number];
}

const pair = ({ stat, prefix, suffix, power, tags, minItemLevel = 1, weight = 10, roll = [0.6, 1.4] }: Pair): AffixDef[] =>
	(['prefix', 'suffix'] as const).map((position) => ({
		id: `${stat}_${position}`,
		name: position === 'prefix' ? prefix : suffix,
		position,
		stat,
		power,
		roll,
		minItemLevel,
		weight,
		tags,
		group: stat,
		enabled: true,
	}));

export const AFFIXES: AffixDef[] = [
	...pair({ stat: 'damage', prefix: 'Sharp', suffix: 'of Power', power: 0.5, tags: WEAPON }),
	...pair({ stat: 'armor', prefix: 'Sturdy', suffix: 'of the Bulwark', power: 1.5, tags: DEFENCE }),
	...pair({ stat: 'maxHp', prefix: 'Hearty', suffix: 'of Vitality', power: 1.5, tags: [] }),
	...pair({ stat: 'critChance', prefix: 'Keen', suffix: 'of Precision', power: 1.5, tags: [...WEAPON, 'hands', ...TRINKET] }),
	...pair({ stat: 'superCrit', prefix: 'Deadly', suffix: 'of Ruin', power: 1, tags: [...WEAPON, 'ring', 'charm'], minItemLevel: 6, weight: 6 }),
	...pair({ stat: 'dodge', prefix: 'Fleet', suffix: 'of Evasion', power: 1, tags: ['feet', 'legs', 'cape', 'charm'], weight: 8 }),
	...pair({ stat: 'goldFind', prefix: 'Gilded', suffix: 'of Greed', power: 1.5, tags: [], weight: 8 }),
	...pair({ stat: 'luck', prefix: 'Lucky', suffix: 'of Fortune', power: 1.5, tags: [], weight: 8 }),
	...pair({ stat: 'regen', prefix: 'Mending', suffix: 'of Renewal', power: 1.5, tags: [], weight: 8 }),
	...pair({ stat: 'maxMana', prefix: 'Arcane', suffix: 'of the Well', power: 1.5, tags: [...MAGIC, 'head', 'chest', 'neck', 'ring', 'charm'], weight: 8 }),
	...pair({ stat: 'manaRegen', prefix: 'Flowing', suffix: 'of Clarity', power: 1.5, tags: [...MAGIC, 'head', 'chest', 'neck', 'ring', 'charm'], weight: 8 }),
	...pair({ stat: 'spellPower', prefix: 'Wise', suffix: 'of Sorcery', power: 1.5, tags: [...MAGIC, 'neck', 'ring', 'charm'], weight: 6 }),
	...pair({ stat: 'lifeLeech', prefix: 'Vampiric', suffix: 'of the Leech', power: 2, tags: WEAPON, minItemLevel: 5, weight: 5 }),
];

// No prototype: an affix id from a save must not resolve to 'constructor' and friends
export const AFFIX_CATALOG: Record<string, AffixDef> = Object.assign(
	Object.create(null) as Record<string, AffixDef>,
	Object.fromEntries(AFFIXES.map((affix) => [affix.id, affix]))
);
