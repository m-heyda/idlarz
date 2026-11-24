// Server trust: enforcement (IDL-112), the trusted economy (IDL-167) and paid merchant levels (IDL-168).
import test from 'node:test';
import assert from 'node:assert/strict';
import { honestGame, memoryRepo, T0 } from '../audit/cheats';
import { encodeSave } from '../../src/lib/saveFormat';
import { acceptSave } from '../../src/lib/cloudSave/pipeline';
import { summarize } from '../../src/lib/cloudSave/summary';
import { merchantGoldSpent } from '../../src/lib/cloudSave/netWorth';
import { restoreMerchantLevels } from '../../src/lib/cloudSave/trustedEconomy';
import { ENFORCEMENT, FLAG_POLICY, POISON_FLAGS, rejectedFlags, verifyTransition, type SaveFlag } from '../../src/lib/cloudSave/verify';
import { MERCHANT_UPGRADES } from '../../src/config/merchant';
import { merchantUpgradeCost } from '../../src/utils/game/merchant';
import type { PersistedGame } from '../../src/lib/sanitizeSave';

const accept = (repo: ReturnType<typeof memoryRepo>['repo'], state: PersistedGame, baseRev: number, at: number, enforcement = ENFORCEMENT) =>
	acceptSave(repo, 'u', 'Z', encodeSave(state), baseRev, at, false, null, enforcement);
const withGold = (state: PersistedGame, gold: number, playSeconds = state.playSeconds): PersistedGame => ({
	...state,
	playSeconds,
	resources: { ...state.resources, gold },
});

const ON = { enabled: true, reject: ENFORCEMENT.reject };

test('every flag has a decision, and the ones enforcement can refuse are exactly the reject flags on the list', () => {
	const flags: SaveFlag[] = [
		'baseline_rich',
		'networth_exceeds',
		'playtime_regress',
		'playtime_fast',
		'gold_jump',
		'xp_jump',
		'gems_increase',
		'prestige_regress',
		'castle_jump',
		'timer_jump',
		'ember_jump',
	];
	for (const flag of flags) assert.ok(['flag', 'clamp', 'reject'].includes(FLAG_POLICY[flag]), flag);
	assert.deepEqual(rejectedFlags(flags, ON).sort(), ['gems_increase', 'gold_jump']);
	assert.deepEqual(rejectedFlags(flags, { enabled: false, reject: ENFORCEMENT.reject }), [], 'the kill switch turns every refusal off');
	assert.deepEqual(rejectedFlags(flags, { enabled: true, reject: new Set<SaveFlag>(['gold_jump']) }), ['gold_jump'], 'a flag off the list is not enforced');
	assert.deepEqual(rejectedFlags(['castle_jump', 'xp_jump'], ON), [], 'clamp and flag decisions never refuse a save');
});

test('normal play never costs an account its ranking or its away pay: a browser left open, an auto-clicker or a late save only leave a recorded flag', () => {
	for (const flag of ['playtime_fast', 'castle_jump', 'timer_jump'] as SaveFlag[]) {
		assert.equal(POISON_FLAGS.has(flag), false, `${flag} is not a poison flag`);
		assert.equal(FLAG_POLICY[flag], 'flag', `${flag} only records`);
	}
	assert.equal(POISON_FLAGS.has('networth_exceeds'), true, 'what the game could not have paid still does');
});

test('shadow mode stores a gold jump flagged; enforcement refuses it and the account keeps its last accepted save', async () => {
	const { repo, rows } = memoryRepo();
	const base = honestGame();
	assert.equal((await accept(repo, base, 0, T0)).kind, 'ok');
	const cheat = withGold(base, 1e9, base.playSeconds + 60);

	const shadow = await accept(repo, cheat, 1, T0 + 60_000, { enabled: false, reject: ENFORCEMENT.reject });
	assert.equal(shadow.kind, 'ok');
	assert.ok(shadow.kind === 'ok' && shadow.flags.includes('gold_jump'));
	assert.equal(rows.get('u')!.rev, 2);

	// the same cheat from a fresh account with enforcement on
	const fresh = memoryRepo();
	await accept(fresh.repo, base, 0, T0);
	const refused = await accept(fresh.repo, cheat, 1, T0 + 60_000, ON);
	assert.equal(refused.kind, 'rejected');
	assert.ok(refused.kind === 'rejected' && refused.flags.includes('gold_jump'));
	assert.equal(fresh.rows.get('u')!.rev, 1, 'nothing was stored');
	assert.equal(fresh.rows.get('u')!.summary.gold, 100, 'the balance is still the last accepted one');
	// an honest follow-up from the same base is still accepted (the refusal burned nothing)
	assert.equal((await accept(fresh.repo, withGold(base, 100, base.playSeconds + 60), 1, T0 + 60_000, ON)).kind, 'ok');
});

test('an honest save raises no flag with enforcement on, and a stock sold at the merchant is no gold jump', async () => {
	const { repo } = memoryRepo();
	const base = honestGame();
	const stocked: PersistedGame = { ...base, resources: { ...base.resources, wood: 400, stone: 300, coal: 200, food: 300 } };
	assert.equal((await accept(repo, stocked, 0, T0, ON)).kind, 'ok');
	const before = summarize(stocked);
	assert.ok((before.derived.stockWorth ?? 0) > 0, 'the stock is recorded in gold');
	// the stock is sold: the gold rises by its worth, the stock is gone
	const sold = withGold(
		{ ...stocked, resources: { ...stocked.resources, wood: 0, stone: 0, coal: 0, food: 0 } },
		100 + before.derived.stockWorth!,
		stocked.playSeconds + 30,
	);
	const outcome = await accept(repo, sold, 1, T0 + 30_000, ON);
	assert.equal(outcome.kind, 'ok');
	assert.deepEqual(outcome.kind === 'ok' ? outcome.flags : null, []);
});

