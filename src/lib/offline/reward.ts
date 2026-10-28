import type { StoredSave } from '@/lib/cloudSave/pipeline';
import { rollKillLoot } from '@/lib/loot';
import { levelAtAge } from '@/lib/monsters';
import { addTotals, type Ledger } from '@/lib/offline/ledger';
import { ownedBases, receiveInto, sellContextOf } from '@/lib/offline/inventory';
import { sealedRng } from '@/lib/offline/seal';
import { takeMonster, type MonsterTicket } from '@/lib/offline/tickets';
import type { Drop } from '@/types/game';

// SERVER ONLY. What a kill pays: rolled from a secret against the monster's ticket, at the level its age has earned.

export interface KillPayout {
	level: number;
	lucky: boolean;
	gold: number;
	xp: number;
	hide: number;
	items: Drop[];
	/** What the drops became: the part that went into the bag, the gold for what did not fit, and what the auto-sell filter sold */
	stored: Drop[];
	convertedGold: number;
	autoSold: { count: number; gold: number };
	pity: Record<string, number>;
}

/**
 * Pays the kill of ticket `n`: the ticket leaves the bank, the roll is sealed on the number of kills this run (so a replay cannot roll
 * it again), and the gold, XP and hide go into what the server has granted. Null when the ticket is not there.
 */
export const payKill = (secret: string, userId: string, ledger: Ledger, stored: StoredSave, n: number, nowSec: number): { ledger: Ledger; payout: KillPayout } | null => {
	const taken = takeMonster(ledger.bank, n);
	if (!taken) return null;
	const ticket: MonsterTicket = taken.ticket;
	const type = taken.kind === 'king' ? 'ratKing' : 'rat';
	const level = levelAtAge(ticket.spawnLevel ?? 1, nowSec - ticket.at);
	const ordKill = ledger.ordKill + 1;
	const rng = sealedRng(secret, userId, ledger.runId, 'kill', ordKill);
	const { luck, goldFind, killRewardPct } = stored.summary.derived;
	const inv = ledger.inv!;
	const loot = rollKillLoot(
		{ type, level },
		{ goldPerSec: stored.summary.rates.gold, xpPerSec: stored.summary.rates.xp * (1 + stored.summary.xpGainPct / 100), hidePerSec: stored.summary.rates.hide, luck, goldFind, killRewardPct, owned: ownedBases(inv), pity: inv.lootPity, lucky: ticket.lucky },
		rng
	);
	// the drops go where they go on the server: the bag (or gold when it is full, or the auto-sell filter), and the pity counters move on
	const received = receiveInto(inv, loot.items, sellContextOf(stored.core), loot.pity);
	return {
		ledger: {
			...ledger,
			bank: taken.bank,
			ordKill,
			inv: received.inv,
			granted: addTotals(ledger.granted, { gold: loot.gold + received.received.convertedGold + received.received.autoSold.gold, xp: loot.xp, hide: loot.hide }),
		},
		payout: {
			level,
			lucky: ticket.lucky,
			gold: loot.gold,
			xp: loot.xp,
			hide: loot.hide,
			items: loot.items,
			stored: received.received.stored,
			convertedGold: received.received.convertedGold,
			autoSold: received.received.autoSold,
			pity: loot.pity,
		},
	};
};
