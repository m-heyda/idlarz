import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { api, freshGame, growTo, rawSnapshot, store } from '../helpers';
import { BIOME_RULES } from '../../src/config/biomeRules';
import { BIOME_COLORS, HIGHLIGHT_COLORS } from '../../src/config/biomePalette';
import { BIOMES, REBIRTH_BIOME_OUTPUT } from '../../src/config/biomes';
import { BIOME_STAGE, isLiveBiome } from '../../src/config/biomeStage';
import { BIOME_YIELD } from '../../src/config/economy';
import { MONSTERS } from '../../src/config/combatConfig';
import { canSpawnOn } from '../../src/lib/monsters';
import { pickPersisted, sanitizeSave } from '../../src/lib/sanitizeSave';
import { BIOME_CODES, decodeSave, encodeSave } from '../../src/lib/saveFormat';
import { SELECTABLE_BIOMES, biomeVerdicts, rollBiome } from '../../src/utils/biomeRules';
import { growWorld } from '../../src/utils/growWorld';
import { HASH_ID, RANK, ATLAS } from '../../src/utils/terrain';
import { REBIRTH_UNLOCK_NOTE, rebirthUnlockIntro } from '../../src/utils/game/rebirthUnlocks';
import { ownedEntries, patchTile } from '../../src/utils/world';
import { CASTLE_X, CASTLE_Y } from '../../src/config/castle';
import type { MonsterType } from '../../src/types/game';

// IDL-258: the five rebirth biomes are live, one per rebirth (jungle 1, fields 2, orchard 3, blight 4, battlefield 5).

const NEW_BIOMES = ['jungle', 'fields', 'orchard', 'blight', 'battlefield'];
const BASIC_RESOURCES = ['gold', 'wood', 'food', 'stone', 'coal']; // no hide, eggs, milk or T2 materials
const needs = (b: string) => BIOME_RULES.unlockAfterRebirths[b] ?? 0;

test('the unlock table: one biome per rebirth, 1 to 5, and all five are live', () => {
	assert.deepEqual(BIOME_RULES.unlockAfterRebirths, { jungle: 1, fields: 2, orchard: 3, blight: 4, battlefield: 5 });
	assert.deepEqual(BIOME_STAGE, {}, 'no biome is dev-only any more');
	for (const b of NEW_BIOMES) {
		assert.ok(isLiveBiome(b), b);
		assert.ok(SELECTABLE_BIOMES.includes(b as never), `${b} can be rolled once unlocked`);
	}
});

test('a biome is never rolled (or even allowed) before its rebirth', () => {
	for (let rebirths = 0; rebirths <= 6; rebirths++) {
		const seen = new Set<string>();
		for (let seed = 1; seed <= 12; seed++) for (const e of ownedEntries(growWorld(220, seed, 'nearest', rebirths))) seen.add(e.tile.biome);
		for (const b of NEW_BIOMES) {
			if (needs(b) > rebirths) assert.ok(!seen.has(b), `${b} appeared at rebirth ${rebirths}`);
			else assert.ok(seen.has(b), `${b} is reachable at rebirth ${rebirths}`);
		}
	}
});

test('rolls without the rebirth count behave like rebirth 0 (the default can never leak a gated biome)', () => {
	const world = growWorld(40, 3);
	for (let i = 0; i < 300; i++) assert.ok(!NEW_BIOMES.includes(rollBiome(world, CASTLE_X + 12, CASTLE_Y, 40, Math.random)), 'default rebirths = 0');
	const verdicts = biomeVerdicts(world, CASTLE_X + 12, CASTLE_Y, 40);
	for (const b of NEW_BIOMES) assert.equal(verdicts.find((v) => v.biome === b)!.allowed, false);
});

test('the verdict names the rebirth that unlocks a biome, and a neighbour cannot pull a locked biome in', () => {
	const world = growWorld(30, 4);
	const at = (rebirths: number, biome: string) => biomeVerdicts(world, CASTLE_X + 10, CASTLE_Y, 30, rebirths).find((v) => v.biome === biome)!;
	assert.equal(at(1, 'fields').allowed, false);
	assert.equal(at(1, 'fields').reason, 'Unlocks after rebirth 2');
	assert.equal(at(2, 'fields').allowed, true);
	assert.equal(at(4, 'battlefield').reason, 'Unlocks after rebirth 5');
	assert.equal(at(5, 'battlefield').reason === undefined || at(5, 'battlefield').allowed === false, true);
});

