import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo } from '../helpers';
import { STARTER_EQUIPMENT } from '../../src/config/itemCatalog';
import { MONSTERS } from '../../src/config/combatConfig';
import { atItemLevel, simSetup, spentCharacter } from '../../src/lib/fightSim';
import { STRONG_KIT } from '../builders';
import { castleDistance } from '../../src/lib/distance';
import { dangerBonus, levelAtAge, maxLevelOf, rollSpawnLevel, spawnLevelRange } from '../../src/lib/monsters';
import { placeTickets } from '../../src/lib/offline/placement';
import { playerProfile } from '../../src/lib/offline/profile';
import { sealedRng } from '../../src/lib/offline/seal';
import {
	HOPELESS_WEIGHT,
	TRIVIAL_WEIGHT,
	WORTH_FIGHTING,
	growthCap,
	pickWeighted,
	powerKey,
	spawnLevelCap,
	spawnWeight,
	typeWeights,
	winChanceAt,
} from '../../src/lib/offline/spawnWeights';
import { syntheticWorld } from '../../src/utils/worldGen';
import { mulberry32 } from '../../src/lib/rng';
import { emptyBank } from '../../src/lib/offline/tickets';
import type { PlayerProfile } from '../../src/lib/offline/fightTypes';
import type { MonsterType } from '../../src/types/game';

// Early-game spawns (IDL-215): the type of a new monster is weighted by how beatable it is for the player, and its level is capped.

const profileOf = (equipment: Parameters<typeof simSetup>[0]['equipment'], level: number, character = spentCharacter({})): PlayerProfile =>
	playerProfile(simSetup({ equipment, character, level, monsters: [], seed: 'w' }).stored.core as Record<string, unknown>);
const rookie = () => profileOf(STARTER_EQUIPMENT, 1);
const veteran = () => profileOf(atItemLevel(STRONG_KIT, 30), 30, spentCharacter({ strength: 12, vitality: 8, dexterity: 5 }));

/** A hero nothing on the map can hurt: every type looks the same to the weights. */
const invincible = (): PlayerProfile => ({ ...veteran(), hit: 1e6, maxHp: 1e6, armor: 1e5 });

const normalTypes = (Object.keys(MONSTERS) as MonsterType[]).filter((type) => MONSTERS[type].grade !== 'boss');
const forestType = normalTypes.find((type) => (MONSTERS[type].spawn.biomes as readonly string[]).includes('forest'))!;

const rollFor = (kind: string, n: number) => sealedRng('weights-secret-0123456789', 'u1', 1, kind, n);
/** The biome of each bought tile is drawn from Math.random, so the land is built from a fixed seed: a random land made this test flaky. */
const world = () => {
	const random = Math.random;
	Math.random = mulberry32(20261109);
	try {
		freshGame();
		growTo(60);
	} finally {
		Math.random = random;
	}
	return api().tiles;
};
/** Ticket `n` placed alone on the land (every ticket is placed on its own, so the first ones do not use up the tiles of the later ones). */
const placeOne = (tiles: ReturnType<typeof world>, n: number, hero?: PlayerProfile) => {
	const bank = { ...emptyBank(0), monsters: [{ n, at: 0, kind: 'normal' as const, lucky: false }] };
	return placeTickets(bank, tiles, 'k', 0, rollFor, hero).monsters[0];
};

test('the weight is full for a fight worth taking, fades to the floor for a hopeless one and is never zero', () => {
	assert.equal(spawnWeight(WORTH_FIGHTING.from), 1);
	assert.equal(spawnWeight(0.7), 1);
	assert.equal(spawnWeight(WORTH_FIGHTING.to), 1);
	assert.equal(spawnWeight(0), HOPELESS_WEIGHT);
	assert.equal(spawnWeight(0.05), HOPELESS_WEIGHT);
	assert.equal(spawnWeight(Number.NaN), HOPELESS_WEIGHT);
	assert.equal(spawnWeight(1), TRIVIAL_WEIGHT);
	assert.ok(spawnWeight(0.2) > HOPELESS_WEIGHT && spawnWeight(0.2) < 1);
	assert.ok(spawnWeight(0.97) > TRIVIAL_WEIGHT && spawnWeight(0.97) < 1);
	for (let c = 0; c <= 1; c += 0.01) assert.ok(spawnWeight(c) >= HOPELESS_WEIGHT && spawnWeight(c) <= 1);
});

test('pickWeighted follows the weights, is the plain uniform pick when they are equal, and is deterministic', () => {
	for (const roll of [0, 0.2, 0.49, 0.99]) assert.equal(pickWeighted([0.3, 0.3, 0.3, 0.3], roll), Math.floor(roll * 4));
	assert.equal(pickWeighted([1, 0.1], 0.5), 0);
	assert.equal(pickWeighted([0.1, 1], 0.5), 1);
	assert.equal(pickWeighted([1, 0.1, 1], 0.999999), 2);
	const counts = [0, 0, 0];
	for (let i = 0; i < 1000; i++) counts[pickWeighted([1, 0.1, 0.9], (i + 0.5) / 1000)]++;
	assert.deepEqual(counts, [500, 50, 450]);
	assert.equal(pickWeighted([1, 0.1, 0.9], 0.3), pickWeighted([1, 0.1, 0.9], 0.3));
});

