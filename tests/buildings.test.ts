import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { BUILDINGS, INITIAL_RESOURCES } from '../src/config/gameConfig';
import {
	BUILDING_GLOW,
	BUILDING_PIXEL_ICONS,
	PIXEL_ICON_SIZES,
	RESERVED_RESOURCES,
	RESOURCE_PIXEL_ICONS,
	pixelIconSrc,
} from '../src/config/pixelIcons';

const ICON_DIR = resolve(__dirname, '..', 'public');

test('every building has a sprite (48x60, on disk), a glow colour and a plausible output', () => {
	const all = Object.values(BUILDINGS);
	assert.equal(all.length, 16);
	for (const b of all) {
		assert.equal(b.name in BUILDINGS, true);
		const icon = BUILDING_PIXEL_ICONS[b.name];
		assert.ok(icon, `${b.name} has an icon`);
		assert.deepEqual(PIXEL_ICON_SIZES[icon], [48, 60], `${b.name} sprite size`);
		assert.ok(existsSync(resolve(ICON_DIR, pixelIconSrc(icon).slice(1))), `${icon}.png exists`);
		assert.match(BUILDING_GLOW[b.name] ?? '', /^#[0-9a-f]{6}$/i, `${b.name} glow`);
		const outputs = Object.entries(b.resourceGeneration);
		assert.ok(outputs.length >= 1);
		for (const [resource, rate] of outputs) {
			assert.ok(resource in INITIAL_RESOURCES, `${b.name} produces an existing resource (${resource})`);
			assert.ok((rate as number) > 0);
		}
		const total = outputs.reduce((s, [, r]) => s + (r as number), 0);
		assert.ok(total >= 0.15 && total <= 0.45, `${b.name} total output ${total}`);
	}
});

test('reserved resources are art only: icons exist, but nothing treats them as a resource', () => {
	for (const [name, icon] of Object.entries(RESERVED_RESOURCES)) {
		assert.ok(existsSync(resolve(ICON_DIR, pixelIconSrc(icon).slice(1))), `${icon}.png exists`);
		assert.equal(name in RESOURCE_PIXEL_ICONS, false, `${name} must not be a ResourceIcon`);
		assert.equal(name in INITIAL_RESOURCES, false, `${name} must not be a game resource`);
	}
	assert.deepEqual(Object.keys(RESERVED_RESOURCES).sort(), ['abilityShard', 'crystal', 'fish', 'iron', 'mana', 'randomItem', 'sapphire']);
});
