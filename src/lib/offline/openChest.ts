import { ITEM_CATALOG } from '@/catalog';
import { monsterChestTierOf } from '@/catalog/items/chests';
import { MONSTER_CHEST, type MonsterChestTier } from '@/config/monsterChests';
import { removeFromBag, stackOf } from '@/lib/inventory';
import type { CombatEnv } from '@/lib/offline/fightContext';
import type { OfflineGrant } from '@/lib/offline/grant';
import { receiveInto, sellContextOf } from '@/lib/offline/inventory';
import { addTotals, type Ledger } from '@/lib/offline/ledger';
import { sealedRng } from '@/lib/offline/seal';
import type { Rng } from '@/lib/rng';
import type { Drop, Resources } from '@/types/game';
import { zeroResources } from '@/catalog/resourceKeys';

// SERVER ONLY. Opening a monster chest from the bag (the `open` operation of /api/inventory, IDL-163). One chest leaves the bag, what it holds is rolled from a sealed random stream and paid into the ledger's `granted` in the same write,
// and the answer carries the payment as an `OfflineGrant` (no time passes: the same shape the time-shift potion uses) for the browser to apply.

/** What an opened chest held, for the notice. */
export interface OpenedChest {
	/** The chest's tier and name */
	tier: MonsterChestTier;
	label: string;
	/** The income it paid, resources and XP; apply it like an absence's pay (`applyOfflineGrant`) */
	grant: OfflineGrant;
	/** The potion that came with it (it is already in the server's bag), if any */
	potion?: { id: string; qty: number };
}

export type OpenResult = { ok: true; ledger: Ledger; opened: OpenedChest } | { ok: false; message: string };

const between = (rng: Rng, [lo, hi]: [number, number]) => lo + rng() * (hi - lo);

/**
 * What a chest of `tier` pays at the player's income: one kind picked by weight (gold, one resource, or XP), worth a random number of minutes of that income, and a potion with `potionChance`. Pure and sealed on `rng`.
 *
 * @category Loot/Monster chests
 * @order 3
 * @formula
 * kind    = gold 45 | one of wood / stone / coal / food 30 | xp 25 (weights)
 * paid    = floor(rate per second x U(minutes) x 60)       resource at least 25, XP at least 60 and x (1 + XP gain %)
 */
export const rollMonsterChest = (
	tier: MonsterChestTier,
	income: { rates: Resources; xpGainPct: number },
	rng: Rng,
): { resources: Resources; potion?: Drop & { kind: 'consumable' } } => {
	const { kinds, resources: pool, floor, potionChance } = MONSTER_CHEST;
	const def = MONSTER_CHEST.tiers[tier];
	const paid = zeroResources();
	const total = kinds.gold + kinds.resource + kinds.xp;
	let pick = rng() * total;
	const minutes = between(rng, def.minutes);
	if ((pick -= kinds.gold) < 0) paid.gold = Math.floor(income.rates.gold * minutes * 60);
	else if ((pick -= kinds.resource) < 0) {
		const resource = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
		paid[resource] = Math.max(floor.resource, Math.floor(income.rates[resource] * minutes * 60));
	} else paid.xp = Math.max(floor.xp, Math.floor(income.rates.xp * minutes * 60 * (1 + income.xpGainPct / 100)));
	const potion = rng() >= 1 - potionChance ? ({ kind: 'consumable', id: def.potion, qty: 1 } as const) : undefined;
	return { resources: paid, ...(potion ? { potion } : {}) };
};

/**
 * Opens the monster chest in bag slot `index`. Refused, with nothing consumed, when the slot holds no monster chest. Otherwise one chest leaves the bag, the roll is sealed on the inventory's version (so a replayed request, which the idempotency key answers from the
 * stored result, and a reload can never roll twice, and a roll cannot be chosen: the version moves with every operation), the income it paid goes into `granted` (so the save that holds it passes the checks), and the potion goes into the server's bag through the full-bag rule
 * (a potion that does not fit pays its sell value). Allowed in a fight: it touches no gear.
 *
 * @category Loot/Monster chests
 * @order 4
 */
export const applyOpen = (input: Ledger, env: CombatEnv, index: number): OpenResult => {
	const inv = input.inv!;
	const stack = Number.isInteger(index) ? stackOf(inv.bag[index]) : null;
	const tier = stack ? monsterChestTierOf(stack.id) : undefined;
	if (!stack || !tier) return { ok: false, message: 'That is not a chest' };
	const rng = sealedRng(env.secret, env.userId, input.runId, 'openchest', inv.ver + 1);
	const rolled = rollMonsterChest(tier, { rates: env.stored.summary.rates, xpGainPct: env.stored.summary.xpGainPct }, rng);
	let next = { ...inv, bag: removeFromBag(inv.bag, index, 1), ver: inv.ver + 1 };
	let gold = 0;
	if (rolled.potion) {
		const received = receiveInto(next, [rolled.potion], sellContextOf(env.stored.core));
		next = received.inv;
		gold = received.received.convertedGold + received.received.autoSold.gold;
	}
	const paid = { ...rolled.resources, gold: rolled.resources.gold + gold };
	const grant: OfflineGrant = { elapsedSec: 0, gapSec: 0, capSec: 0, efficiency: 1, capped: false, resources: paid, castle: null };
	const ledger: Ledger = { ...input, inv: next, granted: addTotals(input.granted, paid) };
	return {
		ok: true,
		ledger,
		opened: {
			tier,
			label: ITEM_CATALOG[stack.id]?.name ?? MONSTER_CHEST.tiers[tier].label,
			grant,
			...(rolled.potion ? { potion: { id: rolled.potion.id, qty: rolled.potion.qty } } : {}),
		},
	};
};
