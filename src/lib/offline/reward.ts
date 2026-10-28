import type { StoredSave } from '@/lib/cloudSave/pipeline';
import { rollKillLoot } from '@/lib/loot';
import { levelAtAge } from '@/lib/monsters';
import { addTotals, type Ledger } from '@/lib/offline/ledger';
import { sealedRng } from '@/lib/offline/seal';
import { takeMonster, type MonsterTicket } from '@/lib/offline/tickets';
import type { Drop } from '@/types/game';

// SERVER ONLY. What a kill pays: rolled from a secret against the monster's ticket, at the level its age has earned.

const asRecord = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});

/** What the last accepted save says the player owns (for "prefer a piece you do not have") and their bad-luck counters. */
const rollInputs = (stored: StoredSave): { owned: string[]; pity: Record<string, number> } => {
	const equipment = asRecord(stored.core.equipment) as Record<string, { base?: string } | undefined>;
	const bag = Array.isArray(stored.core.bag) ? (stored.core.bag as ({ item?: { base?: string }; id?: string } | null)[]) : [];
	const owned = [...Object.values(equipment).map((item) => item?.base), ...bag.map((slot) => slot?.item?.base ?? slot?.id)].filter((id): id is string => typeof id === 'string');
	const pity: Record<string, number> = {};
	for (const [id, misses] of Object.entries(asRecord(stored.core.lootPity))) if (typeof misses === 'number' && Number.isFinite(misses)) pity[id] = misses;
	return { owned, pity };
};

export interface KillPayout {
	level: number;
	lucky: boolean;
	gold: number;
	xp: number;
	hide: number;
	items: Drop[];
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
	const { luck, goldFind } = stored.summary.derived;
	const { owned, pity } = rollInputs(stored);
	const loot = rollKillLoot(
		{ type, level },
		{ goldPerSec: stored.summary.rates.gold, xpPerSec: stored.summary.rates.xp * (1 + stored.summary.xpGainPct / 100), hidePerSec: stored.summary.rates.hide, luck, goldFind, owned, pity, lucky: ticket.lucky },
		rng
	);
	return {
		ledger: { ...ledger, bank: taken.bank, ordKill, granted: addTotals(ledger.granted, { gold: loot.gold, xp: loot.xp, hide: loot.hide }) },
		payout: { level, lucky: ticket.lucky, gold: loot.gold, xp: loot.xp, hide: loot.hide, items: loot.items, pity: loot.pity },
	};
};
