import assert from 'node:assert/strict';
import test from 'node:test';
import { ITEM_CATALOG } from '../../src/catalog';
import { COMBAT } from '../../src/config/combatConfig';
import { STARTER_EQUIPMENT } from '../../src/config/itemCatalog';
import { simSetup } from '../../src/lib/fightSim';
import { BURN_SEC } from '../../src/lib/offline/fightSteps';
import { runCombat } from '../../src/lib/offline/fight';
import type { Ledger } from '../../src/lib/offline/ledger';
import { playerProfile } from '../../src/lib/offline/profile';
import { plainItem } from '../../src/lib/itemInstance';
import { STRONG_KIT } from '../builders';
import type { Equipment } from '../../src/types/game';

// IDL-46: the two handlers of the legendary roster. Burn (Cindercrescent Glaive) and Potion refund (Amethyst Spire) ride on the perk channel as stats, are frozen into the fight's profile and
// applied inside the fight engine, from the fight's own sealed random stream (nothing is drawn unless the perk is worn).

// the win gate would not engage the tough monster these fights need; the handlers are the point here
(COMBAT.auto as { minWinChance: number }).minWinChance = 0;

const worn = (id: string): Equipment => ({ ...STARTER_EQUIPMENT, mainHand: { ...plainItem(id), rarity: 'legendary' } });

test('the handlers are in the worn profile, and only when the legendary is worn', () => {
	const core = (equipment: Equipment) => ({ equipment, characterStats: { availablePoints: 0 }, level: { level: 1, progress: 0 }, bag: [] }) as never;
	assert.equal(playerProfile(core(worn('cindercrescent_glaive'))).burnPct, 30);
	assert.equal(playerProfile(core(worn('amethyst_spire'))).potionRefundPct, 15);
	const plain = playerProfile(core(STARTER_EQUIPMENT));
	assert.equal('burnPct' in plain, false, 'no perk: the profile has no new field at all');
	assert.equal('potionRefundPct' in plain, false);
	assert.ok(ITEM_CATALOG.amethyst_spire.enabled !== false, 'the Spire is live now that its handler exists');
});

/** Opens one fight against a tough monster and returns the ledger with the fight open (the profile frozen into it is replaced by `profile`). */
const openFight = (profile: Record<string, number>) => {
	const s = simSetup({ equipment: STRONG_KIT, monsters: [{ type: 'thistleBoar', level: 40 }], seed: 'burn' });
	let ledger: Ledger = s.ledger;
	for (let t = 1; t <= 30 && !ledger.combat!.fight; t++) ledger = runCombat(ledger, s.env(s.start + t), {}).ledger;
	assert.ok(ledger.combat!.fight, 'a fight opened');
	const fight = ledger.combat!.fight!;
	ledger = { ...ledger, combat: { ...ledger.combat!, fight: { ...fight, profile: { ...fight.profile, ...profile } } } };
	return { s, ledger, at: ledger.combat!.at };
};

test('Burn: a crit lights the monster for 3 s at 30 % of that hit per second, never stacks, and the flames do damage on their own', () => {
	const burning = openFight({ burnPct: 30, crit: 1, superCrit: 0 });
	const plain = openFight({ crit: 1, superCrit: 0 });
	let a = burning.ledger;
	let b = plain.ledger;
	let lit: { leftSec: number; perSec: number } | undefined;
	for (let i = 1; i <= 6 && a.combat!.fight && b.combat!.fight; i++) {
		a = runCombat(a, burning.s.env(Math.ceil(burning.at) + i), {}).ledger;
		b = runCombat(b, plain.s.env(Math.ceil(plain.at) + i), {}).ledger;
		lit = lit ?? a.combat!.fight?.burn;
	}
	assert.ok(lit, 'the first crit set the monster alight');
	assert.ok(lit.leftSec <= BURN_SEC && lit.leftSec > 0);
	assert.equal(b.combat!.fight?.burn, undefined, 'no handler, no flames');
	const fa = a.combat!.fight;
	const fb = b.combat!.fight;
	if (fa && fb) assert.ok(fa.monsterHp < fb.monsterHp, `same swings, the burning monster has less HP left (${fa.monsterHp} vs ${fb.monsterHp})`);
	else assert.ok(!fa, 'or the burning one is already dead');
});

test('Potion refund: with a sure refund the potion stays in the bag, with none it is used up, and the heal is the same', () => {
	const run = (refund: number) => {
		const s = simSetup({
			equipment: STARTER_EQUIPMENT,
			monsters: [{ type: 'thistleBoar', level: 6 }],
			seed: 'refund',
			potions: [{ id: 'potion_minor', qty: 5 }],
		});
		let ledger: Ledger = s.ledger;
		for (let t = 1; t <= 30 && !ledger.combat!.fight; t++) ledger = runCombat(ledger, s.env(s.start + t), {}).ledger;
		const fight = ledger.combat!.fight!;
		ledger = {
			...ledger,
			combat: {
				...ledger.combat!,
				hp: Math.round(fight.profile.maxHp * 0.6),
				autoUse: false,
				fight: { ...fight, profile: { ...fight.profile, potionRefundPct: refund } },
			},
		};
		const out = runCombat(ledger, s.env(ledger.combat!.at + 0.5), { commands: [{ kind: 'potion', id: 'potion_minor' }] }).ledger;
		const left = out.inv!.bag.reduce((n, slot) => n + (slot && 'id' in slot && slot.id === 'potion_minor' ? slot.qty : 0), 0);
		const drunk = out.combat!.log.filter((e) => e.kind === 'potion');
		return { left, drunk: drunk.length, healed: drunk[0]?.amount };
	};
	const none = run(0);
	const sure = run(100);
	assert.equal(none.drunk, 1);
	assert.equal(sure.drunk, 1);
	assert.equal(none.left, 4, 'used up');
	assert.equal(sure.left, 5, 'refunded');
	assert.equal(sure.healed, none.healed, 'the heal itself is unchanged');
});
