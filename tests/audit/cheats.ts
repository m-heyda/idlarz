// Cheating saves run through the real server pipeline (acceptSave) on an in-memory store: what does the server do with each?
// Used by tests/audit/server.test.ts (assertions) and scripts/stat-audit.ts (the trust table in docs/generated/stat-audit.md).
import { api, growTo, store } from '../helpers';
import { pickPersisted, type PersistedGame } from '../../src/lib/sanitizeSave';
import { encodeSave } from '../../src/lib/saveFormat';
import { acceptSave, type SaveRepo, type StoredSave } from '../../src/lib/cloudSave/pipeline';
import { CASTLE_X, CASTLE_Y } from '../../src/config/castle';
import { calculateLevel, totalStatPoints } from '../../src/utils/game/character';
import { patchTile } from '../../src/utils/world';

export type Verdict = 'rejected' | 'clamped' | 'flagged' | 'silent';

export interface CheatRow {
	id: string;
	/** What the client claims */
	claim: string;
	verdict: Verdict;
	/** The flags the server raised (empty when it saw nothing) */
	flags: string[];
	/** Why the save was refused, when it was */
	reason?: string;
	/** Income rate (gold/s) the server stored for this save, divided by the same for an honest save. > 1 means the cheat now pays out. */
	rateFactor: number;
}

export const memoryRepo = () => {
	const rows = new Map<string, StoredSave>();
	const repo: SaveRepo = {
		load: async (id) => (rows.has(id) ? { ...rows.get(id)! } : null),
		commit: async (id, baseRev, save) => {
			const current = rows.get(id);
			if (baseRev === 0 ? !!current : current?.rev !== baseRev) return false;
			rows.set(id, save);
			return true;
		},
		archive: async () => undefined,
		pin: async () => undefined,
	};
	return { repo, rows };
};

export const T0 = 1_800_000_000_000;