test('the buy action rolls with the run\'s rebirth count: rebirth 0 never grows a rebirth biome, rebirth 5 can', () => {
	const seenAt = (rebirths: number) => {
		freshGame();
		store.setState((s) => ({ prestige: { ...s.prestige, rebirths } }));
		growTo(260);
		return new Set(ownedEntries(api().tiles).map((e) => e.tile.biome as string));
	};
	const first = seenAt(0);
	for (const b of NEW_BIOMES) assert.ok(!first.has(b), `${b} in a first run`);
	const late = seenAt(5);
	assert.ok(NEW_BIOMES.some((b) => late.has(b)), 'a rebirth 5 run grows at least one of the new biomes');
});

test('conflicts: blight keeps off lake, coast and orchard; battlefield off swamp; jungle off tundra (never touching in 8 directions)', () => {
	const pairs: [string, string][] = [
		['blight', 'lake'],
		['blight', 'coast'],
		['blight', 'orchard'],
		['battlefield', 'swamp'],
		['jungle', 'tundra'],
	];
	for (const pair of pairs) assert.ok(BIOME_RULES.conflicts.some(([a, b]) => (a === pair[0] && b === pair[1]) || (a === pair[1] && b === pair[0])), pair.join('-'));
	for (let seed = 1; seed <= 10; seed++) {
		const world = growWorld(300, seed, 'nearest', 6);
		const biomeAt = new Map(ownedEntries(world).map((e) => [`${e.x},${e.y}`, e.tile.biome as string]));
		for (const e of ownedEntries(world)) {
			for (let dx = -1; dx <= 1; dx++)
				for (let dy = -1; dy <= 1; dy++) {
					const other = biomeAt.get(`${e.x + dx},${e.y + dy}`);
					if (!other || (!dx && !dy)) continue;
					for (const [a, b] of pairs) assert.ok(!(e.tile.biome === a && other === b), `${a} touches ${b} (seed ${seed})`);
				}
		}
	}
});

test('output: existing resources only, a flat multiple x1.5 to x2 of the basic tile, rising with the rebirth', () => {
	// pinned: change these numbers on purpose, together with docs/plan and the pacing baseline
	assert.deepEqual(
		Object.fromEntries(NEW_BIOMES.map((b) => [b, REBIRTH_BIOME_OUTPUT[b].multiplier])),
		{ jungle: 1.5, fields: 1.6, orchard: 1.75, blight: 1.9, battlefield: 2 },
	);
	assert.deepEqual(BIOMES.jungle.resourceGeneration, { gold: 0.15, wood: 0.45 });
	assert.deepEqual(BIOMES.fields.resourceGeneration, { gold: 0.16, food: 0.48 });
	assert.deepEqual(BIOMES.orchard.resourceGeneration, { gold: 0.175, food: 0.35, wood: 0.175 });
	assert.deepEqual(BIOMES.blight.resourceGeneration, { gold: 0.19, coal: 0.665 });
	assert.deepEqual(BIOMES.battlefield.resourceGeneration, { stone: 0.6, wood: 0.4 });

	let last = 0;
	for (const b of NEW_BIOMES) {
		const { multiplier, base, rebirth } = REBIRTH_BIOME_OUTPUT[b];
		assert.equal(rebirth, needs(b), `${b}: the output table and the unlock rule name the same rebirth`);
		assert.ok(multiplier >= 1.5 && multiplier <= 2 && multiplier > last, `${b}: ${multiplier}`);
		last = multiplier;
		const sum = (o: Record<string, number | undefined>) => Object.values(o).reduce((s: number, v) => s + (v ?? 0), 0);
		assert.ok(Math.abs(sum(BIOMES[b].resourceGeneration as Record<string, number>) / sum(base) - multiplier) < 1e-3, `${b}: output / base = multiplier`);
		for (const resource of Object.keys(BIOMES[b].resourceGeneration)) assert.ok(BASIC_RESOURCES.includes(resource), `${b} makes ${resource}`);
	}
});

