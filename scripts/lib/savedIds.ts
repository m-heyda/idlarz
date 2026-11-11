import { ACHIEVEMENTS } from '../../src/catalog/achievements';
import { AVATARS } from '../../src/catalog/avatars';
import { BUFF_FAMILIES } from '../../src/catalog/buffs';
import { BUILDINGS } from '../../src/catalog/buildings';
import { EQUIPMENT_LAYOUT, ITEM_CATALOG, RARITIES } from '../../src/catalog';
import { COMPONENTS, RECIPES } from '../../src/catalog/recipes';
import { STORED_KEYS } from '../../src/catalog/resourceKeys';
import { CASTLE_UPGRADE } from '../../src/config/castle';
import { MONSTERS } from '../../src/config/combatConfig';
import { CLICK_LADDER } from '../../src/config/economy';
import { ANIMALS, FARM_UPGRADES } from '../../src/config/farm';
import { HARD_LIMITS } from '../../src/config/limits';
import { MERCHANT_UPGRADES } from '../../src/config/merchant';
import { PLAYER_CLASSES } from '../../src/config/playerClasses';
import { EMBER_UPGRADES } from '../../src/config/rebirth';
import { BIOME_CODES } from '../../src/lib/saveFormat';

/**
 * Everything a stored save or ledger can name by id or position, as the running code has it. `tests/fixtures/saves/released-ids.json` holds what has SHIPPED; `tests/saves/appendOnly.test.ts` fails when
 * the code no longer has something that shipped. Used by `npm run gen-save-fixtures -- --ids` to add the new ids to the shipped list.
 */
export interface SavedIds {
	/** Ordered: the stored resource keys, in catalog order (saves and `granted` are keyed by name, but the order is pinned too) */
	resourceKeys: string[];
	/** Letter per biome in the compact land: never changed or reused */
	biomeCodes: Record<string, string>;
	itemIds: string[];
	monsterIds: string[];
	recipeIds: string[];
	componentIds: string[];
	buildingIds: string[];
	avatarIds: string[];
	achievementIds: string[];
	merchantUpgradeIds: string[];
	farmUpgradeIds: string[];
	animalIds: string[];
	emberUpgradeIds: string[];
	playerClassIds: string[];
	rarityIds: string[];
	equipmentSlots: string[];
	buffFamilyIds: string[];
	/** Numbers a stored value is checked against: they only grow, or a stored value above the lowered number would be cut */
	limits: Record<string, number>;
}

/** Lists that are order-sensitive: the shipped list must be a PREFIX of the current one. */
export const ORDERED_LISTS: readonly (keyof SavedIds)[] = ['resourceKeys'];

const maxLevels = (table: Record<string, { maxLevel: number }>, prefix: string): Record<string, number> =>
	Object.fromEntries(Object.entries(table).map(([id, def]) => [`${prefix}.${id}`, def.maxLevel]));

export const currentIds = (): SavedIds => ({
	resourceKeys: [...STORED_KEYS],
	biomeCodes: { ...BIOME_CODES },
	itemIds: Object.keys(ITEM_CATALOG),
	monsterIds: Object.keys(MONSTERS),
	recipeIds: RECIPES.map((r) => r.id),
	componentIds: Object.keys(COMPONENTS),
	buildingIds: BUILDINGS.map((b) => b.id),
	avatarIds: AVATARS.map((a) => a.id),
	achievementIds: ACHIEVEMENTS.map((a) => a.id),
	merchantUpgradeIds: Object.keys(MERCHANT_UPGRADES),
	farmUpgradeIds: Object.keys(FARM_UPGRADES),
	animalIds: ANIMALS.map((a) => a.id),
	emberUpgradeIds: Object.keys(EMBER_UPGRADES),
	playerClassIds: Object.keys(PLAYER_CLASSES),
	rarityIds: Object.keys(RARITIES),
	equipmentSlots: [...EQUIPMENT_LAYOUT.left, ...EQUIPMENT_LAYOUT.right, ...EQUIPMENT_LAYOUT.bottom],
	buffFamilyIds: Object.keys(BUFF_FAMILIES),
	limits: {
		...Object.fromEntries(Object.entries(HARD_LIMITS).map(([key, value]) => [`hard.${key}`, value])),
		'castle.maxLevel': CASTLE_UPGRADE.maxLevel,
		'clickLadder.length': CLICK_LADDER.length,
		...maxLevels(MERCHANT_UPGRADES as unknown as Record<string, { maxLevel: number }>, 'merchant'),
		...maxLevels(FARM_UPGRADES as unknown as Record<string, { maxLevel: number }>, 'farm'),
		...maxLevels(EMBER_UPGRADES as unknown as Record<string, { maxLevel: number }>, 'ember'),
	},
});

/** The shipped list merged with the current one: nothing shipped is ever removed, new entries are appended (ordered lists keep the shipped order as the prefix). Pure. */
export const mergeReleased = (shipped: SavedIds | null, current: SavedIds): SavedIds => {
	if (!shipped) return current;
	const out = { ...current } as Record<string, unknown>;
	for (const key of Object.keys(current) as (keyof SavedIds)[]) {
		const was = shipped[key];
		const now = current[key];
		if (Array.isArray(was) && Array.isArray(now)) out[key] = [...was, ...now.filter((id) => !was.includes(id))];
		else
			out[key] = {
				...(now as Record<string, number | string>),
				...(was as Record<string, number | string>),
				...mergeMax(was as Record<string, unknown>, now as Record<string, unknown>),
			};
	}
	return out as unknown as SavedIds;
};

const mergeMax = (was: Record<string, unknown>, now: Record<string, unknown>): Record<string, unknown> =>
	Object.fromEntries(
		Object.entries(now).map(([k, v]) => [k, typeof v === 'number' && typeof was[k] === 'number' ? Math.max(v, was[k] as number) : (was[k] ?? v)]),
	);
