import { DAILY_BONUS_GEMS, DAY_SEC, gemItemById, type GemItem } from '@/config/gemShop';
import { GEMS_CAP } from '@/config/economy';
import { PLAYER_CLASSES } from '@/config/playerClasses';
import { respecAttrs, spentOf, type Attrs } from '@/lib/offline/attrs';
import { recordRespec } from '@/lib/offline/stats';
import { addTotals, type Ledger } from '@/lib/offline/ledger';
import type { DailyInfo, GemShop, GemsRefusal, PendingIdentity } from '@/lib/offline/gemTypes';

// The gem shop's rules, pure: the ledger in, the ledger out. No database and no clock of its own (the caller passes the server clock), so the same functions run against Supabase and against a Map in the tests.

/** The server day (UTC), 1-based so that 0 can mean "never". */
export const serverDay = (nowSec: number): number => Math.floor(nowSec / DAY_SEC) + 1;

/**
 * The daily first-login bonus as it stands: claimable when today (UTC) has not been claimed; the step it pays is the next one of the ladder when the last claim was yesterday, and day 1 otherwise (a missed day starts again, and so does day 8).
 *
 * @category Economy/Gems
 * @order 3
 */
export const dailyInfo = (shop: GemShop, nowSec: number): DailyInfo => {
	const today = serverDay(nowSec);
	const steps = DAILY_BONUS_GEMS.length;
	const step = shop.daily.day === today - 1 ? (shop.daily.streak % steps) + 1 : shop.daily.day === today ? shop.daily.streak : 1;
	const available = shop.daily.day !== today;
	return { available, step, gems: DAILY_BONUS_GEMS[step - 1] };
};

/** Claims today's bonus: the gems go into the balance (clamped to the cap) and into `granted`, like every gem the server hands out. Null when today is already claimed. */
export const claimDaily = (ledger: Ledger, nowSec: number): { ledger: Ledger; gems: number } | null => {
	const info = dailyInfo(ledger.gemShop, nowSec);
	if (!info.available) return null;
	const gems = Math.max(0, Math.min(info.gems, GEMS_CAP - ledger.gems));
	return {
		gems,
		ledger: {
			...ledger,
			gems: ledger.gems + gems,
			granted: addTotals(ledger.granted, { gems }),
			gemShop: { ...ledger.gemShop, daily: { day: serverDay(nowSec), streak: info.step } },
		},
	};
};

/** What a purchase costs this account now: the first attribute respec is free. */
export const priceFor = (item: GemItem, attrs: Attrs | null): number => (item.id === 'attr_respec' && !(attrs?.freeUsed ?? false) ? 0 : item.price);

export interface SpendFacts {
	nowSec: number;
	/** A fight is open (the combat was brought up to now first) */
	inFight: boolean;
	/** The hero class on the profile row, for `class_change` (null: no profile) */
	currentClass: string | null;
	/** The attribute allocation (seeded) */
	attrs: Attrs;
}

export type SpendOutcome = { ok: true; ledger: Ledger; paid: number } | { ok: false; reason: GemsRefusal; message: string };

const refuse = (reason: GemsRefusal, message: string): SpendOutcome => ({ ok: false, reason, message });

/**
 * One purchase from the gem shop, decided on the ledger: the item must exist, no identity change may be waiting to be written, the balance must cover the price, the cooldown must be over and the item's own rule must hold. Nothing is changed
 * when it is refused. A paid purchase takes the gems, counts the purchase and records `spentSinceSave`; a class or name change is left as a `pending` identity change for the caller to write on the profile (and clear), and an attribute respec is done here.
 *
 * - **Class change**: not during a fight, to another class of the four.
 * - **Name change**: `value` is the new name, already checked against the name rules and the unique index by the caller (the cooldown is the profile's, checked by the caller too).
 * - **Attribute respec**: not during a fight; refused when nothing is spent; the first one of an account is free.
 *
 * @category Economy/Gems
 * @order 4
 */
export const applySpend = (ledger: Ledger, itemId: string, value: string | undefined, facts: SpendFacts): SpendOutcome => {
	const item = gemItemById(itemId);
	if (!item) return refuse('unknown_item', 'That is not for sale.');
	if (ledger.gemShop.pending) return refuse('pending', 'A change is still being finished. Try again in a moment.');
	const last = ledger.gemShop.lastAt[item.id] ?? 0;
	if (item.cooldownSec > 0 && last > 0 && facts.nowSec - last < item.cooldownSec) return refuse('cooldown', 'You have to wait before buying that again.');
	const price = priceFor(item, ledger.attrs);
	if (ledger.gems < price) return refuse('short_balance', `You need ${price - ledger.gems} more gems.`);

	let pending: PendingIdentity | null = null;
	let attrs = ledger.attrs;
	if (item.id === 'class_change') {
		if (facts.inFight) return refuse('in_fight', 'Finish the fight first.');
		if (!value || !PLAYER_CLASSES[value as keyof typeof PLAYER_CLASSES]) return refuse('bad_value', 'Pick one of the four heroes.');
		if (value === facts.currentClass) return refuse('same_class', 'That is already your class.');
		pending = { kind: 'class', value, price };
	} else if (item.id === 'name_change') {
		if (!value) return refuse('bad_value', 'Enter a name.');
		pending = { kind: 'name', value, price };
	} else {
		if (facts.inFight) return refuse('in_fight', 'Finish the fight first.');
		if (spentOf(facts.attrs.alloc) === 0) return refuse('nothing_to_respec', 'You have no attribute points to take back.');
		attrs = respecAttrs(facts.attrs);
	}
	return {
		ok: true,
		paid: price,
		ledger: {
			...ledger,
			gems: ledger.gems - price,
			attrs,
			stats: item.id === 'class_change' || item.id === 'name_change' ? ledger.stats : recordRespec(ledger.stats),
			gemShop: {
				...ledger.gemShop,
				bought: { ...ledger.gemShop.bought, [item.id]: (ledger.gemShop.bought[item.id] ?? 0) + 1 },
				lastAt: { ...ledger.gemShop.lastAt, [item.id]: facts.nowSec },
				spentSinceSave: ledger.gemShop.spentSinceSave + price,
				pending,
			},
		},
	};
};

/** The identity change was written: the pending record goes. */
export const clearPending = (ledger: Ledger): Ledger => ({ ...ledger, gemShop: { ...ledger.gemShop, pending: null } });

/** The identity change could not be written (the name was taken a moment ago): the gems and the purchase are given back and the cooldown is not used up. */
export const refundPending = (ledger: Ledger): Ledger => {
	const p = ledger.gemShop.pending;
	if (!p) return ledger;
	const item = p.kind === 'class' ? 'class_change' : 'name_change';
	const bought = { ...ledger.gemShop.bought };
	const lastAt = { ...ledger.gemShop.lastAt };
	if ((bought[item] ?? 0) <= 1) delete bought[item];
	else bought[item] -= 1;
	delete lastAt[item];
	return {
		...ledger,
		gems: Math.min(GEMS_CAP, ledger.gems + p.price),
		gemShop: { ...ledger.gemShop, bought, lastAt, spentSinceSave: Math.max(0, ledger.gemShop.spentSinceSave - p.price), pending: null },
	};
};
