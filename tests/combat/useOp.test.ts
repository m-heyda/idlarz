import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_CATALOG } from '../../src/catalog';
import type { ConsumableEffect } from '../../src/catalog/buffs';
import { COMBAT } from '../../src/config/combatConfig';
import { fullSet, simSetup } from '../../src/lib/fightSim';
import { readBuffs, type ActiveBuff } from '../../src/lib/buffs';
import { applyUse } from '../../src/lib/offline/consumables';
import { runCombat } from '../../src/lib/offline/fight';
import { inventoryFromCore, parseOp } from '../../src/lib/offline/inventory';
import { playerProfile, profileWithBuffs, withBuffs } from '../../src/lib/offline/profile';
import { newLedger, type Ledger } from '../../src/lib/offline/ledger';
import { supabaseLedgerRepo } from '../../src/lib/offline/supabaseLedger';

// The `use` operation of /api/inventory and the way the running buffs reach a fight (IDL-155 part 2). The online route is covered in tests/server/serverUse.test.ts.

(COMBAT.auto as { minWinChance: number }).minWinChance = 0;

const buff = (family: ActiveBuff['family'], stat: ActiveBuff['stat'], amount: number, untilSec: number): ActiveBuff => ({ family, stat, amount, untilSec });
const def = (id: string, effects: ConsumableEffect[]) => {
	ITEM_CATALOG[id] = { ...ITEM_CATALOG.potion_minor, id, name: id, effects, stackMax: 20 };
};
def('t_might', [{ kind: 'buff', family: 'might', stat: 'damagePct', amount: 50, durationSec: 120 }]);
def('t_haste', [{ kind: 'buff', family: 'haste', stat: 'atkSpeedPct', amount: 20, durationSec: 60 }]);
def('t_regen', [{ kind: 'regen', hpPerSec: 5, durationSec: 10 }]);

const setup = (potions: { id: string; qty: number }[] = []) =>
	simSetup({ equipment: fullSet('steel'), potions, monsters: [{ type: 'thistleBoar', level: 3 }], seed: 'use-op' });
const seeded = (s: ReturnType<typeof setup>): Ledger => ({ ...s.ledger, inv: inventoryFromCore(s.stored.core as Record<string, unknown>) });
const coreOf = (s: ReturnType<typeof setup>) => s.stored.core as Record<string, unknown>;

test('a profile with no buffs is the very same profile; buffs scale the numbers they name and cap crit and dodge', () => {
	const s = setup();
	const base = playerProfile(coreOf(s));
	assert.equal(withBuffs(base, {}), base);
	const buffed = withBuffs(base, { damagePct: 50, atkSpeedPct: 20, armorPct: 10, maxHpPct: 10, critChance: 1000, dodge: 1000 });
	assert.equal(buffed.hit, base.hit * 1.5);
	assert.equal(buffed.attacksPerSec, base.attacksPerSec * 1.2);
	assert.equal(buffed.maxHp, Math.round(base.maxHp * 1.1));
	assert.equal(buffed.crit, COMBAT.crit.maxCritChance / 100);
	assert.equal(buffed.dodge, COMBAT.maxDodge / 100);
	assert.equal(profileWithBuffs(coreOf(s), [buff('might', 'damagePct', 50, 200)], 100).hit, base.hit * 1.5);
	assert.equal(profileWithBuffs(coreOf(s), [buff('might', 'damagePct', 50, 100)], 100).hit, base.hit, 'ended at 100: not counted');
});

