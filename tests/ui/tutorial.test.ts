import test from 'node:test';
import assert from 'node:assert/strict';
import { INTRO_ID, TUTORIAL_LESSONS, TUTORIAL_PATH, type TutorialFacts } from '../../src/catalog/tutorial';
import { TYPE_CPS, glyphs, mouthOpen, visibleLength } from '../../src/lib/tutorial/typewriter';
import { guideLiveFor, guideVisibleFor } from '../../src/lib/tutorial/live';
import { emptyProgress, journalEntries, mergeProgress, lessonBeat, newlyDone, nextBeat, withDone, withLesson, withSkip } from '../../src/lib/tutorial/engine';
import { clipPathFor, holesFor, padRect, pointInHoles, sameRects, selectorFor, CUTOUT_PAD, MAX_HOLES } from '../../src/lib/tutorial/geometry';
import { buildNumbers, spoken } from '../../src/lib/tutorial/numbers';
import { emptyCounters, factsFromGame, pointsSpentOf, withSeen } from '../../src/lib/tutorial/facts';
import { api } from '../helpers';

const base = (over: Partial<TutorialFacts> = {}): TutorialFacts => ({
	clicks: 0,
	tilesBought: 0,
	animals: 0,
	animalAffordable: false,
	castleLevel: 1,
	castleUpgrading: false,
	castleAffordable: false,
	chestsOpened: 0,
	chestOnMap: false,
	monsterOnMap: false,
	fightsWon: 0,
	merchantOpened: false,
	pointsSpent: 0,
	unspentPoints: 0,
	seen: {},
	rebirths: 0,
	rebirthReady: false,
	open: [],
	...over,
});
const afterIntro = () => withDone(emptyProgress(), INTRO_ID);

test('a fresh chapter starts with the intro, three pages, strict', () => {
	const beat = nextBeat(base(), emptyProgress(), 1);
	assert.equal(beat?.kind, 'intro');
	assert.equal(beat?.kind === 'intro' && beat.page, 1);
	assert.equal(beat?.kind === 'intro' && beat.pages, 3);
	assert.equal(beat?.focus, 'strict');
});

test('the starter path runs in order, strict first and soft later', () => {
	let progress = afterIntro();
	assert.equal(nextBeat(base(), progress)?.id, 'click-gold');
	assert.equal(nextBeat(base(), progress)?.focus, 'strict');
	progress = withDone(progress, 'click-gold');
	assert.equal(nextBeat(base({ clicks: 3 }), progress)?.id, 'buy-tile');
	progress = withDone(progress, 'buy-tile');
	// the farm step waits until the first animal can be paid; the next ready step is shown meanwhile
	const waiting = nextBeat(base({ tilesBought: 1, chestOnMap: true }), progress);
	assert.equal(waiting?.id, 'open-chest');
	assert.equal(waiting?.focus, 'soft');
	assert.equal(nextBeat(base({ tilesBought: 1, animalAffordable: true, chestOnMap: true }), progress)?.id, 'buy-animal');
});

test('a step the player already did on their own is recorded, never shown', () => {
	const facts = base({ clicks: 5, tilesBought: 2, merchantOpened: true });
	const done = newlyDone(facts, afterIntro()).map((s) => s.id);
	assert.deepEqual(done, ['click-gold', 'buy-tile', 'merchant']);
	assert.equal(nextBeat(facts, [...done].reduce(withDone, afterIntro()))?.kind, undefined, 'nothing left that is ready');
});

test('targets follow the window state: the tab first, then the thing inside the window', () => {
	const progress = ['click-gold', 'buy-tile'].reduce(withDone, afterIntro());
	const food = base({ tilesBought: 1, animalAffordable: true });
	assert.equal(nextBeat(food, progress)?.target, 'tab-farm');
	assert.equal(nextBeat({ ...food, open: ['farm'] }, progress)?.target, 'farm-animal');
});

