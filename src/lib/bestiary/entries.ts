import { MASTERY_BIOMES, BIOME_GOALS, bonusText, masteryTiersOf, biomeRoster } from '@/catalog/mastery';
import { ingredientsOf, ingredientQty } from '@/catalog/monsterDrops';
import { MONSTER_CATALOG, monsterSpriteUrl, type MonsterCatalogEntry } from '@/catalog/monsters';
import { LOOT_PROFILES, LOOT_SOURCES } from '@/catalog/lootConfig';
import { ITEM_CATALOG } from '@/catalog';
import { BOSS_MIN_DISTANCE, MONSTERS } from '@/config/combatConfig';
import { BIOMES } from '@/config/biomes';
import { biomeArtUrl } from '@/config/biomeArt';
import { biomeColor } from '@/config/biomePalette';
import { biomeState, masteryBonusesFor, masteryStateOf, noBonuses } from '@/lib/mastery';
import { maxLevelOf, monsterStats, rewardLevelMult } from '@/lib/monsters';
import { formatCompact } from '@/utils/formatters';
import type { BestiaryBiomeGoal, BestiaryDropRow, BestiaryEntry } from '../../../packages/design-system/src/views/bestiary';
import type { MonsterType } from '@/types/game';

// The Bestiary as data for the window and for Storybook (IDL-322, IDL-336): every live monster as an entry with its tiers, stats at any level and the drop table at any level. Pure: the server's numbers come in as `BestiaryInput`.

/** What the server tells the browser (`useBestiaryStore`): the types met, the kills and the claimed tiers. */
export interface BestiaryInput {
	/** Before the server's first answer every type reads as met (`isKnownType`) */
	loaded: boolean;
	seen: ReadonlySet<string>;
	kills: Readonly<Record<string, number>>;
	claimed: Readonly<Record<string, number>>;
	biomeClaimed: Readonly<Record<string, number>>;
	deaths: Readonly<Record<string, number>>;
	bestMs: Readonly<Record<string, number>>;
}

/** An input with nothing in it (Storybook's "all unknown"). */
export const emptyInput = (): BestiaryInput => ({ loaded: true, seen: new Set(), kills: {}, claimed: {}, biomeClaimed: {}, deaths: {}, bestMs: {} });

const REBIRTH_BIOMES: Readonly<Record<string, number>> = { jungle: 1, fields: 2, orchard: 3, blight: 4, battlefield: 5 };

/** "Plains" for a home biome, the capitalised id for a rebirth one. */
export const biomeLabelOf = (biome: string): string => BIOMES[biome]?.label ?? biome.charAt(0).toUpperCase() + biome.slice(1);

/** The Fast / Normal / Slow word of an attack speed (attacks per second). */
export const speedWord = (perSec: number): string => (perSec >= 0.55 ? 'Fast' : perSec > 0.42 ? 'Normal' : 'Slow');

const perSecond = (value: number): string => `${formatCompact(Math.round(value * 100) / 100)}/s`;

/** Where and when a monster appears, in words. */
export const whereOf = (type: string): string => {
	const def = MONSTERS[type as MonsterType];
	if (!def) return '';
	const entry = MONSTER_CATALOG.find((m) => m.id === type);
	const biome = entry?.biomes[0] ?? def.spawn.biomes[0];
	const dist =
		def.grade === 'boss'
			? `${BOSS_MIN_DISTANCE}+ tiles from the castle`
			: `${def.spawn.minCastleDistance}-${def.spawn.maxCastleDistance} tiles from the castle`;
	const rebirth = REBIRTH_BIOMES[biome] ? ` · after rebirth ${def.spawn.minRebirths ?? REBIRTH_BIOMES[biome]}` : '';
	return `${biomeLabelOf(biome)} · ${dist}${rebirth}`;
};

/** The levels the Bestiary's +/- walks through: the bottom of the spawn window to the top it can grow to. */
export const levelRangeOf = (type: string): { min: number; max: number } => {
	const def = MONSTERS[type as MonsterType];
	return { min: def.spawnWindow.base, max: maxLevelOf(def.spawnWindow.cap) };
};

