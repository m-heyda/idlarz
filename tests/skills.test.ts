import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, store, gridCells } from './helpers';
import { SKILLS, SKILL_IDS, skillDescription } from '../src/catalog/skills';
import { INITIAL_CHARACTER_STATS } from '../src/config/gameConfig';
import { STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import { maxHp, maxMana, newFight, stepFight } from '../src/lib/combat';
import { plainItem } from '../src/lib/itemInstance';
import { pickPersisted } from '../src/lib/sanitizeSave';
import { castRefusal, healAmount, isSkillId, tickCooldowns } from '../src/lib/skills';
import { calculateCombatStats } from '../src/utils/gameUtils';
import type { CharacterStats, Monster } from '../src/types/game';

const character = (over: Partial<CharacterStats> = {}): CharacterStats => {
	const stats = { ...INITIAL_CHARACTER_STATS, ...over };
	return Object.assign(stats, calculateCombatStats(stats));
};
const noRng = () => 0;
const level = (n: number) => store.setState({ level: { level: n, progress: 0 } });
const max = () => maxHp(api().characterStats, api().equipment);

const withFight = (monster: Partial<Monster> = {}) => {
	freshGame();
	growTo(6);
	const spot = gridCells().filter(({ t }) => t.isOwned && t.biome !== 'castle')[0];
	store.setState({ monsters: [{ id: 1, type: 'rat', level: 1, spawnLevel: 1, x: spot.x, y: spot.y, ageSec: 0, ...monster }], nextMonsterId: 2 });
	assert.equal(api().startFight(1), true);
};

test('the two skills: Heal unlocks at level 5, Stun at level 10 with a 3 s stun on a 15 s cooldown', () => {
	assert.deepEqual([...SKILL_IDS], ['heal', 'stun']);
	assert.equal(SKILLS.heal.unlockLevel, 5);
	assert.equal(SKILLS.heal.fightOnly, false);
	assert.equal(SKILLS.stun.unlockLevel, 10);
	assert.equal(SKILLS.stun.stunSec, 3);
	assert.equal(SKILLS.stun.cooldownSec, 15);
	assert.equal(SKILLS.stun.fightOnly, true);
	assert.ok(SKILLS.heal.cooldownSec < SKILLS.stun.cooldownSec);
	for (const id of SKILL_IDS) assert.ok(SKILLS[id].manaCost > 0 && SKILLS[id].manaCost <= maxMana(character(), {}), `${id} is castable with the starting mana pool`);
	assert.ok(skillDescription(SKILLS.stun).includes('3 s'), 'tooltips are built from the numbers');
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

test('castRefusal names the reason, in the order the UI explains it', () => {
	const ready = { level: 30, mana: 100, hp: 10, maxHp: 100, fight: null, cooldowns: {} };
	assert.equal(castRefusal('heal', ready), null);
	assert.equal(castRefusal('heal', { ...ready, level: 4 }), 'locked');
	assert.equal(castRefusal('stun', { ...ready, level: 9 }), 'locked');
	assert.equal(castRefusal('stun', ready), 'noFight', 'Stun needs a fight');
	assert.equal(castRefusal('heal', { ...ready, cooldowns: { heal: 3 } }), 'cooldown');
	assert.equal(castRefusal('heal', { ...ready, mana: 19 }), 'mana');
	assert.equal(castRefusal('heal', { ...ready, hp: 100 }), 'fullHp');
	assert.deepEqual(tickCooldowns({ heal: 5, stun: 1 }, 2), { heal: 3 });
	assert.deepEqual(tickCooldowns({ heal: 5 }, NaN), { heal: 5 });
});

test('castSkill(heal): level gate, mana, cooldown, the HP cap and the full-HP refusal, in and out of a fight', () => {
	freshGame();
	store.setState({ playerHp: 40 });
	level(4);
	assert.equal(api().castSkill('heal'), false, 'locked below level 5');
	level(5);
	const mana = api().playerMp;
	assert.equal(api().castSkill('heal'), true);
	assert.equal(api().playerHp, 40 + healAmount(api().characterStats, api().equipment));
	assert.equal(api().playerMp, mana - SKILLS.heal.manaCost);
	assert.equal(api().skillCd.heal, SKILLS.heal.cooldownSec);
	assert.equal(api().castSkill('heal'), false, 'cooldown');
	assert.equal(api().castSkill('nope' as never), false);
	store.setState({ skillCd: {}, playerHp: max() - 3 });
	assert.equal(api().castSkill('heal'), true);
	assert.equal(api().playerHp, max(), 'the heal stops at max HP');
	store.setState({ skillCd: {} });
	assert.equal(api().castSkill('heal'), false, 'full HP');
	store.setState({ skillCd: {}, playerHp: 10, playerMp: SKILLS.heal.manaCost - 1 });
	assert.equal(api().castSkill('heal'), false, 'not enough mana');
	assert.equal(api().playerHp, 10);
});

test('castSkill(heal) works in an active fight and not once it is over', () => {
	withFight();
	level(5);
	store.setState({ playerHp: 30 });
	assert.equal(api().castSkill('heal'), true);
	assert.ok(api().playerHp > 30);
	store.setState({ skillCd: {}, playerHp: 30, fight: { ...api().fight!, phase: 'knockedOut' } });
	assert.equal(api().castSkill('heal'), false);
});

test('skill cooldowns and mana run down with the game clock', () => {
	freshGame();
	store.setState({ playerHp: 40 });
	level(5);
	api().castSkill('heal');
	const mpAfter = api().playerMp;
	for (let i = 0; i < SKILLS.heal.cooldownSec - 1; i++) api().tick(1000);
	level(5);
	assert.ok((api().skillCd.heal ?? 0) > 0 && (api().skillCd.heal ?? 0) <= 1.01, `${api().skillCd.heal} s left`);
	assert.equal(api().castSkill('heal'), false);
	api().tick(1000);
	api().tick(1000);
	level(5);
	assert.equal(api().skillCd.heal, undefined, 'the cooldown entry is gone once it ran out');
	assert.ok(api().playerMp > mpAfter, 'mana regenerated meanwhile');
	store.setState({ playerHp: 40 });
	assert.equal(api().castSkill('heal'), true);
});

test('castSkill(stun): fights only, level 10, freezes the monster for 3 s, then the attacks resume', () => {
	freshGame();
	level(30);
	assert.equal(api().castSkill('stun'), false, 'no fight');
	withFight();
	level(9);
	assert.equal(api().castSkill('stun'), false, 'locked below level 10');
	level(10);
	const mana = api().playerMp;
	assert.equal(api().castSkill('stun'), true);
	assert.equal(api().fight?.stunLeftSec, SKILLS.stun.stunSec);
	assert.equal(api().playerMp, mana - SKILLS.stun.manaCost);
	assert.equal(api().skillCd.stun, SKILLS.stun.cooldownSec);
	assert.equal(api().castSkill('stun'), false, 'cooldown');

	const hp = api().playerHp;
	api().tick(1000);
	api().tick(1000);
	assert.equal(api().playerHp >= hp, true, 'no damage while stunned');
	assert.equal(api().fight?.attackTimer, 0, 'the monster did not even wind up');
	api().tick(1000);
	assert.equal(api().fight?.stunLeftSec, 0);
	api().tick(1000);
	api().tick(1000);
	assert.ok(api().playerHp < hp, 'after the stun the rat bites again');
});

test('stepFight: the stun runs down first and only the rest of the step winds up the attack', () => {
	const fight = { ...newFight({ id: 1, type: 'rat', level: 1 }), stunLeftSec: 0.75 };
	let r = stepFight(fight, 1, 100, 2, noRng);
	assert.equal(r.fight.stunLeftSec, 0);
	assert.equal(r.fight.attackTimer, 0.25, 'a quarter of the second counted towards the attack');
	assert.deepEqual(r.events, []);
	r = stepFight({ ...fight, stunLeftSec: 3 }, 1, 100, 2, noRng);
	assert.equal(r.fight.stunLeftSec, 2);
	assert.equal(r.fight.attackTimer, 0);
	// a stunned King still runs out of time
	const king = { ...newFight({ id: 2, type: 'ratKing', level: 15 }), stunLeftSec: 3 };
	assert.equal(stepFight(king, 1, 100, 2, noRng).fight.timeLeftSec, king.timeLeftSec! - 1);
	assert.equal(newFight({ id: 1, type: 'rat', level: 1 }).stunLeftSec, 0);
});

test('skill cooldowns are transient: a save never holds them', () => {
	freshGame();
	level(5);
	store.setState({ playerHp: 40 });
	api().castSkill('heal');
	assert.ok(api().skillCd.heal);
	assert.equal('skillCd' in pickPersisted(api()), false);
});
