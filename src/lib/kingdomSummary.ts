import { BIOMES } from '@/config/biomes';
import { BUILDINGS } from '@/catalog/buildings';
import { builderCount, builtBuildings, maxLevelOf } from '@/lib/buildings';
import { busyBuilders } from '@/lib/builders';
import { castleLevelOf } from '@/lib/castleWard';
import { limitOf } from '@/lib/limits';
import { isBoss } from '@/lib/monsters';
import { getTile, ownedCount } from '@/utils/world';
import type { GameState } from '@/types/game';

/** What the Kingdom overview reads from the game state */
export type KingdomInput = Pick<GameState, 'tiles' | 'monsters' | 'castleUpgrade' | 'buildingUpgrades' | 'prestige' | 'gemBuilders'>;

export interface KingdomBuildingRow {
	id: string;
	label: string;
	biome: string;
	kind: 'producer' | 'extractor' | 'idol';
	/** 0 = not built */
	level: number;
	/** The highest level it can be taken to with what the account owns (the Ember caps; the castle level only gates when a level can be bought) */
	cap: number;
	/** An upgrade or first build is running on it */
	upgrading: boolean;
}

export interface KingdomSummary {
	castle: { level: number; cap: number; upgradingTo: number | null };
	builders: { total: number; busy: number };
	land: { owned: number; byBiome: { biome: string; label: string; count: number }[] };
	buildings: { built: number; total: number; rows: KingdomBuildingRow[] };
	monsters: { total: number; bosses: number; highestLevel: number };
}

/**
 * A one-screen summary of the realm for the Kingdom overview window: the castle's level against its cap, the builders, the land owned per biome, every building with its level against what it can reach now, and how many monsters stand on the map.
 * Pure (reads the state it is given, changes nothing). Income and resources are not here: the resource windows have them.
 */
export const kingdomSummary = (state: KingdomInput): KingdomSummary => {
	const prestige = state.prestige;
	const castleLevel = castleLevelOf(state.tiles);
	const idolMax = limitOf('idolMaxLevel', { prestige });
	const buildingMax = limitOf('buildingMaxLevel', { prestige });

	const built = new Map<string, number>();
	for (const b of builtBuildings(state.tiles)) built.set(b.id, Math.max(built.get(b.id) ?? 0, b.level));
	const upgrading = new Set<string>();
	for (const job of state.buildingUpgrades) {
		const tile = getTile(state.tiles, job.x, job.y);
		const id = job.building ?? tile?.building;
		if (id) upgrading.add(id);
	}
	const rows: KingdomBuildingRow[] = BUILDINGS.map((def) => ({
		id: def.id,
		label: def.label,
		biome: def.biome,
		kind: def.kind,
		level: built.get(def.id) ?? 0,
		cap: maxLevelOf(def, idolMax, buildingMax),
		upgrading: upgrading.has(def.id),
	}));

	const byBiome = Object.entries(state.tiles.stats.byBiome)
		.filter(([biome, count]) => biome !== 'castle' && biome !== 'empty' && count > 0)
		.map(([biome, count]) => ({ biome, label: BIOMES[biome]?.label ?? biome, count }))
		.sort((a, b) => b.count - a.count);

	return {
		castle: {
			level: castleLevel,
			cap: limitOf('castleMaxLevel', { prestige }),
			upgradingTo: state.castleUpgrade ? state.castleUpgrade.toLevel : null,
		},
		builders: {
			total: builderCount({ prestige, gemBuilders: state.gemBuilders }),
			busy: busyBuilders(state.castleUpgrade, state.buildingUpgrades),
		},
		land: { owned: ownedCount(state.tiles), byBiome },
		buildings: { built: rows.filter((row) => row.level > 0).length, total: rows.length, rows },
		monsters: {
			total: state.monsters.length,
			bosses: state.monsters.filter((monster) => isBoss(monster.type)).length,
			highestLevel: state.monsters.reduce((top, monster) => Math.max(top, monster.level), 0),
		},
	};
};
