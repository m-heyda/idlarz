import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MONSTERS } from '../../src/config/combatConfig';
import { isKnownType } from '../../src/stores/bestiaryStore';
import type { MonsterType } from '../../src/types/game';

// The component imports a stylesheet; node has no CSS loader, so the import is made a no-op before the component is loaded.
(require as unknown as { extensions: Record<string, () => void> }).extensions['.css'] = () => undefined;

const type: MonsterType = 'thistleBoar';
const draw = (known: boolean) => {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const { MonsterPicture } = require('../../src/components/game/MonsterArt') as typeof import('../../src/components/game/MonsterArt');
	return renderToStaticMarkup(React.createElement(MonsterPicture, { type, known }));
};

test('MonsterPicture: an unmet type is the "?" silhouette with no name, a met type the plain picture', () => {
	const hidden = draw(false);
	assert.match(hidden, /monster-unknown-wrap/);
	assert.match(hidden, /monster-unknown-mark/);
	assert.match(hidden, /Unknown monster/);
	assert.doesNotMatch(hidden, new RegExp(MONSTERS[type].label));
	const shown = draw(true);
	assert.doesNotMatch(shown, /monster-unknown/);
	assert.match(shown, new RegExp(MONSTERS[type].label));
});

test('the rule: a type is known once the server said so, nothing is hidden before its first answer', () => {
	assert.equal(isKnownType({ loaded: false, seen: new Set() }, type), true, 'no answer yet (every answer, the login claim included, loads the store)');
	assert.equal(isKnownType({ loaded: true, seen: new Set() }, type), false);
	assert.equal(isKnownType({ loaded: true, seen: new Set([type]) }, type), true);
	assert.equal(isKnownType({ loaded: true, seen: new Set(['graniteRam']) }, type), false);
});

test('a real monster on the map or in the fight window is never the lab preview: only an `art` override skips the silhouette', () => {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const { labPreviewOf } = require('../../src/components/game/MonsterArt') as typeof import('../../src/components/game/MonsterArt');
	assert.equal(labPreviewOf(undefined), undefined, 'the map and the combat panel pass no art for a real monster');
	assert.equal(labPreviewOf(type)?.id, type, 'the lab names a roster monster explicitly');
	assert.equal(labPreviewOf('nope'), undefined);
});
