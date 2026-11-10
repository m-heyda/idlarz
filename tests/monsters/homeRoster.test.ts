import test from 'node:test';
import assert from 'node:assert/strict';
import { BOSS_MIN_DISTANCE, COMBAT, MONSTERS } from '../../src/config/combatConfig';
import { BIOME_RULES } from '../../src/config/biomeRules';
import { CASTLE_X, CASTLE_Y } from '../../src/config/castle';
import { MONSTER_CATALOG } from '../../src/catalog/monsters';
import { castleDistance } from '../../src/lib/distance';
import { canSpawnOn, spawnLevelRange, spawnTiles } from '../../src/lib/monsters';
import { runCombat } from '../../src/lib/offline/fight';
import { placeTickets } from '../../src/lib/offline/placement';
import { sealedRng } from '../../src/lib/offline/seal';
import { emptyBank, monsterTypeOf, type MonsterTicket } from '../../src/lib/offline/tickets';
import { STARTER_EQUIPMENT } from '../../src/config/itemCatalog';
import { atItemLevel, fullSet, kit, simSetup, simulateMany, spentCharacter } from '../../src/lib/fightSim';
import { STRONG_KIT } from '../builders';
import { createWorld, getTile, type Placed } from '../../src/utils/world';
import type { BiomeType, Equipment, MonsterType } from '../../src/types/game';

// The home rosters (IDL-201): hills, coast and lake monsters go through the same ticket bank as the first four biomes, stand on tiles of their own biome (water included) and fight the same on the server however the requests are cut.

// Auto-battle's win-chance gate is not what is tested here: the fight engine is, so a fight with any of the new monsters starts at once.
(COMBAT.auto as { minWinChance: number }).minWinChance = 0;

const HOME_NEW = ['hills', 'coast', 'lake'] as const;
const newTypes = (Object.keys(MONSTERS) as MonsterType[]).filter((type) => (HOME_NEW as readonly string[]).includes(MONSTERS[type].spawn.biomes[0]));
const rollFor = (kind: string, n: number) => sealedRng('home-roster-secret-0123456789', 'u1', 1, kind, n);

/** A castle with one tile of every home biome at the given offsets (x, y from the castle), all owned */
const land = (tiles: [BiomeType, number, number][]) => {
	const placed: Placed[] = [{ x: CASTLE_X, y: CASTLE_Y, tile: { biome: 'castle', isOwned: true, level: 1 } }];
	for (const [biome, dx, dy] of tiles) placed.push({ x: CASTLE_X + dx, y: CASTLE_Y + dy, tile: { biome, isOwned: true } });
	return createWorld(placed);
};
const ticket = (n: number, kind: MonsterTicket['kind'] = 'normal'): MonsterTicket => ({ n, at: 0, kind, lucky: false });

test('the three rosters are in: twelve monsters, three normal ones and a boss in each of hills, coast and lake, all on their own biome', () => {
	assert.equal(newTypes.length, 12);
	for (const biome of HOME_NEW) {
		const own = newTypes.filter((type) => MONSTERS[type].spawn.biomes[0] === biome);
		assert.equal(own.filter((type) => MONSTERS[type].grade === 'normal').length, 3, biome);
		assert.equal(own.filter((type) => MONSTERS[type].grade === 'boss').length, 1, biome);
		for (const type of own) assert.deepEqual([...MONSTERS[type].spawn.biomes], [biome], `${type} stands on its own biome only`);
	}
});

test('a hills monster stands on hills only, a coast monster on coast and a lake monster on lake, water included', () => {
	const world = land([
		['hills', 3, 0],
		['coast', 0, 4],
		['lake', -3, 0],
		['plains', 0, -3],
		['forest', 4, 4],
	]);
	const spots = (type: MonsterType) => spawnTiles(type, world, new Set()).map(({ x, y }) => `${x - CASTLE_X},${y - CASTLE_Y}`);
	assert.deepEqual(spots('graniteRam'), ['3,0']);
	assert.deepEqual(spots('wreckCrab'), ['0,4']);
	assert.deepEqual(spots('reedNymph'), ['-3,0']);
	assert.deepEqual(spots('thistleBoar'), ['0,-3'], 'the old rosters are untouched');
	assert.deepEqual(spots('mossbackWolf'), ['4,4']);
	// a boss needs a tile 8 or more tiles out
	assert.deepEqual(spots('bossHillGiant'), []);
	assert.equal(canSpawnOn('bossHillGiant', CASTLE_X + 8, CASTLE_Y, { biome: 'hills' }, 1), true);
	assert.equal(canSpawnOn('bossHillGiant', CASTLE_X + 7, CASTLE_Y, { biome: 'hills' }, 1), false);
	assert.equal(canSpawnOn('graniteRam', CASTLE_X + 10, CASTLE_Y, { biome: 'hills' }, 1), false, 'normal monsters stay within 9');
	assert.equal(BOSS_MIN_DISTANCE, 8);
});

