import test from 'node:test';
import assert from 'node:assert/strict';
import { api, growTo, patchTileAt, setResources, store, tileAt } from '../helpers';
import { memoryLedgers } from '../builders';
import { CASTLE_X, CASTLE_Y } from '../../src/config/castle';
import { IDOL_RULES } from '../../src/config/buildings';
import { MERCHANT_RESOURCE_PRICES } from '../../src/config/merchant';
import { acceptSave, type SaveRepo, type StoredSave, type WorldPart } from '../../src/lib/cloudSave/pipeline';
import { summarize } from '../../src/lib/cloudSave/summary';
import { verifyTransition } from '../../src/lib/cloudSave/verify';
import { pickPersisted, type PersistedGame } from '../../src/lib/sanitizeSave';
import { encodeSave } from '../../src/lib/saveFormat';
import { emptyLegacy, newLedger } from '../../src/lib/offline/ledger';
import { bankContext } from '../../src/lib/offline/service';
import { playerProfile } from '../../src/lib/offline/profile';
import { payKill } from '../../src/lib/offline/reward';
import { emptyBank } from '../../src/lib/offline/tickets';
import { inventoryFromCore, sellContextOf, applyOp } from '../../src/lib/offline/inventory';
import { computeOfflineGrant } from '../../src/lib/offline/grant';
import { chestIntervalSec } from '../../src/lib/luck';
import { applyClaimAll } from '../../src/lib/offline/craft';
import { RECIPES } from '../../src/catalog/recipes';
import { emptyCraft } from '../../src/lib/crafting';
import { plainItem } from '../../src/lib/itemInstance';
import { buildTimeReduction } from '../../src/lib/buildings';
import { useGameStore } from '../../src/stores/gameStore';
import { patchTile } from '../../src/utils/world';

/**
 * Every Idol effect, checked the way the server applies it: a save is accepted through the real pipeline (with a ledger that already remembers the level, so the free re-placement is trusted),
 * and what the server stored (the summary, the stamped core) is read by the functions that decide a reward, a timer or a fight. Levels 0, 1 and the cap (5).
 */

// the maps the helpers grow are random; a fixed seed keeps every comparison below between the same land
let seed = 12345;
Math.random = () => {
	seed = (seed * 1664525 + 1013904223) % 4294967296;
	return seed / 4294967296;
};

const T = 1_800_000_000_000;
const CAP = 5;
const LEVELS = [0, 1, CAP] as const;
const SECRET = 'idol-secret-idol-secret';

const memoryStore = () => {
	const rows = new Map<string, StoredSave>();
	const worlds = new Map<string, WorldPart>();
	const saves: SaveRepo = {
		load: async (id, options) => {
			const row = rows.get(id);
			if (!row) return null;
			return options?.world ? { ...row, world: worlds.get(id) } : { ...row };
		},
		commit: async (id, baseRev, save, world) => {
			const current = rows.get(id);
			if (baseRev === 0 ? !!current : current?.rev !== baseRev) return false;
			rows.set(id, save);
			if (world) worlds.set(id, world);
			return true;
		},
		archive: async () => undefined,
		pin: async () => undefined,
	};
	return { saves, rows };
};

/** A game whose first non-castle tile is `biome`, with the Idol of that biome standing at `level` (0: none); farm animals and a modest purse. */
const game = (biome: string, level: number): PersistedGame => {
	api().resetGame();
	growTo(6);
	let spot: { x: number; y: number } | null = null;
	for (let y = CASTLE_Y - 4; y <= CASTLE_Y + 4 && !spot; y++)
		for (let x = CASTLE_X - 4; x <= CASTLE_X + 4 && !spot; x++)
			if (tileAt(api().tiles, x, y).isOwned && tileAt(api().tiles, x, y).biome !== 'castle') spot = { x, y };
	patchTileAt(spot!.x, spot!.y, { biome: biome as never, hasChest: false });
	if (level > 0) patchTileAt(spot!.x, spot!.y, { building: `idol_${biome}`, buildingLevel: level });
	store.setState((s) => ({
		tiles: patchTile(s.tiles, CASTLE_X, CASTLE_Y, { level: 2 }),
		monsters: [],
		idolLevels: level > 0 ? { [biome]: level } : {},
		farmLevels: { chicken: 5, cow: 3, deer: 2 },
		resources: { ...s.resources, gold: 5_000, wood: 500, stone: 500, coal: 0, food: 0, hide: 0 },
		playSeconds: 100_000,
	}));
	return structuredClone(pickPersisted(api()));
};

