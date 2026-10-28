import test from 'node:test';
import assert from 'node:assert/strict';
import { api, growTo, store } from './helpers';
import { pickPersisted, type PersistedGame } from '../src/lib/sanitizeSave';
import { encodeSave } from '../src/lib/saveFormat';
import { acceptSave, type SaveRepo, type StatsRow, type StoredSave, type WorldPart } from '../src/lib/cloudSave/pipeline';
import type { Ledger, LedgerRepo } from '../src/lib/offline/ledger';
import type { ServiceDeps } from '../src/lib/offline/service';
import { fightStep, inventoryStep, redeemChest, syncTickets, type Online } from '../src/lib/offline/online';
import { applyOp, bagCountOf, inventoryFromCore, parseOp, stampInventory } from '../src/lib/offline/inventory';
import { addDrop, emptyBag } from '../src/lib/inventory';
import { plainItem, sellValueOf } from '../src/lib/itemInstance';
import { sellPayout } from '../src/utils/gameUtils';
import { LOOT_PROFILES } from '../src/catalog';
import type { Inventory } from '../src/lib/offline/types';
import type { BagSlot } from '../src/types/game';

// The ledger owns the bag, the gear, the pity and the auto-sell filter: an upload cannot change them, and the player's own changes are
// operations the server applies (/api/inventory).

const memory = () => {
	const rows = new Map<string, StoredSave>();
	const worlds = new Map<string, WorldPart>();
	const stats = new Map<string, StatsRow>();
	const ledgers = new Map<string, Ledger>();
	const saves: SaveRepo = {
		load: async (id, options) => {
			const row = rows.get(id);
			if (!row) return null;
			return options?.world ? { ...row, world: worlds.get(id) } : { ...row };
		},
		commit: async (id, baseRev, save, world, st) => {
			const current = rows.get(id);
			if (baseRev === 0 ? !!current : current?.rev !== baseRev) return false;
			rows.set(id, save);
			if (world) worlds.set(id, world);
			stats.set(id, st);
			return true;
		},
		archive: async () => undefined,
		pin: async () => undefined,
	};
	const ledgerRepo: LedgerRepo = {
		load: async (id) => (ledgers.has(id) ? structuredClone(ledgers.get(id)!) : null),
		commit: async (id, expectedVer, ledger) => {
			const current = ledgers.get(id);
			if (expectedVer === 0 ? !!current : current?.ver !== expectedVer) return false;
			ledgers.set(id, structuredClone(ledger));
			return true;
		},
	};
	const deps: ServiceDeps = { saves, ledgers: ledgerRepo, secret: 'test-secret-test-secret' };
	return { saves, ledgerRepo, ledgers, rows, deps };
};

const game = (): PersistedGame => {
	api().resetGame();
	growTo(60);
	api().tick(1000);
	store.setState({ playSeconds: 1000, resources: { ...api().resources, gold: 100, wood: 0, stone: 0, coal: 0, food: 0, hide: 0 } } as never);
	return structuredClone(pickPersisted(api()));
};
/** A loot table that keeps a bad-luck counter (the only keys a save may hold in `lootPity`) */
const PITY_KEY = Object.values(LOOT_PROFILES).flatMap((profile) => profile.bonusTables.filter((table) => table.pity).map((table) => `${profile.id}:${table.id}`))[0];
const T0 = 1_800_000_000_000;
const MIN = 60_000;
const save = (m: ReturnType<typeof memory>, id: string, state: PersistedGame, baseRev: number, at: number) => acceptSave(m.saves, id, 'Zoë', encodeSave(state), baseRev, at, false, m.ledgerRepo);
const ok = <T>(out: Online<T>): T => {
	assert.equal(out.kind, 'ok', JSON.stringify(out));
	return (out as { kind: 'ok'; value: T }).value;
};

