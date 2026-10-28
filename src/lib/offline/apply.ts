import { CASTLE_UPGRADE, CASTLE_X, CASTLE_Y, RESOURCE_CAP, XP_CAP } from '@/config/gameConfig';
import { maxHp, maxMana } from '@/lib/combat';
import type { LimitContext } from '@/lib/limits';
import { advanceMonsters } from '@/lib/monsters';
import type { OfflineGrant } from '@/lib/offline/grant';
import { calculateLevel, calculateResourceRates } from '@/utils/gameUtils';
import { getTile, setTile } from '@/utils/world';
import type { GameState, Resources } from '@/types/game';

// The client's side of an absence: it adds what the server certified. Nothing here decides how much - `OfflineGrant` does, and the
// server made it - so a modified client can ignore a grant but cannot enlarge one.

type Applied = Pick<
	GameState,
	| 'tiles'
	| 'resources'
	| 'resourceRates'
	| 'level'
	| 'previousLevel'
	| 'characterStats'
	| 'castleUpgrade'
	| 'monsters'
	| 'playerHp'
	| 'playerMp'
>;

export type OfflineStateIn = Applied & Pick<GameState, 'equipment' | 'farmLevels' | 'farmUpgrades' | 'prestige' | 'merchantUpgrades'>;

/** What the welcome-back window shows besides the income. */
export interface OfflineSummary {
	levelsGained: number;
	/** The castle level reached while away, when the upgrade finished */
	castleReached: number | null;
}

/** Everything the welcome-back window shows. */
export interface OfflineReport {
	grant: OfflineGrant;
	levelsGained: number;
	castleReached: number | null;
	chestsPlaced: number;
	monstersPlaced: number;
	/** The highest level among the monsters that arrived (0 when none did) */
	strongestMonster: number;
	/** The gem balance the server holds */
	gems: number;
}

/** An absence at least this long heals the hero completely. */
const FULL_HEAL_AFTER_SEC = 600;

export const applyOfflineGrant = (state: OfflineStateIn, grant: OfflineGrant, limits: LimitContext = {}): { patch: Partial<GameState>; summary: OfflineSummary } => {
	const resources: Resources = { ...state.resources };
	(Object.keys(grant.resources) as (keyof Resources)[]).forEach((key) => {
		const cap = key === 'xp' ? XP_CAP : RESOURCE_CAP;
		resources[key] = Math.min(resources[key] + grant.resources[key], cap);
	});

	// the castle upgrade keeps counting while away, at full speed (only income is discounted)
	let tiles = state.tiles;
	let resourceRates = state.resourceRates;
	let castleUpgrade = state.castleUpgrade;
	let castleReached: number | null = null;
	if (castleUpgrade && grant.castle && castleUpgrade.toLevel === grant.castle.toLevel) {
		const remaining = castleUpgrade.remainingSec - grant.elapsedSec;
		if (remaining > 0) {
			castleUpgrade = { ...castleUpgrade, remainingSec: remaining };
		} else {
			const castle = getTile(tiles, CASTLE_X, CASTLE_Y);
			if (castle && castle.biome === 'castle') {
				tiles = setTile(tiles, CASTLE_X, CASTLE_Y, { ...castle, level: castleUpgrade.toLevel, upgradeCost: CASTLE_UPGRADE.upgradeCosts[castleUpgrade.toLevel - 1] ?? undefined });
				resourceRates = calculateResourceRates(tiles, state.characterStats, state.farmLevels, state.prestige, state.farmUpgrades, state.merchantUpgrades);
				castleReached = castleUpgrade.toLevel;
			}
			castleUpgrade = null;
		}
	}

	// monsters age, and so grow, by the whole absence (the server then says which of them are still there)
	const monsters = state.monsters.length > 0 ? advanceMonsters(state.monsters, grant.elapsedSec, limits) : state.monsters;

	const { level, progress } = calculateLevel(resources.xp);
	const levelsGained = Math.max(0, level - state.level.level);
	const characterStats = levelsGained > 0 ? { ...state.characterStats, availablePoints: state.characterStats.availablePoints + levelsGained } : state.characterStats;
	const healed = grant.gapSec >= FULL_HEAL_AFTER_SEC;

	return {
		patch: {
			resources,
			resourceRates,
			tiles,
			castleUpgrade,
			monsters,
			level: { level, progress },
			// the level-up window is for levels reached while playing: the welcome-back window reports these
			previousLevel: level,
			characterStats,
			...(healed ? { playerHp: maxHp(characterStats, state.equipment), playerMp: maxMana(characterStats, state.equipment) } : {}),
		},
		summary: { levelsGained, castleReached },
	};
};
