import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { api, freshGame, gridCells, growTo, setResources, store } from './helpers';
import { SKILLS } from '../src/catalog/skills';
import { COMBAT } from '../src/config/combatConfig';
import { LIMITS } from '../src/config/limits';
import { emptyBag, gearOf } from '../src/lib/inventory';
import { plainItem, sellValueOf } from '../src/lib/itemInstance';
import { limitOf, LIMIT_BONUSES } from '../src/lib/limits';
import { generateMerchantStock } from '../src/lib/merchant';
import { spawnLevelRange } from '../src/lib/monsters';
import { receiveDrops } from '../src/lib/loot';
import { MERCHANT_RESOURCE_PRICES } from '../src/config/gameConfig';
import { globalMenuItems } from '../src/lib/globalMenu';
import { decodeSave, encodeSave, sealWire, packBody } from '../src/lib/saveFormat';
import { pickPersisted } from '../src/lib/sanitizeSave';
import { SELL_BONUSES, sellMultiplier, sellPayout } from '../src/utils/gameUtils';
import type { Monster } from '../src/types/game';

// ---- schema 4 -> 5: monsters have a level ---------------------------------------------------------------------------------------

test('a schema 4 save with tiered monsters loads: a tier t rat becomes level 2t-1, the King a level 15 boss, growth starts again', () => {
	const text = readFileSync(new URL('./fixtures/saves/v4-monsters.sav', import.meta.url), 'utf8').trim();
	const r = decodeSave(text);
	assert.equal(r.ok, true, r.ok ? '' : r.reason);
	if (!r.ok) return;
	assert.equal(r.schema, 4);
	const byId = new Map(r.state.monsters.map((mon) => [mon.id, mon]));
	assert.deepEqual([byId.get(1)!.level, byId.get(1)!.spawnLevel, byId.get(1)!.ageSec], [1, 1, 0]);
	assert.deepEqual([byId.get(2)!.level, byId.get(2)!.spawnLevel, byId.get(2)!.ageSec], [5, 5, 0]);
	assert.equal(byId.get(3)!.type, 'ratKing');
	assert.deepEqual([byId.get(3)!.level, byId.get(3)!.spawnLevel], [15, 15]);
	assert.equal(r.state.bossSpawnTimer, 0);
	assert.ok(r.state.monsters.every((mon) => !('tier' in mon)));
});

test('monsters round-trip through a save with their level and spawn level', () => {
	freshGame();
	growTo(8);
	const spot = gridCells().find(({ t }) => t.isOwned && t.biome !== 'castle' && t.biome !== 'lake')!;
	store.setState({ monsters: [{ id: 1, type: 'rat', level: 6, spawnLevel: 4, x: spot.x, y: spot.y, ageSec: 3700 }], nextMonsterId: 2 });
	const result = decodeSave(encodeSave(pickPersisted(api())));
	assert.equal(result.ok, true, result.ok ? '' : result.reason);
	if (result.ok) assert.deepEqual(result.state.monsters, api().monsters);
});

test('a save with a monster level the age cannot have earned is refused', () => {
	freshGame();
	growTo(8);
	const spot = gridCells().find(({ t }) => t.isOwned && t.biome !== 'castle' && t.biome !== 'lake')!;
	const encode = (monster: Record<string, unknown>) => {
		store.setState({ monsters: [monster as unknown as Monster], nextMonsterId: 2 });
		return packBody(pickPersisted(api()));
	};
	const good = { id: 1, type: 'rat', level: 6, spawnLevel: 4, x: spot.x, y: spot.y, ageSec: 3700 };
	assert.equal(decodeSave(sealWire({ v: 5, t: 1, s: encode(good) })).ok, true);
	assert.equal(decodeSave(sealWire({ v: 5, t: 1, s: encode({ ...good, level: 9 }) })).ok, false, 'two growth steps of age cannot make level 9');
	assert.equal(decodeSave(sealWire({ v: 5, t: 1, s: encode({ ...good, level: 3 }) })).ok, false, 'below the spawn level');
	assert.equal(decodeSave(sealWire({ v: 5, t: 1, s: encode({ ...good, type: 'dragon' }) })).ok, false, 'an unknown kind');
	assert.equal(decodeSave(sealWire({ v: 5, t: 1, s: encode({ ...good, type: 'ratKing' }) })).ok, false, 'a King below his spawn window');
});

