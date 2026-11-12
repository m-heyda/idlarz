import { JUNK_ITEMS } from '@/catalog/items/junk';
import type { Rng } from '@/lib/rng';
import type { Drop } from '@/types/game';

// What a kill drops besides gear and potions: junk materials (IDL-312). Cheap ones are always found and scale with how rich the kill was; pricey ones are rare finds; a boss always drops a stack of the pricey ones.

/** Share of the kill's gold that the cheap junk is worth (placeholder, balance pass): a kill that pays more gold drops more junk, so it follows the monster's level and the player's economy. */
export const JUNK_GOLD_SHARE = 0.15;

/** Cheap junk, found on every kill, picked by weight. */
const COMMON: readonly { id: string; weight: number }[] = [
	{ id: 'junk_rubble', weight: 24 },
	{ id: 'junk_brush', weight: 22 },
	{ id: 'junk_bones', weight: 20 },
	{ id: 'junk_feather', weight: 16 },
	{ id: 'junk_scrap', weight: 12 },
	{ id: 'junk_tar', weight: 8 },
	{ id: 'junk_sand', weight: 6 },
];

/** Pricey junk: a chance per kill (before Luck) and the monster level it starts at. */
const RARE: readonly { id: string; chance: number; minLevel: number }[] = [
	{ id: 'junk_claw', chance: 0.08, minLevel: 1 },
	{ id: 'junk_rose_dust', chance: 0.035, minLevel: 5 },
	{ id: 'junk_teal_crystals', chance: 0.012, minLevel: 12 },
	{ id: 'junk_amethyst', chance: 0.004, minLevel: 20 },
];

/** A boss always drops these, in a number that grows with its level (and a little with Luck). */
const BOSS: readonly { id: string; base: number; perLevel: number }[] = [
	{ id: 'junk_claw', base: 3, perLevel: 1 / 8 },
	{ id: 'junk_teal_crystals', base: 2, perLevel: 1 / 6 },
	{ id: 'junk_amethyst', base: 1, perLevel: 1 / 12 },
];

export interface JunkRollContext {
	/** The monster's level */
	level: number;
	/** The gold this kill pays: it carries the monster's level and the player's economy */
	gold: number;
	luck: number;
	boss: boolean;
	/** A golden monster: everything is tripled */
	lucky: boolean;
}

const valueOf = (id: string): number => JUNK_ITEMS.find((i) => i.id === id)?.sellValue ?? 1;

/**
 * The junk a kill drops, as consumable drops (a stack holds 10,000 to 100,000 by rarity). Cheap junk: one kind, in the number that fills `JUNK_GOLD_SHARE` of the kill's gold (between half and one and a half times). Pricey junk: each kind has its own small chance
 * (Luck raises it, 0.5% per point) from its minimum monster level. A boss drops its guaranteed pricey stack on top. Drawn from `rng` **after** every other roll of the kill, so the rest of the kill's loot is the same as before junk existed.
 *
 * @category Loot/Junk
 * @order 3
 * @formula
 * cheap qty   = max(1, round(gold x 0.15 x (0.5 + roll) / sellValue))        (x3 for a golden monster)
 * rare chance = base x (1 + 0.005 x Luck)
 * boss qty    = floor((base + level x perLevel) x (1 + 0.005 x Luck))       (guaranteed, x3 for a golden one)
 */
export const rollJunkDrops = (ctx: JunkRollContext, rng: Rng): Drop[] => {
	const drops: Drop[] = [];
	const bonus = ctx.lucky ? 3 : 1;
	const luck = 1 + Math.max(0, ctx.luck) * 0.005;
	const total = COMMON.reduce((sum, c) => sum + c.weight, 0);
	let pick = rng() * total;
	const common = COMMON.find((c) => (pick -= c.weight) < 0) ?? COMMON[0];
	const qty = Math.max(1, Math.round(((ctx.gold * JUNK_GOLD_SHARE * (0.5 + rng())) / valueOf(common.id)) * bonus));
	drops.push({ kind: 'consumable', id: common.id, qty });
	for (const rare of RARE) {
		if (ctx.level >= rare.minLevel && rng() < rare.chance * luck) drops.push({ kind: 'consumable', id: rare.id, qty: bonus });
	}
	if (ctx.boss)
		for (const b of BOSS) {
			const n = Math.max(1, Math.floor((b.base + ctx.level * b.perLevel) * luck)) * bonus;
			const merged = drops.find((d) => d.kind === 'consumable' && d.id === b.id);
			if (merged && merged.kind === 'consumable') merged.qty += n;
			else drops.push({ kind: 'consumable', id: b.id, qty: n });
		}
	return drops;
};
