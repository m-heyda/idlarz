import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DEFAULT_WINDOW_POS, useWindowStore } from '../../src/stores/windowStore';
import { QUERY_KEYS } from '../../src/lib/queryClient';
import type { RankingBoardAnswer, RankingRow } from '../../src/lib/rankings';

// The Rankings window: tabs, zebra list, move arrows, the placeholders. (node has no CSS loader: the imports are made no-ops before the component loads.)
(require as unknown as { extensions: Record<string, () => void> }).extensions['.css'] = () => undefined;

const h = React.createElement;
const open = () => {
	const patch = { order: ['rankings' as const], positions: { ...DEFAULT_WINDOW_POS }, sizes: {} };
	useWindowStore.setState(patch);
	Object.assign(useWindowStore.getInitialState(), patch);
};

const row = (patch: Partial<RankingRow> = {}): RankingRow => ({
	rank: 1,
	move: { dir: 'same', by: 0 },
	name: 'Insane',
	playerClass: 'warrior',
	avatarId: 'knight',
	badge: null,
	badgeName: null,
	title: null,
	nameColor: null,
	admin: false,
	value: 80,
	paragon: 0,
	me: false,
	...patch,
});

const draw = (answer?: RankingBoardAnswer) => {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const RankingsWindow = (require('../../src/components/game/RankingsWindow') as typeof import('../../src/components/game/RankingsWindow')).default;
	const client = new QueryClient();
	if (answer) client.setQueryData(QUERY_KEYS.rankings(answer.board), answer);
	open();
	return renderToStaticMarkup(h(QueryClientProvider, { client }, h(RankingsWindow)));
};

test('the tabs are Level, Rebirths, Crafting, Tiles, Kills, Quests and Deeds, and the first load shows skeleton rows', () => {
	const html = draw();
	for (const label of ['Level', 'Rebirths', 'Crafting', 'Tiles', 'Kills', 'Quests', 'Deeds']) assert.ok(html.includes(`>${label}`), label);
	assert.ok(html.includes('aria-busy="true"'));
	assert.ok(html.includes('ds-rank-sk-art'));
});

test('a loaded board lists the places with the name, title, value and the move arrows', () => {
	const html = draw({
		board: 'level',
		refreshedAt: '2026-11-12T10:00:00Z',
		mine: row({ rank: 77, name: 'Mine', me: true, move: { dir: 'new', by: 0 } }),
		rows: [
			row({ rank: 1, name: 'Alpha', title: 'The Brave', value: 100, move: { dir: 'up', by: 3 }, admin: true, nameColor: 'gold' }),
			row({ rank: 2, name: 'Beta', value: 99, move: { dir: 'down', by: 2 } }),
			row({ rank: 3, name: 'Gamma', value: 98, paragon: 4 }),
		],
	});
	assert.match(html, /Alpha/);
	assert.match(html, /The Brave/);
	assert.match(html, /Lv 100/);
	assert.match(html, /▲ 3/);
	assert.match(html, /▼ 2/);
	assert.match(html, /ds-admin-mark/);
	assert.match(html, /ds-nick-gold/);
	assert.match(html, /✦ 4/, 'a paragon mark shows when a row has a paragon level');
	assert.match(html, /data-me="true"/);
	assert.match(html, /Mine/);
	assert.equal((html.match(/ds-rank-row/g) ?? []).length >= 4, true);
});

test('an empty board says so', () => {
	assert.match(draw({ board: 'level', rows: [], mine: null, refreshedAt: null }), /Nobody is ranked here yet/);
});
