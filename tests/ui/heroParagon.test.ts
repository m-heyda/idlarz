import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useGameStore } from '../../src/stores/gameStore';
import { LEVELING } from '../../src/config/character';
import { PARAGON_UPGRADES } from '../../src/config/paragon';
import { cumulativeParagonXp, cumulativeXp } from '../../src/utils/game/character';

// The Paragon tab of the Hero window (docs/plan/paragon.md). (node has no CSS loader: the imports are made no-ops before the component loads.)
(require as unknown as { extensions: Record<string, () => void> }).extensions['.css'] = () => undefined;

/** A server render reads zustand's initial state, not the live one, so the test writes the patch to both */
const put = (patch: Partial<ReturnType<typeof useGameStore.getState>>) => {
	useGameStore.setState(patch);
	Object.assign(useGameStore.getInitialState(), patch);
};

const draw = async () => {
	const { default: HeroParagon } = await import('../../src/components/game/hero/HeroParagon');
	return renderToStaticMarkup(React.createElement(HeroParagon));
};

test('before level 100 the tab says how paragon points are earned and shows no grid', async () => {
	put({ resources: { ...useGameStore.getInitialState().resources, xp: 1000 }, paragonSpent: {} });
	const out = await draw();
	assert.match(out, /Reach level 100/);
	assert.doesNotMatch(out, /px-paragon-grid/);
});

test('with paragon levels it shows the level, the free points and all 20 upgrades in 4 categories, the spent ones with their points', async () => {
	const xp = cumulativeXp(LEVELING.maxLevel) + cumulativeParagonXp(30) + 1;
	put({ resources: { ...useGameStore.getInitialState().resources, xp }, paragonSpent: { damage: 4, luck: 25 } });
	const out = await draw();
	assert.match(out, /✦ 30/);
	assert.ok(out.includes('<strong>1</strong> free point</span>'));
	assert.match(out, /29 spent/);
	for (const name of ['Combat', 'Economy', 'Fortune', 'Realm']) assert.ok(out.includes(name), name);
	for (const u of PARAGON_UPGRADES) assert.ok(out.includes(u.name), u.name);
	assert.match(out, /25 \/ 25/, 'a full capped upgrade shows its cap');
	assert.match(out, /\(full\)/);
});

test('every upgrade has a medallion with its icon, the columns carry their category, and capped and uncapped upgrades look different', async () => {
	const xp = cumulativeXp(LEVELING.maxLevel) + cumulativeParagonXp(30) + 1;
	put({ resources: { ...useGameStore.getInitialState().resources, xp }, paragonSpent: { damage: 4, luck: 25 } });
	const out = await draw();
	for (const cat of ['combat', 'economy', 'fortune', 'realm']) assert.ok(out.includes(`data-cat="${cat}"`), cat);
	assert.equal((out.match(/class="px-paragon-medal"/g) ?? []).length, 20, 'one medallion per upgrade');
	assert.equal((out.match(/class="px-paragon-medal" data-capped="true"/g) ?? []).length, 12, 'twelve capped medallions (rings)');
	assert.match(out, /px-paragon-inf/, 'an uncapped upgrade carries the infinity mark');
	assert.match(out, /px-paragon-check/, 'a full capped upgrade carries the check');
	assert.match(out, /Next paragon level/);
	assert.ok(out.includes(' points</span>'), 'a category shows its points');
});

test('from paragon 100 the level ring wears the frame of its milestone (bronze first), below it the ring is plain', async () => {
	const xp = cumulativeXp(LEVELING.maxLevel) + cumulativeParagonXp(100) + 1;
	put({ resources: { ...useGameStore.getInitialState().resources, xp }, paragonSpent: {} });
	const framed = await draw();
	assert.match(framed, /data-frame="bronze"/);
	assert.match(framed, /❨✦ 100❩/);
	put({ resources: { ...useGameStore.getInitialState().resources, xp: cumulativeXp(LEVELING.maxLevel) + cumulativeParagonXp(30) + 1 }, paragonSpent: {} });
	assert.doesNotMatch(await draw(), /data-frame/);
});
