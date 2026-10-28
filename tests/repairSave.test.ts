import test from 'node:test';
import assert from 'node:assert/strict';
import { api, growTo, tileAt } from './helpers';
import { ownedCount } from '../src/utils/world';
import { pickPersisted } from '../src/lib/sanitizeSave';
import { SAVE_SCHEMA, decodeSave, packBody, sealWire, type SaveBody } from '../src/lib/saveFormat';
import { createSaveStorage, type KeyValue } from '../src/lib/saveStorage';
import { FARM_UPGRADES, INITIAL_CHARACTER_STATS, MERCHANT_UPGRADES, CASTLE_UPGRADE } from '../src/config/gameConfig';
import { maxHp, maxMana } from '../src/lib/combat';
import { totalStatPoints } from '../src/utils/gameUtils';

// A save is kept for weeks while the rules move under it (curves, maxima, content). `decodeSave` is strict, because the server and imports
// must refuse a forged save. The game's own copies (browser storage, the account's save) are read leniently: whatever the rules no longer
// allow is adjusted and the rest of the game is kept, instead of locking the player out. These tests change a good save the way a rule
// change would and check both sides.

const KNOWN_FARM_UPGRADE = Object.keys(FARM_UPGRADES)[0];
const KNOWN_MERCHANT_UPGRADE = Object.keys(MERCHANT_UPGRADES)[0];

/** The wire body of a played game, as the server stores it. */
const playedBody = (): SaveBody => {
	api().resetGame();
	growTo(16);
	api().tick(60_000);
	return JSON.parse(JSON.stringify(packBody(pickPersisted(api()))));
};

const textOf = (body: SaveBody): string => sealWire({ v: SAVE_SCHEMA, t: 1_700_000_000_000, s: body });

/** Strict refuses the changed body, lenient loads it. */
const repaired = (mutate: (body: any) => void) => { // eslint-disable-line @typescript-eslint/no-explicit-any
	const body = playedBody();
	mutate(body);
	const text = textOf(body);
	const strict = decodeSave(text);
	assert.equal(strict.ok, false, 'the strict check must still refuse it');
	const lenient = decodeSave(text, { lenient: true });
	assert.equal(lenient.ok, true, lenient.ok ? '' : lenient.reason);
	if (!lenient.ok) throw new Error('unreachable');
	assert.ok(lenient.repaired && lenient.repaired.length > 0, 'a repair is reported');
	return lenient.state;
};

test('a good save is read the same by both and reports no repair', () => {
	const text = textOf(playedBody());
	const strict = decodeSave(text);
	const lenient = decodeSave(text, { lenient: true });
	assert.equal(strict.ok && lenient.ok, true);
	if (strict.ok && lenient.ok) {
		assert.equal(lenient.repaired, undefined);
		assert.deepEqual(lenient.state, strict.state);
	}
});

test('HP or mana above the maximum (the maxima moved) become full instead of locking the player out', () => {
	const state = repaired((b) => {
		b.playerHp = 1e6;
		b.playerMp = 1e6;
	});
	assert.equal(state.playerHp, maxHp(state.characterStats, state.equipment));
	assert.equal(state.playerMp, maxMana(state.characterStats, state.equipment));
});

test('more attribute points than the level has earned (the curve moved) are refunded', () => {
	const state = repaired((b) => {
		b.characterStats.strength += 500;
	});
	assert.equal(state.characterStats.strength, INITIAL_CHARACTER_STATS.strength);
	assert.equal(state.characterStats.availablePoints, totalStatPoints(state.level.level));
});

test('far fewer attribute points than the level has earned: the missing ones are left to spend', () => {
	const state = repaired((b) => {
		b.characterStats.availablePoints = 0;
		b.characterStats.strength = INITIAL_CHARACTER_STATS.strength;
		b.characterStats.dexterity = INITIAL_CHARACTER_STATS.dexterity;
		b.characterStats.intelligence = INITIAL_CHARACTER_STATS.intelligence;
		b.characterStats.vitality = INITIAL_CHARACTER_STATS.vitality;
		b.characterStats.charisma = INITIAL_CHARACTER_STATS.charisma;
		b.resources.xp = b.resources.xp * 50;
	});
	assert.equal(state.characterStats.availablePoints, totalStatPoints(state.level.level));
});

test('XP that no longer pays for the land owned (the XP curve moved) is raised to what the land needs; the land stays', () => {
	const before = playedBody();
	const state = repaired((b) => {
		b.resources.xp = 0;
	});
	assert.ok(state.resources.xp > 0);
	assert.equal(state.freeTiles, (before as { freeTiles: number }).freeTiles);
});

test('farm animals, farm upgrades and merchant upgrades that no longer exist are dropped; the ones that do are kept', () => {
	const state = repaired((b) => {
		b.farmLevels = { ...b.farmLevels, dodo: 3 };
		b.farmUpgrades = { [KNOWN_FARM_UPGRADE]: 1, removed_upgrade: 2 };
		b.merchantUpgrades = { [KNOWN_MERCHANT_UPGRADE]: 1, removed_perk: 4 };
	});
	assert.equal('dodo' in state.farmLevels, false);
	assert.deepEqual(state.farmUpgrades, { [KNOWN_FARM_UPGRADE]: 1 });
	assert.deepEqual(state.merchantUpgrades, { [KNOWN_MERCHANT_UPGRADE]: 1 });
});

