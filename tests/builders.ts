// Shared builders for the literals many tests used to copy: an in-memory ledger store and a monster standing near the castle.
// Only pure, behaviour-free helpers live here; helpers.ts builds whole games.
import { CASTLE_X, CASTLE_Y } from '../src/config/castle';
import type { Ledger, LedgerRepo } from '../src/lib/offline/ledger';
import { fullSet, kit } from '../src/lib/fightSim';
import { plainItem } from '../src/lib/itemInstance';
import type { Equipment, Monster } from '../src/types/game';

/** A ledger repo kept in a Map (optimistic version check, values cloned on the way in and out), plus the Map for assertions. */
export const memoryLedgers = () => {
	const ledgers = new Map<string, Ledger>();
	const ledgerRepo: LedgerRepo = {
		load: async (id) => (ledgers.has(id) ? structuredClone(ledgers.get(id)!) : null),
		commit: async (id, expectedVer, ledger) => {
			const current = ledgers.get(id);
			if (expectedVer === 0 ? !!current : current?.ver !== expectedVer) return false;
			ledgers.set(id, structuredClone(ledger));
			return true;
		},
	};
	return { ledgers, ledgerRepo };
};

/** A fresh thistle boar two tiles east of the castle; `spawnLevel` follows `level` unless given. */
export const makeMonster = (patch: Partial<Monster> = {}): Monster => ({
	id: 1,
	type: 'thistleBoar',
	level: 1,
	spawnLevel: patch.level ?? 1,
	x: CASTLE_X + 2,
	y: CASTLE_Y,
	ageSec: 0,
	...patch,
});

// ---- gear kits: the yardstick of the fight and loot tests (IDL-219) ----------------------------------------------------------------
// The tests used to spell out `fullSet('obsidian', 'titan_maul')` as "the strong kit". Obsidian is only grade G6 of the ladder
// (catalog/items/ladder.ts), so the benchmark is now a named kit per grade and ONE place that says which kit is the strong one.

export { kit };

/**
 * The strongest kit that exists in the game today (what a player can actually wear): the Obsidian set plus the top legendary maul.
 * Fixtures that need "a strong character" use this, so when the grade ladder goes live (a stronger kit exists) swapping it is this line.
 */
export const STRONG_KIT: Equipment = { ...fullSet('obsidian'), mainHand: plainItem('titan_maul') };
