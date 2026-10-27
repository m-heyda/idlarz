import { INITIAL_CHARACTER_STATS } from '@/config/gameConfig';
import { ITEM_CATALOG, SETS } from '@/catalog';
import { COMBAT } from '@/config/combatConfig';
import { SKILLS, type SkillId } from '@/catalog/skills';
import { applyHit, armorOf, damageAfterArmor, manaRegenPerSec, maxHp, maxMana, newFight, rollHit, stepFight, stunResisted } from '@/lib/combat';
import { castRefusal, healAmount, tickCooldowns, type SkillCooldowns } from '@/lib/skills';
import { aggregateStats } from '@/lib/inventory';
import { plainItem } from '@/lib/itemInstance';
import { calculateCombatStats } from '@/utils/gameUtils';
import type { CharacterStats, Equipment, EquipmentSlot, MonsterType } from '@/types/game';

// A bot that fights with the real combat rules (rollHit, stepFight, mitigate): used by scripts/fight-sim.ts to tune the
// monsters and the gear, and by tests/fightBalance.test.ts to keep that tuning honest. Pure; the rng is injected.

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
	/** Clicks per second (each gap is jittered by +-30 %) */
	cps: number;
	rng: () => number;
	character?: CharacterStats;
	/** Potions the bot has: it drinks the best one when HP is under 40 % and the shared cooldown is over */
	potions?: { healHp: number; qty: number }[];
	/** The character level the bot casts skills at (Heal under 50 % HP, Stun whenever it is ready); without it the bot casts nothing */
	skillLevel?: number;
}

export interface SimResult {
	won: boolean;
	outcome: 'won' | 'timeout' | 'knockedOut' | 'stalled';
	timeSec: number;
	hpLeftFraction: number;
	clicks: number;
}

const STEP = 0.05;
const GIVE_UP_SEC = 600; // monsters without a time limit (rats): a fight that drags on this long counts as stalled

export const simulateFight = ({ equipment, monster, cps, rng, character = freshCharacter(), potions = [], skillLevel = 0 }: SimInput): SimResult => {
	let fight = newFight({ id: 1, ...monster });
	const max = maxHp(character, equipment);
	let hp = max;
	const armor = armorOf(equipment, character);
	const gearRegen = { perSec: aggregateStats(equipment).regen, max };
	const bag = potions.map((p) => ({ ...p })).sort((a, b) => b.healHp - a.healHp);
	let mana = maxMana(character, equipment);
	const manaMax = mana;
	const manaRegen = manaRegenPerSec(character, equipment);
	let cooldowns: SkillCooldowns = {};
	let time = 0;
	let clicks = 0;
	let nextClick = (1 / cps) * (0.7 + 0.6 * rng());

	while (fight.phase === 'active' && time < GIVE_UP_SEC) {
		time += STEP;
		while (nextClick <= time && fight.phase === 'active') {
			const damage = damageAfterArmor(fight, rollHit(character, equipment, rng).damage);
			clicks++;
			const hitResult = applyHit(fight, damage);
			fight = hitResult.fight;
			if (hitResult.killed) return { won: true, outcome: 'won', timeSec: nextClick, hpLeftFraction: hp / max, clicks };
			nextClick += (1 / cps) * (0.7 + 0.6 * rng());
		}
		const step = stepFight(fight, STEP, hp, armor, rng, gearRegen);
		fight = step.fight;
		hp = step.playerHp;
		mana = Math.min(manaMax, mana + manaRegen * STEP);
		cooldowns = tickCooldowns(cooldowns, STEP);
		if (skillLevel > 0 && fight.phase === 'active') {
			const can = (id: SkillId) => castRefusal(id, { level: skillLevel, mana, hp, maxHp: max, fight, cooldowns }) === null;
			if (fight.stunLeftSec <= 0 && can('stun')) {
				mana -= SKILLS.stun.manaCost;
				cooldowns = { ...cooldowns, stun: SKILLS.stun.cooldownSec };
				if (!stunResisted(fight, rng)) fight = { ...fight, stunLeftSec: SKILLS.stun.stunSec ?? 0 };
			}
			if (hp < max * 0.5 && can('heal')) {
				mana -= SKILLS.heal.manaCost;
				cooldowns = { ...cooldowns, heal: SKILLS.heal.cooldownSec };
				hp = Math.min(max, hp + healAmount(character, equipment));
			}
		}
		if (fight.phase === 'active' && hp < max * 0.4 && fight.potionCd <= 0) {
			const potion = bag.find((p) => p.qty > 0);
			if (potion) {
				potion.qty--;
				hp = Math.min(max, hp + potion.healHp);
				fight = { ...fight, potionCd: COMBAT.potionCooldownSec };
			}
		}
	}
	const outcome = fight.phase === 'active' ? 'stalled' : (fight.phase as SimResult['outcome']);
	return { won: false, outcome, timeSec: time, hpLeftFraction: hp / max, clicks };
};

export interface SimSummary {
	winRate: number;
	meanTimeSec: number; // of the wins
	meanHpLeft: number; // of the wins, as a fraction of max HP
}

/** Runs the bot `runs` times (a seeded rng makes a table reproducible). */
export const simulateMany = (input: Omit<SimInput, 'rng'>, runs: number, rng: () => number): SimSummary => {
	let wins = 0;
	let time = 0;
	let hpLeft = 0;
	for (let i = 0; i < runs; i++) {
		const r = simulateFight({ ...input, rng });
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