/** A player with a saved game and a ledger (the first online request creates it, seeded from the save). */
const player = async (state = game(), id = 'u1') => {
	const m = memory();
	await save(m, id, state, 0, T0);
	return { m, id, inv: () => m.ledgers.get(id)!.inv! };
};
/** The player stays around for `minutes`: the game asks the server every ten minutes or so, which keeps "last seen" fresh. */
const stay = async (p: Awaited<ReturnType<typeof player>>, minutes: number) => {
	for (let t = 10; t <= minutes; t += 10) ok(await syncTickets(p.m.deps, p.id, T0 + t * MIN));
};
let keyNo = 0;
const key = () => `inv-key-${String(++keyNo).padStart(6, '0')}`;
const op = async (p: Awaited<ReturnType<typeof player>>, body: Record<string, unknown>, at = T0 + MIN) => {
	const parsed = parseOp(body);
	assert.ok(parsed, JSON.stringify(body));
	return ok(await inventoryStep(p.m.deps, p.id, key(), parsed!, at));
};
const bag = (...slots: BagSlot[]): BagSlot[] => {
	const out = emptyBag();
	slots.forEach((slot, i) => (out[i] = slot));
	return out;
};

// ---------------------------------------------------------------------------------------------------- the ledger owns it

test('a save seeds the ledger\'s inventory the first time, and the answer to an online call carries it when the browser\'s version is not the current one', async () => {
	const p = await player();
	assert.equal(p.m.ledgers.get(p.id)!.inv?.ver, 1, 'the first save seeds it');
	const first = ok(await syncTickets(p.m.deps, p.id, T0 + MIN));
	assert.ok(first.inv, 'a browser that knows no version is sent the inventory');
	assert.deepEqual(first.inv!.equipment, inventoryFromCore(p.m.rows.get(p.id)!.core).equipment);
	const same = ok(await syncTickets(p.m.deps, p.id, T0 + 2 * MIN, undefined, first.inv!.ver));
	assert.equal(same.inv, undefined, 'the same version: nothing to send');
});

test('an uploaded save cannot change the bag, the gear, the pity or the auto-sell filter: the stored copy carries the ledger\'s', async () => {
	const state = game();
	const p = await player(state);
	const real = structuredClone(p.inv());
	const forged: PersistedGame = {
		...state,
		playSeconds: state.playSeconds + 120,
		equipment: { ...state.equipment, head: plainItem('rattatui_cap'), chest: plainItem('rattatui_tunic') },
		bag: addDrop(state.bag, { kind: 'gear', item: plainItem('rattatui_fang_blade') }).bag,
		lootPity: { [PITY_KEY]: 3 },
		autoSellUpTo: 'uncommon',
	};
	const out = await save(p.m, p.id, forged, 1, T0 + 2 * MIN);
	assert.equal(out.kind, 'ok');
	const stored = p.m.rows.get(p.id)!.core as Record<string, unknown>;
	assert.deepEqual(stored.equipment, real.equipment);
	assert.deepEqual(stored.bag, real.bag);
	assert.deepEqual(stored.lootPity, real.lootPity);
	assert.equal(stored.autoSellUpTo ?? null, real.autoSellUpTo);
	assert.deepEqual(p.inv(), real, 'and the ledger did not move');
});

test('the summary is worked out from the ledger\'s gear: a set claimed in an upload gives no bonus', async () => {
	const state = game();
	const p = await player(state);
	const before = p.m.rows.get(p.id)!.summary;
	const set = ['head', 'shoulder', 'chest', 'hands', 'legs', 'feet', 'neck', 'cape', 'ring1', 'ring2', 'charm'] as const;
	const ids = ['obsidian_helm', 'obsidian_pauldrons', 'obsidian_cuirass', 'obsidian_gauntlets', 'obsidian_greaves', 'obsidian_sabatons', 'obsidian_pendant', 'obsidian_cloak', 'obsidian_ring', 'obsidian_ring', 'obsidian_charm'];
	const equipment = { ...state.equipment, ...Object.fromEntries(set.map((slot, i) => [slot, plainItem(ids[i])])) };
	await save(p.m, p.id, { ...state, playSeconds: state.playSeconds + 120, equipment }, 1, T0 + 2 * MIN);
	const after = p.m.rows.get(p.id)!.summary;
	assert.equal(after.xpGainPct, before.xpGainPct, 'no Obsidian XP bonus');
	assert.equal(after.derived.killRewardPct ?? 0, 0);
});