/** The stat rows of a monster at a level (the same numbers as the monster tooltip). */
export const statRowsOf = (type: string, level: number): [string, string][] => {
	const t = type as MonsterType;
	const s = monsterStats(t, level);
	const def = MONSTERS[t];
	return [
		['HP', formatCompact(s.maxHp)],
		['Damage', `${formatCompact(s.attack)} / hit`],
		['Speed', `${speedWord(s.attackSpeed)} · ${perSecond(s.attackSpeed)}`],
		['DPS', formatCompact(Math.round(s.attack * s.attackSpeed * 10) / 10)],
		['Armor', formatCompact(Math.round(s.armor * 10) / 10)],
		...(s.critChance > 0 ? ([['Crit', `${s.critChance}% x${s.critMult}`]] as [string, string][]) : []),
		...(s.stunResist > 0 ? ([['Stun resist', `${s.stunResist}%`]] as [string, string][]) : []),
		...(def.grade === 'boss' && 'timeLimitSec' in def && def.timeLimitSec ? ([['Time limit', `${def.timeLimitSec} s`]] as [string, string][]) : []),
	];
};

const pct = (n: number): string => `${+(Math.min(1, n) * 100).toFixed(1)}%`;

/** The drop table of a monster at a level: gold and XP caps, the gear roll, potions, the common junk and its own ingredients, each scaled to the level. */
export const dropRowsOf = (type: string, level: number): BestiaryDropRow[] => {
	const t = type as MonsterType;
	const def = MONSTERS[t];
	const mult = rewardLevelMult(t, level);
	const source = LOOT_SOURCES[def.lootSourceId];
	const profile = source ? LOOT_PROFILES[source.lootProfileId] : undefined;
	const rows: BestiaryDropRow[] = [
		{ label: 'Gold', value: `up to ${formatCompact(Math.round(def.reward.gold.cap * mult))}`, tone: 'good' },
		{ label: 'XP', value: `up to ${formatCompact(Math.round(def.reward.xp.cap * mult))}`, tone: 'good' },
	];
	if (profile) {
		const roll = profile.rolls;
		const chance = roll.guaranteed ? 1 : roll.chancePerRoll + (roll.chancePerLevel ?? 0) * (level - 1);
		const v = profile.itemLevel.variance;
		rows.push({ label: `Gear (item level ${Math.max(1, level - v)}-${level + v})`, value: chance >= 1 ? 'always' : pct(chance) });
		for (const table of profile.bonusTables) {
			if (table.takeAll) rows.push({ label: 'Potions', value: 'always', tone: 'good' });
			else if (table.poolId.startsWith('potions')) rows.push({ label: 'Potion', value: pct((table.chance ?? 1) + (table.chancePerLevel ?? 0) * (level - 1)) });
			else if (table.id === 'unique') rows.push({ label: 'Unique weapon', value: pct(table.chance ?? 0), tone: 'epic' });
			else if (table.id === 'set') rows.push({ label: 'Set piece', value: pct(table.chance ?? 0), tone: 'epic' });
		}
	}
	rows.push({ label: 'Common junk', value: 'every kill' });
	for (const ing of ingredientsOf(type)) {
		if (level < ing.minLevel) continue;
		const lo = ingredientQty(ing, level, 0);
		const hi = ingredientQty(ing, level, 0.999);
		const item = ITEM_CATALOG[ing.id];
		const n = lo === hi ? `${lo}` : `${lo}-${hi}`;
		rows.push({
			label: `${item?.name ?? ing.id} x${n}`,
			value: ing.chance >= 1 ? 'always' : pct(ing.chance),
			tone: item?.rarity === 'epic' ? 'epic' : item?.rarity === 'rare' ? 'rare' : 'plain',
		});
	}
	return rows;
};

