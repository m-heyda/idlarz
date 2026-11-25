import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SaveHub from '../../src/components/auth/SaveHub';

// IDL-383: the start hub's buttons are the design system's plates, not the old `px-btn`.

const h = React.createElement;
const cloud = { rev: 3, serverSavedAt: 0, text: '', summary: { level: 7, tilesOwned: 12, playSeconds: 3700, gold: 5 } };

test('the start hub draws its buttons with the design system', () => {
	const out = renderToStaticMarkup(
		h(SaveHub, { mode: 'cloud', local: { kind: 'none' }, cloud, onEnter: () => null, onNewGame: () => undefined, onLogout: () => undefined }),
	);
	assert.match(out, /class="ds-btn ds-btn-gold mt-2"[^>]*>Continue</, 'Continue is the primary (gold) plate');
	assert.match(out, /class="ds-btn"[^>]*>New Game</);
	assert.doesNotMatch(out, /px-btn/);
	assert.match(out, /Level 7 · 12 tiles/);
});

test('an unreadable local save offers only a new game and logging out', () => {
	const out = renderToStaticMarkup(
		h(SaveHub, { mode: 'local', local: { kind: 'unreadable' }, cloud: null, onEnter: () => null, onNewGame: () => undefined, onLogout: () => undefined }),
	);
	assert.match(out, />Start a new game</);
	assert.doesNotMatch(out, /px-btn/);
});
