import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, store } from './helpers';
import { MONSTERS } from '../src/config/combatConfig';
import { CLICK_LIMIT } from '../src/config/gameConfig';
import { ITEM_CATALOG } from '../src/config/itemCatalog';
import { createClickLimiter } from '../src/lib/clickLimiter';

const bestWeaponDamage = () =>
	Math.max(...Object.values(ITEM_CATALOG).filter((i) => i.slot === 'mainHand').map((i) => i.stats?.damage ?? 0));

test('best possible clicks x best weapon damage stay below the Rat King HP', () => {
	// formula from the constants
	const maxClicks = CLICK_LIMIT.capacity + CLICK_LIMIT.refillPerSec * MONSTERS.ratKing.timeLimitSec;
	assert.ok(maxClicks * bestWeaponDamage() < MONSTERS.ratKing.hp, `${maxClicks} x ${bestWeaponDamage()}`);

	// and the real limiter, hammered by a bot clicking every 5 ms for the whole minute
	const limiter = createClickLimiter();
	let accepted = 0;
	for (let t = 0, id = 1; t <= MONSTERS.ratKing.timeLimitSec * 1000; t += 5, id++) {
		if (limiter.take({ eventId: id, now: t, trusted: true })) accepted++;
	}
	assert.ok(accepted * bestWeaponDamage() < MONSTERS.ratKing.hp, `${accepted} accepted clicks`);
});

test('a starter-kit king fight ends by timeout, not by knockout', () => {
	freshGame();
	growTo(6);
	store.setState({ monsters: [{ id: 1, type: 'ratKing', tier: 1, x: 0, y: 0, ageSec: 0 }], nextMonsterId: 2 });
	const startHp = api().playerHp;
	api().startFight(1);
	for (let i = 0; i < 70 && api().fight?.phase === 'active'; i++) api().tick(1000);
	assert.equal(api().fight?.phase, 'timeout');
	assert.ok(api().playerHp > 0 && api().playerHp < startHp);
});
