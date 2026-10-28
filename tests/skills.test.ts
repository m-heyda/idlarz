import test from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS, SKILL_IDS, skillDescription } from '../src/catalog/skills';
import { INITIAL_CHARACTER_STATS } from '../src/config/gameConfig';
import { STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import { maxHp, maxMana } from '../src/lib/combat';
import { plainItem } from '../src/lib/itemInstance';
import { healAmount, isSkillId } from '../src/lib/skills';
import { calculateCombatStats } from '../src/utils/gameUtils';
import type { CharacterStats } from '../src/types/game';

const character = (over: Partial<CharacterStats> = {}): CharacterStats => {
	const stats = { ...INITIAL_CHARACTER_STATS, ...over };
	return Object.assign(stats, calculateCombatStats(stats));
};

test('the two skills: Heal unlocks at level 5, Stun at level 10 with a 10 s stun on a 30 s cooldown', () => {
	assert.deepEqual([...SKILL_IDS], ['heal', 'stun']);
	assert.equal(SKILLS.heal.unlockLevel, 5);
	assert.equal(SKILLS.heal.fightOnly, false);
	assert.equal(SKILLS.stun.unlockLevel, 10);
	assert.equal(SKILLS.stun.stunSec, 10);
	assert.equal(SKILLS.stun.cooldownSec, 30);
	assert.equal(SKILLS.stun.fightOnly, true);
	assert.ok(SKILLS.heal.cooldownSec < SKILLS.stun.cooldownSec);
	for (const id of SKILL_IDS) assert.ok(SKILLS[id].manaCost > 0 && SKILLS[id].manaCost <= maxMana(character(), {}), `${id} is castable with the starting mana pool`);
	assert.ok(skillDescription(SKILLS.stun).includes('10 s'), 'tooltips are built from the numbers');
	assert.ok(skillDescription(SKILLS.heal).includes('25%'));
	assert.equal(isSkillId('heal'), true);
	assert.equal(isSkillId('constructor'), false, 'a prototype name is not a skill');
	assert.equal(isSkillId(7), false);
});

test('Heal restores 25% of max HP, plus the Intelligence bonus (same rate as magic weapons) and the gear Spell Power', () => {
	const fresh = character();
	assert.equal(healAmount(fresh, STARTER_EQUIPMENT), Math.round(maxHp(fresh, STARTER_EQUIPMENT) * 0.25));
	const wise = character({ intelligence: 25 });
	assert.equal(healAmount(wise, STARTER_EQUIPMENT), Math.round(maxHp(wise, STARTER_EQUIPMENT) * 0.25 * 1.48));
	const staff = { ...STARTER_EQUIPMENT, mainHand: plainItem('oak_staff') };
	assert.ok(healAmount(fresh, staff) > healAmount(fresh, STARTER_EQUIPMENT), 'Spell Power on the staff makes it heal more');
	assert.ok(healAmount(fresh, STARTER_EQUIPMENT) >= 1);
});
