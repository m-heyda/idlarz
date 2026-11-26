import test from 'node:test';
import assert from 'node:assert/strict';
import { levelAtAge } from '../../src/lib/monsters';
import { publicTickets } from '../../src/lib/offline/service';
import { emptyBank } from '../../src/lib/offline/tickets';

// The level a boss has on the map must be the level it is fought at: the public boss ticket carries the growth cap the server fights it with (a boss on the map at level 76 was fought at 67).

const bank = (growCap?: number) => ({
	...emptyBank(0),
	monsters: [
		{
			n: 1,
			at: 0,
			kind: 'boss' as const,
			lucky: false,
			x: 3,
			y: 4,
			spawnLevel: 66,
			type: 'bossBlossomReaper' as never,
			...(growCap !== undefined ? { growCap } : {}),
		},
	],
});

const AGE = 10 * 3600; // far past every growth step

test('a capped boss is listed with its growth cap, so the browser grows it no further than the server fights it', () => {
	const boss = publicTickets(bank(1)).boss!;
	assert.equal(boss.growCap, 1);
	const serverLevel = levelAtAge(66, AGE, {}, 1);
	const mapLevel = levelAtAge(boss.spawnLevel, AGE, {}, boss.growCap);
	assert.equal(serverLevel, 67);
	assert.equal(mapLevel, serverLevel, 'the map and the fight agree');
});

test('a boss with no cap is listed without one and grows the full limit on both sides', () => {
	const boss = publicTickets(bank()).boss!;
	assert.equal('growCap' in boss, false);
	assert.equal(levelAtAge(boss.spawnLevel, AGE, {}, boss.growCap), levelAtAge(66, AGE, {}));
	assert.equal(levelAtAge(66, AGE, {}), 76);
});
