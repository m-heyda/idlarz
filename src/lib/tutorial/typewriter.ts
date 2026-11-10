/** Characters per second the bubble types at (the owner's 25 to 35) */
export const TYPE_CPS = 30;

/** How often the bubble looks at the clock while typing (ms): about one letter per tick */
export const TYPE_TICK_MS = 30;

/** How many characters are showing `elapsedMs` after the text started, at `cps`: never more than the text, never negative. */
export const visibleLength = (total: number, elapsedMs: number, cps: number = TYPE_CPS): number =>
	Math.max(0, Math.min(total, Math.floor((elapsedMs * cps) / 1000)));

/** The text split into characters the way a person counts them (an emoji or an accented letter is one). */
export const glyphs = (text: string): string[] => Array.from(text);

/**
 * Whether Brother Alder's mouth is open for the character just typed (`typed` characters showing): it opens and closes every two letters while he talks, rests on a space or a full stop,
 * and is shut once the text is complete.
 */
export const mouthOpen = (text: string, typed: number): boolean => {
	const chars = glyphs(text);
	if (typed <= 0 || typed >= chars.length) return false;
	if (/[\s.,;:!?]/.test(chars[typed - 1])) return false;
	return Math.floor(typed / 2) % 2 === 1;
};
