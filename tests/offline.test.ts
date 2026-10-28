import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, setResources, tileAt } from './helpers';
import { CASTLE_X, CASTLE_Y, CHEST, LEGACY_UPGRADES, LUCK } from '../src/config/gameConfig';
import { COMBAT } from '../src/config/combatConfig';
import { INITIAL_CHARACTER_STATS } from '../src/config/gameConfig';
import { STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import { effectiveStats } from '../src/lib/effectiveStats';
import { chestIntervalSec, chestRateBonusPct, dropChanceMultiplier, gemChance, luckyRatChance, rarityLuckMultiplier, rollGemAmount } from '../src/lib/luck';
import { mulberry32 } from '../src/lib/rng';
import { applyOfflineGrant } from '../src/lib/offline/apply';
import { computeOfflineGrant, zeroGrant, type OfflineInput } from '../src/lib/offline/grant';
import { offlineCapHours, offlineCapSec, offlineEfficiency, offlineMinGapSec } from '../src/lib/offline/limits';
import { sealedRng } from '../src/lib/offline/seal';
import { advanceBank, emptyBank, takeChest, takeMonster, ticketCap, TICKET_CAP, type BankContext, type TicketBank } from '../src/lib/offline/tickets';
import { calculateCombatStats, calculateResourceRates, totalStatPoints } from '../src/utils/gameUtils';
import { castleUpgradeDuration } from '../src/utils/gameUtils';
import type { PrestigeState, Resources } from '../src/types/game';

/** A bank whose land has plenty of tiles for monsters (a bank that has never looked at the land mints none). */
const openBank = (): TicketBank => ({ ...emptyBank(0), sites: { rat: 1000, king: 1000 } });

const prestige = (upgrades: PrestigeState['upgrades'] = {}): PrestigeState => ({ rebirths: 1, legacyPoints: 0, legacyEarned: 0, upgrades });
const res = (over: Partial<Resources> = {}): Resources => ({ ...zeroGrant(), ...over });

const input = (over: Partial<OfflineInput> = {}): OfflineInput => ({
	rates: res({ gold: 10, wood: 2, xp: 1 }),
	ratesAfterCastle: null,
	castleUpgrade: null,
	xpGainPct: 0,
	gapSec: 3600,
	capSec: 8 * 3600,
	efficiency: 0.5,
	minGapSec: 300,
	...over,
});

// ---------------------------------------------------------------------------------------------------- limits and Legacy

test('away time defaults to 8 h at 50 %, and the Legacy upgrades raise it (never past the hard ceilings)', () => {
	assert.equal(offlineCapHours(), 8);
	assert.equal(offlineCapSec(), 8 * 3600);
	assert.equal(offlineEfficiency(), 0.5);
	assert.equal(offlineMinGapSec(), 300);
	assert.equal(offlineCapHours({ prestige: prestige({ nightwatch: 4 }) }), 8 + 4 * LEGACY_UPGRADES.nightwatch.effectPerLevel);
	assert.ok(Math.abs(offlineEfficiency({ prestige: prestige({ steward: 4 }) }) - (0.5 + 4 * LEGACY_UPGRADES.steward.effectPerLevel)) < 1e-9);
	assert.equal(offlineEfficiency({ prestige: prestige({ steward: LEGACY_UPGRADES.steward.maxLevel }) }), 1, 'fully upgraded the kingdom works at full speed');
});

test('the Character window lists the offline cap and efficiency, with the rebirth upgrades in them', () => {
	const stats = { ...INITIAL_CHARACTER_STATS };
	Object.assign(stats, calculateCombatStats(stats));
	const base = effectiveStats({ characterStats: stats, equipment: STARTER_EQUIPMENT });
	assert.equal(base.offlineCapHours, 8);
	assert.equal(base.offlineEfficiency, 50);
	const up = effectiveStats({ characterStats: stats, equipment: STARTER_EQUIPMENT, prestige: prestige({ nightwatch: 2, steward: 2 }) });
	assert.equal(up.offlineCapHours, 10);
	assert.ok(Math.abs(up.offlineEfficiency - 60) < 1e-9);
});

// ---------------------------------------------------------------------------------------------------- Luck

test('Luck shortens the chest interval (never below the floor) and raises gem, rarity, drop and lucky-rat odds', () => {
	assert.equal(chestIntervalSec(0), CHEST.intervalSec);
	assert.ok(chestIntervalSec(60) < chestIntervalSec(10));
	assert.equal(chestIntervalSec(1e9), CHEST.intervalSec * LUCK.chestIntervalFloor);
	assert.ok(chestRateBonusPct(60) > chestRateBonusPct(0));
	assert.equal(rarityLuckMultiplier(0), 1);
	assert.equal(rarityLuckMultiplier(1e9), LUCK.rarityCap);
	assert.ok(dropChanceMultiplier(50) > dropChanceMultiplier(5));
	assert.equal(gemChance(0), LUCK.gem.base);
	assert.equal(gemChance(1e9), LUCK.gem.cap);
	assert.ok(luckyRatChance(40) > luckyRatChance(0));
	assert.equal(luckyRatChance(1e9), LUCK.luckyRat.cap);
	assert.equal(chestIntervalSec(NaN), CHEST.intervalSec, 'a bad number counts as no Luck');
});

test('a gem find is 5 to 50 gems, mostly small ones', () => {
	const rng = mulberry32(7);
	const amounts = Array.from({ length: 2000 }, () => rollGemAmount(rng));
	assert.ok(amounts.every((n) => Number.isInteger(n) && n >= LUCK.gem.min && n <= LUCK.gem.max));
	const mean = amounts.reduce((s, n) => s + n, 0) / amounts.length;
	assert.ok(mean > 12 && mean < 25, `mean ${mean}`);
	assert.ok(amounts.filter((n) => n <= 20).length > amounts.filter((n) => n > 35).length);
});

// ---------------------------------------------------------------------------------------------------- the grant

test('an absence pays efficiency x rates x time (xp with the xp bonus), rounded down', () => {
	const grant = computeOfflineGrant(input({ xpGainPct: 20 }))!;
	assert.equal(grant.elapsedSec, 3600);
	assert.equal(grant.resources.gold, 10 * 3600 * 0.5);
	assert.equal(grant.resources.wood, 2 * 3600 * 0.5);
	assert.equal(grant.resources.xp, Math.floor(1 * 3600 * 0.5 * 1.2));
	assert.equal(grant.capped, false);
	assert.equal(grant.castle, null);
});

test('nothing is paid below the minimum gap', () => {
	assert.equal(computeOfflineGrant(input({ gapSec: 299 })), null);
	assert.ok(computeOfflineGrant(input({ gapSec: 300 })));
	assert.equal(computeOfflineGrant(input({ gapSec: NaN })), null);
	assert.equal(computeOfflineGrant(input({ gapSec: -5000 })), null, 'a clock that went backwards pays nothing');
});

test('the cap limits what is paid, and says so', () => {
	const grant = computeOfflineGrant(input({ gapSec: 3 * 24 * 3600 }))!;
	assert.equal(grant.elapsedSec, 8 * 3600);
	assert.equal(grant.capped, true);
	assert.equal(grant.gapSec, 3 * 24 * 3600);
	assert.equal(grant.resources.gold, 10 * 8 * 3600 * 0.5);
	const longer = computeOfflineGrant(input({ gapSec: 3 * 24 * 3600, capSec: 12 * 3600 }))!;
	assert.equal(longer.resources.gold, 10 * 12 * 3600 * 0.5, 'Night Watch lengthens the paid stretch');
});

test('a castle upgrade that finishes while away switches the rest of the time to the higher rates', () => {
	const grant = computeOfflineGrant(
		input({
			gapSec: 3600,
			efficiency: 1,
			castleUpgrade: { toLevel: 3, remainingSec: 1000 },
			ratesAfterCastle: res({ gold: 30, wood: 2, xp: 1 }),
		})
	)!;
	assert.equal(grant.castle?.finished, true);
	assert.equal(grant.resources.gold, 10 * 1000 + 30 * 2600);
});

test('a castle upgrade that does not finish keeps the old rates and is reported as unfinished', () => {
	const grant = computeOfflineGrant(
		input({ gapSec: 600, efficiency: 1, castleUpgrade: { toLevel: 3, remainingSec: 5000 }, ratesAfterCastle: res({ gold: 30 }) })
	)!;
	assert.equal(grant.castle?.finished, false);
	assert.equal(grant.resources.gold, 10 * 600);
});

test('efficiency is clamped to 0..1', () => {
	assert.equal(computeOfflineGrant(input({ efficiency: 7 }))!.resources.gold, 10 * 3600);
	assert.equal(computeOfflineGrant(input({ efficiency: -1 }))!.resources.gold, 0);
});

// ---------------------------------------------------------------------------------------------------- the ticket bank

const ctx = (over: Partial<BankContext> = {}): BankContext => ({ luck: 0, tilesOwned: 100, buildingsOwned: 0, castleLevel: 1, ...over });
const NO_LUCKY = () => () => 0.9999; // never under a lucky chance
const ALL_LUCKY = () => () => 0;

test('the first rat comes after 2 minutes, the next ones every 15, chests every 10', () => {
	const hour = advanceBank(openBank(), 3600, ctx(), NO_LUCKY);
	assert.equal(hour.minted.chests.length, 6);
	assert.equal(hour.minted.rats.length, 1 + Math.floor((3600 - COMBAT.spawn.firstSec) / COMBAT.spawn.intervalSec));
	assert.equal(hour.minted.rats[0].at, COMBAT.spawn.firstSec);
	assert.equal(hour.minted.rats[1].at, COMBAT.spawn.firstSec + COMBAT.spawn.intervalSec);
	assert.deepEqual(
		hour.minted.rats.map((rat) => rat.n),
		hour.minted.rats.map((_, i) => i + 1),
		'tickets are numbered in order'
	);
});

test('tickets are the same however the time is cut up', () => {
	const whole = advanceBank(openBank(), 7200, ctx(), NO_LUCKY).bank;
	let bank = openBank();
	for (let i = 0; i < 72; i++) bank = advanceBank(bank, 100, ctx(), NO_LUCKY).bank;
	assert.deepEqual(bank.chests.map(Math.round), whole.chests.map(Math.round));
	assert.deepEqual(bank.rats.map((r) => Math.round(r.at)), whole.rats.map((r) => Math.round(r.at)));
	assert.equal(bank.ratsMinted, whole.ratsMinted);
});

test('Luck makes chests come faster', () => {
	const slow = advanceBank(openBank(), 4 * 3600, ctx({ luck: 0 }), NO_LUCKY).minted.chests.length;
	const fast = advanceBank(openBank(), 4 * 3600, ctx({ luck: 100 }), NO_LUCKY).minted.chests.length;
	assert.ok(fast > slow, `${fast} > ${slow}`);
});

test('the bank stops when the map is full, and then holds its timers at zero', () => {
	const small = ctx({ tilesOwned: 12 });
	const cap = ticketCap(small);
	assert.ok(cap >= 2 && cap <= TICKET_CAP);
	const { bank } = advanceBank(openBank(), 24 * 3600, small, NO_LUCKY);
	assert.equal(bank.chests.length + bank.rats.length + (bank.king ? 1 : 0), cap);
	assert.equal(bank.chestAcc, 0);
	assert.equal(bank.ratAcc, 0);
});

test('never more than the ticket cap, even on a huge map', () => {
	const { bank } = advanceBank(openBank(), 72 * 3600, ctx({ tilesOwned: 100000 }), NO_LUCKY);
	assert.ok(bank.chests.length + bank.rats.length + (bank.king ? 1 : 0) <= TICKET_CAP);
});

test('one King at a time, after three hours', () => {
	const wide = ctx({ tilesOwned: 10000 });
	const early = advanceBank(openBank(), 3 * 3600 - 1, wide, NO_LUCKY);
	assert.equal(early.bank.king, null);
	const later = advanceBank(openBank(), 3 * 3600 + 1, wide, NO_LUCKY);
	assert.ok(later.bank.king);
	const again = advanceBank(later.bank, 9 * 3600, wide, NO_LUCKY);
	assert.equal(again.minted.king, null, 'the King is still waiting, so no second one');
});

test('no monsters while the land has no tile for them, and they start once it does', () => {
	const none = advanceBank({ ...emptyBank(0), sites: { rat: 0, king: 0 } }, 3600, ctx(), NO_LUCKY);
	assert.equal(none.minted.rats.length, 0);
	assert.equal(none.minted.king, null);
	const unknown = advanceBank(emptyBank(0), 3600, ctx(), NO_LUCKY);
	assert.equal(unknown.minted.rats.length, 0, 'the land has not been looked at yet: nothing comes');
	const some = advanceBank({ ...emptyBank(0), sites: { rat: 3, king: 3 } }, 3600, ctx(), NO_LUCKY);
	assert.ok(some.minted.rats.length >= 1);
	assert.ok(some.bank.rats.length + (some.bank.king ? 1 : 0) <= 3, 'never more monsters than tiles for them');
});

test('lucky rats are decided by the ticket roll, and only the server holds it', () => {
	assert.ok(advanceBank(openBank(), 3600, ctx(), ALL_LUCKY).minted.rats.every((rat) => rat.lucky));
	assert.ok(advanceBank(openBank(), 3600, ctx(), NO_LUCKY).minted.rats.every((rat) => !rat.lucky));
});

test('an absence is credited at its efficiency but the tickets are stamped across the real time', () => {
	// 6 h away at 50 %: the bank runs 3 h, the stamps spread over the 6 h
	const { bank, minted } = advanceBank(openBank(), 3 * 3600, ctx({ tilesOwned: 10000 }), NO_LUCKY, { realDtSec: 6 * 3600 });
	assert.equal(bank.accAt, 6 * 3600);
	const lastChest = minted.chests[minted.chests.length - 1];
	assert.ok(lastChest > 5 * 3600 && lastChest <= 6 * 3600, `${lastChest}`);
});

test('taking tickets removes exactly one and refuses what does not exist', () => {
	const { bank } = advanceBank(openBank(), 7200, ctx(), NO_LUCKY);
	const chest = takeChest(bank)!;
	assert.equal(chest.bank.chests.length, bank.chests.length - 1);
	assert.equal(chest.at, bank.chests[0], 'the oldest chest goes first');
	assert.equal(takeChest(emptyBank(0)), null);
	const monster = takeMonster(bank, bank.rats[0].n)!;
	assert.equal(monster.kind, 'rat');
	assert.equal(monster.bank.rats.length, bank.rats.length - 1);
	assert.equal(takeMonster(monster.bank, bank.rats[0].n), null, 'a ticket is spent once');
	assert.equal(takeMonster(bank, 9999), null);
	assert.equal(bank.rats.length, advanceBank(openBank(), 7200, ctx(), NO_LUCKY).bank.rats.length, 'the input bank is never changed');
});

// ---------------------------------------------------------------------------------------------------- sealed rolls

test('a sealed roll is stable for one ordinal and different for another player, run, kind or ordinal', () => {
	const draw = (user: string, run: number, kind: string, n: number) => {
		const r = sealedRng('secret', user, run, kind, n);
		return [r(), r(), r()];
	};
	assert.deepEqual(draw('u1', 1, 'chest', 5), draw('u1', 1, 'chest', 5));
	for (const other of [draw('u2', 1, 'chest', 5), draw('u1', 2, 'chest', 5), draw('u1', 1, 'kill', 5), draw('u1', 1, 'chest', 6)]) {
		assert.notDeepEqual(other, draw('u1', 1, 'chest', 5));
	}
	assert.ok(draw('u1', 1, 'chest', 5).every((x) => x >= 0 && x < 1));
	assert.notDeepEqual(sealedRng('another', 'u1', 1, 'chest', 5)(), sealedRng('secret', 'u1', 1, 'chest', 5)());
	assert.throws(() => sealedRng('', 'u1', 1, 'chest', 5), /secret/);
});

// ---------------------------------------------------------------------------------------------------- applying a grant

test('applying a grant adds the income, levels the hero up and fills HP after a long absence', () => {
	freshGame();
	const before = api();
	const grant = computeOfflineGrant(input({ rates: res({ gold: 5, xp: 3 }), gapSec: 2 * 3600, efficiency: 0.5 }))!;
	const { patch, summary } = applyOfflineGrant(before, grant);
	assert.equal(patch.resources!.gold, before.resources.gold + 5 * 7200 * 0.5);
	assert.ok(patch.resources!.xp > before.resources.xp);
	assert.equal(summary.levelsGained, patch.level!.level - before.level.level);
	assert.equal(patch.characterStats!.availablePoints, before.characterStats.availablePoints + totalStatPoints(patch.level!.level) - totalStatPoints(before.level.level));
	assert.equal(patch.previousLevel, patch.level!.level, 'no level-up popup: the welcome-back window reports it');
	assert.ok(patch.playerHp! >= before.playerHp);
});

test('applying a grant counts the castle upgrade down and finishes it, with the new rates', () => {
	freshGame();
	const cost = tileAt(api().tiles, CASTLE_X, CASTLE_Y).upgradeCost!;
	setResources({ ...(cost as Record<string, number>) });
	assert.equal(api().upgradeCastle(), true);
	const total = castleUpgradeDuration(1);
	const state = api();
	assert.equal(state.castleUpgrade!.remainingSec, total);

	// not yet finished: only the clock moves
	const partial = applyOfflineGrant(state, computeOfflineGrant(input({ gapSec: 600, castleUpgrade: state.castleUpgrade }))!);
	assert.equal(partial.patch.castleUpgrade!.remainingSec, total - 600);
	assert.equal(partial.summary.castleReached, null);

	// finished: the castle level rises and the rates are rebuilt
	const done = applyOfflineGrant(state, computeOfflineGrant(input({ gapSec: total + 60, capSec: total + 3600, castleUpgrade: state.castleUpgrade }))!);
	assert.equal(done.patch.castleUpgrade, null);
	assert.equal(done.summary.castleReached, 2);
	assert.equal(tileAt(done.patch.tiles!, CASTLE_X, CASTLE_Y).level, 2);
	assert.deepEqual(done.patch.resourceRates, calculateResourceRates(done.patch.tiles!, state.characterStats, state.farmLevels, state.prestige, state.farmUpgrades));
});

test('monsters grow by the whole absence, not by the efficiency', () => {
	freshGame();
	const monster = { id: 1, type: 'rat' as const, level: 2, spawnLevel: 2, x: CASTLE_X + 1, y: CASTLE_Y, ageSec: 0 };
	const state = { ...api(), monsters: [monster] };
	const { patch } = applyOfflineGrant(state, computeOfflineGrant(input({ gapSec: 3 * 3600 + 10 }))!);
	assert.equal(patch.monsters![0].ageSec, 3 * 3600 + 10);
	assert.equal(patch.monsters![0].level, 2 + 6, 'six growth intervals of half an hour');
});