// ---- bosses spawn on their own timer ---------------------------------------------------------------------------------------------

test('a boss appears when the boss timer runs out: one at a time, at a level in the King window for the castle', () => {
	freshGame();
	growTo(12);
	assert.equal(api().monsters.some((mon) => mon.type === 'ratKing'), false);
	store.setState({ bossSpawnTimer: COMBAT.spawn.bossIntervalSec - 1 });
	api().tick(500);
	assert.equal(api().monsters.some((mon) => mon.type === 'ratKing'), false, 'not yet');
	api().tick(1000);
	const kings = api().monsters.filter((mon) => mon.type === 'ratKing');
	assert.equal(kings.length, 1);
	const range = spawnLevelRange('ratKing', 1);
	assert.ok(kings[0].level >= range.min && kings[0].level <= range.max, `level ${kings[0].level}`);
	assert.equal(kings[0].level, kings[0].spawnLevel);
	assert.equal(api().bossSpawnTimer, 0);
	store.setState({ bossSpawnTimer: COMBAT.spawn.bossIntervalSec });
	api().tick(1000);
	assert.equal(api().monsters.filter((mon) => mon.type === 'ratKing').length, 1, 'only one boss while one is on the map');
	assert.equal(api().bossSpawnTimer, 0, 'and the timer does not run meanwhile');
});

test('rats spawn on their timer at a level of the castle window and grow, but never turn into the King', () => {
	freshGame();
	growTo(12);
	store.setState({ monsterSpawnTimer: COMBAT.spawn.firstSec });
	api().tick(1000);
	const rat = api().monsters.find((mon) => mon.type === 'rat');
	assert.ok(rat);
	assert.ok(rat!.level >= 1 && rat!.level <= 3);
	store.setState({ monsters: [{ ...rat!, ageSec: 99 * LIMITS.monsterGrowthIntervalSec, level: rat!.spawnLevel + 10 }] });
	for (let i = 0; i < 5; i++) api().tick(1000);
	const grown = api().monsters.find((mon) => mon.id === rat!.id)!;
	assert.equal(grown.type, 'rat');
	assert.equal(grown.level, grown.spawnLevel + LIMITS.monsterGrowthLevels);
});

// ---- Stun and bosses -------------------------------------------------------------------------------------------------------------

const fightKing = () => {
	freshGame();
	growTo(6);
	const spot = gridCells().find(({ t }) => t.isOwned && t.biome !== 'castle' && t.biome !== 'lake')!;
	store.setState({ monsters: [{ id: 1, type: 'ratKing', level: 15, spawnLevel: 15, x: spot.x, y: spot.y, ageSec: 0 }], nextMonsterId: 2, level: { level: 30, progress: 0 } });
	assert.equal(api().startFight(1), true);
};

test('the King can resist Stun (20%): the mana and the cooldown are spent, the monster is not stunned', () => {
	fightKing();
	const mana = api().playerMp;
	const stub = mock.method(Math, 'random', () => 0); // a roll under the resist chance
	try {
		assert.equal(api().castSkill('stun'), true);
	} finally {
		stub.mock.restore();
	}
	assert.equal(api().fight!.stunLeftSec, 0);
	assert.ok(api().playerMp < mana);
	assert.ok((api().skillCd.stun ?? 0) > 0);
	store.setState({ skillCd: {} });
	const stub2 = mock.method(Math, 'random', () => 0.99);
	try {
		assert.equal(api().castSkill('stun'), true);
	} finally {
		stub2.mock.restore();
	}
	assert.equal(api().fight!.stunLeftSec, SKILLS.stun.stunSec);
});

test('a rat never resists Stun', () => {
	freshGame();
	growTo(6);
	const spot = gridCells().find(({ t }) => t.isOwned && t.biome !== 'castle' && t.biome !== 'lake')!;
	store.setState({ monsters: [{ id: 1, type: 'rat', level: 3, spawnLevel: 3, x: spot.x, y: spot.y, ageSec: 0 }], nextMonsterId: 2, level: { level: 30, progress: 0 } });
	api().startFight(1);
	const stub = mock.method(Math, 'random', () => 0);
	try {
		assert.equal(api().castSkill('stun'), true);
	} finally {
		stub.mock.restore();
	}
	assert.equal(api().fight!.stunLeftSec, SKILLS.stun.stunSec);
});

