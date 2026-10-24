import { CLICK_LIMIT } from '@/config/gameConfig';
import type { ClickInput } from '@/types/game';

/**
 * Fight hits are not rate limited (speed is the skill), but a hit must still be a real click: synthetic
 * (script-dispatched) events never count, and one DOM event counts once however many handlers see it.
 */
export interface HitGuard {
	take: (input: ClickInput) => boolean;
	reset: () => void;
}

export const createHitGuard = (requireTrusted: boolean = CLICK_LIMIT.requireTrusted): HitGuard => {
	let lastEventId: number | null = null;
	return {
		take: ({ eventId, trusted }) => {
			if (requireTrusted && !trusted) return false;
			if (eventId === lastEventId) return false;
			lastEventId = eventId;
			return true;
		},
		reset: () => {
			lastEventId = null;
		},
	};
};