test('a fight with Might hits harder, is deterministic, and a fight with no potions is unchanged', () => {
	const s = setup();
	const run = (buffs: ActiveBuff[]) => {
		const ledger: Ledger = { ...s.ledger, buffs };
		const out = runCombat(ledger, s.env(s.start + 1), { commands: [{ kind: 'fight', n: 1 }] });
		return runCombat(out.ledger, s.env(s.start + 4)).ledger;
	};
	const damageOf = (l: Ledger) => l.combat!.log.filter((e) => ['hit', 'crit', 'super'].includes(e.kind)).reduce((sum, e) => sum + (e.amount ?? 0), 0);
	const plain = run([]);
	assert.deepEqual(run([]).combat, plain.combat, 'no potions: the same fight every time');
	const opened = runCombat({ ...s.ledger }, s.env(s.start + 1), { commands: [{ kind: 'fight', n: 1 }] });
	assert.equal(opened.ledger.combat!.fight?.profile.hit, playerProfile(coreOf(s)).hit, 'the frozen profile has no buff in it');
	const mighty = run([buff('might', 'damagePct', 50, s.start + 100)]);
	assert.deepEqual(run([buff('might', 'damagePct', 50, s.start + 100)]).combat, mighty.combat, 'with a buff: deterministic too');
	assert.ok(damageOf(mighty) > damageOf(plain) * 1.3, `${damageOf(mighty)} vs ${damageOf(plain)}`);
});

test('a buff that ended before the fight starts changes nothing; the fight freezes the profile it started with', () => {
	const s = setup();
	const base = playerProfile(coreOf(s)).hit;
	const expired = runCombat({ ...s.ledger, buffs: [buff('might', 'damagePct', 50, s.start - 5)] }, s.env(s.start + 1), { commands: [{ kind: 'fight', n: 1 }] });
	assert.equal(expired.ledger.combat!.fight?.profile.hit, base);
	const live = runCombat({ ...s.ledger, buffs: [buff('might', 'damagePct', 50, s.start + 2)] }, s.env(s.start + 1), { commands: [{ kind: 'fight', n: 1 }] });
	const hit = live.ledger.combat!.fight!.profile.hit;
	assert.ok(hit > base);
	const later = runCombat(live.ledger, s.env(s.start + 3));
	assert.equal(later.ledger.combat!.fight?.profile.hit ?? hit, hit, 'the open fight keeps the buff it began with');
});

test('applyUse: a buff potion leaves the bag once, records the buff with its end time, refreshes a running family and refuses a sixth', () => {
	const s = setup([{ id: 't_might', qty: 3 }]);
	const now = s.start + 10;
	const used = applyUse(seeded(s), s.env(now), 0);
	assert.ok(used.ok);
	if (!used.ok) return;
	assert.deepEqual(used.ledger.buffs, [buff('might', 'damagePct', 50, now + 120)]);
	const slot = used.ledger.inv!.bag[0];
	assert.equal(slot && 'qty' in slot ? slot.qty : 0, 2);
	assert.equal(used.ledger.inv!.ver, seeded(s).inv!.ver + 1);
	const again = applyUse(used.ledger, s.env(now + 50), 0);
	assert.ok(again.ok);
	if (again.ok) {
		assert.equal(again.ledger.buffs.length, 1);
		assert.equal(again.ledger.buffs[0].untilSec, now + 50 + 120);
	}
	const full: ActiveBuff[] = [
		buff('haste', 'atkSpeedPct', 5, now + 100),
		buff('ironskin', 'armorPct', 5, now + 101),
		buff('keenEye', 'critChance', 5, now + 102),
		buff('fortitude', 'maxHpPct', 5, now + 103),
		buff('warding', 'dodge', 5, now + 104),
	];
	const refused = applyUse({ ...seeded(s), buffs: full }, s.env(now), 0);
	assert.equal(refused.ok, false);
	if (!refused.ok) assert.match(refused.message, /Only 5/);
	const five = applyUse({ ...seeded(s), buffs: [...full.slice(0, 4), buff('might', 'damagePct', 10, now + 5)] }, s.env(now), 0);
	assert.ok(five.ok, 'a refresh is allowed at the cap');
});