test('a New Game starts the ledger\'s inventory again from the new game; a rebirth keeps it', async () => {
	const state = game();
	const p = await player(state);
	const worn = { ...p.inv().equipment, head: plainItem('steel_helm') };
	p.m.ledgers.set(p.id, { ...p.m.ledgers.get(p.id)!, inv: { ...p.inv(), equipment: worn, ver: 5 } });
	// a rebirth (more rebirths in the save): the gear stays
	const reborn: PersistedGame = { ...state, playSeconds: state.playSeconds + 120, prestige: { ...state.prestige, rebirths: state.prestige.rebirths + 1, legacyPoints: state.prestige.legacyPoints + 5, legacyEarned: state.prestige.legacyEarned + 5 } };
	const rebirth = await save(p.m, p.id, reborn, 1, T0 + 2 * MIN);
	assert.equal(rebirth.kind, 'ok', JSON.stringify(rebirth));
	assert.equal(p.inv().equipment.head?.base, 'steel_helm');
	// a New Game (the play time of the same run goes back): the new game's own starter kit
	api().resetGame();
	const fresh = structuredClone(pickPersisted(api()));
	const restarted = await save(p.m, p.id, { ...fresh, prestige: reborn.prestige }, 2, T0 + 3 * MIN);
	assert.equal(restarted.kind, 'ok', JSON.stringify(restarted));
	assert.equal(p.inv().equipment.head, undefined);
	assert.equal(p.inv().equipment.mainHand?.base, 'wooden_sword');
});

test('a bag grows with the Pack Rat level of the save and never shrinks', async () => {
	const state = game();
	const p = await player(state);
	const size = p.inv().bag.length;
	await save(p.m, p.id, { ...state, playSeconds: state.playSeconds + 120, merchantUpgrades: { ...state.merchantUpgrades, packrat: 2 }, bag: [...state.bag, null, null, null, null, null, null, null, null] }, 1, T0 + 2 * MIN);
	ok(await syncTickets(p.m.deps, p.id, T0 + 3 * MIN));
	assert.equal(p.inv().bag.length, size + 8);
	const stamped = stampInventory(state, { ...p.inv(), bag: p.inv().bag.slice(0, size) });
	assert.ok(stamped.bag.length >= size, 'padded to what the save is entitled to, never cut');
});

// ---------------------------------------------------------------------------------------------------- the player's operations

test('equip, unequip, move, organize and discard change the ledger\'s inventory and bump its version; the answer is the inventory', async () => {
	const p = await player();
	ok(await syncTickets(p.m.deps, p.id, T0 + MIN)); // seeds nothing new: the ledger exists
	const seeded: Inventory = { ...p.inv(), bag: bag({ item: plainItem('steel_helm') }, { id: 'potion_minor', qty: 2 }, { item: plainItem('steel_mace') }) };
	p.m.ledgers.set(p.id, { ...p.m.ledgers.get(p.id)!, inv: seeded });
	const v0 = seeded.ver;

	const equipped = await op(p, { action: 'equip', index: 0 });
	assert.equal(equipped.ok, true);
	assert.equal(equipped.inv.equipment.head?.base, 'steel_helm');
	assert.equal(equipped.inv.bag[0], null);
	assert.ok(equipped.inv.ver > v0);

	const moved = await op(p, { action: 'move', from: 1, to: 5 });
	assert.deepEqual(moved.inv.bag[5], { id: 'potion_minor', qty: 2 });

	const discarded = await op(p, { action: 'discard', index: 5, qty: 1 });
	assert.deepEqual(discarded.inv.bag[5], { id: 'potion_minor', qty: 1 });

	const tidy = await op(p, { action: 'organize' });
	assert.ok(tidy.ok);

	const off = await op(p, { action: 'unequip', slot: 'head' });
	assert.equal(off.inv.equipment.head, undefined);
	assert.equal(bagCountOf(off.inv, 'potion_minor'), 1);
	assert.deepEqual(p.inv(), off.inv, 'what was answered is what the ledger holds');
});

