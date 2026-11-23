import { mergeJunk } from '@/lib/inventory';
import type { Ledger } from '@/lib/offline/ledger';

// SERVER ONLY. Junk used to stack to 100,000 (less for the pricey kinds), so a ledger can hold several stacks of one kind; now one kind is one stack (`JUNK_STACK`). Every request merges them: a quick pass that finds nothing once it has run.

/** Merges split junk stacks in the ledger's bag (see `mergeJunk`); the bag version moves on so the browser fetches the new bag. Returns the same ledger when there is nothing to merge. */
export const mergeJunkStacks = (ledger: Ledger): Ledger => {
	const inv = ledger.inv;
	if (!inv) return ledger;
	const bag = mergeJunk(inv.bag);
	return bag === inv.bag ? ledger : { ...ledger, inv: { ...inv, ver: inv.ver + 1, bag } };
};
