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
	assert.match(out, />1 free point</);
	assert.match(out, /29 spent/);
	for (const name of ['Combat', 'Economy', 'Fortune', 'Realm']) assert.ok(out.includes(name), name);
	for (const u of PARAGON_UPGRADES) assert.ok(out.includes(u.name), u.name);
	assert.match(out, /25 \/ 25/, 'a full capped upgrade shows its cap');
	assert.match(out, /\(full\)/);
});