test('a save that holds the new biomes round-trips (letters, sanitizeSave, encode/decode)', () => {
	freshGame();
	growTo(20);
	let tiles = api().tiles;
	// connected land: turn five owned tiles (not the castle) into the five new biomes
	const spots = ownedEntries(tiles).filter((e) => e.tile.biome !== 'castle').slice(0, NEW_BIOMES.length);
	NEW_BIOMES.forEach((b, i) => (tiles = patchTile(tiles, spots[i].x, spots[i].y, { biome: b as never })));
	store.setState({ tiles });
	for (const b of NEW_BIOMES) assert.ok(BIOME_CODES[b], `${b} has a save letter`);
	assert.deepEqual(
		NEW_BIOMES.map((b) => BIOME_CODES[b]),
		['j', 'd', 'o', 'b', 'w'],
		'the letters are frozen',
	);
	const decoded = decodeSave(encodeSave(pickPersisted(api())));
	assert.ok(decoded.ok);
	if (!decoded.ok) return;
	const biomes = new Set(ownedEntries(decoded.state.tiles).map((e) => e.tile.biome));
	for (const b of NEW_BIOMES) assert.ok(biomes.has(b as never), `${b} survives the round trip`);
	const result = sanitizeSave(rawSnapshot());
	assert.equal(result.ok, true, 'sanitizeSave accepts the new biomes');
});

test('art: every new biome has colours, a ground texture, shapes, props, decor, a draw rank and a hash id', () => {
	const dir = resolve(__dirname, '../../public/pixel/terrain');
	for (const b of NEW_BIOMES) {
		assert.ok(BIOME_COLORS[b], `${b}: minimap / fallback colour`);
		assert.ok(HIGHLIGHT_COLORS[b], `${b}: highlight colour`);
		assert.ok(ATLAS.styles.includes(b), `${b}: in the atlas styles`);
		assert.ok(existsSync(resolve(dir, `tex_${b}.png`)), `${b}: tex_${b}.png`);
		assert.ok(existsSync(resolve(dir, `shapes_${b}.png`)), `${b}: shapes_${b}.png`);
		assert.ok(ATLAS.props[b] && ATLAS.props[b].opts.length > 0, `${b}: props`);
		assert.ok(ATLAS.decor?.[b], `${b}: decor`);
		assert.ok((RANK as readonly string[]).includes(b), `${b}: draw rank`);
		assert.ok(typeof HASH_ID[b] === 'number', `${b}: hash id`);
		for (const sprite of ATLAS.props[b].opts) assert.ok(ATLAS.sprites[sprite[0]], `${b}: sprite ${sprite[0]} is in the atlas`);
	}
});

test('monsters: nothing spawns on a new-biome tile, whatever the distance, castle level or rebirths', () => {
	for (const type of Object.keys(MONSTERS) as MonsterType[])
		for (const biome of NEW_BIOMES)
			for (const distance of [2, 5, 9, 20, 40]) assert.equal(canSpawnOn(type, CASTLE_X + distance, CASTLE_Y, { biome }, 1, 9), false, `${type} on ${biome} at ${distance}`);
});

test('the "what you unlocked" screen: one biome per rebirth 1-5, with its output, multiplier and the later-update note; nothing from the sixth', () => {
	const expected: Record<number, { biome: string; label: string; multiplier: number; outputs: [string, number][] }> = {
		1: { biome: 'jungle', label: 'Jungle', multiplier: 1.5, outputs: [['gold', 0.195], ['wood', 0.585]] },
		2: { biome: 'fields', label: 'Fields', multiplier: 1.6, outputs: [['gold', 0.208], ['food', 0.624]] },
		3: { biome: 'orchard', label: 'Blossom Orchard', multiplier: 1.75, outputs: [['gold', 0.227], ['food', 0.455], ['wood', 0.227]] },
		4: { biome: 'blight', label: 'Blight', multiplier: 1.9, outputs: [['gold', 0.247], ['coal', 0.865]] },
		5: { biome: 'battlefield', label: 'Battlefield', multiplier: 2, outputs: [['stone', 0.78], ['wood', 0.52]] },
	};
	assert.equal(BIOME_YIELD.scale, 1.3, 'the screen shows the real per-second output (config x BIOME_YIELD.scale); update the numbers above if the scale moves');
	for (const [rebirths, want] of Object.entries(expected)) {
		const intro = rebirthUnlockIntro(Number(rebirths))!;
		assert.ok(intro, `rebirth ${rebirths}`);
		assert.equal(intro.biome, want.biome);
		assert.equal(intro.label, want.label);
		assert.equal(intro.multiplier, want.multiplier);
		assert.equal(intro.rebirths, Number(rebirths));
		assert.deepEqual(
			intro.outputs.map((o) => [o.resource, o.perSecond]),
			want.outputs,
		);
		assert.equal(intro.note, REBIRTH_UNLOCK_NOTE);
		assert.match(intro.note, /monsters and buildings/i);
	}
	assert.equal(rebirthUnlockIntro(0), null);
	assert.equal(rebirthUnlockIntro(6), null);
	assert.equal(rebirthUnlockIntro(40), null);
});
