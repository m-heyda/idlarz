import { INTRO, INTRO_ID, TUTORIAL_LESSONS, TUTORIAL_PATH, type FocusMode, type Lesson, type PathStep, type TutorialFacts } from '@/catalog/tutorial';

// The tutorial's brain, all pure: what the player has done (`TutorialProgress`, stored per account by the server) and what the game looks like now
// (`TutorialFacts`) decide which beat Brother Alder speaks. No React, no store, no clock: tests run it without a browser.

/** Per account, stored in the ledger's `stats.tutorial`. A step or lesson id is in the list once it is done; ids that are not in the catalog any more are ignored. */
export interface TutorialProgress {
	/** Intro and starter path steps that are done */
	done: string[];
	/** Lessons that have fired (the journal lists these) */
	lessons: string[];
	/** The player ended the starter path with Skip: no intro, no further path steps (lessons still come) */
	skipped: boolean;
}

export const emptyProgress = (): TutorialProgress => ({ done: [], lessons: [], skipped: false });

export const isEmptyProgress = (p: TutorialProgress): boolean => p.done.length === 0 && p.lessons.length === 0 && !p.skipped;

/** What is on show: the intro (page `page`), a step of the path, or a lesson. */
export type Beat =
	| { kind: 'intro'; id: typeof INTRO_ID; page: number; pages: number; focus: 'strict'; target: undefined }
	| { kind: 'step'; id: string; step: PathStep; focus: FocusMode; target: string | undefined }
	| { kind: 'lesson'; id: string; lesson: Lesson; focus: FocusMode; target: string | undefined };

/** The path steps whose condition holds now but are not recorded yet (the player got there on their own, or just did the task). */
export const newlyDone = (facts: TutorialFacts, progress: TutorialProgress): PathStep[] =>
	progress.skipped ? [] : TUTORIAL_PATH.filter((step) => !progress.done.includes(step.id) && step.done(facts));

/** The lessons that fire now and are not in the journal yet. */
export const newlyFired = (facts: TutorialFacts, progress: TutorialProgress): Lesson[] =>
	TUTORIAL_LESSONS.filter((l) => !progress.lessons.includes(l.id) && l.fires(facts));

const targetOf = (target: PathStep['target'], facts: TutorialFacts): string | undefined => (typeof target === 'function' ? target(facts) : target);

/**
 * The beat to show: the intro on a fresh chapter, then the first step of the path that is ready and not done (a step that cannot be done yet, like the
 * castle upgrade you cannot afford, waits and the next ready one is shown), then the first lesson that has fired and was not read. Nothing when the
 * guide is switched off. A skipped player gets lessons only.
 */
export const nextBeat = (facts: TutorialFacts, progress: TutorialProgress, introPage = 0): Beat | null => {
	if (!progress.skipped && !progress.done.includes(INTRO_ID)) {
		return { kind: 'intro', id: INTRO_ID, page: Math.min(introPage, INTRO.length - 1), pages: INTRO.length, focus: 'strict', target: undefined };
	}
	if (!progress.skipped) {
		const step = TUTORIAL_PATH.find((s) => !progress.done.includes(s.id) && !s.done(facts) && s.ready(facts));
		if (step) return { kind: 'step', id: step.id, step, focus: step.focus, target: targetOf(step.target, facts) };
	}
	const lesson = TUTORIAL_LESSONS.find((l) => !progress.lessons.includes(l.id) && l.fires(facts));
	return lesson ? { kind: 'lesson', id: lesson.id, lesson, focus: lesson.focus, target: targetOf(lesson.target, facts) } : null;
};

/** Two views of the same account's progress put together: what either has recorded counts (a server answer must not erase a move the browser has made since it was asked). */
export const mergeProgress = (a: TutorialProgress, b: TutorialProgress): TutorialProgress => ({
	done: [...a.done, ...b.done.filter((id) => !a.done.includes(id))],
	lessons: [...a.lessons, ...b.lessons.filter((id) => !a.lessons.includes(id))],
	skipped: a.skipped || b.skipped,
});

/** Progress after the player finished `id` (intro, a step): idempotent. */
export const withDone = (p: TutorialProgress, id: string): TutorialProgress => (p.done.includes(id) ? p : { ...p, done: [...p.done, id] });

/** Progress after a lesson fired (the journal keeps it): idempotent. */
export const withLesson = (p: TutorialProgress, id: string): TutorialProgress => (p.lessons.includes(id) ? p : { ...p, lessons: [...p.lessons, id] });

/** Progress after Skip: the starter path ends. */
export const withSkip = (p: TutorialProgress): TutorialProgress => (p.skipped ? p : { ...p, skipped: true });

/** The ids a step or lesson may carry (the server refuses any other). */
export const isPathStepId = (id: string): boolean => TUTORIAL_PATH.some((s) => s.id === id);
export const isLessonId = (id: string): boolean => TUTORIAL_LESSONS.some((l) => l.id === id);

/** The journal: every lesson with whether it has fired. Locked ones are shown as '???' by the dialog. */
export const journalEntries = (progress: TutorialProgress): { lesson: Lesson; seen: boolean }[] =>
	TUTORIAL_LESSONS.map((lesson) => ({ lesson, seen: progress.lessons.includes(lesson.id) }));

/** The beat of a lesson that is already in the journal but still on show (the player has not closed its bubble). Null for an id that is not a lesson. */
export const lessonBeat = (id: string, facts: TutorialFacts): Beat | null => {
	const lesson = TUTORIAL_LESSONS.find((l) => l.id === id);
	return lesson ? { kind: 'lesson', id, lesson, focus: lesson.focus, target: targetOf(lesson.target, facts) } : null;
};