test('the ticket bank places a monster of the new biomes on a tile of its biome, the same land always giving the same map', () => {
	const world = land([
		['hills', 3, 0],
		['coast', 0, 4],
		['lake', -3, 0],
		['hills', 9, 0],
		['coast', 0, -9],
		['lake', -9, 9],
	]);
	const run = () => {
		const bank = { ...emptyBank(0), monsters: [1, 2, 3, 4, 5, 6].map((n) => ticket(n)) };
		return placeTickets(bank, world, 'k', 0, rollFor).monsters;
	};
	const placed = run();
	assert.deepEqual(placed, run(), 'deterministic');
	const standing = placed.filter((t) => t.x !== undefined);
	assert.ok(standing.length >= 3, 'monsters found tiles');
	const seen = new Set<string>();
	for (const t of standing) {
		const type = monsterTypeOf(t);
		const tileBiome = [...MONSTER_CATALOG].find((m) => m.id === type)!.biomes[0];
		assert.ok(['hills', 'coast', 'lake'].includes(tileBiome), `${type} is one of the new rosters here: the land has no other biome`);
		assert.ok(canSpawnOn(type, t.x!, t.y!, getTile(world, t.x!, t.y!)!, 1), `${type} on ${t.x},${t.y}`);
		assert.ok(!seen.has(`${t.x},${t.y}`), 'one monster per tile');
		seen.add(`${t.x},${t.y}`);
		const { min, max } = spawnLevelRange(type, 1);
		assert.ok(
			t.spawnLevel! >= min && t.spawnLevel! <= max + Math.floor(castleDistance({ x: t.x!, y: t.y! }) / COMBAT.spawn.dangerStep),
			`${type} level ${t.spawnLevel}`,
		);
	}
});

test('a boss of a new biome appears only on a tile of its biome 8 or more tiles from the castle, and never before such a tile is owned', () => {
	const near = land([['hills', 3, 0]]);
	assert.equal(placeTickets({ ...emptyBank(0), monsters: [ticket(1, 'boss')] }, near, 'k', 0, rollFor).monsters[0].x, undefined, 'no boss tile yet: it waits');
	const far = land([
		['hills', 3, 0],
		['hills', 8, 0],
		['lake', 0, 9],
	]);
	const boss = placeTickets({ ...emptyBank(0), monsters: [ticket(1, 'boss')] }, far, 'k', 0, rollFor).monsters[0];
	assert.ok(boss.x !== undefined, 'it found a tile');
	assert.ok(['bossHillGiant', 'bossLakeHydra'].includes(monsterTypeOf(boss)));
	assert.ok(castleDistance({ x: boss.x!, y: boss.y! }) >= BOSS_MIN_DISTANCE);
});

test('old saves: a monster ticket that is already on the map keeps its tile and type when the new rosters join, and a ticket with no type is still the plains fallback', () => {
	const world = land([
		['plains', 2, 0],
		['hills', 3, 0],
		['coast', 0, 4],
	]);
	const old: MonsterTicket = { n: 1, at: 0, kind: 'normal', lucky: false, type: 'thistleBoar', x: CASTLE_X + 2, y: CASTLE_Y, spawnLevel: 3 };
	const bank = { ...emptyBank(0), monsters: [old, ticket(2), ticket(3)] };
	const after = placeTickets(bank, world, 'k', 0, rollFor).monsters;
	assert.deepEqual(after[0], old, 'the placed monster is not moved');
	assert.equal(monsterTypeOf({ kind: 'normal' }), 'thistleBoar');
	assert.equal(monsterTypeOf({ kind: 'normal', type: 'notAMonster' as MonsterType }), 'thistleBoar');
	assert.equal(monsterTypeOf({ kind: 'boss' }), 'bossGreatAuroch');
});

