// A one-function bridge so the game store can say "the server wants an absence claimed first" without importing the code that claims
// it (which imports the store). The spawn sync hook registers the handler.

let handler: (() => void) | null = null;

export const setNeedClaimHandler = (fn: (() => void) | null): void => {
	handler = fn;
};

export const signalNeedClaim = (): void => handler?.();
