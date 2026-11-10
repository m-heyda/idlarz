import type { TutorialFacts } from '@/catalog/tutorial';
import { CASTLE_UPGRADE } from '@/config/castle';
import { INITIAL_CHARACTER_STATS } from '@/config/character';
import { ANIMALS } from '@/config/farm';
import { calculateAnimalCost } from '@/utils/game/farm';
import { economyTiles } from '@/utils/game/tiles';
import { rebirthStatus } from '@/utils/game/rebirth';
import { castleLevelOf } from '@/lib/castleWard';
import type { GameState } from '@/types/game';

/** What the guide counts itself (events the state does not keep): kept in the tutorial store and reset by a reload. */
export interface TutorialCounters {
	clicks: number;
	chestsOpened: number;
	fightsWon: number;
	merchantOpened: boolean;
	/** Resources that were ever above zero (sticky) */
	seen: Record<string, boolean>;
}

export const emptyCounters = (): TutorialCounters => ({ clicks: 0, chestsOpened: 0, fightsWon: 0, merchantOpened: false, seen: {} });

type GameInput = Pick<
	GameState,
	| 'tiles'
	| 'freeTiles'
	| 'resources'
	| 'resourceRates'
	| 'farmLevels'
	| 'castleUpgrade'
	| 'characterStats'
	| 'monsters'
	| 'activeChests'
	| 'prestige'
	| 'merchantUpgrades'
>;

const ATTRIBUTES = ['strength', 'dexterity', 'intelligence', 'vitality', 'charisma'] as const;

/** Attribute points spent so far: the attributes above their starting value. */
export const pointsSpentOf = (stats: GameInput['characterStats']): number =>
	ATTRIBUTES.reduce((sum, key) => sum + Math.max(0, stats[key] - INITIAL_CHARACTER_STATS[key]), 0);

/** The resources that are above zero in the stores or the rates now, added to the sticky `seen` map (a new object only when something was added). */
export const withSeen = (seen: Record<string, boolean>, game: Pick<GameInput, 'resources' | 'resourceRates'>): Record<string, boolean> => {
	let next = seen;
	const stock = game.resources as unknown as Record<string, number>;
	const rates = game.resourceRates.total as unknown as Record<string, number>;
	for (const key of Object.keys(stock)) {
		if (key === 'xp' || seen[key]) continue;
		if (stock[key] > 0 || rates[key] > 0) next = { ...next, [key]: true };
	}
	return next;
};

/**
 * The facts the triggers read, taken from the game state, the events the guide counted and the windows that are open. Pure.
 * `castleAffordable` uses the first upgrade's price table row for the castle's current level.
 */
export const factsFromGame = (game: GameInput, counters: TutorialCounters, open: readonly string[]): TutorialFacts => {
	const castleLevel = castleLevelOf(game.tiles);
	const cost = CASTLE_UPGRADE.upgradeCosts[castleLevel - 1] as Partial<Record<string, number>> | undefined;
	const stock = game.resources as unknown as Record<string, number>;
	const animal = ANIMALS[0];
	const animals = Object.values(game.farmLevels).reduce((sum, n) => sum + Math.max(0, n), 0);
	const rebirth = rebirthStatus(game);
	return {
		clicks: counters.clicks,
		tilesBought: Math.max(0, economyTiles(game.tiles, game.freeTiles) - 1),
		animals,
		animalAffordable: stock.food >= calculateAnimalCost(animal, game.farmLevels[animal.id] ?? 0),
		castleLevel,
		castleUpgrading: !!game.castleUpgrade,
		castleAffordable: !!cost && Object.entries(cost).every(([key, need]) => (stock[key] ?? 0) >= (need ?? 0)),
		chestsOpened: counters.chestsOpened,
		chestOnMap: game.activeChests > 0,
		monsterOnMap: game.monsters.length > 0,
		fightsWon: counters.fightsWon,
		merchantOpened: counters.merchantOpened,
		pointsSpent: pointsSpentOf(game.characterStats),
		unspentPoints: game.characterStats.availablePoints,
		seen: counters.seen,
		rebirths: game.prestige.rebirths,
		rebirthReady: rebirth.requirements.every((r) => r.met),
		open,
	};
};
