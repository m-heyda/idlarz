import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASS_AVATARS, CLASS_DEFAULT_AVATAR, creatorAvatar } from '../../src/catalog/avatars';
import { CLASS_PASSIVES } from '../../src/config/playerClasses';
import { describeClassPassives } from '../../src/lib/classPassives';
import { PLAYER_CLASS_ORDER } from '../../src/config/playerClasses';

// The hero creation block: which avatar it shows for a class, and that every class has bonuses to show (the screen lists the real CLASS_PASSIVES).

test("the creator shows the class default until one of the class's own avatars is picked", () => {
	assert.equal(creatorAvatar(null, 'knight'), null, 'no class, no avatar');
	assert.equal(creatorAvatar('mage', null), CLASS_DEFAULT_AVATAR.mage);
	assert.equal(creatorAvatar('mage', CLASS_AVATARS.mage[1]), CLASS_AVATARS.mage[1]);
	assert.equal(
		creatorAvatar('mage', 'knight'),
		CLASS_DEFAULT_AVATAR.mage,
		"another class's avatar falls back to the default (the pick resets when the class changes)",
	);
	assert.equal(creatorAvatar('mage', 'boss_slayer'), CLASS_DEFAULT_AVATAR.mage, 'an unearned one too');
	assert.equal(creatorAvatar('mage', 'boss_slayer', ['boss_slayer']), 'boss_slayer', 'an earned one stays');
});

test('every class has at least one combat and one economy bonus to list', () => {
	for (const id of PLAYER_CLASS_ORDER) {
		const lines = describeClassPassives(id);
		assert.ok(lines.combat.length > 0, `${id} combat`);
		assert.ok(lines.economy.length > 0, `${id} economy`);
		assert.ok(CLASS_PASSIVES[id]);
	}
});