/** A small seeded random generator (mulberry32), so every game below grows the same map and the numbers repeat run after run. */
const seeded = (seed: number) => () => {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
/** Every game built here starts from this seed: the biome of each bought tile is drawn from Math.random. */
export const reseed = () => {
	Math.random = seeded(20261107);
};

/** An honest early game: 12 tiles, 1000 s played, a little gold. */
export const honestGame = (): PersistedGame => {
	reseed();
	api().resetGame();
	growTo(12);
	store.setState({ playSeconds: 1000, resources: { ...api().resources, gold: 100, wood: 0, stone: 0, coal: 0, food: 0, hide: 0 } } as never);
	return structuredClone(pickPersisted(api()));
};

/** Unspent points a character of this much XP is allowed to hold, so only the cheat under test is wrong. */
const pointsFor = (cs: PersistedGame['characterStats'], xp: number): PersistedGame['characterStats'] => ({
	...cs,
	availablePoints: totalStatPoints(calculateLevel(xp).level),
});

interface Cheat {
	id: string;
	claim: string;
	/** Seconds between the honest save and the cheating one */
	dtSec?: number;
	/** True: the cheating save is the account's first one */
	first?: boolean;
	mutate: (honest: PersistedGame) => PersistedGame;
}

const embers = (rebirths: number, earned: number) => ({ rebirths, legacyPoints: earned, legacyEarned: earned, upgrades: {} });

export const CHEATS: Cheat[] = [
	{ id: 'embers-later-save', claim: '1,000,000 Embers and rebirth 1, at castle 1 with 12 tiles', mutate: (s) => ({ ...s, prestige: embers(1, 1_000_000) }) },
	{
		id: 'embers-first-save',
		claim: 'a brand new account whose first save holds 1,000,000 Embers',
		first: true,
		mutate: (s) => ({ ...s, prestige: embers(1, 1_000_000) }),
	},
	{ id: 'rebirths-jump', claim: 'rebirth count 0 -> 40 in one save, 900,000 Embers', mutate: (s) => ({ ...s, prestige: embers(40, 900_000) }) },
	{
		id: 'ember-shop-unpaid',
		claim: 'Thrift level 10 without spending the Embers',
		mutate: (s) => ({ ...s, prestige: { rebirths: 1, legacyPoints: 10, legacyEarned: 10, upgrades: { thrift: 10 }, shopVersion: 2 } }),
	},
	{ id: 'stat-points', claim: '+100 attribute points', mutate: (s) => ({ ...s, characterStats: { ...s.characterStats, strength: 105 } }) },
	{ id: 'click-level', claim: 'click ladder maxed', mutate: (s) => ({ ...s, clickLevel: 5 }) as never },
	{
		id: 'xp-inflated',
		claim: '1e12 XP',
		mutate: (s) => ({ ...s, resources: { ...s.resources, xp: 1e12 }, characterStats: pointsFor(s.characterStats, 1e12) }),
	},
	{ id: 'gold-huge', claim: '1e12 gold', mutate: (s) => ({ ...s, resources: { ...s.resources, gold: 1e12 } }) },
	{
		id: 'gold-inside-allowance',
		claim: '+1,500 gold in 300 s (inside the 1,000 floor + income allowance)',
		dtSec: 300,
		mutate: (s) => ({ ...s, playSeconds: s.playSeconds + 300, resources: { ...s.resources, gold: 100 + 1_500 } }),
	},
	{
		id: 'gold-over-allowance',
		claim: '+20,000 gold in 300 s',
		dtSec: 300,
		mutate: (s) => ({ ...s, playSeconds: s.playSeconds + 300, resources: { ...s.resources, gold: 100 + 20_000 } }),
	},
	{
		id: 'resources-huge',
		claim: '1e15 wood, stone, coal and food',
		mutate: (s) => ({ ...s, resources: { ...s.resources, wood: 1e15, stone: 1e15, coal: 1e15, food: 1e15 } }),
	},
	{
		id: 'castle-skip',
		claim: 'castle level 10 with no upgrade running',
		mutate: (s) => ({ ...s, tiles: patchTile(s.tiles, CASTLE_X, CASTLE_Y, { level: 10 }) }),
	},
	{ id: 'playtime-fast', claim: '+1,000,000 s played in 60 s', mutate: (s) => ({ ...s, playSeconds: s.playSeconds + 1_000_000 }) },
	{
		id: 'tiles-unpaid',
		claim: '200 tiles with 100 gold in hand',
		mutate: () => {
			reseed();
			api().resetGame();
			growTo(200);
			store.setState({
				playSeconds: 1060,
				characterStats: pointsFor(api().characterStats, api().resources.xp),
				resources: { ...api().resources, gold: 100, wood: 0, stone: 0, coal: 0, food: 0, hide: 0 },
			} as never);
			return structuredClone(pickPersisted(api()));
		},
	},
	{
		id: 'merchant-unpaid',
		claim: 'Foreman 10, Haggler 10, Tithe 10, Bulk 8 with no gold spent',
		mutate: (s) => ({ ...s, merchantUpgrades: { foreman: 10, haggler: 10, tithe: 10, bulk: 8 } }),
	},
];

/** The stored gold rate of an honest second save (the reference for `rateFactor`). */
const honestRate = async (): Promise<number> => {
	const { repo, rows } = memoryRepo();
	const base = honestGame();
	await acceptSave(repo, 'honest', 'Z', encodeSave(base), 0, T0);
	await acceptSave(repo, 'honest', 'Z', encodeSave(structuredClone(base)), 1, T0 + 60_000);
	return rows.get('honest')!.summary.rates.gold;
};

export const runCheats = async (): Promise<CheatRow[]> => {
	const reference = await honestRate();
	const out: CheatRow[] = [];
	for (const cheat of CHEATS) {
		const { repo, rows } = memoryRepo();
		const base = honestGame();
		let result;
		if (cheat.first) {
			result = await acceptSave(repo, 'u', 'Z', encodeSave(cheat.mutate(structuredClone(base))), 0, T0);
		} else {
			await acceptSave(repo, 'u', 'Z', encodeSave(base), 0, T0);
			result = await acceptSave(repo, 'u', 'Z', encodeSave(cheat.mutate(structuredClone(base))), 1, T0 + (cheat.dtSec ?? 60) * 1000);
		}
		if (result.kind !== 'ok') {
			out.push({
				id: cheat.id,
				claim: cheat.claim,
				verdict: 'rejected',
				flags: [],
				reason: result.kind === 'invalid' ? result.reason : result.kind,
				rateFactor: 1,
			});
			continue;
		}
		const flags = [...result.flags];
		const verdict: Verdict =
			result.xp !== undefined || result.prestige !== undefined || result.economy !== undefined ? 'clamped' : flags.length ? 'flagged' : 'silent';
		out.push({ id: cheat.id, claim: cheat.claim, verdict, flags, rateFactor: rows.get('u')!.summary.rates.gold / reference });
	}
	return out;
};
