// paragonSlice.ts
// The paragon points (docs/plan/paragon.md): the server's record lives in `paragonSpent`; the actions are the sync's (paragonSync.ts).

import type { ParagonSync } from './paragonSync';

export const createParagonSlice = (paragon: ParagonSync) => ({
	/** Takes the server's paragon record (the points belong to the server's ledger). */
	applyServerParagon: paragon.applyParagon,
	/** Reads the server's record and takes it (game start). */
	syncServerParagon: paragon.syncParagon,
	/** Puts free points into an upgrade: a preview at once, then the server is asked. */
	spendParagon: paragon.spendParagon,
});