test('applyUse: mana and regen go through the same op; a bad slot and a full pool are refused', () => {
	const s = setup([
		{ id: 'potion_mana', qty: 1 },
		{ id: 't_regen', qty: 1 },
	]);
	const now = s.start + 1;
	const low: Ledger = { ...seeded(s), combat: { ...seeded(s).combat!, mp: 0, hp: 10 } };
	const mana = applyUse(low, s.env(now), 0);
	assert.ok(mana.ok);
	if (mana.ok) assert.ok(mana.ledger.combat!.mp > 0);
	const regen = applyUse(low, s.env(now), 1);
	assert.ok(regen.ok);
	if (regen.ok) {
		assert.deepEqual(regen.ledger.combat!.regen, { hpPerSec: 5, untilSec: now + 10 });
		const after = runCombat(regen.ledger, s.env(now + 4));
		assert.ok(after.ledger.combat!.hp >= 10 + 5 * 4 - 1e-6, 'the heal over time runs');
	}
	assert.equal(applyUse(seeded(s), s.env(now), 0).ok, false, 'mana already full');
	assert.equal(applyUse(low, s.env(now), 5).ok, false);
	assert.equal(applyUse(low, s.env(now), 30).ok, false);
});

test('an open fight puts the potion cooldown on a drunk potion', () => {
	const s = setup([{ id: 't_might', qty: 3 }]);
	const open = runCombat(s.ledger, s.env(s.start + 1), { commands: [{ kind: 'fight', n: 1 }] });
	const used = applyUse(open.ledger, s.env(s.start + 1), 0);
	assert.ok(used.ok);
	if (!used.ok) return;
	assert.equal(used.ledger.combat!.cd.potion, COMBAT.potionCooldownSec);
	assert.equal(applyUse(used.ledger, s.env(s.start + 1), 0).ok, false, 'on cooldown');
});

test('auto-use and the hotkeys never drink a buff potion', () => {
	const s = setup([{ id: 't_might', qty: 3 }]);
	const hurt: Ledger = { ...s.ledger, combat: { ...s.ledger.combat!, hp: 5 } };
	const out = runCombat(hurt, s.env(s.start + 1), {
		commands: [
			{ kind: 'fight', n: 1 },
			{ kind: 'potion', id: 't_might' },
		],
	});
	const later = runCombat(out.ledger, s.env(s.start + 20));
	const slot = later.ledger.inv!.bag.find((entry) => entry && 'id' in entry && entry.id === 't_might');
	assert.equal(slot && 'qty' in slot ? slot.qty : 0, 3);
	assert.deepEqual(later.ledger.buffs, []);
});

test('the ledger column: unknown families and garbage are dropped on read, an empty list is stored as null', async () => {
	const rows: Record<string, unknown>[] = [];
	const db = {
		from: () => ({
			select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: rows[0], error: null }) }) }),
			update: (row: Record<string, unknown>) => ({
				eq: () => ({
					eq: () => ({
						select: async () => {
							rows.unshift(row);
							return { data: [{ ver: 1 }], error: null };
						},
					}),
				}),
			}),
		}),
	};
	const repo = supabaseLedgerRepo(db as never);
	const ledger = newLedger(1_700_000_000_000);
	await repo.commit('u', 1, { ...ledger, ver: 2, buffs: [] });
	assert.equal(rows[0].buffs, null);
	await repo.commit('u', 1, { ...ledger, ver: 2, buffs: [buff('might', 'damagePct', 10, 99)] });
	assert.deepEqual(rows[0].buffs, [buff('might', 'damagePct', 10, 99)]);
	rows[0] = {
		...rows[0],
		anchor_at: new Date().toISOString(),
		reset_at: null,
		buffs: [{ family: 'retiredFamily', amount: 5, untilSec: 9e9 }, { family: 'might', amount: 10, untilSec: 9e9 }, 'junk', null],
	};
	const loaded = await repo.load('u');
	assert.deepEqual(
		loaded!.buffs.map((b) => b.family),
		['might'],
	);
	assert.deepEqual(readBuffs('nonsense', 0), []);
});

test('parseOp reads the use operation', () => {
	assert.deepEqual(parseOp({ action: 'use', index: 3 }), { action: 'use', index: 3 });
	assert.equal(parseOp({ action: 'use' }), null);
	assert.equal(parseOp({ action: 'use', index: 1.5 }), null);
});