test('lessons fire the first time, in any order, after the path; a read lesson never comes back', () => {
	const progress = TUTORIAL_PATH.reduce((p, s) => withDone(p, s.id), afterIntro());
	assert.equal(nextBeat(base(), progress), null);
	const facts = base({ seen: { stone: true, wood: true } });
	const first = nextBeat(facts, progress);
	assert.equal(first?.kind, 'lesson');
	assert.equal(first?.id, 'res-wood', 'catalog order decides between two that fired together');
	const next = nextBeat(facts, withLesson(progress, 'res-wood'));
	assert.equal(next?.id, 'res-stone');
	assert.equal(next?.focus, 'soft');
	assert.equal(next?.target, 'res-stone');
	assert.equal(nextBeat(facts, ['res-wood', 'res-stone'].reduce(withLesson, progress)), null);
});

test('the path comes before lessons; skip ends it', () => {
	const facts = base({ seen: { wood: true } });
	assert.equal(nextBeat(facts, afterIntro())?.id, 'click-gold', 'the path comes before lessons');
	const skipped = withSkip(emptyProgress());
	assert.equal(nextBeat(facts, skipped)?.id, 'res-wood', 'skip ends the path and the intro; lessons still come');
	assert.deepEqual(newlyDone(base({ clicks: 9 }), skipped), []);
});

test('milestone lessons: income, gear, rebirth and auto-battle', () => {
	const fires = (id: string, facts: TutorialFacts) => TUTORIAL_LESSONS.find((l) => l.id === id)!.fires(facts);
	assert.equal(fires('income-offline', base({ tilesBought: 2 })), false);
	assert.equal(fires('income-offline', base({ tilesBought: 3 })), true);
	assert.equal(fires('gear-bag-potions', base({ fightsWon: 1 })), true);
	assert.equal(fires('rebirth-embers', base()), false);
	assert.equal(fires('rebirth-embers', base({ rebirthReady: true })), true);
	assert.equal(fires('auto-battle', base({ rebirths: 1 })), true);
});

test('every resource lesson exists for the eight new resources', () => {
	const ids = TUTORIAL_LESSONS.map((l) => l.id);
	for (const key of ['wood', 'stone', 'coal', 'food', 'hide', 'meat', 'eggs', 'milk']) assert.ok(ids.includes(`res-${key}`), key);
	assert.equal(new Set([INTRO_ID, ...TUTORIAL_PATH.map((s) => s.id), ...ids]).size, 1 + TUTORIAL_PATH.length + ids.length, 'ids are unique');
});

test("the path is the owner's eight steps, in order, with the three bundles", () => {
	assert.deepEqual(
		TUTORIAL_PATH.map((s) => s.id),
		['click-gold', 'buy-tile', 'buy-animal', 'castle-upgrade', 'open-chest', 'first-fight', 'merchant', 'stat-point'],
	);
	assert.deepEqual(
		TUTORIAL_PATH.filter((s) => s.reward).map((s) => s.id),
		['buy-tile', 'castle-upgrade', 'stat-point'],
	);
});

