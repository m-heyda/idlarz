import { BIOMES } from '@/config/biomes';
import { BIOME_RULES } from '@/config/biomeRules';
import { BUILDINGS, GENERAL_BIOME } from '@/catalog/buildings';
import { builderCount, builtBuildings, maxLevelOf } from '@/lib/buildings';
import { busyBuilders } from '@/lib/builders';
import { castleLevelOf } from '@/lib/castleWard';
import { limitOf } from '@/lib/limits';
import { growthInfo, isBoss } from '@/lib/monsters';
import { getTile, ownedCount } from '@/utils/world';
import type { GameState } from '@/types/game';

/** The rebirths a building's biome needs before it opens (0 = open now), from `BIOME_RULES.unlockAfterRebirths`. */
const lockedUntil = (biome: string, rebirths: number): number => {
	const need = BIOME_RULES.unlockAfterRebirths[biome] ?? 0;
	return rebirths >= need ? 0 : need;
};

/** What the Kingdom overview reads from the game state */
export type KingdomInput = Pick<GameState, 'tiles' | 'monsters' | 'castleUpgrade' | 'buildingUpgrades' | 'prestige' | 'gemBuilders'>;

export interface KingdomBuildingRow {
	id: string;
	label: string;
	biome: string;
	kind: 'producer' | 'extractor' | 'idol' | 'general';
	/** 0 = not built */
	level: number;
	/** The highest level it can be taken to with what the account owns (the Ember caps; the castle level only gates when a level can be bought) */
	cap: number;
	/** An upgrade or first build is running on it */
	upgrading: boolean;
	/** Its biome is not open to the account yet: the rebirths it needs (0 = open). A locked building is not a missing one */
	lockedUntilRebirth: number;
}

/** The buildings of one biome (or the general buildings), in the fixed order Producer, Extractor, Idol, then general */
export interface KingdomBuildingGroup {
	biome: string;
	label: string;
	rows: KingdomBuildingRow[];
}

export interface KingdomSummary {
	castle: { level: number; cap: number; upgradingTo: number | null };
	builders: { total: number; busy: number };
	land: { owned: number; byBiome: { biome: string; label: string; count: number; /** Share of the owned tiles, 0-100 */ pct: number }[] };
	/** `total` is every building type, `available` leaves out the ones whose biome is still locked; `built` counts the types standing */
	buildings: { built: number; total: number; available: number; rows: KingdomBuildingRow[]; groups: KingdomBuildingGroup[] };
	/** `lucky` (golden) is a subset of `total`; `maxed` have reached their growth limit, `growing` have not (`maxed + growing = total`) */
	monsters: { total: number; bosses: number; highestLevel: number; lucky: number; maxed: number; growing: number; chests: number; rocks: number };
}

/**
 * A one-screen summary of the realm for the Kingdom overview window: the castle's level against its cap, the builders, the land owned per biome, every building with its level against what it can reach now, and how many monsters stand on the map.
 * Pure (reads the state it is given, changes nothing). Income and resources are not here: the resource windows have them.
 */
export const kingdomSummary = (state: KingdomInput, rocks = 0): KingdomSummary => {
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
		lockedUntilRebirth: def.kind === 'general' ? 0 : lockedUntil(def.biome, state.prestige.rebirths),
	}));

	const order: Record<KingdomBuildingRow['kind'], number> = { producer: 0, extractor: 1, idol: 2, general: 3 };
	const groups: KingdomBuildingGroup[] = [];
	for (const row of rows) {
		let group = groups.find((g) => g.biome === row.biome);
		if (!group) groups.push((group = { biome: row.biome, label: row.biome === GENERAL_BIOME ? 'General' : (BIOMES[row.biome]?.label ?? row.biome), rows: [] }));
		group.rows.push(row);
	}
	for (const group of groups) group.rows.sort((a, b) => order[a.kind] - order[b.kind]);

	const owned = ownedCount(state.tiles);
	const maxed = state.monsters.filter((monster) => growthInfo(monster, { prestige }).maxed).length;
	const byBiome = Object.entries(state.tiles.stats.byBiome)
		.filter(([biome, count]) => biome !== 'castle' && biome !== 'empty' && count > 0)
		.map(([biome, count]) => ({ biome, label: BIOMES[biome]?.label ?? biome, count, pct: owned > 0 ? (count / owned) * 100 : 0 }))
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
		land: { owned, byBiome },
		buildings: {
			built: rows.filter((row) => row.level > 0).length,
			total: rows.length,
			available: rows.filter((row) => row.lockedUntilRebirth === 0).length,
			rows,
			groups,
		},
		monsters: {
			total: state.monsters.length,
			bosses: state.monsters.filter((monster) => isBoss(monster.type)).length,
			highestLevel: state.monsters.reduce((top, monster) => Math.max(top, monster.level), 0),
			lucky: state.monsters.filter((monster) => monster.lucky).length,
			maxed,
			growing: state.monsters.length - maxed,
			chests: state.tiles.stats.chests,
			rocks,
		},
	};
};
