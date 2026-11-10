import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BIOME_LOOT, BOSS_LOOT, OPEN_SETS, bossSourceId, buildBossLoot, type BossLootDef } from '@/catalog';
import { SET_DEFS } from '@/catalog/sets';
import { MONSTERS } from '@/config/combatConfig';
import { limitOf } from '@/lib/limits';
import { LOOT_DATA, type LootData } from '@/lib/loot/data';
import { generateLoot } from '@/lib/loot/generate';
import { eligibleCandidates } from '@/lib/loot/pools';
import { validateLootData } from '@/lib/loot/validate';
import { mulberry32 } from '@/lib/rng';

// IDL-44: bosses own their drops. The set pieces and the named uniques of a biome come only from its boss. See `BOSS_LOOT` in src/catalog/lootConfig.ts.

const biomes = Object.keys(BOSS_LOOT) as (keyof typeof BOSS_LOOT)[];
const bossOf = (biome: string) => Object.values(MONSTERS).find((m) => m.grade === 'boss' && m.spawn.biomes[0] === biome)!;

/**
 * Sets with no boss yet and no open pool either: S1-S3 (pieces disabled until their biomes exist). Wiring one is `setId` in BOSS_LOOT; this list must shrink with it (the partition test fails otherwise).
 * TODO (post release): hills, coast, lake and the new biomes bring their bosses; S2 and S3 drop from theirs (docs/plan/20-monster-families-and-rewards.md).
 */
const PENDING_SETS = ['sunhoney', 'ashen_warlord', 'blightbound'];

/** Every item a source can give: its general pool and each bonus table's pool, at every level the source can have (and the item level offsets of its tables) */
const reachable = (data: LootData, sourceId: string): Map<string, Set<string>> => {
	const source = data.sources[sourceId];
	const profile = data.profiles[source.lootProfileId];
	const out = new Map<string, Set<string>>();
	const add = (pool: string, level: number) => {
		for (const c of eligibleCandidates(data, pool, level)) {
			if (!out.has(c.def.id)) out.set(c.def.id, new Set());
			out.get(c.def.id)!.add(pool);
		}
	};
	for (let level = source.levels!.min; level <= source.levels!.max; level++) {
		if (profile.generalPoolId) add(profile.generalPoolId, level + profile.itemLevel.offset);
		for (const table of profile.bonusTables) add(table.poolId, level + (table.itemLevel?.offset ?? profile.itemLevel.offset));
	}
	return out;
};

test('every boss of the roster has a loot source of its own, one per biome', () => {
	assert.deepEqual(biomes.sort(), Object.keys(BIOME_LOOT).sort());
	const bosses = Object.entries(MONSTERS).filter(([, m]) => m.grade === 'boss');
	assert.equal(bosses.length, biomes.length, 'one boss per biome');
	for (const [id, boss] of bosses) {
		const biome = boss.spawn.biomes[0];
		assert.equal(boss.lootSourceId, bossSourceId(biome), id);
		const source = LOOT_DATA.sources[boss.lootSourceId];
		assert.ok(source, `${id}: source exists`);
		assert.equal(source.lootProfileId, boss.lootSourceId, `${id}: profile of its own`);
		assert.ok(LOOT_DATA.profiles[source.lootProfileId].enabled);
	}
	assert.equal(new Set(bosses.map(([, m]) => m.lootSourceId)).size, bosses.length, 'no two bosses share a source');
});

test('a boss source covers every level its boss can have (spawn window plus growth), and the shipped data validates', () => {
	for (const biome of biomes) {
		const { spawnWindow } = bossOf(biome);
		const levels = LOOT_DATA.sources[bossSourceId(biome)].levels!;
		assert.ok(levels.min <= spawnWindow.base, `${biome}: min level`);
		assert.ok(
			levels.max >= spawnWindow.cap + limitOf('monsterGrowthLevels'),
			`${biome}: max level ${levels.max} vs ${spawnWindow.cap + limitOf('monsterGrowthLevels')}`,
		);
	}
	assert.deepEqual(validateLootData().errors, []);
});

test("no boss drops another biome's set, or any set it does not own; every unique has exactly one boss", () => {
	const setOf = (id: string) => LOOT_DATA.items[id].set;
	const uniqueOwners = new Map<string, string[]>();
	for (const biome of biomes) {
		const owned = BOSS_LOOT[biome].setId;
		for (const [id, pools] of reachable(LOOT_DATA, bossSourceId(biome))) {
			const set = setOf(id);
			if (set) assert.equal(set, owned, `${bossSourceId(biome)} can drop ${id} (set ${set}), but owns ${owned ?? 'no set'}`);
			if (LOOT_DATA.items[id].generation === 'named') {
				assert.ok(
					[...pools].every((p) => p === `boss_unique_${biome}`),
					`${bossSourceId(biome)}: ${id} comes from ${[...pools]} and not only its unique pool`,
				);
				uniqueOwners.set(id, [...(uniqueOwners.get(id) ?? []), biome]);
			}
		}
		for (const id of BOSS_LOOT[biome].uniques) assert.ok(LOOT_DATA.items[id]?.pools?.includes('legendary_weapons'), `${id} is a legendary weapon`);
	}
	for (const biome of biomes) for (const id of BOSS_LOOT[biome].uniques) assert.deepEqual(uniqueOwners.get(id), [biome], `${id} has exactly one boss`);
	// the generic `boss` source (debug panel, craft-sim) drops no named item and no set piece either
	for (const [id] of reachable(LOOT_DATA, 'boss'))
		assert.ok(!LOOT_DATA.items[id].set && LOOT_DATA.items[id].generation !== 'named', `generic boss drops ${id}`);
});

