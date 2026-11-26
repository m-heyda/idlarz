import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LOCKED_PETS, PETS } from '../../src/catalog/pets';
import { usePetStore } from '../../src/stores/petStore';

// The Pets tab of the Hero window: pets to unlock later are shown greyed, and the special pet is for its owner only. (node has no CSS loader: the imports are made no-ops before the component loads.)
(require as unknown as { extensions: Record<string, () => void> }).extensions['.css'] = () => undefined;

/** A server render reads zustand's initial state, not the live one, so the test writes the patch to both */
const put = (owned: string[]) => {
	usePetStore.setState({ owned });
	Object.assign(usePetStore.getInitialState(), { owned });
};

const draw = async () => {
	const { default: HeroPets } = await import('../../src/components/game/hero/HeroPets');
	return renderToStaticMarkup(React.createElement(HeroPets));
};

test('a player without the special pet sees the locked pets and no trace of Yuki', async () => {
	put([]);
	const out = await draw();
	for (const pet of LOCKED_PETS) assert.ok(out.includes(pet.name), pet.name);
	assert.match(out, /Coming soon/);
	assert.match(out, /data-owned="false"/);
	assert.doesNotMatch(out, /data-owned="true"/);
	assert.doesNotMatch(out, /Yuki/i);
	assert.doesNotMatch(out, /kaczkawu/i);
});

test('the account that owns Yuki sees her in colour with her name, besides the locked pets', async () => {
	put(['yuki']);
	const out = await draw();
	assert.match(out, /data-owned="true"/);
	assert.match(out, /Yuki/);
	assert.match(out, /No effect yet/);
	for (const pet of LOCKED_PETS) assert.ok(out.includes(pet.name), pet.name);
	put([]);
});

test('an owned id the build does not know draws nothing and does not break the tab', async () => {
	put(['not_a_pet']);
	const out = await draw();
	assert.doesNotMatch(out, /data-owned="true"/);
	put([]);
});

test('a locked pet is not a pet of the catalog (nothing can own, grant or save it) and its sheet exists', () => {
	for (const pet of LOCKED_PETS) {
		assert.ok(!PETS.some((real) => real.id === pet.id), `${pet.id} is not in PETS`);
		assert.ok(fs.existsSync(path.join(__dirname, '../../public', pet.sheet)), pet.sheet);
		assert.ok(pet.frameW > 0 && pet.frameH > 0 && pet.sheetW >= pet.frameW && pet.sheetH >= pet.frameH, `${pet.id} frame fits its sheet`);
	}
	assert.equal(new Set(LOCKED_PETS.map((p) => p.id)).size, LOCKED_PETS.length);
});