test('texts quote the live config and stay short', () => {
	const n = buildNumbers();
	assert.ok(n.tilePrice.length > 0 && n.animalFood.length > 0 && n.castleSeconds.length > 0);
	const all = [...TUTORIAL_PATH, ...TUTORIAL_LESSONS].map((b) => b.text(n));
	for (const text of all) {
		assert.ok(text.length < 260, text);
		assert.ok(!/undefined|NaN|\[object/.test(text), text);
		assert.ok(!/!{2}|haha|lol/i.test(text), 'no jokes');
	}
	assert.ok(TUTORIAL_PATH[3].text(n).includes(n.castleGold));
	assert.equal(spoken(1800), '30 minutes');
	assert.equal(spoken(7200), '2 hours');
	assert.equal(spoken(3600), '1 hour');
	assert.equal(spoken(129600), '1.5 days');
	assert.equal(n.castleSeconds, '30 minutes');
	assert.equal(n.castleGold, '70,000');
});

test('journal: fired lessons are readable, the others stay locked', () => {
	const entries = journalEntries(withLesson(emptyProgress(), 'res-coal'));
	assert.equal(entries.find((e) => e.lesson.id === 'res-coal')?.seen, true);
	assert.equal(entries.filter((e) => e.seen).length, 1);
	assert.equal(lessonBeat('res-coal', base())?.kind, 'lesson');
	assert.equal(lessonBeat('nope', base()), null);
});

// ---- the cut-out geometry

const view = { width: 1000, height: 600 };

test('holes are padded, clipped to the screen and empty ones dropped', () => {
	assert.deepEqual(padRect({ left: 10, top: 10, width: 20, height: 20 }), {
		left: 10 - CUTOUT_PAD,
		top: 10 - CUTOUT_PAD,
		width: 20 + 2 * CUTOUT_PAD,
		height: 20 + 2 * CUTOUT_PAD,
	});
	const holes = holesFor(
		[
			{ left: 100, top: 100, width: 50, height: 40 },
			{ left: -200, top: 0, width: 100, height: 100 }, // off screen
			{ left: 990, top: 590, width: 100, height: 100 }, // half out
			{ left: 5, top: 5, width: 0, height: 10 }, // no area
		],
		view,
	);
	assert.equal(holes.length, MAX_HOLES);
	assert.deepEqual(holes[0], { left: 94, top: 94, width: 62, height: 52 });
	const edge = holesFor([{ left: 990, top: 590, width: 100, height: 100 }], view)[0];
	assert.equal(edge.left + edge.width, 1000, 'clipped at the right edge');
	assert.equal(edge.top + edge.height, 600);
	assert.deepEqual(holesFor([], view), [], 'a target that is not on screen yields no hole (the bubble stays alone)');
});

test('only the element nearest the middle of the screen is lit', () => {
	const many = Array.from({ length: 80 }, (_, i) => ({ left: (i * 12) % 900, top: 20, width: 10, height: 10 }));
	assert.equal(holesFor(many, view).length, MAX_HOLES);
	const [near] = holesFor(
		[
			{ left: 20, top: 20, width: 10, height: 10 },
			{ left: 490, top: 290, width: 10, height: 10 },
		],
		view,
	);
	assert.equal(near.left, 484, 'the one at the centre wins');
});

test('the clip path is the screen minus the holes (even-odd), and strict lets clicks through the holes only', () => {
	const holes = holesFor([{ left: 100, top: 100, width: 50, height: 40 }], view);
	const path = clipPathFor(holes, view);
	assert.equal(path, "path(evenodd, 'M0 0H1000V600H0ZM94 94h62v52h-62Z')");
	assert.equal(clipPathFor([], view), "path(evenodd, 'M0 0H1000V600H0Z')");
	assert.equal(pointInHoles(120, 120, holes), true);
	assert.equal(pointInHoles(10, 10, holes), false);
	assert.equal(pointInHoles(156, 146, holes), false, 'the far edge is outside');
});

test('measuring: unchanged rectangles are the same, a moved one is not; selectors are safe', () => {
	const a = [{ left: 1.2, top: 2, width: 3, height: 4 }];
	assert.equal(sameRects(a, [{ left: 1.4, top: 2, width: 3, height: 4 }]), true);
	assert.equal(sameRects(a, [{ left: 5, top: 2, width: 3, height: 4 }]), false);
	assert.equal(sameRects(a, []), false);
	assert.equal(selectorFor('tile-buy'), '[data-tutorial="tile-buy"]');
	assert.equal(selectorFor('x"] , body ['), '[data-tutorial="xbody"]');
});

// ---- facts from the game

test("facts are read from the game state and the guide's own counters", () => {
	api().resetGame();
	const s = api();
	const facts = factsFromGame(s, emptyCounters(), []);
	assert.equal(facts.tilesBought, 0);
	assert.equal(facts.animals, 0);
	assert.equal(facts.castleLevel, 1);
	assert.equal(facts.castleUpgrading, false);
	assert.equal(facts.rebirthReady, false);
	assert.equal(facts.pointsSpent, 0);
	assert.equal(pointsSpentOf({ ...s.characterStats, strength: s.characterStats.strength + 2 }), 2);
	const counters = { ...emptyCounters(), clicks: 4, merchantOpened: true };
	assert.equal(factsFromGame(s, counters, ['farm']).clicks, 4);
	assert.deepEqual(factsFromGame(s, counters, ['farm']).open, ['farm']);
});

test('resources count as seen once above zero and stay seen', () => {
	api().resetGame();
	const s = api();
	const seen = withSeen({}, s);
	assert.equal(seen.gold, true, 'gold is in the stores at the start');
	assert.equal(withSeen(seen, s), seen, 'nothing new: the same object, no re-render');
	const more = withSeen(seen, { resources: { ...s.resources, coal: 5 }, resourceRates: s.resourceRates });
	assert.equal(more.coal, true);
	assert.equal(withSeen(more, s).coal, true, 'sticky');
});

// ---- a brand-new game

test('a brand-new game gets the intro first, then the first strict step on the map', () => {
	api().resetGame();
	const facts = factsFromGame(api(), emptyCounters(), []);
	const first = nextBeat(facts, emptyProgress());
	assert.equal(first?.kind, 'intro');
	assert.equal(first?.focus, 'strict');
	const afterIntro = nextBeat(facts, withDone(emptyProgress(), INTRO_ID));
	assert.equal(afterIntro?.id, 'click-gold');
	assert.equal(afterIntro?.target, 'map');
	assert.equal(afterIntro?.focus, 'strict');
	assert.deepEqual(newlyDone(facts, emptyProgress()), [], 'nothing counts as done on a fresh game');
});

test('the intro does not wait for a cloud save: a brand-new account answers no_save and the guide still starts', async () => {
	const { useTutorialStore } = await import('../../src/stores/tutorialStore');
	const real = globalThis.fetch;
	globalThis.fetch = (async () => new Response('{}', { status: 404 })) as typeof fetch;
	try {
		useTutorialStore.getState().reset();
		await useTutorialStore.getState().load();
		assert.equal(useTutorialStore.getState().loaded, true);
		assert.deepEqual(useTutorialStore.getState().progress, emptyProgress());
	} finally {
		globalThis.fetch = real;
		useTutorialStore.getState().reset();
	}
});

test('a server answer never erases what the browser has recorded since it asked', () => {
	const merged = mergeProgress({ done: ['intro', 'click-gold'], lessons: ['res-wood'], skipped: false }, { done: ['intro'], lessons: [], skipped: true });
	assert.deepEqual(merged, { done: ['intro', 'click-gold'], lessons: ['res-wood'], skipped: true });
});

// ---- where the guide is shown

test('the guide is shown on localhost and previews, and on production only after the flip', () => {
	const prod = { epoch: 1, nodeEnv: 'production', vercelEnv: 'production' };
	assert.equal(guideVisibleFor(prod), false, 'the production site before the flip');
	assert.equal(guideVisibleFor({ epoch: 1, nodeEnv: 'production', vercelEnv: '' }), false, 'a self-hosted production build');
	assert.equal(guideVisibleFor({ epoch: 1, nodeEnv: 'development' }), true, 'next dev');
	assert.equal(guideVisibleFor({ epoch: 1, nodeEnv: 'production', vercelEnv: 'preview' }), true, 'a Vercel preview');
	assert.equal(guideVisibleFor({ ...prod, epoch: 2 }), true, 'after the flip');
	assert.equal(guideVisibleFor({ ...prod, flag: 'on' }), true, 'forced on');
	// the new-chapter economy (bundles, achievements) never follows the environment
	assert.equal(guideLiveFor({ epoch: 1, nodeEnv: 'development', vercelEnv: 'preview' }), false);
	assert.equal(guideLiveFor({ ...prod, flag: 'on' }), true);
});

// ---- the typewriter

test('the text types at about 30 characters a second and never past its end', () => {
	assert.ok(TYPE_CPS >= 25 && TYPE_CPS <= 35);
	assert.equal(visibleLength(100, 0), 0);
	assert.equal(visibleLength(100, 1000), TYPE_CPS);
	assert.equal(visibleLength(100, 500), Math.floor(TYPE_CPS / 2));
	assert.equal(visibleLength(10, 60_000), 10);
	assert.equal(visibleLength(10, -5), 0);
	assert.deepEqual(glyphs('a\u00e9\u{1F600}'), ['a', '\u00e9', '\u{1F600}']);
});

test('the mouth opens and closes while typing, rests on spaces and stops shut when the text is complete', () => {
	const text = 'Hello there. Welcome';
	assert.equal(mouthOpen(text, 0), false);
	const opens = Array.from({ length: text.length }, (_, i) => mouthOpen(text, i + 1));
	assert.ok(opens.some(Boolean) && opens.some((v) => !v), 'it alternates');
	assert.equal(mouthOpen(text, 6), false, 'the space');
	assert.equal(mouthOpen(text, 12), false, 'the full stop');
	assert.equal(mouthOpen(text, glyphs(text).length), false, 'complete');
	assert.equal(mouthOpen(text, glyphs(text).length + 5), false);
});