/** The server's stored save after accepting `state` for an account whose ledger already remembers `remembered`. */
const serve = async (state: PersistedGame, remembered: Record<string, number>) => {
	const m = memoryStore();
	const { ledgers, ledgerRepo } = memoryLedgers();
	ledgers.set('u1', { ...newLedger(T - 1000), ver: 1, legacy: { idols: remembered } });
	const out = await acceptSave(m.saves, 'u1', 'Zoe', encodeSave(state), 0, T, false, ledgerRepo);
	assert.equal(out.kind, 'ok');
	return { stored: m.rows.get('u1')!, ledgers };
};

const served = async (biome: string, level: number) => serve(game(biome, level), level > 0 ? { [biome]: level } : {});
const base = async (biome: string) => (await served(biome, 0)).stored;
const pct = (level: number) => level * IDOL_RULES.perLevel;

// ---- XP gain -----------------------------------------------------------------------------------------------------------------------------------

test('server: XP gain (Elder Tree Statue) at level 0, 1 and the cap: the stored summary and the away-time grant', async () => {
	const none = await base('forest');
	const grantXp = (s: StoredSave) =>
		computeOfflineGrant({
			rates: s.summary.rates,
			ratesAfterCastle: null,
			castleUpgrade: null,
			xpGainPct: s.summary.xpGainPct,
			gapSec: 3600,
			capSec: 8 * 3600,
			efficiency: 1,
			minGapSec: 300,
		})!.resources.xp;
	let last = grantXp(none);
	for (const level of LEVELS.filter((l) => l > 0)) {
		const { stored } = await served('forest', level);
		assert.equal(stored.summary.xpGainPct, none.summary.xpGainPct + pct(level));
		const xp = grantXp(stored);
		assert.ok(xp > last, `level ${level} pays more XP while away`);
		last = xp;
	}
});

// ---- kill rewards ------------------------------------------------------------------------------------------------------------------------------

test('server: kill rewards (Totem of the Wild) through payKill: gold and XP grow by the level', async () => {
	const payout = async (stored: StoredSave) => {
		const ledger = {
			...newLedger(T),
			inv: inventoryFromCore(stored.core),
			bank: { ...emptyBank(T / 1000), monsters: [{ n: 1, at: T / 1000 - 60, kind: 'normal' as const, lucky: false, spawnLevel: 20 }] },
		};
		const r = payKill(SECRET, 'u1', ledger as never, stored, 1, T / 1000);
		assert.ok(r);
		return r!.payout as unknown as { gold: number; xp: number };
	};
	const none = await payout(await base('jungle'));
	let last = none;
	for (const level of [1, CAP]) {
		const { stored } = await served('jungle', level);
		assert.equal(stored.summary.derived.killRewardPct, (await base('jungle')).summary.derived.killRewardPct + pct(level));
		const p = await payout(stored);
		assert.ok(p.gold >= last.gold && p.xp > last.xp, `level ${level}: ${p.gold}/${p.xp} vs ${last.gold}/${last.xp}`);
		last = p;
	}
});

// ---- offline efficiency ------------------------------------------------------------------------------------------------------------------------

test('server: away income (Frost Obelisk) raises the share of the income an away second pays', async () => {
	const none = await base('tundra');
	const wood = (s: StoredSave) =>
		computeOfflineGrant({
			rates: { ...s.summary.rates, wood: 100 },
			ratesAfterCastle: null,
			castleUpgrade: null,
			xpGainPct: 0,
			gapSec: 3600,
			capSec: 8 * 3600,
			efficiency: s.summary.derived.offlineEfficiency,
			minGapSec: 300,
		})!.resources.wood;
	let last = wood(none);
	for (const level of [1, CAP]) {
		const { stored } = await served('tundra', level);
		assert.ok(Math.abs(stored.summary.derived.offlineEfficiency - (none.summary.derived.offlineEfficiency + level * 0.02)) < 1e-9);
		const w = wood(stored);
		assert.ok(w > last);
		last = w;
	}
});

