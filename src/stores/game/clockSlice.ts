// clockSlice.ts
// Split out of gameStore.ts (IDL-14); the actions and their behaviour are unchanged.

import { CASTLE_UPGRADE } from '@/config/castle';
import { MAX_CATCHUP_SEC, RESOURCE_CAP, XP_CAP } from '@/config/economy';
import { calculateLevel, totalStatPoints } from '@/utils/game/character';
import { calculateResourceRates } from '@/utils/game/income';
import { merchantCombat } from '@/utils/game/merchant';
import { manaRegenPerSec, maxHp, maxMana, regen } from '@/lib/combat';
import { bestWornGrade, generateMerchantStock, rotationRng, stockDue } from '@/lib/merchant';
import { emitSaveEvent } from '@/lib/saveEvents';
import { gearIncomePct, xpGainPct } from '@/lib/gearEconomy';
import { aggregateStats, averageItemLevel } from '@/lib/inventory';
import { castleLevelOf } from '@/lib/castleWard';
import { advanceMonsters } from '@/lib/monsters';
import type { Resources } from '@/types/game';
import { setTile } from '@/utils/world';
import { findCastle, limitCtx, type GameGet, type GameSet } from './base';

export const createClockSlice = (set: GameSet, get: GameGet) => ({
	tick: (deltaTime: number) => {
		const state = get();
		// Bounded, never negative: editing the system clock cannot grant (or remove) progress
		const deltaMs = Number.isFinite(deltaTime) ? deltaTime : 0;
		const secondsElapsed = Math.min(Math.max(0, deltaMs), MAX_CATCHUP_SEC * 1000) / 1000;
		if (secondsElapsed === 0) return;

		// Resource accumulation (xp has its own multiplier)
		const newResources = { ...state.resources };
		(Object.entries(state.resourceRates.total) as [keyof Resources, number][]).forEach(([resource, rate]) => {
			if (resource === 'xp') return;
			newResources[resource] = Math.min(newResources[resource] + rate * secondsElapsed, RESOURCE_CAP);
		});
		const xpGain = state.resourceRates.total.xp * (1 + xpGainPct(state.characterStats, state.equipment) / 100);
		newResources.xp = Math.min(newResources.xp + xpGain * secondsElapsed, XP_CAP);

		let newTiles = state.tiles;
		let newRates = state.resourceRates;
		let newCastleUpgrade = state.castleUpgrade;

		// Castle upgrade timer (counted from tick deltas, so changing the clock cannot skip it)
		if (newCastleUpgrade) {
			const remaining = newCastleUpgrade.remainingSec - secondsElapsed;
			if (remaining <= 0) {
				const castle = findCastle(state.tiles);
				if (castle) {
					newTiles = setTile(state.tiles, castle.x, castle.y, {
						...castle.tile,
						level: newCastleUpgrade.toLevel,
						upgradeCost: CASTLE_UPGRADE.upgradeCosts[newCastleUpgrade.toLevel - 1] ?? undefined,
					});
					newRates = calculateResourceRates(
						newTiles,
						state.characterStats,
						state.farmLevels,
						state.prestige,
						state.farmUpgrades,
						state.merchantUpgrades,
						gearIncomePct(state.equipment),
					);
				}
				newCastleUpgrade = null;
			} else {
				newCastleUpgrade = { ...newCastleUpgrade, remainingSec: remaining };
			}
		}

		// Chests and monsters come from the server (see applyServerTickets); between its answers the monsters on the map just age
		const newMonsters = state.monsters.length > 0 ? advanceMonsters(state.monsters, secondsElapsed, limitCtx(state)) : state.monsters;

		// HP and mana: the server's numbers arrive with every answer; in between they keep filling the way the server will count them
		// (in a fight the server's picture is the only one, so HP is left alone and only the cooldowns and the stun run down)
		const playerMaxHp = maxHp(state.characterStats, state.equipment);
		const inFight = state.combat.fight !== null;
		const newPlayerHp = Math.min(
			playerMaxHp,
			inFight
				? state.playerHp
				: regen(state.playerHp, playerMaxHp, secondsElapsed, aggregateStats(state.equipment).regen + merchantCombat(state.merchantUpgrades).regen),
		);
		const newPlayerMp = Math.min(
			maxMana(state.characterStats, state.equipment),
			state.playerMp + manaRegenPerSec(state.characterStats, state.equipment) * secondsElapsed,
		);
		const cd = state.combat.cd;
		const cooling = cd.heal > 0 || cd.stun > 0 || cd.potion > 0 || (state.combat.fight?.stunLeft ?? 0) > 0;
		const newCombat = cooling
			? {
					...state.combat,
					cd: { heal: Math.max(0, cd.heal - secondsElapsed), stun: Math.max(0, cd.stun - secondsElapsed), potion: Math.max(0, cd.potion - secondsElapsed) },
					fight: state.combat.fight ? { ...state.combat.fight, stunLeft: Math.max(0, state.combat.fight.stunLeft - secondsElapsed) } : null,
				}
			: state.combat;

		const newPlaySeconds = state.playSeconds + secondsElapsed;

		// Level and stat points
		const { level, progress } = calculateLevel(newResources.xp);
		const castleFinished = !!state.castleUpgrade && !newCastleUpgrade;
		const newCharacterStats = { ...state.characterStats };
		if (level > state.level.level) {
			newCharacterStats.availablePoints += totalStatPoints(level) - totalStatPoints(state.level.level);
		}

		set({
			resources: newResources,
			resourceRates: newRates,
			level: { level, progress },
			previousLevel: state.level.level,
			characterStats: newCharacterStats,
			tiles: newTiles,
			castleUpgrade: newCastleUpgrade,
			monsters: newMonsters,
			combat: newCombat,
			playerHp: newPlayerHp,
			playerMp: newPlayerMp,
			merchantStock: stockDue(state.merchantStock, newPlaySeconds, limitCtx(state))
				? generateMerchantStock(
						castleLevelOf(state.tiles),
						averageItemLevel(state.equipment),
						rotationRng(newPlaySeconds),
						newPlaySeconds,
						limitCtx(state),
						bestWornGrade(state.equipment),
					)
				: state.merchantStock,
			playSeconds: newPlaySeconds,
		});
		if (castleFinished) emitSaveEvent('castleUpgraded');
		if (level > state.level.level) emitSaveEvent('levelUp');
	},
});
