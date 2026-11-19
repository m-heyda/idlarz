// The browser side of three secret deeds that are not one click: the Konami code, playing in the small hours and opening every dock window in one visit. Pure functions here (tested in tests/ui/secretTriggers.test.ts);
// `hooks/useSecretDeeds.ts` wires them to the keyboard, the clock and the window store and reports each through `reportCuriosity`.

/** The Konami code as `KeyboardEvent.key` values (letters compared in lower case). */
export const KONAMI: readonly string[] = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

/**
 * The next progress through the Konami code after one key press: the number of keys matched so far. The right key advances, a wrong key starts over (and counts as a new first key when it is the first Up).
 * A full code returns `KONAMI.length`; the caller reports it and resets to 0.
 */
export const konamiStep = (progress: number, key: string): number => {
	const k = key.length === 1 ? key.toLowerCase() : key;
	if (k === KONAMI[progress]) return progress + 1;
	return k === KONAMI[0] ? 1 : 0;
};

/** Whether the local clock is in the 3 AM hour (03:00 to 03:59): the "Night owl" deed. */
export const isNightOwlHour = (date: Date): boolean => date.getHours() === 3;

/** The dock windows "Dock shuffle" asks for, in dock order. Deeds only counts while its button is in the dock (the tutorial build flag hides it before the release). */
export const dockWindows = (deedsInDock: boolean): readonly string[] => [
	'equipment',
	'merchant',
	'farm',
	'bestiary',
	'gems',
	...(deedsInDock ? ['achievements'] : []),
	'rankings',
	'rebirth',
	'boss',
];

/** Whether every window the deed asks for has been opened at some point in this visit. */
export const dockComplete = (opened: ReadonlySet<string>, required: readonly string[]): boolean => required.every((id) => opened.has(id));
