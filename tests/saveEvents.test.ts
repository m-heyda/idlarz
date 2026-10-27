import test from 'node:test';
import assert from 'node:assert/strict';
import { api, growTo, setResources, store } from './helpers';
import { onSaveEvent, emitSaveEvent, type SaveEventReason } from '../src/lib/saveEvents';

const record = () => {
	const seen: SaveEventReason[] = [];
	const off = onSaveEvent((reason) => seen.push(reason));
	return { seen, off };
};

test('listeners hear events and can be removed', () => {
	const { seen, off } = record();
	emitSaveEvent('rebirth');
	off();
	emitSaveEvent('rebirth');
	assert.deepEqual(seen, ['rebirth']);
});

test('a purchase that goes through is an event; one that is refused is not', () => {
	api().resetGame();
	const { seen, off } = record();
	try {
		setResources({ gold: 0 });
		assert.equal(api().buyClickUpgrade(), false);
		assert.deepEqual(seen, []);
		setResources({ gold: 1e12 });
		assert.equal(api().buyClickUpgrade(), true);
		assert.deepEqual(seen, ['buyClickUpgrade']);
	} finally {
		off();
	}
});

test('land and castle upgrades are events, clicking for gold and ticking are not', () => {
	api().resetGame();
	growTo(6);
	const { seen, off } = record();
	try {
		setResources({ gold: 1e15, wood: 1e12, stone: 1e12, food: 1e12 });
		api().tick(100);
		assert.equal(seen.length, 0, 'idle ticking is not an event');
		api().upgradeCastle();
		assert.ok(seen.includes('upgradeCastle'), `got ${seen.join(',')}`);
	} finally {
		off();
	}
});

test('finishing the castle upgrade is an event, once', () => {
	api().resetGame();
	growTo(6);
	setResources({ gold: 1e15, wood: 1e12, stone: 1e12, food: 1e12 });
	assert.equal(api().upgradeCastle(), true);
	const { seen, off } = record();
	try {
		api().tick(1000);
		const done = seen.filter((r) => r === 'castleUpgraded').length;
		assert.equal(done, 0, 'still building');
		store.setState({ castleUpgrade: { toLevel: 2, remainingSec: 0.05 } } as never);
		api().tick(200);
		api().tick(200);
		assert.equal(seen.filter((r) => r === 'castleUpgraded').length, 1);
	} finally {
		off();
	}
});

test('a level up is an event, once per level gained', () => {
	api().resetGame();
	const { seen, off } = record();
	try {
		setResources({ xp: 1e9 });
		api().tick(100);
		assert.equal(seen.filter((r) => r === 'levelUp').length, 1);
		api().tick(100);
		assert.equal(seen.filter((r) => r === 'levelUp').length, 1, 'no new level, no new event');
	} finally {
		off();
	}
});