test('a monster never appears before its biome can exist: no home monster is gated by rebirth, and a rebirth biome has no monster until it gets a roster', () => {
	for (const type of newTypes) {
		const biome = MONSTERS[type].spawn.biomes[0];
		assert.equal(BIOME_RULES.unlockAfterRebirths[biome], undefined, `${biome} is open from the first purchase of a run`);
		assert.equal(BIOME_RULES.unlockAfterPurchases[biome], undefined, biome);
		assert.equal(MONSTERS[type].spawn.minRebirths, undefined, type);
	}
	// every monster that exists waits at least as long as its biome (a future jungle monster cannot slip in before rebirth 1)
	for (const [type, def] of Object.entries(MONSTERS)) {
		const biome = def.spawn.biomes[0];
		assert.ok((def.spawn.minRebirths ?? 0) >= (BIOME_RULES.unlockAfterRebirths[biome] ?? 0), `${type} (${biome})`);
	}
});

test('the server fights the new monsters the same however the requests are cut: one long request equals many short ones', () => {
	for (const type of newTypes) {
		const { min } = spawnLevelRange(type, 1);
		const s = simSetup({ equipment: STRONG_KIT, monsters: [{ type, level: min }], seed: `roster-${type}` });
		const first = runCombat(s.ledger, s.env(s.start)).ledger;
		let many = first;
		for (let t = 1; t <= 30; t++) many = runCombat(many, s.env(s.start + t)).ledger;
		const one = runCombat(first, s.env(s.start + 30)).ledger;
		assert.equal(one.combat!.eventNo, many.combat!.eventNo, type);
		assert.equal(Math.round(one.combat!.hp), Math.round(many.combat!.hp), type);
	}
});

// Fight balance of the new rosters (the numbers of docs/generated/monster-ladder.md: a level 30 hero with 25 points spent and auto-use on, gear worn at the monster's item level).
const HERO = spentCharacter({ strength: 12, vitality: 8, dexterity: 5 });
const winRate = (equipment: Equipment, type: MonsterType, level: number) =>
	simulateMany({ equipment: atItemLevel(equipment, level), monster: { type, level }, character: HERO, level: 30, autoUse: true }, 12, `roster-${type}-${level}`)
		.winRate;

test('the easy coast and the hills start within the starter kit, the lake does not (it starts where the swamp does)', () => {
	for (const type of ['wreckCrab', 'netGull', 'drownedSailor'] as const) assert.equal(winRate(STARTER_EQUIPMENT, type, spawnLevelRange(type, 1).min), 1, type);
	for (const type of ['graniteRam', 'caveGoblinMiner', 'boulderBeetle'] as const)
		assert.ok(winRate(STARTER_EQUIPMENT, type, spawnLevelRange(type, 1).min) >= 0.9, type);
	for (const type of ['mossSnapper', 'reedNymph', 'pikeLurker'] as const) assert.equal(winRate(STARTER_EQUIPMENT, type, spawnLevelRange(type, 1).min), 0, type);
});

test('a grown monster of the new biomes outgrows a mid kit like the old ones do: the grade of its level wins at the bottom of the window, not at the top of the growth', () => {
	for (const type of ['graniteRam', 'wreckCrab', 'mossSnapper'] as const) {
		const top = MONSTERS[type].spawnWindow.cap + 10;
		assert.ok(winRate(kit('G3', 'mace'), type, spawnLevelRange(type, 1).min) >= 0.9, `${type}: G3 beats the bottom of the window`);
		assert.equal(winRate(kit('G3', 'mace'), type, top), 0, `${type}: but not the grown one`);
	}
});

