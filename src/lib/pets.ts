// The pet on the map: where it steps and what it says. Pure (the caller passes the random source), so it is tested without a browser; the sprite only draws the result.

/** Where the pet stands, in steps from the middle of the castle tile (a step is `PET_STEP_PX`), and which way it last walked. */
export interface WanderPos {
	x: number;
	y: number;
	/** The way it last walked sideways (it keeps the old way while it steps straight up or down) */
	facing: 'left' | 'right';
}

/** One step is this many pixels (a map tile is 48 px). */
export const PET_STEP_PX = 16;
/** The pet stays within this many steps of the castle's middle: the castle tile and its direct neighbours. */
export const PET_RANGE = 3;

/** The pet stands on the castle's middle at first. */
export const startWander = (): WanderPos => ({ x: 0, y: 0, facing: 'right' });

/** Seconds between two steps: a pause of 1.5 to 4 s. */
export const nextStepDelayMs = (rng: () => number): number => 1500 + Math.floor(rng() * 2500);

/**
 * The pet's next step: one step sideways, up, down or diagonally, never leaving `PET_RANGE` (3) steps from the castle's middle (a step that would leave it is
 * turned back inwards, so it keeps moving near the edge). Cosmetic only: nothing in the game reads it.
 *
 * @category Progression/Pets
 * @order 2
 */
export const nextWanderStep = (pos: WanderPos, rng: () => number): WanderPos => {
	const pick = () => Math.floor(rng() * 3) - 1;
	let dx = pick();
	let dy = pick();
	if (dx === 0 && dy === 0) dx = rng() < 0.5 ? -1 : 1;
	if (Math.abs(pos.x + dx) > PET_RANGE) dx = -dx;
	if (Math.abs(pos.y + dy) > PET_RANGE) dy = -dy;
	return { x: pos.x + dx, y: pos.y + dy, facing: dx < 0 ? 'left' : dx > 0 ? 'right' : pos.facing };
};

/** The first bubble comes a minute after the map is up; then one every 3 to 6 minutes. */
export const FIRST_SPEECH_MS = 60_000;
export const nextSpeechDelayMs = (rng: () => number): number => 180_000 + Math.floor(rng() * 180_000);
/** How long a bubble stays up. */
export const SPEECH_SHOW_MS = 4_500;

/**
 * Which phrase the pet says next: a random one that is not the last one said (`lastIndex`, or -1 for none). -1 when it has nothing to say.
 *
 * @category Progression/Pets
 * @order 3
 */
export const pickPetPhrase = (phrases: readonly string[], lastIndex: number, rng: () => number): number => {
	if (phrases.length === 0) return -1;
	if (phrases.length === 1) return 0;
	if (lastIndex < 0 || lastIndex >= phrases.length) return Math.min(phrases.length - 1, Math.floor(rng() * phrases.length));
	const index = Math.min(phrases.length - 2, Math.floor(rng() * (phrases.length - 1)));
	// skip over the last one said, so every other phrase is equally likely
	return index >= lastIndex ? index + 1 : index;
};