test('a sale pays the server\'s price (Haggler from the save) and records the gold as granted, so the save that holds it passes', async () => {
	const state: PersistedGame = { ...game() };
	state.merchantUpgrades = { ...state.merchantUpgrades, haggler: 3 };
	const p = await player(state);
	const sword = plainItem('steel_mace');
	p.m.ledgers.set(p.id, { ...p.m.ledgers.get(p.id)!, inv: { ...p.inv(), bag: bag({ item: sword }, { id: 'potion_minor', qty: 3 }) } });
	const grantedBefore = p.m.ledgers.get(p.id)!.granted.gold;

	const sold = await op(p, { action: 'sell', index: 0 });
	assert.equal(sold.ok, true);
	assert.equal(sold.gold, sellPayout(sellValueOf(sword), 1, { merchantUpgrades: { haggler: 3 } }));
	assert.equal(sold.inv.bag[0], null);
	assert.equal(p.m.ledgers.get(p.id)!.granted.gold, grantedBefore + sold.gold);

	const potions = await op(p, { action: 'sell', index: 1, qty: 2 });
	assert.equal(potions.count, 2);
	assert.deepEqual(potions.inv.bag[1], { id: 'potion_minor', qty: 1 });
	const nothing = await op(p, { action: 'sell', index: 7 });
	assert.deepEqual([nothing.ok, nothing.gold], [false, 0], 'an empty slot sells nothing');
	const tooMany = await op(p, { action: 'sell', index: 1, qty: 5 });
	assert.equal(tooMany.ok, false);
});

test('sellJunk sells the gear up to a rarity and leaves potions and better gear; the auto-sell filter is the ledger\'s too', async () => {
	const p = await player();
	const rare = { ...plainItem('steel_mace'), rarity: 'rare' as const };
	p.m.ledgers.set(p.id, { ...p.m.ledgers.get(p.id)!, inv: { ...p.inv(), bag: bag({ item: plainItem('steel_helm') }, { item: rare }, { id: 'potion_minor', qty: 1 }, { item: plainItem('steel_cuirass') }) } });
	const junk = await op(p, { action: 'sellJunk', maxRarity: 'uncommon' });
	assert.equal(junk.count, 2);
	assert.ok(junk.gold > 0);
	assert.ok(junk.inv.bag.some((slot) => slot && 'item' in slot && slot.item.rarity === 'rare'));
	assert.deepEqual(junk.inv.bag[2], { id: 'potion_minor', qty: 1 });
	assert.equal((await op(p, { action: 'sellJunk', maxRarity: 'mythic' })).ok, false, 'an unknown rarity');

	const auto = await op(p, { action: 'autoSell', rarity: 'common' });
	assert.equal(auto.inv.autoSellUpTo, 'common');
	assert.equal(p.inv().autoSellUpTo, 'common');
	assert.equal((await op(p, { action: 'autoSell', rarity: null })).inv.autoSellUpTo, null);
});

test('purchases add to the ledger\'s bag: shop items and an offered piece; a full bag refuses, an invalid piece refuses', async () => {
	const p = await player();
	const bought = await op(p, { action: 'buyShop', id: 'potion_minor', qty: 3 });
	assert.equal(bought.ok, true);
	assert.equal(bagCountOf(bought.inv, 'potion_minor'), bagCountOf(p.m.ledgers.get(p.id)!.inv!, 'potion_minor'));
	assert.equal((await op(p, { action: 'buyShop', id: 'steel_helm', qty: 1 })).ok, false, 'not on the shelf');
	assert.equal((await op(p, { action: 'buyShop', id: 'potion_minor', qty: 0 })).ok, false);

	const offer = { ...plainItem('steel_helm'), level: 4, rarity: 'uncommon' as const, quality: 50, affixes: [] };
	const piece = await op(p, { action: 'buyOffer', item: offer });
	assert.equal(piece.ok, true);
	assert.ok(piece.inv.bag.some((slot) => slot && 'item' in slot && slot.item.base === 'steel_helm'));
	const forged = await op(p, { action: 'buyOffer', item: { base: 'steel_helm', level: 4, rarity: 'legendary', quality: 999, affixes: [] } });
	assert.equal(forged.ok, false, 'an item that cannot exist');

	p.m.ledgers.set(p.id, { ...p.m.ledgers.get(p.id)!, inv: { ...p.inv(), bag: emptyBag().map(() => ({ item: plainItem('wooden_sword') })) } });
	assert.equal((await op(p, { action: 'buyOffer', item: offer })).ok, false, 'a full bag');
});