// ---- luck and chest speed ----------------------------------------------------------------------------------------------------------------------

test('server: Luck (Bog Witch Totem) in the stored summary and the chest bank context', async () => {
	const none = await base('swamp');
	for (const level of [1, CAP]) {
		const { stored } = await served('swamp', level);
		assert.equal(stored.summary.derived.luck, none.summary.derived.luck + level * IDOL_RULES.luckPerLevel);
		assert.equal(bankContext(stored).luck, stored.summary.derived.luck);
	}
});

test('server: chest speed (Water Spirit Fountain) shortens the chest interval through the bank context', async () => {
	const none = await base('lake');
	const interval = (s: StoredSave) => chestIntervalSec(bankContext(s).luck, bankContext(s).chestSpeedPct);
	assert.equal(bankContext(none).chestSpeedPct, 0);
	let last = interval(none);
	for (const level of [1, CAP]) {
		const { stored } = await served('lake', level);
		assert.equal(bankContext(stored).chestSpeedPct, pct(level));
		assert.ok(interval(stored) < last);
		last = interval(stored);
	}
});

// ---- crafting XP -------------------------------------------------------------------------------------------------------------------------------

test('server: crafting XP (Blossom Shrine) in the craft payout', async () => {
	const recipe = RECIPES.find((r) => r.timeSec && r.kind !== 'gear' && r.xp > 0)!;
	assert.ok(recipe);
	const xpFor = (s: StoredSave) => {
		const env = { secret: SECRET, userId: 'u1', luck: 0, intelligence: 0, xpPct: s.summary.derived.idol?.craftXpPct ?? 0 };
		const craft = { ...emptyCraft(), queue: [{ recipeId: recipe.id, count: 50, startedAt: 0, timeSec: recipe.timeSec! }] };
		const r = applyClaimAll({ bag: [], ver: 1 } as never, craft, 1_000_000_000_000, env);
		assert.ok(r.ok);
		return r.craft.xp;
	};
	const none = xpFor(await base('orchard'));
	let last = none;
	for (const level of [1, CAP]) {
		const xp = xpFor((await served('orchard', level)).stored);
		assert.ok(Math.abs(xp - none * (1 + pct(level) / 100)) < 1e-3 * none, `${xp} vs ${none * (1 + pct(level) / 100)}`);
		assert.ok(xp > last);
		last = xp;
	}
});

// ---- damage, max HP, armor ---------------------------------------------------------------------------------------------------------------------

test('server: damage (Maw Idol) and max HP + armor (War Memorial) reach the fight profile of the stored save', async () => {
	const none = playerProfile((await base('blight')).core);
	for (const level of [1, CAP]) {
		const maw = playerProfile((await served('blight', level)).stored.core);
		assert.ok(Math.abs(maw.hit - none.hit * (1 + pct(level) / 100)) < 1e-6);
		assert.equal(maw.maxHp, none.maxHp, 'the Maw changes only damage');
		const war = playerProfile((await served('battlefield', level)).stored.core);
		assert.equal(war.maxHp, Math.round(none.maxHp * (1 + pct(level) / 100)));
		assert.ok(Math.abs(war.armor - none.armor * (1 + pct(level) / 100)) < 1e-6);
		assert.equal(war.hit, none.hit);
	}
});

// ---- the three effects that used to be client-only ----------------------------------------------------------------------------------------------

test('server: farm output (Harvest Scarecrow) multiplies every farm product in the stored rates', async () => {
	const none = await base('plains');
	assert.ok(none.summary.rates.meat > 0);
	for (const level of [1, CAP]) {
		const { stored } = await served('plains', level);
		for (const key of ['meat', 'eggs', 'milk', 'hide'] as const) {
			if (!(none.summary.rates[key] > 0)) continue;
			// the farm part grows by the percentage; the castle and the other multipliers apply on top, so the ratio is exact for a product with no other source
			assert.ok(stored.summary.rates[key] > none.summary.rates[key], `${key} at level ${level}`);
		}
		const ratio = stored.summary.rates.eggs / none.summary.rates.eggs;
		assert.ok(Math.abs(ratio - (1 + pct(level) / 100)) < 1e-9, `eggs x${ratio}`);
	}
});

