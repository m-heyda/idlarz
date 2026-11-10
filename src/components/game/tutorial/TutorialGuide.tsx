import React, { useEffect, useMemo, useState } from 'react';
import { INTRO, INTRO_ID, TUTORIAL_PATH } from '@/catalog/tutorial';
import { lessonBeat, newlyDone, nextBeat, type Beat } from '@/lib/tutorial/engine';
import { factsFromGame, withSeen } from '@/lib/tutorial/facts';
import { guideVisible } from '@/lib/tutorial/live';
import { buildNumbers } from '@/lib/tutorial/numbers';
import { useGameStore } from '@/stores/gameStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTutorialStore } from '@/stores/tutorialStore';
import { useWindowStore } from '@/stores/windowStore';
import FocusLayer, { useTargetRects } from './FocusLayer';
import GuideBubble from './GuideBubble';

const EVALUATE_MS = 500;

const sameBeat = (a: Beat | null, b: Beat | null): boolean =>
	a === b || (!!a && !!b && a.id === b.id && a.target === b.target && a.focus === b.focus && (a.kind !== 'intro' || (b.kind === 'intro' && a.page === b.page)));

const useViewport = () => {
	const [view, setView] = useState({ width: 0, height: 0 });
	useEffect(() => {
		const update = () => setView({ width: window.innerWidth, height: window.innerHeight });
		update();
		window.addEventListener('resize', update);
		return () => window.removeEventListener('resize', update);
	}, []);
	return view;
};

/**
 * Brother Alder, the tutorial guide. Mounted once in the game (GameApp). It counts the few events the state does not keep (map clicks, chests opened, fights won),
 * evaluates the triggers twice a second (`lib/tutorial/engine.ts`), records finished steps and fired lessons on the account (the server may pay a starter bundle),
 * and draws the bubble and the focus layer for the beat that is on show. Nothing is drawn while the guide is dark (`guideLive`), switched off in Settings, or before the
 * account's progress has arrived; a target that is not on screen shows the bubble alone and never blocks the game.
 *
 * @category Progression/Guided tutorial
 * @order 5
 */
const TutorialGuide: React.FC<{ ready: boolean }> = ({ ready }) => {
	const live = guideVisible();
	const enabled = useSettingsStore((s) => s.guideEnabled);
	const introPage = useTutorialStore((s) => s.introPage);
	const [beat, setBeat] = useState<Beat | null>(null);
	const view = useViewport();

	useEffect(() => {
		if (!live || !ready) return;
		void useTutorialStore.getState().load();
	}, [live, ready]);

	// events the state does not keep
	useEffect(() => {
		if (!live || !ready) return;
		const bump = (change: (c: ReturnType<typeof useTutorialStore.getState>['counters']) => void) => {
			const t = useTutorialStore.getState();
			const counters = { ...t.counters };
			change(counters);
			t.setCounters(counters);
		};
		const onClick = (e: MouseEvent) => {
			if (e.isTrusted && e.target instanceof Element && e.target.closest('[data-click-area]')) bump((c) => void (c.clicks += 1));
		};
		window.addEventListener('click', onClick, true);
		let lastChest = useGameStore.getState().lastChestLoot;
		let fighting = !!useGameStore.getState().combat.fight;
		let monstersThen = useGameStore.getState().monsters.length;
		const unGame = useGameStore.subscribe((g) => {
			if (g.lastChestLoot && g.lastChestLoot !== lastChest) bump((c) => void (c.chestsOpened += 1));
			lastChest = g.lastChestLoot;
			const now = !!g.combat.fight;
			// a fight that ended while a monster left the map is a win
			if (fighting && !now && g.monsters.length < monstersThen) bump((c) => void (c.fightsWon += 1));
			if (!fighting && now) monstersThen = g.monsters.length;
			fighting = now;
		});
		const unWindows = useWindowStore.subscribe((w) => {
			if (w.order.includes('merchant') && !useTutorialStore.getState().counters.merchantOpened) bump((c) => void (c.merchantOpened = true));
		});
		return () => {
			window.removeEventListener('click', onClick, true);
			unGame();
			unWindows();
		};
	}, [live, ready]);

	// the triggers
	useEffect(() => {
		if (!live || !ready) return;
		const evaluate = () => {
			const game = useGameStore.getState();
			const t = useTutorialStore.getState();
			if (!game.isHydrated || !t.loaded) return;
			const seen = withSeen(t.counters.seen, game);
			if (seen !== t.counters.seen) t.setCounters({ ...t.counters, seen });
			const facts = factsFromGame(game, { ...t.counters, seen }, useWindowStore.getState().order);
			// what the player already did (also on their own) is recorded, whether or not the guide is on: the starter bundles are theirs
			for (const step of newlyDone(facts, t.progress)) useTutorialStore.getState().completeStep(step.id);
			if (!useSettingsStore.getState().guideEnabled) {
				setBeat(null);
				return;
			}
			const current = useTutorialStore.getState();
			const next: Beat | null = current.shownLesson ? lessonBeat(current.shownLesson, facts) : nextBeat(facts, current.progress, current.introPage);
			if (next?.kind === 'lesson' && !current.shownLesson) current.showLesson(next.id);
			setBeat((prev) => (sameBeat(prev, next) ? prev : next));
		};
		evaluate();
		const timer = setInterval(evaluate, EVALUATE_MS);
		return () => clearInterval(timer);
	}, [live, ready, introPage, enabled]);

	const rects = useTargetRects(beat?.target);
	const numbers = useMemo(buildNumbers, []);

	if (!live || !enabled || !beat) return null;

	const store = useTutorialStore.getState();
	const onSkip = () => {
		store.skip();
		setBeat(null);
	};
	let text: string;
	let progress: string | undefined;
	let actionLabel: string | undefined;
	let onAction: (() => void) | undefined;
	if (beat.kind === 'intro') {
		text = INTRO[beat.page].text(numbers);
		progress = `${beat.page + 1} / ${beat.pages}`;
		const last = beat.page >= beat.pages - 1;
		actionLabel = last ? 'Let us go' : 'Next';
		onAction = () => (last ? store.completeStep(INTRO_ID) : store.nextIntroPage());
	} else if (beat.kind === 'step') {
		text = beat.step.text(numbers);
		progress = `Step ${TUTORIAL_PATH.findIndex((s) => s.id === beat.step.id) + 1} of ${TUTORIAL_PATH.length}`;
	} else {
		text = beat.lesson.text(numbers);
		actionLabel = 'Got it';
		onAction = () => store.closeLesson();
	}

	return (
		<>
			<FocusLayer holes={rects} mode={beat.focus} view={view} intro={beat.kind === 'intro'} />
			<GuideBubble
				text={text}
				progress={progress}
				actionLabel={actionLabel}
				onAction={onAction}
				onSkip={onSkip}
				skipLabel={beat.kind === 'lesson' ? 'Skip' : 'Skip tutorial'}
			/>
		</>
	);
};

export default TutorialGuide;
