import { INTRO_ID, TUTORIAL_PATH, type TutorialReward } from '@/catalog/tutorial';
import { isLessonId, isPathStepId, withDone, withLesson, withSkip, type TutorialProgress } from '@/lib/tutorial/engine';
import type { StoredSave } from '@/lib/cloudSave/pipeline';
import { addTotals, type GrantTotals, type Ledger } from '@/lib/offline/ledger';
import { receiveInto, sellContextOf } from '@/lib/offline/inventory';
import type { Inventory } from '@/lib/offline/types';

// SERVER ONLY. The guided tutorial's progress (`stats.tutorial`) and the starter bundles. The browser says "this step is done"; the server records it, and pays
// the step's bundle once: a step already in the list pays nothing, whatever the key. A bundle step also needs proof in the last accepted save (a bought
// tile, a running castle upgrade, a level), so a forged request for the gold finds nothing. The bundles are the server's own payout (`granted`), like a chest.

export type TutorialRequest = { action: 'sync' } | { action: 'done'; id: string } | { action: 'lesson'; id: string } | { action: 'skip' };

export interface TutorialReply {
	ok: boolean;
	/** `unknown`: not a step or lesson of the catalog; `not_yet`: the last accepted save does not show the step yet (ask again after the next save) */
	reason?: 'unknown' | 'not_yet';
	progress: TutorialProgress;
	/** What the bundle paid this time (empty when nothing was paid) */
	paid?: { gold?: number; wood?: number; food?: number; items?: { id: string; qty: number }[] };
	serverNowSec: number;
	inv?: Inventory;
}

type Summary = StoredSave['summary'];

/** What the last accepted save must show before a step's bundle is paid. Steps without a bundle need no proof. */
const PROOF: Record<string, (s: Summary) => boolean> = {
	'buy-tile': (s) => s.derived.purchased >= 2,
	'castle-upgrade': (s) => s.derived.castleUpgrade !== null || s.castleLevel >= 2,
	'stat-point': (s) => s.level >= 2,
};

const rewardOf = (id: string): TutorialReward | undefined => TUTORIAL_PATH.find((step) => step.id === id)?.reward;

/**
 * Applies one tutorial request to the ledger. `done` records a step once and pays its bundle (gold and wood as `granted` totals, items through
 * `receiveInto`); repeating it, with the same key or another, changes nothing and pays nothing. `lesson` records a fired lesson, `skip` ends the starter path
 * (later bundles are forfeited), `sync` only reads. Progress lives in the ledger's `stats` and resets with it at a new chapter.
 *
 * @category Progression/Guided tutorial
 * @order 4
 * @see readProgress
 */
export const applyTutorial = (ledger: Ledger, stored: StoredSave, request: TutorialRequest, nowSec: number): { ledger: Ledger; reply: TutorialReply } => {
	const progress = ledger.stats.tutorial;
	const reply = (extra: Partial<TutorialReply> = {}): TutorialReply => ({ ok: true, progress, serverNowSec: nowSec, ...extra });
	const store = (next: TutorialProgress, rest: Partial<Ledger> = {}): Ledger => ({ ...ledger, ...rest, stats: { ...ledger.stats, tutorial: next } });

	if (request.action === 'sync') return { ledger, reply: reply() };
	if (request.action === 'skip') {
		const next = withSkip(progress);
		return { ledger: store(next), reply: { ok: true, progress: next, serverNowSec: nowSec } };
	}
	if (request.action === 'lesson') {
		if (!isLessonId(request.id)) return { ledger, reply: reply({ ok: false, reason: 'unknown' }) };
		const next = withLesson(progress, request.id);
		return { ledger: store(next), reply: { ok: true, progress: next, serverNowSec: nowSec } };
	}

	const { id } = request;
	if (id !== INTRO_ID && !isPathStepId(id)) return { ledger, reply: reply({ ok: false, reason: 'unknown' }) };
	if (progress.done.includes(id)) return { ledger, reply: reply() };
	const proof = PROOF[id];
	const reward = rewardOf(id);
	if (reward && proof && !proof(stored.summary)) return { ledger, reply: reply({ ok: false, reason: 'not_yet' }) };
	const next = withDone(progress, id);
	// a skipped player's later steps are not recorded and pay nothing
	if (progress.skipped) return { ledger, reply: reply() };
	if (!reward) return { ledger: store(next), reply: { ok: true, progress: next, serverNowSec: nowSec } };

	const resources: Partial<GrantTotals> = {};
	if (reward.gold) resources.gold = reward.gold;
	if (reward.wood) resources.wood = reward.wood;
	if (reward.food) resources.food = reward.food;
	let inv = ledger.inv;
	let convertedGold = 0;
	if (reward.items?.length && inv) {
		const received = receiveInto(
			inv,
			reward.items.map((item) => ({ kind: 'consumable' as const, id: item.id, qty: item.qty })),
			sellContextOf(stored.core),
		);
		inv = received.inv;
		// what did not fit in the bag is paid as gold, like everything else that is dropped
		convertedGold = received.received.convertedGold + received.received.autoSold.gold;
		if (convertedGold > 0) resources.gold = (resources.gold ?? 0) + convertedGold;
	}
	const paid = {
		...(resources.gold ? { gold: resources.gold } : {}),
		...(resources.wood ? { wood: resources.wood } : {}),
		...(resources.food ? { food: resources.food } : {}),
		...(reward.items ? { items: [...reward.items] } : {}),
	};
	return {
		ledger: store(next, { inv, granted: addTotals(ledger.granted, resources) }),
		reply: { ok: true, progress: next, paid, serverNowSec: nowSec, ...(inv ? { inv } : {}) },
	};
};