test('server: the merchant sell price (Lighthouse) is applied to inventory sales through the stamped save', async () => {
	const sellGold = (s: StoredSave) => {
		const inv = { ...inventoryFromCore(s.core), bag: [{ id: 'potion_minor', qty: 10 }, ...Array(10).fill(null)] } as never;
		const r = applyOp(inv, { action: 'sell', index: 0, qty: 10 }, sellContextOf(s.core)) as { gold?: number };
		return r.gold ?? 0;
	};
	const none = await base('coast');
	const g0 = sellGold(none);
	assert.ok(g0 > 0);
	let last = g0;
	for (const level of [1, CAP]) {
		const { stored } = await served('coast', level);
		const g = sellGold(stored);
		assert.ok(g > last, `level ${level}: ${g} vs ${last}`);
		assert.ok(Math.abs(g - Math.floor(g0 * (1 + pct(level) / 100))) <= 10, `${g} vs ${g0 * (1 + pct(level) / 100)}`);
		last = g;
	}
	void MERCHANT_RESOURCE_PRICES;
	void plainItem;
});

test('click gold (Scarecrow King) is paid by the browser: the click grows by the level (bounded by the gold plausibility check)', () => {
	const click = (level: number) => {
		game('fields', level);
		store.setState({ clickLevel: 0 } as never);
		return useGameStore.getState().clickForGold({ eventId: 1, now: 0, trusted: true });
	};
	const g0 = click(0);
	assert.ok(g0 > 0);
	for (const level of [1, CAP]) assert.ok(Math.abs(click(level) - g0 * (1 + pct(level) / 100)) < 1e-6 * g0 + 1e-9);
});

// ---- build time: the shortened timer is judged by the server -------------------------------------------------------------------------------------

test('server: build time (Dwarf Statue) is derived, capped at 60 % with Master Builders, and a forged shorter timer is refused', async () => {
	const none = await base('hills');
	assert.equal(none.summary.derived.buildTimeReduction, undefined);
	for (const level of [1, CAP]) {
		const { stored } = await served('hills', level);
		assert.ok(Math.abs((stored.summary.derived.buildTimeReduction ?? 0) - level * 0.02) < 1e-9);
	}
	assert.equal(buildTimeReduction({ ...api().prestige, upgrades: { builders: 10 } }, 40), 0.6);

	// a castle upgrade as the browser would start it (30 minutes at castle level 1), with the Statue at the cap: at most 10 % shorter
	const { stored } = await served('hills', CAP);
	const before = stored.summary;
	const started = (remainingSec: number) => ({ ...before, derived: { ...before.derived, castleUpgrade: { toLevel: 3, remainingSec } } });
	const flags = (next: typeof before, at = 5000) => verifyTransition({ summary: before, serverSavedAt: 0 }, next, at, undefined, { hills: CAP });
	// castle level 2 -> 3 takes durationsSec[1] = 7200 s; 10 % shorter is 6480 s
	assert.equal(flags(started(6480)).includes('castle_jump'), false, 'the honest shortened timer');
	assert.equal(flags(started(7200)).includes('castle_jump'), false, 'the full timer');
	assert.equal(flags(started(60)).includes('castle_jump'), true, 'a forged one-minute timer');
	// the same for a building upgrade (10 min to level 2: 540 s with the Statue at the cap)
	const bstart = (remainingSec: number) => ({
		...before,
		derived: { ...before.derived, buildings: { lumberyard: 1 }, buildingUpgrade: { x: 1, y: 1, toLevel: 2, remainingSec } },
	});
	const withBuilding = { ...before, derived: { ...before.derived, buildings: { lumberyard: 1 } } };
	const bflags = (next: typeof before, at = 5000) => verifyTransition({ summary: withBuilding, serverSavedAt: 0 }, next, at, undefined, { hills: CAP });
	assert.equal(bflags(bstart(540)).includes('timer_jump'), false);
	assert.equal(bflags(bstart(5)).includes('timer_jump'), true);
});

// ---- forged levels and persistence -------------------------------------------------------------------------------------------------------------