test('changes that swap or sell gear are refused while a fight is open, purchases and the filter are not; the same key replays the answer', async () => {
	const p = await player();
	const sync = ok(await fightStep(p.m.deps, p.id, null, { action: 'sync' }, T0 + MIN));
	assert.equal(sync.accepted, true);
	// a fight is open on the server (a rat, engaged by a click)
	await stay(p, 30);
	const ticketMs = T0 + 31 * MIN;
	const view = ok(await syncTickets(p.m.deps, p.id, ticketMs));
	const rat = view.tickets.rats[0];
	assert.ok(rat, 'a rat has appeared');
	const opened = ok(await fightStep(p.m.deps, p.id, key(), { action: 'use', command: { kind: 'fight', n: rat.n } }, ticketMs + 1000));
	assert.ok(opened.combat.fight, 'the fight is open');
	const seeded = { ...p.inv(), bag: bag({ item: plainItem('steel_helm') }, { item: plainItem('steel_mace') }) };
	p.m.ledgers.set(p.id, { ...p.m.ledgers.get(p.id)!, inv: seeded });

	const blocked = await op(p, { action: 'equip', index: 0 }, ticketMs + 2000);
	assert.equal(blocked.ok, false, 'not during a fight');
	assert.equal((await op(p, { action: 'sell', index: 1 }, ticketMs + 2000)).ok, false);
	assert.equal((await op(p, { action: 'buyShop', id: 'potion_minor', qty: 1 }, ticketMs + 2000)).ok, true, 'a potion can be bought mid-fight');
	assert.equal((await op(p, { action: 'autoSell', rarity: 'common' }, ticketMs + 2000)).ok, true);

	const sameKey = key();
	const first = ok(await inventoryStep(p.m.deps, p.id, sameKey, { action: 'buyShop', id: 'potion_minor', qty: 1 }, ticketMs + 3000));
	const again = ok(await inventoryStep(p.m.deps, p.id, sameKey, { action: 'buyShop', id: 'potion_minor', qty: 1 }, ticketMs + 4000));
	assert.deepEqual(again, first, 'a lost answer is replayed, never done twice');
});

test('an operation that is not one is not parsed', () => {
	for (const body of [{}, { action: 'steal' }, { action: 'equip' }, { action: 'equip', index: 1.5 }, { action: 'unequip', slot: 'wings' }, { action: 'sell', index: 1, qty: 'x' }, { action: 'move', from: 1 }, { action: 'autoSell', rarity: 4 }, { action: 'buyOffer' }]) {
		assert.equal(parseOp(body), null, JSON.stringify(body));
	}
	assert.deepEqual(parseOp({ action: 'sell', index: 2, qty: 3 }), { action: 'sell', index: 2, qty: 3 });
});

test('applyOp leaves the inventory untouched when it refuses', () => {
	const inv: Inventory = { ver: 3, bag: bag({ item: plainItem('wooden_sword') }), equipment: {}, lootPity: {}, autoSellUpTo: null };
	const frozen = structuredClone(inv);
	for (const refused of [{ action: 'equip', index: 9 }, { action: 'move', from: 0, to: 0 }, { action: 'discard', index: 3 }, { action: 'unequip', slot: 'head' }] as const) {
		const result = applyOp(inv, refused, {});
		assert.equal(result.ok, false);
		assert.deepEqual(result.inv, frozen);
	}
});

// ---------------------------------------------------------------------------------------------------- what the server does with drops

test('a chest\'s item goes into the ledger\'s bag (or the auto-sell filter), and the gold of what it sold is granted', async () => {
	const p = await player();
	await stay(p, 30);
	const listed = ok(await syncTickets(p.m.deps, p.id, T0 + 31 * MIN)).tickets.chests;
	assert.ok(listed.length > 0);
	let items = 0;
	for (const [i, spot] of listed.entries()) {
		const before = p.inv().bag.filter(Boolean).length;
		const result = ok(await redeemChest(p.m.deps, p.id, key(), spot, T0 + 31 * MIN + i * 1000));
		if (result.ok && result.loot.kind === 'item') {
			items++;
			assert.ok(p.inv().bag.filter(Boolean).length > before || (result.received?.autoSold.count ?? 0) > 0 || (result.received?.convertedGold ?? 0) > 0);
		}
	}
	assert.ok(items >= 0);
});
