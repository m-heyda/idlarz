import { INITIAL_CHARACTER_STATS } from '@/config/gameConfig';
import { ITEM_CATALOG, SETS } from '@/catalog';
import type { StoredSave } from '@/lib/cloudSave/pipeline';
import { runCombat, type CombatEnv } from '@/lib/offline/fight';
import type { FightEvent } from '@/lib/offline/fightTypes';
import { newLedger } from '@/lib/offline/ledger';
import { plainItem } from '@/lib/itemInstance';
import { calculateCombatStats } from '@/utils/gameUtils';
import type { CharacterStats, Equipment, EquipmentSlot, MonsterType } from '@/types/game';

// A fight run by the server's own engine (lib/offline/fight.ts): used by scripts/fight-sim.ts to tune the monsters and the gear, and by
// tests/fightBalance.test.ts to keep that tuning honest. The player swings at the weapon's attack speed, so there is no "click speed" any
// more: a fight is decided by gear, attributes, potions and skills alone. Pure apart from the sealed random stream, which a seed picks.

export const freshCharacter = (): CharacterStats => {
	const stats = { ...INITIAL_CHARACTER_STATS };
	return Object.assign(stats, calculateCombatStats(stats));
};

/** A character with attribute points spent on top of the starting 5 each (a level 30 character has about 25 to spend). */
export const spentCharacter = (spend: Partial<Pick<CharacterStats, 'strength' | 'dexterity' | 'intelligence' | 'vitality' | 'charisma'>>): CharacterStats => {
	const stats = { ...INITIAL_CHARACTER_STATS };
	for (const [key, points] of Object.entries(spend)) (stats as unknown as Record<string, number>)[key] += points ?? 0;
	return Object.assign(stats, calculateCombatStats(stats));
};

/** Every piece of a set worn, plus a weapon (and the set's own off hand is part of the set). Both rings are filled. Items are plain: their authored level, neutral quality, no affixes. */
export const fullSet = (setId: string, weapon?: string): Equipment => {
	const eq: Equipment = {};
	for (const id of SETS[setId].pieces) {
		const slot = ITEM_CATALOG[id].slot!;
		if (slot === 'ring') eq.ring1 = eq.ring2 = plainItem(id);
		else eq[slot as EquipmentSlot] = plainItem(id);
	}
	if (weapon) eq.mainHand = plainItem(weapon);
	return eq;
};

/** The same gear at another item level (what a monster of that level drops, or what the world level has produced by then). */
export const atItemLevel = (equipment: Equipment, level: number): Equipment =>
	Object.fromEntries(Object.entries(equipment).map(([slot, item]) => [slot, item ? { ...item, level } : item])) as Equipment;

export interface SimInput {
	equipment: Equipment;
	monster: { type: MonsterType; level: number };
	character?: CharacterStats;
	/** Potions in the bag, by catalog id (auto-use drinks them below the preset HP) */
	potions?: { id: string; qty: number }[];
	/** The character level: skills unlock with it (the default 1 has neither Heal nor Stun) */
	level?: number;
	/** Auto-use switched on (the default): potions, Heal and Stun by the fixed rules */
	autoUse?: boolean;
	/** Picks the sealed random stream, so a table is reproducible */
	seed: string;
}

export interface SimResult {
	won: boolean;
	outcome: 'won' | 'timeout' | 'defeated' | 'stalled';
	timeSec: number;
	hpLeftFraction: number;
}

const SECRET = 'fight-sim-secret-0123456789';
const START = 1_000_000;

const BASE_KEYS = ['strength', 'dexterity', 'intelligence', 'vitality', 'charisma'] as const;

export interface SimSetup {
	equipment?: Equipment;
	character?: CharacterStats;
	potions?: { id: string; qty: number }[];
	level?: number;
	/** The monsters waiting on the map, placed (ticket numbers count up from 1) */
	monsters: { type: MonsterType; level: number; lucky?: boolean }[];
	seed: string;
}

/** A player, a map with monsters on it and the server clock at `START`: what the fight engine runs on (for the sim and for engine tests). */
export const simSetup = ({ equipment = {}, character = freshCharacter(), potions = [], level = 1, monsters, seed }: SimSetup) => {
	const characterStats: Record<string, number> = { availablePoints: 0 };
	for (const key of BASE_KEYS) characterStats[key] = character[key];
	const core = { equipment, characterStats, level: { level, progress: 0 }, bag: potions.map((p) => ({ id: p.id, qty: p.qty })) };
	const stored = { core, summary: { derived: { luck: 0, goldFind: 0 }, rates: { gold: 1, xp: 1 }, xpGainPct: 0 } } as unknown as StoredSave;
	const base = newLedger(START * 1000);
	let n = 0;
	const ticket = (m: SimSetup['monsters'][number]) => ({ n: ++n, at: START, lucky: m.lucky ?? false, x: 2 + n, y: 3, spawnLevel: m.level });
	const rats = monsters.filter((m) => m.type === 'rat').map(ticket);
	const kingDef = monsters.find((m) => m.type === 'ratKing');
	const ledger = { ...base, runId: 1, bank: { ...base.bank, accAt: START, rats, king: kingDef ? ticket(kingDef) : null } };
	const env = (nowSec: number): CombatEnv => ({ secret: SECRET, userId: seed, stored, nowSec });
	return { ledger, env, start: START, stored };
};

export const simulateFight = ({ equipment, monster, character, potions, level, autoUse = true, seed }: SimInput): SimResult => {
	const { ledger, env } = simSetup({ equipment, character, potions, level, monsters: [monster], seed });

	// the first request engages the monster; then the clock runs on one second at a time until the fight is decided
	let state = runCombat(ledger, env(START), { autoUse }).ledger;
	const maxHp = state.combat!.fight?.profile.maxHp ?? 1;
	let now = START;
	const seen: FightEvent[] = [];
	for (let i = 0; i < 700 && state.combat!.fight; i++) {
		now += 1;
		state = runCombat(state, env(now)).ledger;
		seen.push(...state.combat!.log.filter((e) => e.no > (seen[seen.length - 1]?.no ?? 0)));
	}
	const end = seen.find((e) => e.kind === 'won' || e.kind === 'defeated' || e.kind === 'timeout');
	const hp = state.combat!.hp;
	if (!end) return { won: false, outcome: 'stalled', timeSec: now - START, hpLeftFraction: hp / maxHp };
	const outcome = end.kind as 'won' | 'defeated' | 'timeout';
	return { won: outcome === 'won', outcome, timeSec: end.t - START, hpLeftFraction: outcome === 'won' ? hp / maxHp : 0 };
};

export interface SimSummary {
	winRate: number;
	meanTimeSec: number; // of the wins
	meanHpLeft: number; // of the wins, as a fraction of max HP
}

/** Runs the fight `runs` times (each with its own sealed stream). */
export const simulateMany = (input: Omit<SimInput, 'seed'>, runs: number, seedBase = 'sim'): SimSummary => {
	let wins = 0;
	let time = 0;
	let hpLeft = 0;
	for (let i = 0; i < runs; i++) {
		const r = simulateFight({ ...input, seed: `${seedBase}-${i}` });
		if (r.won) {
			wins++;
			time += r.timeSec;
			hpLeft += r.hpLeftFraction;
		}
	}
	return { winRate: wins / runs, meanTimeSec: wins ? time / wins : NaN, meanHpLeft: wins ? hpLeft / wins : NaN };
};

/** Small seeded generator (mulberry32) so tables and tests are reproducible. */
export const seeded = (seed: number): (() => number) => {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};