/** One Bestiary entry from the catalog row and what the server has said. */
export const entryOf = (m: MonsterCatalogEntry, input: BestiaryInput): BestiaryEntry => {
	const tiers = masteryTiersOf(m.id);
	const kills = input.kills[m.id] ?? 0;
	const met = !input.loaded ? true : input.seen.has(m.id) || kills > 0;
	const state = masteryStateOf(m.id, kills, input.claimed[m.id] ?? 0);
	return {
		id: m.id,
		name: m.label,
		family: m.family,
		tags: m.tags,
		lore: m.lore ?? '',
		boss: m.grade === 'boss',
		biome: m.biomes[0],
		biomeLabel: biomeLabelOf(m.biomes[0]),
		where: whereOf(m.id),
		icon: monsterSpriteUrl(m),
		met,
		kills,
		deaths: input.deaths[m.id] ?? 0,
		bestMs: input.bestMs[m.id] ?? null,
		tiers: tiers.map((t) => ({ kills: t.kills, reveal: t.reveal, text: t.bonuses.map(bonusText).join(', '), gems: t.gems })),
		claimed: state.claimed,
		levels: levelRangeOf(m.id),
		stats: (level) => statRowsOf(m.id, level),
		drops: (level) => dropRowsOf(m.id, level),
	};
};

/** Every live monster as an entry, in catalog order (home biomes first, a boss last in its biome). */
export const entriesOf = (input: BestiaryInput): BestiaryEntry[] => MONSTER_CATALOG.filter((m) => m.enabled).map((m) => entryOf(m, input));

/** The biome goal strips. */
export const biomeGoalsOf = (input: BestiaryInput): BestiaryBiomeGoal[] => {
	const names = new Map(MONSTER_CATALOG.map((m) => [m.id, m.label]));
	return MASTERY_BIOMES.map((biome) => {
		const s = biomeState(biome, input.kills, input.biomeClaimed[biome] ?? 0);
		return {
			biome,
			label: biomeLabelOf(biome),
			art: biomeArtUrl(biome),
			color: biomeColor(biome),
			monsters: biomeRoster(biome).length,
			reached: s.reached,
			claimed: s.claimed,
			missing: s.missing.map((id) => names.get(id) ?? id),
			tiers: BIOME_GOALS.map((g) => ({ text: g.bonuses.map(bonusText).join(', '), gems: g.gems })),
		};
	});
};

/** "Mastery bonuses active": the claimed tiers and biome goals counted (each bonus works against its own monster, so there is no single sum). */
export const activeTextOf = (input: BestiaryInput): string => {
	let tiers = 0;
	const total = noBonuses();
	for (const m of MONSTER_CATALOG.filter((x) => x.enabled)) {
		tiers += Math.min(input.claimed[m.id] ?? 0, masteryTiersOf(m.id).length);
		const b = masteryBonusesFor(m.id, input.claimed, input.biomeClaimed);
		for (const k of Object.keys(total) as (keyof typeof total)[]) total[k] = Math.max(total[k], b[k]);
	}
	const goals = Object.values(input.biomeClaimed).reduce((a, b) => a + b, 0);
	if (tiers + goals === 0) return 'None yet: claim a tier';
	const best = (Object.keys(total) as (keyof typeof total)[]).filter((k) => total[k] > 0).map((k) => bonusText({ stat: k, value: total[k] }));
	return `${tiers} tier${tiers === 1 ? '' : 's'}${goals ? ` · ${goals} biome goal${goals === 1 ? '' : 's'}` : ''}${best.length ? ` · best ${best.join(', ')}` : ''}`;
};

/** Reward tiers waiting to be claimed: monster tiers reached and not claimed, plus biome goals reached and not claimed (the dock badge). */
export const readyCountOf = (input: BestiaryInput): number => {
	let n = 0;
	for (const m of MONSTER_CATALOG.filter((x) => x.enabled)) n += masteryStateOf(m.id, input.kills[m.id] ?? 0, input.claimed[m.id] ?? 0).claimable;
	for (const biome of MASTERY_BIOMES) n += biomeState(biome, input.kills, input.biomeClaimed[biome] ?? 0).claimable;
	return n;
};