test('a rookie finds some types worth fighting and some hopeless; an invincible hero finds nothing that stands out', () => {
	const weak = typeWeights(rookie(), normalTypes, 1);
	const strong = typeWeights(invincible(), normalTypes, 1);
	assert.ok(weak.some((w) => w >= TRIVIAL_WEIGHT) && weak.some((w) => w === HOPELESS_WEIGHT));
	assert.ok(
		strong.every((w) => w >= TRIVIAL_WEIGHT),
		'nothing is out of reach',
	);
	assert.equal(new Set(strong).size, 1, 'so the pick stays uniform');
});

test('a spawn level cap pulls the roll down but never below the window', () => {
	const { min } = spawnLevelRange('thistleBoar', 1);
	for (let id = 1; id < 60; id++) {
		const plain = rollSpawnLevel('thistleBoar', 1, id, 0);
		assert.equal(rollSpawnLevel('thistleBoar', 1, id, 0, undefined), plain, 'no cap: the old roll');
		assert.equal(rollSpawnLevel('thistleBoar', 1, id, 0, 99), plain);
		assert.equal(rollSpawnLevel('thistleBoar', 1, id, 0, 2), Math.max(min, Math.min(plain, 2)));
		assert.equal(rollSpawnLevel('thistleBoar', 1, id, 0, 0), min, 'a cap below the window is the bottom of it');
	}
});

test('growth stops at the cap and the limit still holds', () => {
	const day = 24 * 3600;
	assert.equal(levelAtAge(3, day), 13);
	assert.equal(levelAtAge(3, day, {}, 2), 5);
	assert.equal(levelAtAge(3, day, {}, 0), 3);
	assert.equal(levelAtAge(3, day, {}, 99), 13, 'a cap above the limit changes nothing');
	assert.equal(maxLevelOf(3, {}, 2), 5);
});

test('the caps follow the hero: a rookie is capped on the forest, a veteran is not', () => {
	const bottom = spawnLevelRange(forestType, 1).min;
	assert.ok(spawnLevelCap(rookie(), forestType, 1) <= bottom, 'the whole forest window is out of reach');
	assert.equal(growthCap(rookie(), forestType, bottom), 0, 'and it does not grow either');
	assert.equal(spawnLevelCap(veteran(), forestType, 1), Infinity);
	assert.equal(growthCap(veteran(), forestType, bottom), undefined);
});

test('placement: the same hero gives the same map, a weak hero meets far more beatable monsters, a hero nothing can hurt changes nothing', () => {
	const tiles = world();
	const hero = rookie();
	assert.deepEqual(placeOne(tiles, 7, hero), placeOne(tiles, 7, hero));
	const share = (h?: PlayerProfile) => {
		const rats = Array.from({ length: 120 }, (_, i) => placeOne(tiles, i + 1, h));
		return rats.filter((t) => winChanceAt(hero, t.type!, t.spawnLevel!) > 0.5).length / rats.length;
	};
	const before = share();
	const after = share(hero);
	assert.ok(after > before + 0.2, `${before} -> ${after}`);
	const strong = invincible();
	for (let n = 1; n <= 20; n++) assert.deepEqual(placeOne(tiles, n, strong), placeOne(tiles, n), 'a strong player gets the map the old pick gave');
});

test('new gear is a different look at the land', () => {
	assert.notEqual(powerKey(rookie()), powerKey(veteran()));
	assert.equal(powerKey(rookie()), powerKey(rookie()));
});

test('IDL-222: bosses are weighted by win chance and level-capped like normal monsters', () => {
	const land = syntheticWorld(2500, 4);
	const bosses = (Object.keys(MONSTERS) as MonsterType[]).filter((type) => MONSTERS[type].grade === 'boss');
	const placeBoss = (n: number, hero?: PlayerProfile) =>
		placeTickets({ ...emptyBank(0), monsters: [{ n, at: 0, kind: 'boss' as const, lucky: false }] }, land, 'k', 0, rollFor, hero).monsters[0];
	const weak = rookie();
	const castle = 1;
	const weights = typeWeights(weak, bosses, castle);
	assert.ok(
		weights.every((w) => w === HOPELESS_WEIGHT),
		'a level 1 starter kit has no chance against any boss: the lowest weight for all',
	);
	let capped = 0;
	for (let n = 1; n <= 40; n++) {
		const boss = placeBoss(n, weak);
		const { min, max } = spawnLevelRange(boss.type!, castle);
		const bonus = dangerBonus(castleDistance({ x: boss.x!, y: boss.y! }));
		assert.ok(boss.spawnLevel! >= min && boss.spawnLevel! <= max + bonus);
		assert.ok(
			boss.spawnLevel! <= Math.max(min + bonus, spawnLevelCap(weak, boss.type!, castle)),
			'capped at what the hero beats, but never below the window bottom (plus the danger bonus of a far tile)',
		);
		if (boss.growCap !== undefined) capped++;
		assert.equal(boss.growCap, growthCap(weak, boss.type!, boss.spawnLevel!));
	}
	assert.ok(capped > 0, 'a hero who cannot beat a boss does not meet one that grows without limit');
	const free = placeBoss(1);
	assert.equal(free.growCap, undefined, 'without a profile nothing is capped');
});
