import { INITIAL_CHARACTER_STATS } from '@/config/gameConfig';
import { aggregateStats } from '@/lib/inventory';
import { attacksPerSecond, critOdds, damagePerHit, dodgeChance, lifeLeechPercent, manaRegenPerSec, maxHp, maxMana, armorOf } from '@/lib/combat';
import { healAmount } from '@/lib/skills';
import { critDamagePercent } from '@/lib/statBonuses';
import type { PlayerProfile } from '@/lib/offline/fightTypes';
import type { BagSlot, CharacterStats, Equipment } from '@/types/game';
import { calculateCombatStats, calculateLevel, merchantCombat } from '@/utils/gameUtils';

// What the server knows about the player's fighting strength: worked out from the last accepted save with the same functions the game's
// own readouts use, so the numbers in the character window are the numbers the fight runs on.

type Core = Record<string, unknown>;

const BASE_KEYS = ['strength', 'dexterity', 'intelligence', 'vitality', 'charisma'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The character's stats with every derived number worked out again (a save only holds the attributes). */
const statsOf = (core: Core): CharacterStats => {
	const saved = isRecord(core.characterStats) ? core.characterStats : {};
	const stats: CharacterStats = { ...INITIAL_CHARACTER_STATS };
	for (const key of BASE_KEYS) {
		const value = saved[key];
		if (typeof value === 'number' && Number.isFinite(value)) stats[key] = value;
	}
	Object.assign(stats, calculateCombatStats(stats));
	return stats;
};

export const equipmentOf = (core: Core): Equipment => (isRecord(core.equipment) ? (core.equipment as Equipment) : {});

/**
 * The character's level. A stored save does not hold it (it is derived from the XP, see saveFormat NOT_WRITTEN), so it is worked out from the
 * XP exactly as the game does; a record that carries a level but no XP (the engine tests) is still read.
 */
export const characterLevelOf = (core: Core): number => {
	const xp = isRecord(core.resources) ? core.resources.xp : undefined;
	if (typeof xp === 'number' && Number.isFinite(xp)) return calculateLevel(xp).level;
	const level = isRecord(core.level) ? core.level.level : undefined;
	return typeof level === 'number' && Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
};

/** The merchant's upgrades of the save (levels by id; anything else is ignored: merchantLevel clamps to the known ids and their maximum). */
const merchantOf = (core: Core): Record<string, number> => {
	const saved = isRecord(core.merchantUpgrades) ? core.merchantUpgrades : {};
	const out: Record<string, number> = {};
	for (const [id, level] of Object.entries(saved)) if (typeof level === 'number' && Number.isFinite(level)) out[id] = level;
	return out;
};

export const playerProfile = (core: Core): PlayerProfile => {
	const stats = statsOf(core);
	const equipment = equipmentOf(core);
	const bonus = merchantCombat(merchantOf(core));
	const odds = critOdds(stats, equipment, bonus);
	return {
		level: characterLevelOf(core),
		maxHp: maxHp(stats, equipment),
		maxMp: maxMana(stats, equipment),
		hit: damagePerHit(equipment, stats, bonus),
		crit: odds.crit,
		superCrit: odds.superCrit,
		critExtra: 1 + critDamagePercent(stats) / 100,
		attacksPerSec: attacksPerSecond(equipment, stats, bonus),
		armor: armorOf(equipment, stats),
		dodge: dodgeChance(equipment),
		leechPct: lifeLeechPercent(equipment, bonus),
		hpRegen: aggregateStats(equipment).regen + bonus.regen,
		mpRegen: manaRegenPerSec(stats, equipment),
		heal: healAmount(stats, equipment),
	};
};

/** How much of a potion the last saved bag holds. */
export const bagCount = (core: Core, id: string): number => {
	const bag = Array.isArray(core.bag) ? (core.bag as BagSlot[]) : [];
	let total = 0;
	for (const slot of bag) if (slot && 'id' in slot && slot.id === id && Number.isFinite(slot.qty)) total += slot.qty;
	return total;
};

/** The HP and mana the save says the player has: where a new combat record starts. */
export const savedVitals = (core: Core): { hp: number; mp: number } => {
	const num = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
	const profile = playerProfile(core);
	return { hp: Math.min(profile.maxHp, Math.max(1, num(core.playerHp, profile.maxHp))), mp: Math.min(profile.maxMp, Math.max(0, num(core.playerMp, profile.maxMp))) };
};