test('a building that was removed from the game leaves its tile in place', () => {
	let at: [number, number] = [0, 0];
	let tilesBefore = 0;
	const state = repaired((b) => {
		tilesBefore = b.land.reduce((n: number, row: [number, number, string]) => n + row[2].length, 0);
		// the first land tile that is not the castle gets a building that does not exist
		const row = b.land.find((r: [number, number, string]) => /[^K]/.test(r[2]));
		const x = row[1] + row[2].search(/[^K]/);
		at = [x, row[0]];
		b.extra = b.extra.filter((e: [number, number, SaveBody]) => !(e[0] === x && e[1] === row[0]));
		b.extra.push([x, row[0], { building: 'removed_building' }]);
	});
	assert.equal(ownedCount(state.tiles), tilesBefore, 'no land is lost');
	assert.equal(tileAt(state.tiles, at[0], at[1])?.building, undefined);
	assert.equal(tileAt(state.tiles, at[0], at[1])?.isOwned, true);
});

test('a bag or gear item that no longer exists is dropped, the rest of the bag and gear stays', () => {
	const state = repaired((b) => {
		b.bag[0] = { item: { base: 'removed_sword', level: 3, rarity: 'common', quality: 50, affixes: [] } };
		b.equipment.removed_slot = { base: 'removed_helm', level: 1, rarity: 'common', quality: 50, affixes: [] };
	});
	assert.equal(state.bag[0], null);
	assert.equal('removed_slot' in state.equipment, false);
	assert.ok(Object.keys(state.equipment).length > 0, 'the worn gear is kept');
});

test('a bag whose length no longer matches its size is padded', () => {
	const state = repaired((b) => {
		b.bag = b.bag.slice(0, 10);
	});
	assert.ok(state.bag.length > 10);
});

test('Embers that no longer add up (the shop prices moved) are recomputed from what was earned', () => {
	const state = repaired((b) => {
		b.prestige = { rebirths: 2, legacyEarned: 10, legacyPoints: 3, upgrades: {} };
	});
	assert.equal(state.prestige.legacyPoints, 10);
	assert.equal(state.prestige.legacyEarned, 10);
});

test('a castle upgrade timer longer than the upgrade takes is cut to the longest it can be', () => {
	const state = repaired((b) => {
		const castleRow = b.extra.find((e: [number, number, SaveBody]) => e[2].level !== undefined);
		assert.ok(castleRow, 'the played game has a castle with a level');
		b.castleUpgrade = { toLevel: (castleRow[2].level as number) + 1, remainingSec: 1e9 };
	});
	assert.ok(state.castleUpgrade === null || state.castleUpgrade.remainingSec < 1e9);
	assert.ok(CASTLE_UPGRADE.maxLevel > 1);
});

test('a merchant shelf with an item that no longer exists is emptied', () => {
	const state = repaired((b) => {
		b.merchantStock = { at: 0, offers: [{ base: 'removed_cloak', level: 1, rarity: 'common', quality: 50, affixes: [] }] };
	});
	assert.equal(state.merchantStock, null);
});

test('values outside their range are clamped (negative or huge resources, gems, click level, play time)', () => {
	const state = repaired((b) => {
		b.resources.gold = -5;
		b.gems = -1;
		b.clickLevel = 999;
		b.playSeconds = -10;
	});
	assert.equal(state.resources.gold, 0);
	assert.equal(state.gems, 0);
	assert.equal(state.playSeconds, 0);
});

test('a damaged map is still refused when lenient: only rules are adjusted, never the land', () => {
	const body = playedBody() as { land: [number, number, string][]; extra: unknown[] };
	body.land = [...body.land, body.land[0]]; // two tiles on the same spot
	const text = textOf(body as SaveBody);
	const result = decodeSave(text, { lenient: true });
	assert.equal(result.ok, false);
});

test('garbage that is not a save is refused when lenient', () => {
	assert.equal(decodeSave('IDLZ2.nonsense.00000000', { lenient: true }).ok, false);
	assert.equal(decodeSave('hello', { lenient: true }).ok, false);
});

// ------------------------------------------------------------------------------------------------ browser storage

const fakeKv = (initial: Record<string, string> = {}) => {
	const data = new Map(Object.entries(initial));
	const kv: KeyValue = { get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v), remove: (k) => void data.delete(k) };
	return { kv, data };
};

test('the browser storage loads a save the rules moved on from, keeps the original text aside and says what happened', async () => {
	const body = playedBody() as { playerHp?: number };
	body.playerHp = 1e6;
	const original = textOf(body as SaveBody);
	const { kv, data } = fakeKv({ 'idlarz.save': original });
	const saves = createSaveStorage({ kv });
	assert.equal(saves.peek().kind, 'ok');
	const loaded = await saves.storage.getItem('x');
	assert.ok(loaded, 'the game loads');
	assert.equal(data.get('idlarz.save.damaged'), original, 'the original text is kept');
	assert.match((await saves.info()).loadProblem ?? '', /adjusted/);
});

test('installing the account save adjusts it the same way', () => {
	const body = playedBody() as { playerHp?: number };
	body.playerHp = 1e6;
	const { kv, data } = fakeKv();
	const saves = createSaveStorage({ kv });
	assert.equal(saves.install(textOf(body as SaveBody)), true);
	assert.equal(decodeSave(data.get('idlarz.save') ?? '').ok, true, 'what is stored now passes the strict check');
});

test('an import is still strict', async () => {
	const body = playedBody() as { playerHp?: number };
	body.playerHp = 1e6;
	const saves = createSaveStorage({ kv: fakeKv().kv });
	const result = await saves.parse(textOf(body as SaveBody));
	assert.equal(result.ok, false);
});