test("a monster's armor takes its share of every click, never below 1", () => {
	fightKing();
	const before = api().fight!.monsterHp;
	const stub = mock.method(Math, 'random', () => 0); // no crit
	try {
		const result = api().hitMonster({ eventId: 1, now: 1000, trusted: true });
		assert.equal(result!.damage, 4.4, 'a 6 damage click against 15 armor');
	} finally {
		stub.mock.restore();
	}
	assert.equal(Math.round((before - api().fight!.monsterHp) * 10) / 10, 4.4);
});

// ---- limits are reusable ---------------------------------------------------------------------------------------------------------

test('limits: a bonus registered for a key reaches every reader (bag size, the merchant shelf)', () => {
	assert.equal(limitOf('bagSize'), LIMITS.bagSize);
	assert.equal(limitOf('bagSize', { merchantUpgrades: { packrat: 2 } }), LIMITS.bagSize + 8, 'Pack Rat goes through the same hook');
	const original = LIMIT_BONUSES.merchantOffers;
	LIMIT_BONUSES.merchantOffers = () => 2; // a future Legacy effect
	try {
		assert.equal(limitOf('merchantOffers'), 8);
		assert.equal(generateMerchantStock(3, () => 0.5, 0, {}).offers.length, 8);
	} finally {
		LIMIT_BONUSES.merchantOffers = original;
	}
	assert.equal(generateMerchantStock(3, () => 0.5, 0, {}).offers.length, LIMITS.merchantOffers);
});

// ---- the sell bonus reaches everything the player sells -------------------------------------------------------------------------

test('a new sell bonus applies to resources, bag gear, junk, auto-sold drops and the previews alike', () => {
	const bonus = () => 0.2; // a future Legacy effect
	SELL_BONUSES.push(bonus);
	try {
		assert.equal(sellMultiplier({}), 1.2);
		freshGame({ gold: 0 });
		setResources({ wood: 1000 });
		api().sellResources('wood', 1000);
		assert.equal(api().resources.gold, Math.floor(1000 * MERCHANT_RESOURCE_PRICES.wood * 1.2), 'resources');

		freshGame({ gold: 0 });
		const sword = plainItem('wooden_sword');
		const bag = emptyBag();
		bag[0] = { item: sword };
		store.setState({ bag });
		const paid = api().sellItem(0, 1);
		assert.equal(paid, Math.floor(sellValueOf(sword) * 1.2), 'a piece of gear from the bag');

		freshGame({ gold: 0 });
		const junkBag = emptyBag();
		junkBag[0] = { item: sword };
		junkBag[1] = { item: sword };
		store.setState({ bag: junkBag });
		const junk = api().sellJunk('common');
		assert.equal(junk.gold, 2 * Math.floor(sellValueOf(sword) * 1.2), 'junk');

		const received = receiveDrops(emptyBag(), [{ kind: 'gear', item: sword }], 'common', api());
		assert.equal(received.autoSold.gold, Math.floor(sellValueOf(sword) * 1.2), 'an auto-sold drop');

		assert.equal(sellPayout(10, 3, api()), Math.floor(30 * 1.2), 'the previews use the same function');
		assert.equal(gearOf(api().bag[0]), null);
	} finally {
		SELL_BONUSES.splice(SELL_BONUSES.indexOf(bonus), 1);
	}
	assert.equal(sellMultiplier({}), 1);
});

// ---- Organize is a bag function, in the global menu too -------------------------------------------------------------------------

test('the global menu has an Organize bag entry that tidies the bag, and refuses it in a fight', () => {
	freshGame();
	const item = globalMenuItems().find((entry) => entry.id === 'organize');
	assert.ok(item, 'the entry is there');
	const bag = emptyBag();
	bag[3] = { id: 'potion_minor', qty: 1 };
	bag[7] = { id: 'potion_minor', qty: 1 };
	store.setState({ bag });
	item!.onSelect();
	assert.deepEqual(api().bag[0], { id: 'potion_minor', qty: 2 });
	assert.equal(api().bag[3], null);
});
