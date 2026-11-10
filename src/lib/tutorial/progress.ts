import { emptyProgress, isLessonId, isPathStepId, type TutorialProgress } from '@/lib/tutorial/engine';
import { INTRO_ID } from '@/catalog/tutorial';

const ids = (value: unknown, allowed: (id: string) => boolean): string[] => {
	if (!Array.isArray(value)) return [];
	const out: string[] = [];
	for (const id of value) if (typeof id === 'string' && id.length <= 40 && allowed(id) && !out.includes(id)) out.push(id);
	return out;
};

/**
 * Reads the stored `stats.tutorial` (or an answer from the server) back: a missing field, null or anything malformed reads as nothing done, ids that are
 * not in the catalog any more (a step removed in a later release) are dropped, nothing is trusted to be the right shape.
 *
 * @category Progression/Guided tutorial
 * @order 3
 */
export const readProgress = (raw: unknown): TutorialProgress => {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyProgress();
	const r = raw as Record<string, unknown>;
	return {
		done: ids(r.done, (id) => id === INTRO_ID || isPathStepId(id)),
		lessons: ids(r.lessons, isLessonId),
		skipped: r.skipped === true,
	};
};