test('the bosses climb: the Reef Leviathan asks for G2 (the grade below loses), the Hill Giant and the Lake Hydra for more than G3, the Hydra for the best gear there is', () => {
	assert.equal(winRate(kit('G1', 'mace'), 'bossReefLeviathan', 17), 0);
	assert.ok(winRate(kit('G2', 'mace'), 'bossReefLeviathan', 17) >= 0.9);
	assert.equal(winRate(kit('G3', 'mace'), 'bossHillGiant', 22), 0);
	assert.ok(winRate(fullSet('obsidian', 'obsidian_maul'), 'bossHillGiant', 22) >= 0.9);
	assert.equal(winRate(kit('G3', 'mace'), 'bossLakeHydra', 27), 0);
	assert.equal(winRate(fullSet('obsidian', 'obsidian_maul'), 'bossLakeHydra', 27), 0, 'the Hydra beats the plain G6 set');
	assert.ok(winRate(fullSet('obsidian', 'titan_maul'), 'bossLakeHydra', 27) >= 0.5, 'and gives way to the best gear');
});

// ------------------------------------------------------------------------------------------------ jungle (IDL-107)

const JUNGLE = (Object.keys(MONSTERS) as MonsterType[]).filter((type) => MONSTERS[type].spawn.biomes[0] === 'jungle');

test('the jungle roster: three monsters and a boss on jungle tiles, from the first rebirth and not before', () => {
	assert.equal(JUNGLE.length, 4);
	const world = land([
		['jungle', 3, 0],
		['jungle', 9, 0],
		['plains', 0, 3],
	]);
	for (const type of JUNGLE) assert.equal(MONSTERS[type].spawn.minRebirths, BIOME_RULES.unlockAfterRebirths.jungle, type);
	for (const type of JUNGLE.filter((t) => MONSTERS[t].grade === 'normal')) {
		assert.deepEqual(spawnTiles(type, world, new Set(), 0), [], `${type}: nothing before the first rebirth`);
		assert.deepEqual(
			spawnTiles(type, world, new Set(), 1).map(({ x, y }) => `${x - CASTLE_X},${y - CASTLE_Y}`),
			['3,0', '9,0'],
			type,
		);
	}
	// a ticket placed before the first rebirth never lands on the jungle, and from rebirth 1 it may
	const bank = { ...emptyBank(0), monsters: [1, 2, 3, 4].map((n) => ticket(n)) };
	for (const t of placeTickets(bank, world, 'k', 0, rollFor).monsters) if (t.x !== undefined) assert.ok(!JUNGLE.includes(monsterTypeOf(t)));
	const later = placeTickets(bank, world, 'k', 1, rollFor)
		.monsters.filter((t) => t.x !== undefined)
		.map((t) => monsterTypeOf(t));
	assert.ok(later.length > 0);
	const boss = placeTickets({ ...emptyBank(0), monsters: [ticket(1, 'boss')] }, world, 'k', 1, rollFor).monsters[0];
	assert.equal(monsterTypeOf(boss), 'bossHardwoodColossus');
	assert.equal(
		placeTickets({ ...emptyBank(0), monsters: [ticket(1, 'boss')] }, world, 'k', 0, rollFor).monsters[0].x,
		undefined,
		'no jungle boss at rebirth 0',
	);
});

test('the jungle fights the same however the requests are cut, and sits above the tundra: harder window, tougher boss, longer clock', () => {
	for (const type of JUNGLE) {
		const s = simSetup({ equipment: STRONG_KIT, monsters: [{ type, level: spawnLevelRange(type, 1).min }], seed: `jungle-${type}` });
		const first = runCombat(s.ledger, s.env(s.start)).ledger;
		let many = first;
		for (let t = 1; t <= 30; t++) many = runCombat(many, s.env(s.start + t)).ledger;
		const one = runCombat(first, s.env(s.start + 30)).ledger;
		assert.equal(one.combat!.eventNo, many.combat!.eventNo, type);
		assert.equal(Math.round(one.combat!.hp), Math.round(many.combat!.hp), type);
	}
	assert.ok(MONSTERS.skullVine.spawnWindow.base > MONSTERS.frostHare.spawnWindow.base);
	assert.ok(MONSTERS.bossHardwoodColossus.hp > MONSTERS.bossWinterWyrm.hp && MONSTERS.bossHardwoodColossus.timeLimitSec > MONSTERS.bossWinterWyrm.timeLimitSec);
	assert.equal(winRate(STARTER_EQUIPMENT, 'eyeHorror', 14), 0, 'the starter kit is not enough for a rebirth biome');
});
