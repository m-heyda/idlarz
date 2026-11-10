import type { TutorialNumbers } from '@/catalog/tutorial';
import { CASTLE_UPGRADE } from '@/config/castle';
import { COMBAT } from '@/config/combatConfig';
import { ANIMALS } from '@/config/farm';
import { REBIRTH } from '@/config/rebirth';
import { CHEST } from '@/config/spawns';
import { offlineCapSec, offlineEfficiency } from '@/lib/offline/limits';
import { calculateAnimalCost } from '@/utils/game/farm';
import { calculateTileCost } from '@/utils/game/costs';

const plain = (n: number): string => Math.round(n).toLocaleString('en-US');

/** "30 minutes", "2 hours", "1.5 days": a duration a person reads in a bubble. */
export const spoken = (sec: number): string => {
	const unit = sec >= 86400 ? { s: 86400, name: 'day' } : sec >= 3600 ? { s: 3600, name: 'hour' } : { s: 60, name: 'minute' };
	const value = Math.round((sec / unit.s) * 10) / 10;
	return `${value} ${unit.name}${value === 1 ? '' : 's'}`;
};

/** Clicks the first step asks for. */
export const CLICKS_NEEDED = 3;

/**
 * The numbers the tutorial texts quote, read from the live config at the moment they are shown (a changed price changes the text, nothing is typed in):
 * the first tile's price, the first animal and its food price, the first castle upgrade's price and time, the chest interval, the offline cap and
 * efficiency, and the rebirth requirements.
 *
 * @category Progression/Guided tutorial
 * @order 2
 */
export const buildNumbers = (): TutorialNumbers => {
	const animal = ANIMALS[0];
	return {
		clicksNeeded: CLICKS_NEEDED,
		// the first purchase is priced at 1 tile owned (economyTiles of a new game)
		tilePrice: plain(calculateTileCost(1).gold),
		animalName: animal.name.toLowerCase(),
		animalFood: plain(calculateAnimalCost(animal, 0)),
		castleSeconds: spoken(CASTLE_UPGRADE.durationsSec[0]),
		castleGold: plain(CASTLE_UPGRADE.upgradeCosts[0].gold),
		chestMinutes: Math.round(CHEST.intervalSec / 60),
		offlineHours: Math.round(offlineCapSec() / 3600),
		offlinePct: Math.round(offlineEfficiency() * 100),
		rebirthCastle: REBIRTH.minCastleLevel,
		rebirthTiles: REBIRTH.minTiles,
		autoRebirths: COMBAT.auto.minRebirths,
	};
};
