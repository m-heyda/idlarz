// A one-function bridge so the game store can say "the server wants an absence claimed first" without importing the code that claims
// it (which imports the store). The spawn sync hook registers the handler.

let handler: (() => void) | null = null;

export const setNeedClaimHandler = (fn: (() => void) | null): void => {
	handler = fn;
};

export const signalNeedClaim = (): void => handler?.();

/** Asks the poll to run now: a fight was just started (by a click or by switching auto-battle on), so the next answer sets the pace of the fight, not the idle one. */
export const signalSyncNow = (): void => handler?.();
