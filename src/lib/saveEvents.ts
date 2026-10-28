// Tiny event bus for moments worth saving right away (a purchase, a castle upgrade, a rebirth, a level up).
// The store emits after a change went through, the cloud sync listens. No window events: it also runs under node (tests).

export type SaveEventReason =
	| 'buyTile'
	| 'buildOnTile'
	| 'upgradeCastle'
	| 'castleUpgraded'
	| 'rebirth'
	| 'buyEmberUpgrade'
	| 'purchaseAnimal'
	| 'buyFarmUpgrade'
	| 'addStatPoint'
	| 'equipItem'
	| 'unequipItem'
	| 'buyMerchantUpgrade'
	| 'buyOffer'
	| 'refreshMerchantStock'
	| 'buyClickUpgrade'
	| 'levelUp'
	| 'offlineClaimed';

type Listener = (reason: SaveEventReason) => void;

const listeners = new Set<Listener>();

/** Returns the function that removes the listener again. */
export const onSaveEvent = (listener: Listener): (() => void) => {
	listeners.add(listener);
	return () => void listeners.delete(listener);
};

export const emitSaveEvent = (reason: SaveEventReason): void => {
	listeners.forEach((listener) => listener(reason));
};

/** Actions that count as an event when they succeed (return something truthy). Frequent small ones (clicks, sells, hits, bag moves) are left out on purpose. */
const SAVE_EVENT_ACTIONS = [
	'buyTile',
	'buildOnTile',
	'upgradeCastle',
	'rebirth',
	'buyEmberUpgrade',
	'purchaseAnimal',
	'buyFarmUpgrade',
	'addStatPoint',
	'equipItem',
	'unequipItem',
	'buyMerchantUpgrade',
	'buyClickUpgrade',
] as const satisfies readonly SaveEventReason[];

/** Wraps the listed actions of a store slice so a successful call emits its event; everything else is passed through untouched. */
export const withSaveEvents = <T extends object>(slice: T): T => {
	const wrapped = { ...slice } as Record<string, unknown>;
	for (const name of SAVE_EVENT_ACTIONS) {
		const original = wrapped[name];
		if (typeof original !== 'function') continue;
		wrapped[name] = (...args: unknown[]) => {
			const result = (original as (...a: unknown[]) => unknown)(...args);
			if (result) emitSaveEvent(name);
			return result;
		};
	}
	return wrapped as T;
};
