import type { BuffStat } from '@/catalog/buffs';
import { buffTotals, type ActiveBuff } from '@/lib/buffs';
import { COMBAT } from '@/config/combatConfig';
import { isRecord } from '@/lib/isRecord';
import { INITIAL_CHARACTER_STATS } from '@/config/character';
import { aggregateStats } from '@/lib/inventory';
import { attacksPerSecond, critOdds, damagePerHit, dodgeChance, lifeLeechPercent, manaRegenPerSec, maxHp, maxMana, armorOf } from '@/lib/combat';
import { healAmount } from '@/lib/skills';
import { potionCooldownSec, potionPower, potionSlotCount } from '@/lib/potionBelt';
import { withClassBonus } from '@/lib/classPassives';
import { critDamagePercent } from '@/lib/statBonuses';
import type { PlayerProfile } from '@/lib/offline/fightTypes';
import type { CharacterStats, Equipment } from '@/types/game';
import { calculateCombatStats, calculateLevel } from '@/utils/game/character';
import { merchantCombat } from '@/utils/game/merchant';

// What the server knows about the player's fighting strength: worked out from the last accepted save with the same functions the game's
// own readouts use, so the numbers in the character window are the numbers the fight runs on.

type Core = Record<string, unknown>;

const BASE_KEYS = ['strength', 'dexterity', 'intelligence', 'vitality', 'charisma'] as const;

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

const equipmentOf = (core: Core): Equipment => (isRecord(core.equipment) ? (core.equipment as Equipment) : {});

/**
 * The character's level. A stored save does not hold it (it is derived from the XP, see saveFormat NOT_WRITTEN), so it is worked out from the
 * XP exactly as the game does; a record that carries a level but no XP (the engine tests) is still read.
 */
const characterLevelOf = (core: Core): number => {
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

/**
 * Freezes everything a fight needs about the player into a `PlayerProfile` (max HP and mana, damage per hit, crit odds, attack speed, armor, dodge, leech, regen, and the belt's potion cooldown, power and slots), from the last accepted save and the ledger's gear. The hero class of the save (stamped from the profile row) adds its combat passive: armor, regeneration, crit chance, mana and Spell Power (`classPassives`).
 *
 * @category Combat/A fight
 * @order 5
 */
export const playerProfile = (core: Core): PlayerProfile => {
	const stats = statsOf(core);
	const equipment = equipmentOf(core);
	// the class comes from the stored save, where the save route stamps it from the profile row (never from the upload)
	const playerClass = core.playerClass;
	const bonus = withClassBonus(merchantCombat(merchantOf(core)), playerClass);
	const odds = critOdds(stats, equipment, bonus);
	const gear = aggregateStats(equipment);
	// the Idols' combat bonuses (Maw Idol: damage, War Memorial: max HP and armor), stamped into the stored save by the save pipeline from the standing Idols (`idolFx`)
	const fx = isRecord(core.idolFx) ? core.idolFx : {};
	const pct = (key: string) => 1 + (typeof fx[key] === 'number' && Number.isFinite(fx[key]) ? Math.max(0, fx[key] as number) : 0) / 100;
	return {
		level: characterLevelOf(core),
		maxHp: Math.round(maxHp(stats, equipment) * pct('hpArmorPct')),
		maxMp: maxMana(stats, equipment, playerClass),
		hit: damagePerHit(equipment, stats, bonus) * pct('damagePct'),
		crit: odds.crit,
		superCrit: odds.superCrit,
		critExtra: 1 + critDamagePercent(stats) / 100,
		attacksPerSec: attacksPerSecond(equipment, stats, bonus),
		armor: armorOf(equipment, stats, playerClass) * pct('hpArmorPct'),
		dodge: dodgeChance(equipment),
		leechPct: lifeLeechPercent(equipment, bonus),
		hpRegen: gear.regen + bonus.regen,
		mpRegen: manaRegenPerSec(stats, equipment),
		heal: healAmount(stats, equipment, undefined, playerClass),
		potionCooldownSec: potionCooldownSec(gear),
		potionPower: potionPower(gear),
		potionSlots: potionSlotCount(gear),
	};
};

/**
 * A profile with the running potion buffs on top ({@link buffTotals}): each is an additive percent of the number it changes. No buffs gives the profile itself (the same object),
 * so a fight with no potions is exactly the fight there was before buffs. A fight freezes the result when it starts.
 *
 * @category Combat/Consumables
 * @formula
 * hit' = hit x (1 + damagePct/100)         attacksPerSec' = attacksPerSec x (1 + atkSpeedPct/100)
 * armor' = armor x (1 + armorPct/100)       maxHp' = maxHp x (1 + maxHpPct/100)
 * crit' = min(maxCritChance, crit + critChance/100)       dodge' = min(maxDodge, dodge + dodge/100)
 * @order 8
 */
export const withBuffs = (profile: PlayerProfile, totals: Partial<Record<BuffStat, number>>): PlayerProfile => {
	if (Object.values(totals).every((value) => !value)) return profile;
	const pct = (stat: BuffStat) => 1 + (totals[stat] ?? 0) / 100;
	return {
		...profile,
		hit: profile.hit * pct('damagePct'),
		attacksPerSec: profile.attacksPerSec * pct('atkSpeedPct'),
		armor: profile.armor * pct('armorPct'),
		maxHp: Math.round(profile.maxHp * pct('maxHpPct')),
		crit: Math.min(COMBAT.crit.maxCritChance / 100, profile.crit + (totals.critChance ?? 0) / 100),
		dodge: Math.min(COMBAT.maxDodge / 100, profile.dodge + (totals.dodge ?? 0) / 100),
	};
};

/** The player's profile at `nowSec` with the buffs that are running then. */
export const profileWithBuffs = (core: Core, buffs: readonly ActiveBuff[], nowSec: number): PlayerProfile =>
	withBuffs(playerProfile(core), buffTotals(buffs, nowSec));

/** The HP and mana the save says the player has: where a new combat record starts. */
export const savedVitals = (core: Core): { hp: number; mp: number } => {
	const num = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
	const profile = playerProfile(core);
	return {
		hp: Math.min(profile.maxHp, Math.max(1, num(core.playerHp, profile.maxHp))),
		mp: Math.min(profile.maxMp, Math.max(0, num(core.playerMp, profile.maxMp))),
	};
};