test('a forged Idol level pays nothing on the server: every effect stays at the trusted level (0 here)', async () => {
	const none = await base('plains');
	// the ledger remembers nothing; the save claims level 5
	const { stored } = await serve(game('plains', CAP), {});
	assert.equal(stored.summary.rates.eggs, none.summary.rates.eggs, 'no farm bonus');
	const forgedForest = (await serve(game('forest', CAP), {})).stored;
	assert.equal(forgedForest.summary.xpGainPct, (await base('forest')).summary.xpGainPct);
	const forgedCoast = (await serve(game('coast', CAP), {})).stored;
	assert.equal(sellContextOf(forgedCoast.core).idolSellPct, undefined);
	// the stored map carries the cut level, not the claim
	const forgedTile = (stored.core as { idolLevels?: unknown }).idolLevels;
	assert.equal(forgedTile, undefined);
});

test('persistence: a rebirth keeps the remembered level (the building goes), it is placed again for free, and a reset clears the record', async () => {
	const m = memoryStore();
	const { ledgers, ledgerRepo } = memoryLedgers();
	ledgers.set('u1', { ...newLedger(T - 1000), ver: 1, legacy: { idols: { forest: 3 } } });
	const first = game('forest', 3);
	let out = await acceptSave(m.saves, 'u1', 'Zoe', encodeSave(first), 0, T, false, ledgerRepo);
	assert.equal(out.kind, 'ok');
	const withIdol = m.rows.get('u1')!.summary.xpGainPct;
	// the save after a rebirth: a new run (one more rebirth), the building gone, the account's levels kept
	const reborn = structuredClone(first);
	reborn.prestige = { ...reborn.prestige, rebirths: reborn.prestige.rebirths + 1, legacyPoints: 5, legacyEarned: 5 };
	reborn.tiles = patchTile(reborn.tiles, firstIdolTile(first).x, firstIdolTile(first).y, { building: undefined, buildingLevel: undefined });
	reborn.playSeconds = 100_030;
	out = await acceptSave(m.saves, 'u1', 'Zoe', encodeSave(reborn), m.rows.get('u1')!.rev, T + 30_000, false, ledgerRepo);
	assert.equal(out.kind, 'ok');
	assert.deepEqual(ledgers.get('u1')!.legacy.idols, { forest: 3 }, 'the ledger record survives the rebirth');
	assert.equal((m.rows.get('u1')!.core as { idolLevels?: Record<string, number> }).idolLevels?.forest, 3, 'and so does the saved level');
	assert.ok(m.rows.get('u1')!.summary.xpGainPct < withIdol, 'no building, no bonus');
	// placed again for free at level 3, on any forest tile: the bonus is back at once
	const again = structuredClone(reborn);
	again.tiles = patchTile(again.tiles, firstIdolTile(first).x, firstIdolTile(first).y, { building: 'idol_forest', buildingLevel: 3 });
	again.playSeconds = 100_060;
	out = await acceptSave(m.saves, 'u1', 'Zoe', encodeSave(again), m.rows.get('u1')!.rev, T + 60_000, false, ledgerRepo);
	assert.equal(out.kind, 'ok');
	assert.equal(m.rows.get('u1')!.flags.includes('timer_jump'), false, 'free re-placement at the remembered level is not a jump');
	assert.equal(m.rows.get('u1')!.summary.xpGainPct, withIdol);
	// a reset starts the record again
	const { resetLedger } = await import('../../src/lib/offline/ledger');
	assert.deepEqual(resetLedger(ledgers.get('u1')!, T + 1).legacy, emptyLegacy());
});

const firstIdolTile = (state: PersistedGame) => {
	for (let y = CASTLE_Y - 4; y <= CASTLE_Y + 4; y++)
		for (let x = CASTLE_X - 4; x <= CASTLE_X + 4; x++) if (tileAt(state.tiles, x, y).building === 'idol_forest') return { x, y };
	throw new Error('no idol');
};

test('summarize is a pure function of the save: no derived Idol value is stored in it', () => {
	const state = game('forest', 2);
	const keys = Object.keys(state);
	for (const k of keys) assert.ok(!/idolFx|buildTimeReduction|farmOutput|merchantSell/.test(k), k);
	assert.deepEqual(summarize(state).derived.idol, undefined, 'the forest Idol has no stamped-only effect');
	void setResources;
});