test('a row from before the stock was recorded keeps the old burst allowance (no false flag on the first upload after the update)', () => {
	const base = summarize(honestGame());
	const legacy = { summary: { ...base, derived: { ...base.derived, stockWorth: undefined } }, serverSavedAt: T0 };
	const rate = base.rates.gold;
	const next = { ...base, gold: base.gold + rate * 800 };
	assert.deepEqual(verifyTransition(legacy, next, T0 + 30_000), []);
});

test('past 2^53 the comparison has a relative tolerance: a balance the doubles cannot tell apart is not a jump', () => {
	const base = summarize(honestGame());
	const big = { ...base, gold: 2 ** 60 };
	const prev = { summary: big, serverSavedAt: T0 };
	const next = { ...big, gold: 2 ** 60 + 2 ** 12, playSeconds: big.playSeconds + 30 };
	assert.deepEqual(verifyTransition(prev, next, T0 + 30_000), []);
});

test('merchant levels are counted in the spending floor: every level but Pack Rat', () => {
	assert.equal(merchantGoldSpent({}), 0);
	assert.equal(merchantGoldSpent(undefined), 0);
	assert.equal(merchantGoldSpent({ foreman: 1 }), merchantUpgradeCost('foreman', 0));
	assert.equal(merchantGoldSpent({ foreman: 3 }), merchantUpgradeCost('foreman', 0) + merchantUpgradeCost('foreman', 1) + merchantUpgradeCost('foreman', 2));
	assert.equal(merchantGoldSpent({ packrat: MERCHANT_UPGRADES.packrat.maxLevel }), 0, 'Pack Rat survives a rebirth, so it was paid in earlier runs');
});

test('restoring unpaid merchant levels never raises a level and leaves Pack Rat alone', () => {
	assert.deepEqual(restoreMerchantLevels({ foreman: 10, haggler: 10, bulk: 8, packrat: 2 }, { foreman: 3, bulk: 1 }), { foreman: 3, bulk: 1, packrat: 2 });
	assert.deepEqual(restoreMerchantLevels({ foreman: 2 }, { foreman: 5 }), { foreman: 2 });
	assert.deepEqual(restoreMerchantLevels({ foreman: 4 }, undefined), {});
});

test('an honest merchant purchase passes: the gold was earned, the level is paid and the rates follow it', async () => {
	const { repo, rows } = memoryRepo();
	const base = honestGame();
	// a long honest game: the income of 12 tiles over a million seconds pays for Foreman level 1
	const aged = withGold(base, 0, 1_000_000);
	assert.equal((await accept(repo, aged, 0, T0, ON)).kind, 'ok');
	const bought: PersistedGame = { ...aged, playSeconds: aged.playSeconds + 60, merchantUpgrades: { foreman: 1 } };
	const outcome = await accept(repo, bought, 1, T0 + 60_000, ON);
	assert.equal(outcome.kind, 'ok');
	assert.ok(outcome.kind === 'ok' && !outcome.flags.includes('networth_exceeds'), `flags: ${outcome.kind === 'ok' ? outcome.flags : ''}`);
	assert.equal(outcome.kind === 'ok' ? outcome.economy : 'x', undefined, 'an honest save is paid from its own economy');
	assert.equal(rows.get('u')!.core.merchantUpgrades && (rows.get('u')!.core.merchantUpgrades as Record<string, number>).foreman, 1);
});

test('unpaid merchant levels go back to the last trusted ones in the stored game; honest ones stay', async () => {
	const { repo, rows } = memoryRepo();
	const base = honestGame();
	await accept(repo, base, 0, T0);
	const cheat: PersistedGame = { ...base, playSeconds: base.playSeconds + 60, merchantUpgrades: { foreman: 10, haggler: 10, tithe: 10, bulk: 8 } };
	const outcome = await accept(repo, cheat, 1, T0 + 60_000);
	assert.ok(outcome.kind === 'ok' && outcome.flags.includes('networth_exceeds') && outcome.economy === 'trusted');
	const kept = rows.get('u')!.core.merchantUpgrades as Record<string, number>;
	assert.equal(kept.foreman, undefined);
	assert.equal(kept.haggler, undefined);
	assert.equal(kept.bulk, undefined);
});

test('a first save with an unbelievable economy has no trusted baseline: its rates are cut to what its play time explains', async () => {
	const { repo, rows } = memoryRepo();
	const base = honestGame();
	const cheat: PersistedGame = { ...base, merchantUpgrades: { foreman: 10, haggler: 10, tithe: 10, bulk: 8 } };
	const honest = summarize(base);
	const outcome = await accept(repo, cheat, 0, T0);
	assert.ok(outcome.kind === 'ok' && outcome.economy === 'trusted');
	assert.ok(rows.get('u')!.summary.rates.gold <= honest.rates.gold * 1.0001, 'the Foreman bonus is not paid');
});