test('set pieces come only from their boss: the general pools hold none (except an open set), so no other source can drop them', () => {
	const sets = SET_DEFS.filter((s) => !s.retired).map((s) => s.id);
	const owned = biomes.flatMap((b) => (BOSS_LOOT[b].setId ? [BOSS_LOOT[b].setId!] : []));
	// every set has one owner, is open (legacy, drops from the general pools) or is pending (listed above)
	assert.deepEqual(
		[...owned, ...OPEN_SETS, ...PENDING_SETS].sort(),
		[...sets].sort(),
		'a set is owned by a boss, open or pending: update PENDING_SETS when you wire one',
	);
	assert.equal(new Set(owned).size, owned.length, 'a set has one owner');
	for (const source of Object.values(LOOT_DATA.sources)) {
		if (source.id.startsWith('boss')) continue;
		for (const [id] of reachable(
			{ ...LOOT_DATA, sources: { ...LOOT_DATA.sources, [source.id]: { ...source, levels: source.levels ?? { min: 1, max: 100 } } } },
			source.id,
		)) {
			const set = LOOT_DATA.items[id].set;
			if (set) assert.ok(OPEN_SETS.includes(set), `${source.id} drops ${id} of the closed set ${set}`);
		}
	}
});

test('PENDING_SETS: their pieces are disabled or out of reach, so nothing leaks while they wait', () => {
	for (const set of PENDING_SETS)
		for (const def of Object.values(LOOT_DATA.items).filter((d) => d.set === set))
			assert.equal(def.enabled, false, `${def.id} is enabled but its set has no boss`);
});

// ---- a boss with a set (no set has live pieces today: the structure is proved on a copy where the tundra boss owns Blightbound) ------------------------------------

const withSet = (setId: string | null, biome: keyof typeof BOSS_LOOT = 'tundra'): LootData => {
	const data = JSON.parse(JSON.stringify(LOOT_DATA)) as LootData;
	const loot: Record<string, BossLootDef> = Object.fromEntries(biomes.map((b) => [b, { ...BOSS_LOOT[b], setId: b === biome ? setId : null }]));
	const built = buildBossLoot(loot);
	Object.assign(data.pools, built.pools);
	Object.assign(data.profiles, built.profiles);
	Object.assign(data.sources, built.sources);
	// the set's pieces are live and reachable at boss levels in this copy
	for (const def of Object.values(data.items)) {
		if (def.set === 'blightbound') {
			def.enabled = true;
			def.minItemLevel = 1;
			def.maxItemLevel = 100;
			delete def.dropLevels;
		}
	}
	return data;
};

test('a boss that owns a set drops its pieces (missing ones first, certain within a few kills) and no other boss drops them', () => {
	const data = withSet('blightbound');
	const pieces = Object.values(data.items).filter((d) => d.set === 'blightbound');
	assert.ok(pieces.length >= 12, `a set has its pieces (${pieces.length})`);
	assert.ok(validateLootData(data).errors.length === 0, validateLootData(data).errors.join('; '));
	const rng = mulberry32(44);
	const owned = new Set<string>();
	let pity: Record<string, number> = {};
	let kills = 0;
	while (owned.size < pieces.length && kills < 200) {
		kills++;
		const r = generateLoot({ sourceId: 'boss_tundra', level: 40, owned: [...owned], pity }, rng, data);
		pity = r.pity;
		const got = r.drops.flatMap((d) => (d.kind === 'gear' && data.items[d.item.base].set ? [d.item.base] : []));
		assert.ok(got.length <= 1, 'at most one set piece per kill');
		for (const id of got) {
			assert.ok(!owned.has(id), `${id}: a duplicate while pieces are missing`);
			owned.add(id);
		}
	}
	assert.equal(owned.size, pieces.length, `a full set after ${kills} kills`);
	assert.ok(kills >= pieces.length && kills <= 60, `${kills} kills for ${pieces.length} pieces`);
	for (const biome of ['plains', 'forest', 'swamp'] as const)
		for (let i = 0; i < 400; i++)
			for (const d of generateLoot({ sourceId: bossSourceId(biome), level: 30 + (i % 10) }, rng, data).drops)
				assert.ok(d.kind !== 'gear' || !data.items[d.item.base].set, `${biome} boss dropped a set piece`);
});

test('the set table has pity: it triggers within the bound after misses, and the pity counter resets on a piece', () => {
	const data = withSet('blightbound');
	const miss = () => 0.999;
	let pity: Record<string, number> = {};
	for (let i = 0; i < 3; i++) pity = generateLoot({ sourceId: 'boss_tundra', level: 40, pity }, miss, data).pity;
	assert.equal(pity['boss_tundra:set'], 3);
	// 50 % + 3 x 15 % pity (capped at +50 %): a roll of 0.9 still wins
	const win = generateLoot({ sourceId: 'boss_tundra', level: 40, pity }, () => 0.9, data);
	assert.equal(win.pity['boss_tundra:set'], 0);
	assert.equal(win.drops.filter((d) => d.kind === 'gear' && data.items[d.item.base].set).length, 1);
});
