import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { RESOURCE_ART, resourceArtUrl } from '../src/catalog/resourceArt';
import { RESOURCES } from '../src/catalog/resources';

// The roster (catalog/resourceArt.ts) lists the art in public/pixel/resources/: enabled entries are real resources, the rest wait.

const root = path.join(__dirname, '..', 'public');

test('ids are unique and an entry says it has art exactly when the picture exists', () => {
	assert.equal(new Set(RESOURCE_ART.map((r) => r.id)).size, RESOURCE_ART.length);
	for (const r of RESOURCE_ART) {
		assert.equal(fs.existsSync(path.join(root, resourceArtUrl(r))), r.art, `${r.id}: ${resourceArtUrl(r)}`);
	}
});

test('enabled entries are resources the game has (or a reserved icon); planned ones are not in RESOURCES yet', () => {
	for (const r of RESOURCE_ART) {
		if (r.enabled) assert.ok(r.art, `${r.id}: an enabled entry needs its picture`);
		else assert.ok(!(r.id in RESOURCES), `${r.id} is in RESOURCES already: set enabled to true`);
	}
	for (const r of RESOURCE_ART.filter((r) => r.enabled && r.id !== 'fish')) {
		assert.ok(r.id in RESOURCES, `${r.id} is enabled but not in RESOURCES`);
	}
});

test('every picture in the folder is in the roster or a "_" spare', () => {
	const known = new Set(RESOURCE_ART.filter((r) => r.art).map((r) => path.basename(resourceArtUrl(r))));
	for (const file of fs.readdirSync(path.join(root, 'pixel', 'resources')).filter((f) => f.endsWith('.png'))) {
		assert.ok(file.startsWith('_') || known.has(file), `${file}: add it to RESOURCE_ART or prefix it with "_"`);
	}
});
