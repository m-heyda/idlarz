// What a hero of a given level meets on a castle level 1 map that owns all four biomes: the share of new spawns by the hero's chance to beat them,
// with the old uniform type pick ("before") next to the weighted one ("after", offline/spawnWeights.ts). Used by monster-ladder.ts (--hero=1,5,10).
import { STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import { CASTLE_X, CASTLE_Y } from '../src/config/castle';
import { spentCharacter, simSetup } from '../src/lib/fightSim';
import { castleDistance } from '../src/lib/distance';
import { levelAtAge } from '../src/lib/monsters';
import { placeTickets } from '../src/lib/offline/placement';
import { playerProfile } from '../src/lib/offline/profile';
import { sealedRng } from '../src/lib/offline/seal';
import { emptyBank } from '../src/lib/offline/tickets';
import { winChanceAt } from '../src/lib/offline/spawnWeights';
import { totalStatPoints } from '../src/utils/game/character';
import { createWorld, type Placed } from '../src/utils/world';
import type { PlayerProfile } from '../src/lib/offline/fightTypes';
import type { BiomeType } from '../src/types/game';

const SAMPLES = 600;
const BIOMES: BiomeType[] = ['plains', 'forest', 'swamp', 'tundra'];
export const BUCKETS = [
	{ label: 'under 10 %', from: 0, to: 0.1 },
	{ label: '10-50 %', from: 0.1, to: 0.5 },
	{ label: '50-90 %', from: 0.5, to: 0.9 },
	{ label: '90 % and up', from: 0.9, to: 1.01 },
] as const;

/** A hero of this level in the starter kit with the points spent 60 % Strength, 40 % Vitality. */
export const heroProfile = (level: number): PlayerProfile => {
	const points = totalStatPoints(level);
	const strength = Math.round(points * 0.6);
	const { stored } = simSetup({
		equipment: STARTER_EQUIPMENT,
		character: spentCharacter({ strength, vitality: points - strength }),
		level,
		monsters: [],
		seed: 'mix',
	});
	return playerProfile(stored.core as Record<string, unknown>);
};

/** Castle level 1, the land 2-14 tiles out (monsters use 2-9, bosses 8 and more), a quarter of it in each of the four biomes. */
const mixWorld = () => {
	const placed: Placed[] = [{ x: CASTLE_X, y: CASTLE_Y, tile: { biome: 'castle', isOwned: true, level: 1 } }];
	for (let dx = -14; dx <= 14; dx++)
		for (let dy = -14; dy <= 14; dy++) {
			const x = CASTLE_X + dx;
			const y = CASTLE_Y + dy;
			if (castleDistance({ x, y }) < 2) continue;
			placed.push({ x, y, tile: { biome: BIOMES[(dx >= 0 ? 1 : 0) + (dy >= 0 ? 2 : 0)], isOwned: true } });
		}
	return createWorld(placed);
};

export interface Mix {
	/** share of spawns per bucket (at the level they appear at), and the share above 50 % */
	shares: number[];
	above50: number;
	/** the same once an unattended monster has grown as far as it may */
	grownAbove50: number;
}

const measure = (hero: PlayerProfile, world: ReturnType<typeof mixWorld>, weighted: boolean, boss = false): Mix => {
	const counts = BUCKETS.map(() => 0);
	let above = 0;
	let grownAbove = 0;
	for (let n = 1; n <= SAMPLES; n++) {
		const rollFor = (kind: string, k: number) => sealedRng('spawn-mix-secret-0123456789', 'mix', 1, kind, k);
		const ticket = { n, at: 0, lucky: false };
		const bank = boss ? { ...emptyBank(0), king: ticket } : { ...emptyBank(0), rats: [ticket] };
		const placed = placeTickets(bank, world, 'k', 0, rollFor, weighted ? hero : undefined);
		const t = boss ? placed.king! : placed.rats[0];
		const chance = winChanceAt(hero, t.type!, t.spawnLevel!);
		counts[BUCKETS.findIndex((b) => chance >= b.from && chance < b.to)]++;
		if (chance > 0.5) above++;
		const grown = levelAtAge(t.spawnLevel!, Number.MAX_SAFE_INTEGER, {}, t.growCap);
		if (winChanceAt(hero, t.type!, grown) > 0.5) grownAbove++;
	}
	return { shares: counts.map((c) => c / SAMPLES), above50: above / SAMPLES, grownAbove50: grownAbove / SAMPLES };
};

const pct = (x: number) => `${Math.round(x * 100)} %`;

/** The markdown lines of the table for these hero levels: normal monsters first, then bosses (8 or more tiles out, same weights and level cap). */
export const spawnMixLines = (heroLevels: number[]): string[] => {
	const world = mixWorld();
	const out: string[] = [];
	for (const boss of [false, true]) {
		if (boss) out.push('', 'Bosses (stand 8 or more tiles from the castle; the same weights and level cap as normal monsters):', '');
		out.push(
			'| Hero | Pick | ' + BUCKETS.map((b) => b.label).join(' | ') + ' | Win chance above 50 % | ...once grown fully |',
			'|---|---|' + BUCKETS.map(() => '---').join('|') + '|---|---|',
		);
		for (const level of heroLevels) {
			const hero = heroProfile(level);
			for (const [name, weighted] of [['uniform (before)', false] as const, ['weighted (now)', true] as const]) {
				const m = measure(hero, world, weighted, boss);
				out.push(`| level ${level} | ${name} | ${m.shares.map(pct).join(' | ')} | **${pct(m.above50)}** | ${pct(m.grownAbove50)} |`);
			}
		}
	}
	return out;
};
