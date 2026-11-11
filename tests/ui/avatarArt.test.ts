import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AVATARS, CLASS_DEFAULT_AVATAR, STARTER_AVATAR_IDS, artAvatar, avatarById, resolveAvatar } from '../../src/catalog/avatars';
import { PLAYER_CLASS_ORDER } from '../../src/config/playerClasses';

const draw = (id: string | null, playerClass: (typeof PLAYER_CLASS_ORDER)[number]) => {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const AvatarArt = (require('../../src/components/game/AvatarArt') as typeof import('../../src/components/game/AvatarArt')).default;
	return renderToStaticMarkup(React.createElement(AvatarArt, { id, playerClass }));
};

test('an explicit id draws its own portrait whatever class is passed (creator, dimmed picker cards)', () => {
	for (const id of STARTER_AVATAR_IDS) {
		for (const cls of PLAYER_CLASS_ORDER) {
			assert.ok(draw(id, cls).includes(`${avatarById(id)!.portrait}.png`), `${id} under ${cls}`);
			assert.equal(artAvatar(id, cls).id, id);
		}
	}
	for (const avatar of AVATARS) assert.equal(artAvatar(avatar.id, 'mage').id, avatar.id);
});

test('null or unknown id falls back to the class default', () => {
	for (const cls of PLAYER_CLASS_ORDER) {
		assert.equal(artAvatar(null, cls).id, CLASS_DEFAULT_AVATAR[cls]);
		assert.equal(artAvatar('nope', cls).id, CLASS_DEFAULT_AVATAR[cls]);
	}
});

test("the player's own avatar still falls back to the class default when the stored one does not fit", () => {
	assert.equal(resolveAvatar('scout', 'warrior').id, CLASS_DEFAULT_AVATAR.warrior);
	assert.equal(resolveAvatar('scout', 'ranger').id, 'scout');
});
