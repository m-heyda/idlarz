import { CLICK_LIMIT } from '@/config/economy';
import type { ClickInput } from '@/types/game';

/**
 * Click limiter made of two token buckets (a paid click needs a token from both).
 *
 * - burst: `capacity` tokens refilling at `refillPerSec` -> a fast human can burst `capacity` clicks and sustain
 *   `refillPerSec` clicks/s; anything faster earns nothing.
 * - stamina: a large, slowly refilling bucket -> caps the long-run average, so a 24 h auto-clicker is not much better
 *   than a very dedicated person, while short sessions are never affected.
 * - Every handler of the same DOM event shares one `eventId`, so the gold click and the tile tap of one physical
 *   click cost a single token and always get the same verdict.
 * - Synthetic (script-dispatched) clicks are never granted when `requireTrusted` is set.
 */
export interface ClickLimiter {
	take: (input: ClickInput) => boolean;
	reset: () => void;
}

export interface ClickLimitConfig {
	capacity: number;
	refillPerSec: number;
	staminaCapacity: number;
	staminaRefillPerSec: number;
	requireTrusted: boolean;
}

/**
 * Creates the click rate limiter: two token buckets (burst and stamina, see {@link CLICK_LIMIT}); a click is paid only if it can take a token from both. The click's event id makes one physical click cost one token.
 *
 *
 * @category Economy/Clicks
 * @order 4
 */
export const createClickLimiter = (config: ClickLimitConfig = CLICK_LIMIT): ClickLimiter => {
	let burst = config.capacity;
	let stamina = config.staminaCapacity;
	let last: number | null = null;
	let lastEventId: number | null = null;
	let lastVerdict = false;

	return {
		take: ({ eventId, now, trusted }) => {
			if (eventId === lastEventId) return lastVerdict;

			if (last !== null) {
				const dt = Math.max(0, now - last) / 1000;
				burst = Math.min(config.capacity, burst + dt * config.refillPerSec);
				stamina = Math.min(config.staminaCapacity, stamina + dt * config.staminaRefillPerSec);
			}
			last = last === null ? now : Math.max(last, now);

			let verdict = false;
			if ((!config.requireTrusted || trusted) && burst >= 1 && stamina >= 1) {
				burst -= 1;
				stamina -= 1;
				verdict = true;
			}
			lastEventId = eventId;
			lastVerdict = verdict;
			return verdict;
		},
		reset: () => {
			burst = config.capacity;
			stamina = config.staminaCapacity;
			last = null;
			lastEventId = null;
			lastVerdict = false;
		},
	};
};
