import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AVATARS, classAvatarIds } from '../../src/catalog/avatars';
import type { PlayerClassId } from '../../src/config/playerClasses';

// The component imports a stylesheet; node has no CSS loader, so the import is made a no-op before the component is loaded.
(require as unknown as { extensions: Record<string, () => void> }).extensions['.css'] = () => undefined;

const draw = (playerClass: PlayerClassId, props: { loading?: boolean; unlocked?: readonly string[] } = {}) => {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const AvatarPicker = (require('../../src/components/game/AvatarPicker') as typeof import('../../src/components/game/AvatarPicker')).default;
	return renderToStaticMarkup(
		React.createElement(AvatarPicker, {
			value: null,
			playerClass,
			unlocked: props.unlocked ?? classAvatarIds(playerClass, []),
			onChange: () => undefined,
			loading: props.loading,
		}),
	);
};

test("every card shows its own portrait, whatever the hero's class (no shared Knight face for the other classes)", () => {
	const html = draw('paladin');
	for (const avatar of AVATARS.filter((a) => !a.adminOnly)) {
		assert.ok(html.includes(`${avatar.portrait}.png`), `${avatar.id} draws ${avatar.portrait}`);
	}
	const knight = AVATARS.find((a) => a.id === 'knight')!;
	assert.equal(html.split(`${knight.portrait}.png`).length - 1, 1, 'the Knight portrait is drawn once, on the Knight card only');
});

test('while the unlocked set is loading the grid is skeleton cards of the full size: no faces, no names, nothing that could look unlocked', () => {
	const html = draw('mage', { loading: true });
	assert.match(html, /data-testid="avatar-skeleton"/);
	assert.equal((html.match(/avatar-card-skeleton/g) ?? []).length, 16);
	assert.doesNotMatch(html, /Needs the|\?\?\?|avatar-card-how|\.png|role="radio"/);
	for (const avatar of AVATARS) assert.ok(!html.includes(avatar.name), `${avatar.name} is not shown yet`);
});

test('once loaded, other classes keep the dimmed look with the lock line and unearned rewards stay "???"', () => {
	const html = draw('mage');
	assert.match(html, /data-class-locked="true"/);
	assert.match(html, /Needs the Warrior class/);
	assert.match(html, /\?\?\?/);
	assert.doesNotMatch(html, /data-loading="true"/);
});

test('the grid is four rows of four: the faces, then "Soon" cards for the free slots', () => {
	const { AVATAR_GRID_SLOTS } = require('../../src/components/game/AvatarPicker') as typeof import('../../src/components/game/AvatarPicker'); // eslint-disable-line @typescript-eslint/no-require-imports
	const html = draw('mage');
	assert.equal((html.match(/data-testid="avatar-soon"/g) ?? []).length, AVATAR_GRID_SLOTS - AVATARS.filter((a) => !a.adminOnly).length);
	assert.equal(AVATAR_GRID_SLOTS % 4, 0);
	assert.ok(AVATARS.length <= AVATAR_GRID_SLOTS);
});

test('the Admin avatar is not offered to anyone who does not hold it, not even as a locked card; the admin sees it enabled', () => {
	const other = draw('mage');
	assert.ok(!other.includes('avatar_admin.png'));
	assert.doesNotMatch(other, /Only for the game admin/);
	const admin = draw('mage', { unlocked: classAvatarIds('mage', ['admin']) });
	assert.ok(admin.includes('avatar_admin.png'));
});
