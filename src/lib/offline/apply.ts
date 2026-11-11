import { CASTLE_UPGRADE, CASTLE_X, CASTLE_Y } from '@/config/castle';
import { RESOURCE_CAP, XP_CAP } from '@/config/economy';
import { maxHp, maxMana } from '@/lib/combat';
import { gearIncomePct } from '@/lib/gearEconomy';
import type { LimitContext } from '@/lib/limits';
import { afterAbsence } from '@/lib/merchant';
import { completeUpgrade } from '@/lib/buildings';
import { advanceMonsters } from '@/lib/monsters';
import { UNCLAIMED_SEC, type OfflineGrant } from '@/lib/offline/grant';
import { calculateLevel, totalStatPoints } from '@/utils/game/character';
import { calculateResourceRates } from '@/utils/game/income';
import { getTile, setTile } from '@/utils/world';
import type { GameState, Resources } from '@/types/game';

// The client's side of an absence: it adds what the server certified. Nothing here decides how much - `OfflineGrant` does, and the
// server made it - so a modified client can ignore a grant but cannot enlarge one.

type Applied = Pick<
	GameState,
	'tiles' | 'resources' | 'resourceRates' | 'level' | 'previousLevel' | 'characterStats' | 'castleUpgrade' | 'monsters' | 'playerHp' | 'playerMp'
>;

export type OfflineStateIn = Applied &
	Partial<Pick<GameState, 'buildingUpgrade' | 'idolLevels'>> &
	Pick<GameState, 'equipment' | 'farmLevels' | 'farmUpgrades' | 'prestige' | 'merchantUpgrades'> &
	Partial<Pick<GameState, 'merchantStock' | 'merchantRefresh' | 'playSeconds' | 'playerClass'>>;

/** What the welcome-back window shows besides the income. */
export interface OfflineSummary {
	levelsGained: number;
	/** The castle level reached while away, when the upgrade finished */
	castleReached: number | null;
	/** The building level reached while away (building system), only present when an upgrade finished */
	buildingReached?: number;
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

export const applyOfflineGrant = (
	state: OfflineStateIn,
	grant: OfflineGrant,
	limits: LimitContext = {},
): { patch: Partial<GameState>; summary: OfflineSummary } => {
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
				tiles = setTile(tiles, CASTLE_X, CASTLE_Y, {
					...castle,
					level: castleUpgrade.toLevel,
					upgradeCost: CASTLE_UPGRADE.upgradeCosts[castleUpgrade.toLevel - 1] ?? undefined,
				});
				resourceRates = calculateResourceRates(
					tiles,
					state.characterStats,
					state.farmLevels,
					state.prestige,
					state.farmUpgrades,
					state.merchantUpgrades,
					gearIncomePct(state.equipment),
				);
				castleReached = castleUpgrade.toLevel;
			}
			castleUpgrade = null;
		}
	}

	// a building upgrade counts the same way (the builder is shared, so it never runs next to the castle's): the new level counts from the moment its timer ended
	let buildingUpgrade = state.buildingUpgrade ?? null;
	let buildingReached: number | undefined;
	let idolLevels = state.idolLevels;
	if (
		buildingUpgrade &&
		grant.building &&
		buildingUpgrade.x === grant.building.x &&
		buildingUpgrade.y === grant.building.y &&
		buildingUpgrade.toLevel === grant.building.toLevel
	) {
		const remaining = buildingUpgrade.remainingSec - grant.elapsedSec;
		if (remaining > 0) {
			buildingUpgrade = { ...buildingUpgrade, remainingSec: remaining };
		} else {
			const done = completeUpgrade(tiles, state.idolLevels ?? {}, buildingUpgrade);
			if (done.reached) {
				tiles = done.tiles;
				idolLevels = done.idolLevels;
				resourceRates = calculateResourceRates(
					tiles,
					state.characterStats,
					state.farmLevels,
					state.prestige,
					state.farmUpgrades,
					state.merchantUpgrades,
					gearIncomePct(state.equipment),
				);
				buildingReached = buildingUpgrade.toLevel;
			}
			buildingUpgrade = null;
		}
	}

	// monsters age, and so grow, by the whole absence (the server then says which of them are still there)
	const monsters = state.monsters.length > 0 ? advanceMonsters(state.monsters, grant.elapsedSec, limits) : state.monsters;

	const { level, progress } = calculateLevel(resources.xp);
	const levelsGained = Math.max(0, level - state.level.level);
	const characterStats =
		levelsGained > 0
			? { ...state.characterStats, availablePoints: state.characterStats.availablePoints + totalStatPoints(level) - totalStatPoints(state.level.level) }
			: state.characterStats;
	const healed = grant.gapSec > UNCLAIMED_SEC;
	// the merchant's clocks count play time: the absence counts for them too
	const merchant =
		state.merchantRefresh && state.playSeconds !== undefined
			? afterAbsence(state.merchantStock ?? null, state.merchantRefresh, state.playSeconds, grant.elapsedSec, limits)
			: null;

	return {
		patch: {
			resources,
			resourceRates,
			tiles,
			castleUpgrade,
			...(state.buildingUpgrade !== undefined ? { buildingUpgrade } : {}),
			...(idolLevels !== undefined ? { idolLevels } : {}),
			monsters,
			level: { level, progress },
			// the level-up window is for levels reached while playing: the welcome-back window reports these
			previousLevel: level,
			characterStats,
			...(merchant ?? {}),
			...(healed ? { playerHp: maxHp(characterStats, state.equipment), playerMp: maxMana(characterStats, state.equipment, state.playerClass) } : {}),
		},
		summary: { levelsGained, castleReached, ...(buildingReached !== undefined ? { buildingReached } : {}) },
	};
};
