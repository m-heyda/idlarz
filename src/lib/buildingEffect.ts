import { buildingDef } from '@/catalog/buildings';
import { idolDef } from '@/catalog/idols';
import { RESOURCES } from '@/catalog/resources';
import { GENERAL_RULES } from '@/config/buildings';
import { buildingOutput } from '@/lib/buildingOutput';
import { idolValueText } from '@/lib/idolEconomy';
import { formatNumber } from '@/utils/formatters';
import { forEachOwned, type World } from '@/utils/world';

const HOUR = 3600;

/** What a building gives, as the lines the Kingdom overview shows when you point at its name: `built` is whether it stands (otherwise the lines say what level 1 would give), `lines` the effect, one per resource for a Producer or Extractor. */
export interface BuildingEffect {
	built: boolean;
	lines: string[];
}

/**
 * What a building gives at `level` (0 = not built: level 1 is shown instead), in words: an Idol its bonus ("+6 % XP gain", Luck in points), a general building its bonus (`GENERAL_RULES.perLevel` % per level), a Producer or Extractor what it makes per hour
 * (the tile output of its biome with the bonus from the biome tiles the player owns, before the castle and Ember bonuses, the same numbers as the building window). Pure: the Kingdom overview calls it for every row.
 *
 * @category Economy/Buildings
 * @order 9
 */
export const buildingEffect = (id: string, level: number, ownedOfBiome: number): BuildingEffect => {
	const def = buildingDef(id);
	const built = level > 0;
	const at = Math.max(1, level);
	if (!def) return { built, lines: [] };
	if (def.kind === 'idol') {
		const idol = idolDef(def.id);
		return { built, lines: idol ? [idolValueText(idol, at) + (idol.applied ? '' : ' (coming soon)')] : [] };
	}
	if (def.kind === 'general') return { built, lines: [`+${at * GENERAL_RULES.perLevel} % ${def.effectText ?? ''}`.trim()] };
	const output = buildingOutput(def, at, ownedOfBiome);
	const lines = (Object.keys(output) as (keyof typeof output)[])
		.filter((key) => (output[key] ?? 0) > 0)
		.map((key) => `${formatNumber((output[key] ?? 0) * HOUR)} ${RESOURCES[key]?.label ?? key} per hour`);
	return { built, lines };
};

/** Every tile that holds the building `id`, in the map's row-then-column order. */
export const tilesWithBuilding = (world: World, id: string): { x: number; y: number }[] => {
	const found: { x: number; y: number }[] = [];
	forEachOwned(world, (tile, x, y) => {
		if (tile.building === id) found.push({ x, y });
	});
	return found;
};

/**
 * The copy to show next when the player points at a building by name: the first one, or (when `last` is one of them) the one after it, wrapping round, so pressing the same name again walks through the copies. `null` when none stands.
 *
 * @category Economy/Buildings
 * @order 10
 */
export const nextBuildingTile = (tiles: readonly { x: number; y: number }[], last: { x: number; y: number } | null): { x: number; y: number } | null => {
	if (tiles.length === 0) return null;
	const at = last ? tiles.findIndex((t) => t.x === last.x && t.y === last.y) : -1;
	return tiles[(at + 1) % tiles.length];
};
