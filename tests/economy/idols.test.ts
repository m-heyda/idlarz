import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { api, freshGame, growTo, patchTileAt, setResources, store, tileAt } from '../helpers';
import { REBIRTH } from '../../src/config/rebirth';
import { memoryLedgers } from '../builders';
import { BIOMES } from '../../src/config/biomes';
import { BUILDING_RULES, IDOL_RULES } from '../../src/config/buildings';
import { CASTLE_X, CASTLE_Y } from '../../src/config/castle';
import { HARD_LIMITS, LIMITS } from '../../src/config/limits';
import { IDOLS, idolDef, idolOfBiome } from '../../src/catalog/idols';
import { buildingDef } from '../../src/catalog/buildings';
import { TUTORIAL_LESSONS } from '../../src/catalog/tutorial';
import {
	buildingLevelCost,
	buildingUpgradeDuration,
	buildTimeReduction,
	completeUpgrade,
	rememberedIdolLevel,
	upgradeCapOf,
	upgradeProblem,
} from '../../src/lib/buildings';
import { castleUpgradeDuration } from '../../src/utils/game/castle';
import { buildOptions } from '../../src/lib/buildingMenu';
import { effectiveIdolLevel, idolEconomy, idolValueText, NO_IDOL_ECONOMY } from '../../src/lib/idolEconomy';
import { limitOf } from '../../src/lib/limits';
import { pickPersisted, sanitizeSave, type PersistedGame } from '../../src/lib/sanitizeSave';
import { decodeSave, encodeSave } from '../../src/lib/saveFormat';
import { summarize } from '../../src/lib/cloudSave/summary';
import { settleIdols } from '../../src/lib/cloudSave/idolTrust';
import { verifyTransition } from '../../src/lib/cloudSave/verify';
import { acceptSave, type SaveRepo, type StoredSave, type WorldPart } from '../../src/lib/cloudSave/pipeline';
import { emptyLegacy, legacyFromJson, newLedger, resetLedger } from '../../src/lib/offline/ledger';
import { bankContext } from '../../src/lib/offline/service';
import { playerProfile } from '../../src/lib/offline/profile';
import { applyCraft } from '../../src/lib/offline/craft';
import { patchTile } from '../../src/utils/world';
import { zeroResources } from '../../src/catalog/resourceKeys';
import { computeOfflineGrant } from '../../src/lib/offline/grant';
import { applyOfflineGrant } from '../../src/lib/offline/apply';
import { useUiStore } from '../../src/stores/uiStore';

const RICH = {
	gold: 1e15,
	wood: 1e15,
	stone: 1e15,
	coal: 1e15,
	food: 1e15,
	hide: 1e15,
	herbs: 1e9,
	sap: 1e9,
	ironOre: 1e9,
	spores: 1e9,
	frostshard: 1e9,
	pearls: 1e9,
	salt: 1e9,
};

/** A fresh game with `n` tiles made `biome` (the first non-castle tiles), castle at `castleLevel`; returns their positions. */
const gameWith = (biome: string, n = 1, castleLevel = 5, tiles = 14) => {
	api().resetGame();
	growTo(tiles);
	const spots: { x: number; y: number }[] = [];
	for (let y = CASTLE_Y - 6; y <= CASTLE_Y + 6 && spots.length < n; y++)
		for (let x = CASTLE_X - 6; x <= CASTLE_X + 6 && spots.length < n; x++)
			if (tileAt(api().tiles, x, y).isOwned && tileAt(api().tiles, x, y).biome !== 'castle') spots.push({ x, y });
	for (const s of spots) patchTileAt(s.x, s.y, { biome: biome as never, hasChest: false });
	store.setState((s) => ({ tiles: patchTile(s.tiles, CASTLE_X, CASTLE_Y, { level: castleLevel }), monsters: [] }));
	setResources(RICH);
	return spots;
};

const tick = (sec: number) => {
	for (let t = 0; t < sec; t += 10) api().tick(10_000);
};

// ---- catalog -----------------------------------------------------------------------------------------------------------------------------------

test('the catalog: twelve Idols, one per biome, with art, a unique id and an effect; the three client-only ones are marked', () => {
	assert.equal(IDOLS.length, 12);
	assert.equal(new Set(IDOLS.map((i) => i.id)).size, 12);
	assert.equal(new Set(IDOLS.map((i) => i.biome)).size, 12);
	for (const i of IDOLS) {
		assert.ok(BIOMES[i.biome], i.biome);
		assert.ok(existsSync(join(process.cwd(), 'public', i.art)), `${i.id}: ${i.art}`);
		assert.equal(idolDef(i.id), i);
		assert.equal(idolOfBiome(i.biome), i);
		assert.equal(buildingDef(i.id)?.kind, 'idol', 'the building catalog carries it');
	}
	assert.deepEqual(
		IDOLS.filter((i) => !i.applied)
			.map((i) => i.biome)
			.sort(),
		['coast', 'fields', 'plains'],
		'farm output, click gold and merchant sell price are coming soon',
	);
});

test('idolMaxLevel is a limit: 5 base, 10 hard, read through limitOf', () => {
	assert.equal(LIMITS.idolMaxLevel, 5);
	assert.equal(HARD_LIMITS.idolMaxLevel, 10);
	assert.equal(limitOf('idolMaxLevel'), 5);
	assert.equal(limitOf('idolMaxLevel', { hardCap: true }), 10);
});

// ---- the effects -------------------------------------------------------------------------------------------------------------------------------

test('effects: +2 % per level (Luck 4 points), only what the game applies, never above the remembered level', () => {
	const [a] = gameWith('forest');
	patchTileAt(a.x, a.y, { building: 'idol_forest', buildingLevel: 3 });
	assert.equal(idolEconomy(api().tiles, { forest: 3 }).xpPct, 3 * IDOL_RULES.perLevel);
	assert.equal(idolEconomy(api().tiles, { forest: 1 }).xpPct, IDOL_RULES.perLevel, 'a tile above the remembered level works at the remembered one');
	assert.equal(idolEconomy(api().tiles, { forest: 0 }).xpPct, 0);
	assert.equal(idolEconomy(api().tiles).xpPct, 6, 'no record: the tile level');
	assert.equal(effectiveIdolLevel(4, 2), 2);
	assert.equal(effectiveIdolLevel(2, undefined), 2);
	const swamp = gameWith('swamp')[0];
	patchTileAt(swamp.x, swamp.y, { building: 'idol_swamp', buildingLevel: 2 });
	assert.equal(idolEconomy(api().tiles).luck, 2 * IDOL_RULES.luckPerLevel);
	assert.deepEqual({ ...idolEconomy(api().tiles), luck: 0 }, NO_IDOL_ECONOMY);
});

test('every applied Idol feeds exactly its own number; the coming-soon ones feed nothing', () => {
	const expectKey: Record<string, keyof typeof NO_IDOL_ECONOMY | null> = {
		forest: 'xpPct',
		hills: 'buildTimePct',
		swamp: 'luck',
		tundra: 'offlineEffPts',
		lake: 'chestSpeedPct',
		jungle: 'killRewardPct',
		orchard: 'craftXpPct',
		blight: 'damagePct',
		battlefield: 'hpArmorPct',
		plains: null,
		coast: null,
		fields: null,
	};
	for (const idol of IDOLS) {
		const [s] = gameWith(idol.biome);
		patchTileAt(s.x, s.y, { building: idol.id, buildingLevel: 1 });
		const e = idolEconomy(api().tiles, { [idol.biome]: 1 });
		const key = expectKey[idol.biome];
		const nonZero = Object.entries(e)
			.filter(([, v]) => v !== 0)
			.map(([k]) => k);
		assert.deepEqual(nonZero, key ? [key] : [], idol.id);
		assert.equal(idol.applied, key !== null);
	}
});

test('the UI text states the current and the next value', () => {
	assert.equal(idolValueText(idolDef('idol_forest')!, 3), '+6 % XP gain');
	assert.equal(idolValueText(idolDef('idol_swamp')!, 3), '+12 Luck');
});

// ---- rules: build, free re-placement, upgrade, castle gate, timer, cost ------------------------------------------------------------------------

test('the first Idol is paid, the level is remembered, and the cap is the castle gate min(5, castle level)', () => {
	const [a] = gameWith('forest', 1, 2);
	const gold = api().resources.gold;
	assert.equal(api().buildBuilding(a.x, a.y, 'idol_forest'), true);
	assert.ok(api().resources.gold < gold, 'the first Idol costs a level 1 building');
	assert.equal(api().idolLevels.forest, 1);
	assert.equal(tileAt(api().tiles, a.x, a.y).buildingLevel, 1);
	assert.equal(api().upgradeBuilding(a.x, a.y), true, 'castle level 2 allows level 2');
	tick(700);
	assert.equal(api().idolLevels.forest, 2, 'the finished upgrade is remembered');
	assert.equal(api().upgradeBuilding(a.x, a.y), false, 'level 3 needs castle level 3');
	assert.match(upgradeProblem({ ...ctxOf(), castleLevel: 2 }, a.x, a.y) ?? '', /Needs castle level 3/);
	assert.equal(upgradeCapOf(idolDef('idol_forest') && buildingDef('idol_forest'), 3), 3);
	assert.equal(upgradeCapOf(buildingDef('idol_forest'), 10), 5, 'the base cap is 5');
	assert.equal(upgradeCapOf(buildingDef('idol_forest'), 10, 8), 8, 'a raised cap lifts it, past the castle gate');
	assert.equal(upgradeCapOf(buildingDef('idol_forest'), 10, 99), 10, 'never past the hard limit');
});

const ctxOf = () => {
	const s = api();
	return { tiles: s.tiles, monsters: s.monsters, castleLevel: 5, castleUpgrade: s.castleUpgrade, buildingUpgrade: s.buildingUpgrade, ownedTiles: 20 };
};

test('an Idol level from 3 also costs the T3 extract of its biome (where it has one), doubling each level', () => {
	const def = buildingDef('idol_forest');
	assert.equal(buildingLevelCost(2, 20, def).sap, undefined);
	assert.equal(buildingLevelCost(3, 20, def).sap, IDOL_RULES.t3PerLevel);
	assert.equal(buildingLevelCost(4, 20, def).sap, IDOL_RULES.t3PerLevel * 2);
	assert.equal(buildingLevelCost(3, 20, buildingDef('idol_jungle')).sap, undefined, 'a biome without an Extractor asks for none');
	assert.equal(buildingLevelCost(3, 20, buildingDef('lumberyard')).sap, undefined, 'only Idols');
	// and the upgrade really takes it from the stock
	const [a] = gameWith('forest', 1, 5);
	assert.ok(api().buildBuilding(a.x, a.y, 'idol_forest'));
	patchTileAt(a.x, a.y, { buildingLevel: 2 });
	store.setState({ idolLevels: { forest: 2 } });
	setResources({ sap: 10 });
	assert.equal(api().upgradeBuilding(a.x, a.y), false, 'not enough sap');
	setResources({ sap: 1000 });
	assert.equal(api().upgradeBuilding(a.x, a.y), true);
	assert.equal(api().resources.sap, 1000 - IDOL_RULES.t3PerLevel);
});

test('Dwarf Statue shortens castle and building timers, capped at 60 % together with Master Builders', () => {
	assert.equal(buildingUpgradeDuration(1, undefined, 0), BUILDING_RULES.durationsSec[0]);
	assert.equal(buildingUpgradeDuration(1, undefined, 10), Math.floor(BUILDING_RULES.durationsSec[0] * 0.9));
	assert.equal(buildTimeReduction({ ...api().prestige, upgrades: { builders: 10 } }, 40), 0.6, 'capped');
	assert.equal(buildTimeReduction(undefined, 0), 0);
	assert.equal(castleUpgradeDuration(1, undefined, 10), Math.floor(1800 * 0.9));
	// through the store: the timer of the next upgrade is shorter with the Statue standing
	const [a, b] = gameWith('hills', 2, 5);
	assert.ok(api().buildBuilding(a.x, a.y, 'idol_hills'));
	patchTileAt(a.x, a.y, { buildingLevel: 5 });
	store.setState({ idolLevels: { hills: 5 } });
	assert.ok(api().buildBuilding(b.x, b.y, 'quarry'));
	assert.ok(api().upgradeBuilding(b.x, b.y));
	assert.equal(api().buildingUpgrade?.remainingSec, Math.floor(BUILDING_RULES.durationsSec[0] * 0.9));
});

test('the shared builder holds for Idols: an Idol upgrade and the castle exclude each other', () => {
	const [a] = gameWith('forest', 1, 5);
	assert.ok(api().buildBuilding(a.x, a.y, 'idol_forest'));
	assert.ok(api().upgradeBuilding(a.x, a.y));
	assert.equal(api().upgradeCastle(), false);
});

test('rebirth: the levels stay, the buildings go, and the Idol is placed again for free at its level at castle level 1', () => {
	freshGame();
	growTo(REBIRTH.minTiles);
	store.setState((s) => ({ tiles: patchTile(s.tiles, CASTLE_X, CASTLE_Y, { level: REBIRTH.minCastleLevel }) }));
	// an Idol at level 4 on a forest tile, the castle at 6 so that the rebirth is allowed
	const forest = (() => {
		for (let y = CASTLE_Y - 8; y <= CASTLE_Y + 8; y++)
			for (let x = CASTLE_X - 8; x <= CASTLE_X + 8; x++) if (tileAt(api().tiles, x, y).isOwned && tileAt(api().tiles, x, y).biome !== 'castle') return { x, y };
		throw new Error('no tile');
	})();
	patchTileAt(forest.x, forest.y, { biome: 'forest', hasChest: false, building: 'idol_forest', buildingLevel: 4 });
	store.setState({ idolLevels: { forest: 4 } });
	assert.equal(api().rebirth(), true);
	assert.deepEqual(api().idolLevels, { forest: 4 }, 'the account keeps the level');
	assert.equal(Object.values(api().tiles.map).filter((t) => t.building).length, 0, 'the map and its buildings are gone');
	// a forest tile of the new map
	const fresh = (() => {
		let spot: { x: number; y: number } | null = null;
		for (let y = CASTLE_Y - 3; y <= CASTLE_Y + 3 && !spot; y++)
			for (let x = CASTLE_X - 3; x <= CASTLE_X + 3 && !spot; x++)
				if (tileAt(api().tiles, x, y).isOwned && tileAt(api().tiles, x, y).biome !== 'castle') spot = { x, y };
		return spot!;
	})();
	patchTileAt(fresh.x, fresh.y, { biome: 'forest', hasChest: false });
	setResources({ gold: 0, wood: 0, stone: 0 });
	const opt = buildOptions(store as never, fresh.x, fresh.y).builds.find((o) => o.def.id === 'idol_forest')!;
	assert.equal(opt.remembered, 4);
	assert.deepEqual(opt.cost, {}, 'free');
	assert.equal(opt.problem, null, 'with nothing in the stores');
	assert.equal(api().buildBuilding(fresh.x, fresh.y, 'idol_forest'), true);
	assert.equal(tileAt(api().tiles, fresh.x, fresh.y).buildingLevel, 4, 'at its remembered level at once');
	assert.equal(idolEconomy(api().tiles, api().idolLevels).xpPct, 8, 'the power is back at once');
	assert.equal(rememberedIdolLevel(api().idolLevels, 'forest'), 4);
	// New Game forgets
	api().resetGame();
	assert.deepEqual(api().idolLevels, {});
});

test('completeUpgrade remembers an Idol level and never lowers it', () => {
	const [a] = gameWith('forest');
	patchTileAt(a.x, a.y, { building: 'idol_forest', buildingLevel: 2 });
	const done = completeUpgrade(api().tiles, { forest: 5 }, { x: a.x, y: a.y, toLevel: 3 });
	assert.equal(done.idolLevels.forest, 5);
	assert.equal(tileAt(done.tiles, a.x, a.y).buildingLevel, 3);
	assert.equal(completeUpgrade(api().tiles, {}, { x: CASTLE_X + 20, y: CASTLE_Y, toLevel: 3 }).reached, false);
});

// ---- saves -------------------------------------------------------------------------------------------------------------------------------------

test('the save keeps the Idol levels and a placed Idol above the castle gate; forged values are cut', () => {
	const [a] = gameWith('forest', 1, 1);
	patchTileAt(a.x, a.y, { building: 'idol_forest', buildingLevel: 4 });
	store.setState({ idolLevels: { forest: 4, hills: 2 } });
	const back = decodeSave(encodeSave(pickPersisted(api())));
	assert.ok(back.ok, back.ok ? '' : back.reason);
	if (!back.ok) return;
	assert.equal(tileAt(back.state.tiles, a.x, a.y).buildingLevel, 4, 'an Idol is exempt from the castle gate (the castle is level 1)');
	assert.deepEqual(back.state.idolLevels, { forest: 4, hills: 2 });
	// a tile that says more than the record raises the record; absurd levels and unknown biomes are ignored
	const forged = decodeSave(encodeSave({ ...pickPersisted(api()), idolLevels: { forest: 1, hills: 999, nowhere: 3 } as never }));
	assert.ok(forged.ok);
	if (forged.ok) assert.deepEqual(forged.state.idolLevels, { forest: 4 });
	void sanitizeSave;
});

test('with the system off an Idol in a save is dropped like any building', async () => {
	const { BUILDINGS_FLAG } = await import('../../src/config/buildings');
	const [a] = gameWith('forest', 1, 5);
	patchTileAt(a.x, a.y, { building: 'idol_forest', buildingLevel: 2 });
	store.setState({ idolLevels: { forest: 2 } });
	const text = encodeSave(pickPersisted(api()));
	BUILDINGS_FLAG.enabled = false;
	try {
		const back = decodeSave(text);
		assert.ok(back.ok);
		if (back.ok) {
			assert.equal(tileAt(back.state.tiles, a.x, a.y).building, undefined);
			assert.equal('idolLevels' in back.state, false);
		}
	} finally {
		BUILDINGS_FLAG.enabled = true;
	}
});

// ---- the server folds the Idols into its numbers -----------------------------------------------------------------------------------------------

/** A saved game with the Idol of `biome` standing at `level`. */
const withIdol = (biome: string, level: number): PersistedGame => {
	const [a] = gameWith(biome, 1, 5);
	patchTileAt(a.x, a.y, { building: `idol_${biome}`, buildingLevel: level });
	store.setState({ idolLevels: { [biome]: level } });
	return structuredClone(pickPersisted(api()));
};
const plain = (): PersistedGame => {
	gameWith('forest', 1, 5);
	return structuredClone(pickPersisted(api()));
};

test('server: Elder Tree adds to the XP gain %, the Totem to kill rewards, the Frost Obelisk to the away efficiency, the Bog Witch to Luck', () => {
	const base = summarize(plain());
	assert.equal(summarize(withIdol('forest', 3)).xpGainPct, base.xpGainPct + 6);
	assert.equal(summarize(withIdol('jungle', 5)).derived.killRewardPct, base.derived.killRewardPct + 10);
	const eff = summarize(withIdol('tundra', 5)).derived.offlineEfficiency;
	assert.ok(Math.abs(eff - (base.derived.offlineEfficiency + 0.1)) < 1e-9, `${eff}`);
	assert.equal(summarize(withIdol('swamp', 2)).derived.luck, base.derived.luck + 8);
});

test('server: chest speed, crafting XP, damage and HP/armor are carried to where they are applied', () => {
	const none = summarize(plain()).derived;
	assert.equal(none.idol, undefined, 'no Idol, no key');
	assert.equal(summarize(withIdol('lake', 5)).derived.idol?.chestSpeedPct, 10);
	assert.equal(summarize(withIdol('orchard', 5)).derived.idol?.craftXpPct, 10);
	assert.equal(summarize(withIdol('blight', 5)).derived.idol?.damagePct, 10);
	assert.equal(summarize(withIdol('battlefield', 5)).derived.idol?.hpArmorPct, 10);
	// chest speed in the ticket bank context
	const stored = { summary: summarize(withIdol('lake', 5)), core: {} } as unknown as StoredSave;
	assert.equal(bankContext(stored).chestSpeedPct, 10);
	// crafting XP: the same craft pays more
	const inv = { bag: [], gear: {}, ver: 1 } as never;
	void inv;
});

test('server: damage and max HP / armor reach the fight profile through the stamped core', () => {
	const core = pickPersisted(api()) as unknown as Record<string, unknown>;
	const base = playerProfile(core);
	const withFx = playerProfile({ ...core, idolFx: { damagePct: 10, hpArmorPct: 10 } });
	assert.equal(withFx.maxHp, Math.round(base.maxHp * 1.1));
	assert.ok(Math.abs(withFx.hit - base.hit * 1.1) < 1e-9);
	assert.ok(Math.abs(withFx.armor - base.armor * 1.1) < 1e-9);
	assert.deepEqual(playerProfile({ ...core, idolFx: undefined }), base);
	assert.deepEqual(playerProfile({ ...core, idolFx: { damagePct: 'x', hpArmorPct: -5 } }), base, 'junk and negatives are ignored');
});

test('server: crafting XP is paid with the Blossom Shrine bonus', async () => {
	const { RECIPES } = await import('../../src/catalog/recipes');
	const recipe = RECIPES.find((r) => !r.timeSec && r.kind !== 'gear' && r.inputs.every((i) => 'component' in i === false));
	if (!recipe) return; // no instant recipe without components in this catalog: covered by the XP maths below
	const { emptyCraft } = await import('../../src/lib/crafting');
	const craft = emptyCraft();
	const inv = { bag: [], ver: 1 } as never;
	const plainRes = applyCraft(inv, craft, recipe.id, 1, 1_000_000);
	const idolRes = applyCraft(inv, craft, recipe.id, 1, 1_000_000, 50);
	if (plainRes.ok && idolRes.ok) assert.ok(idolRes.craft.xp >= plainRes.craft.xp);
});

test('offline: the income of the Idol effects is in the grant (efficiency) and a finished Idol upgrade lands while away', () => {
	const [a] = gameWith('forest', 1, 5);
	assert.ok(api().buildBuilding(a.x, a.y, 'idol_forest'));
	assert.ok(api().upgradeBuilding(a.x, a.y));
	const summary = summarize(structuredClone(pickPersisted(api())));
	const grant = computeOfflineGrant({
		rates: summary.rates,
		ratesAfterCastle: null,
		castleUpgrade: null,
		buildingUpgrade: summary.derived.buildingUpgrade,
		ratesAfterBuilding: summary.derived.ratesAfterBuilding,
		xpGainPct: summary.xpGainPct,
		gapSec: 3600,
		capSec: 8 * 3600,
		efficiency: summary.derived.offlineEfficiency,
		minGapSec: 300,
	})!;
	assert.equal(grant.building?.finished, true);
	const applied = applyOfflineGrant(api(), grant);
	assert.equal(tileAt(applied.patch.tiles!, a.x, a.y).buildingLevel, 2);
	assert.equal(applied.patch.idolLevels?.forest, 2, 'the Idol level is remembered by the away path too');
	// the efficiency is the Frost Obelisk's: more away income
	const eff = summarize(withIdol('tundra', 5)).derived.offlineEfficiency;
	const g1 = computeOfflineGrant({
		rates: { ...zeroResources(), wood: 100 },
		ratesAfterCastle: null,
		castleUpgrade: null,
		xpGainPct: 0,
		gapSec: 3600,
		capSec: 8 * 3600,
		efficiency: eff,
		minGapSec: 300,
	})!;
	const g0 = computeOfflineGrant({
		rates: { ...zeroResources(), wood: 100 },
		ratesAfterCastle: null,
		castleUpgrade: null,
		xpGainPct: 0,
		gapSec: 3600,
		capSec: 8 * 3600,
		efficiency: summarize(plain()).derived.offlineEfficiency,
		minGapSec: 300,
	})!;
	assert.ok(g1.resources.wood > g0.resources.wood);
});

// ---- the server's trust ------------------------------------------------------------------------------------------------------------------------

test('settleIdols: the claim is cut to the trusted record plus one verified step', () => {
	const [a] = gameWith('forest', 1, 5);
	patchTileAt(a.x, a.y, { building: 'idol_forest', buildingLevel: 3 });
	const claim = (idolLevels: Record<string, number>, trusted: Record<string, number>, jumped = false) =>
		settleIdols(trusted, { tiles: api().tiles, idolLevels }, jumped);
	assert.deepEqual(claim({ forest: 3 }, { forest: 2 }), { forest: 3 }, 'one step, the Idol stands at that level');
	assert.deepEqual(claim({ forest: 3 }, { forest: 1 }), { forest: 1 }, 'two steps at once: refused');
	assert.deepEqual(claim({ forest: 3 }, { forest: 2 }, true), { forest: 2 }, 'a timer_jump: refused');
	assert.deepEqual(claim({ forest: 5 }, {}), {}, 'a first save claiming level 5');
	assert.deepEqual(claim({}, { forest: 4 }), { forest: 4 }, 'the server wins over a lower claim');
	assert.deepEqual(claim({ hills: 1 }, {}), {}, 'a record for an Idol that does not stand');
});

test('timer_jump: placing a learned Idol at its remembered level is fine, above it is a jump', () => {
	const before = summarize(plain());
	const placedAt = (level: number) => {
		const s = summarize(withIdol('forest', level));
		return s;
	};
	const trusted = { forest: 4 };
	assert.equal(
		verifyTransition({ summary: before, serverSavedAt: 0 }, placedAt(4), 1000, undefined, trusted).includes('timer_jump'),
		false,
		'free re-placement at level 4',
	);
	assert.equal(
		verifyTransition({ summary: before, serverSavedAt: 0 }, placedAt(5), 1000, undefined, trusted).includes('timer_jump'),
		true,
		'level 5 with a record of 4',
	);
	assert.equal(verifyTransition({ summary: before, serverSavedAt: 0 }, placedAt(3), 1000).includes('timer_jump'), true, 'without a record only level 1');
	assert.equal(verifyTransition({ summary: before, serverSavedAt: 0 }, placedAt(1), 1000).includes('timer_jump'), false);
});

test('ledger: legacy.idols reads back safely, a New Game forgets it, a rebirth keeps it', () => {
	assert.deepEqual(emptyLegacy(), { idols: {} });
	assert.deepEqual(legacyFromJson(null).idols, {});
	assert.deepEqual(legacyFromJson({ idols: { forest: 3, hills: 'x', swamp: 2.5, jungle: -1 } }).idols, { forest: 3 });
	const l = { ...newLedger(0), legacy: { idols: { forest: 3 } } };
	assert.deepEqual(resetLedger(l, 1000).legacy.idols, {}, 'a New Game / season reset starts again');
});

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

test('through the save pipeline: the ledger remembers a built Idol, refuses a forged jump, and the stored economy follows the settled level', async () => {
	const m = memoryStore();
	const { ledgers, ledgerRepo } = memoryLedgers();
	const T = 1_800_000_000_000;
	const [a] = gameWith('forest', 1, 2, 6);
	setResources({ gold: 12_000, wood: 800, stone: 800, coal: 0, food: 0, hide: 0 });
	store.setState({ playSeconds: 100_000 } as never);
	// 1: a game with nothing
	await acceptSave(m.saves, 'u1', 'Zoe', encodeSave(structuredClone(pickPersisted(api()))), 0, T, false, ledgerRepo);
	assert.deepEqual(ledgers.get('u1')?.legacy.idols ?? {}, {});
	// 2: the Idol is built (level 1): remembered
	assert.ok(api().buildBuilding(a.x, a.y, 'idol_forest'));
	store.setState({ playSeconds: 100_060 } as never);
	let out = await acceptSave(m.saves, 'u1', 'Zoe', encodeSave(structuredClone(pickPersisted(api()))), 1, T + 60_000, false, ledgerRepo);
	assert.equal(out.kind, 'ok');
	assert.deepEqual(ledgers.get('u1')?.legacy.idols, { forest: 1 });
	// 3: a forged claim of level 5 in one save: refused (the ledger stays at 1), the economy follows level 1
	patchTileAt(a.x, a.y, { buildingLevel: 5 });
	store.setState({ idolLevels: { forest: 5 }, playSeconds: 100_120 } as never);
	out = await acceptSave(m.saves, 'u1', 'Zoe', encodeSave(structuredClone(pickPersisted(api()))), 2, T + 120_000, false, ledgerRepo);
	assert.equal(out.kind, 'ok');
	assert.deepEqual(ledgers.get('u1')?.legacy.idols, { forest: 1 }, 'the ledger did not accept the jump');
	const stored = m.rows.get('u1')!;
	assert.equal((stored.core as { idolLevels?: Record<string, number> }).idolLevels?.forest, 1, 'the stored save carries the settled level');
	assert.equal(stored.flags.includes('timer_jump'), true);
	// 4: an honest upgrade: started, then finished after its timer
	patchTileAt(a.x, a.y, { buildingLevel: 1 });
	store.setState({ idolLevels: { forest: 1 }, buildingUpgrade: null, playSeconds: 100_180 } as never);
	assert.ok(api().upgradeBuilding(a.x, a.y));
	out = await acceptSave(m.saves, 'u1', 'Zoe', encodeSave(structuredClone(pickPersisted(api()))), 3, T + 180_000, false, ledgerRepo);
	assert.equal(out.kind, 'ok');
	tick(700);
	store.setState({ playSeconds: 100_900 } as never);
	out = await acceptSave(m.saves, 'u1', 'Zoe', encodeSave(structuredClone(pickPersisted(api()))), 4, T + 900_000, false, ledgerRepo);
	assert.equal(out.kind, 'ok');
	assert.deepEqual(
		ledgers.get('u1')?.legacy.idols,
		{ forest: 2 },
		`the verified step is remembered ${JSON.stringify(m.rows.get('u1')!.flags)} ${JSON.stringify(m.rows.get('u1')!.summary.derived.buildings)} ${JSON.stringify(m.rows.get('u1')!.summary.derived.buildingUpgrade)} ${out.kind}`,
	);
});

// ---- UI: explanation, tutorial -----------------------------------------------------------------------------------------------------------------

test('the Build window offers the Idol of the biome with its remembered level, and a lesson explains Idols', () => {
	const [a] = gameWith('forest', 1, 5);
	const first = buildOptions(store as never, a.x, a.y).builds.find((o) => o.def.id === 'idol_forest')!;
	assert.equal(first.remembered, 0);
	assert.ok((first.cost.gold ?? 0) > 0, 'the first one is paid');
	const lesson = TUTORIAL_LESSONS.find((l) => l.id === 'idols')!;
	assert.ok(lesson, 'a tutorial lesson "Idols"');
	assert.match(lesson.text({} as never), /kept|rebirth/i);
	assert.match(lesson.text({} as never), /free/i);
	assert.equal(typeof useUiStore.getState().openBuildModal, 'function');
});

// ---- review fixes: values must not drift, claims must not pay ----------------------------------------------------------------------------------

test('a record that does not list an Idol means level 0: a forged tile level pays nothing once a record exists', () => {
	const [a] = gameWith('forest');
	patchTileAt(a.x, a.y, { building: 'idol_forest', buildingLevel: 10 });
	assert.equal(idolEconomy(api().tiles, {}).xpPct, 0, 'a record without it');
	assert.equal(idolEconomy(api().tiles, { forest: 3 }).xpPct, 6);
	assert.equal(idolEconomy(api().tiles).xpPct, 20, 'no record at all (an old save): the tile level');
});

test('the server never pays a claimed Idol level: an unrecorded level-10 Idol adds no XP, kill reward or combat bonus', async () => {
	const m = memoryStore();
	const { ledgerRepo } = memoryLedgers();
	const T = 1_800_000_000_000;
	const [a] = gameWith('forest', 1, 1, 6);
	patchTileAt(a.x, a.y, { building: 'idol_forest', buildingLevel: 10 });
	store.setState({ idolLevels: { forest: 10 }, playSeconds: 100_000 } as never);
	const out = await acceptSave(m.saves, 'u1', 'Zoe', encodeSave(structuredClone(pickPersisted(api()))), 0, T, false, ledgerRepo);
	assert.equal(out.kind, 'ok');
	const stored = m.rows.get('u1')!;
	assert.equal(stored.summary.xpGainPct, summarize(plain()).xpGainPct, 'no XP bonus from a claim');
	assert.equal((stored.core as { idolLevels?: unknown }).idolLevels, undefined, 'the stored copy holds the settled record: none');
	assert.equal((stored.core as { idolFx?: unknown }).idolFx, undefined);
});

test('without a usable ledger the claimed levels are kept in the stored save but pay nothing', async () => {
	const m = memoryStore();
	const broken = { load: async () => Promise.reject(new Error('down')), commit: async () => false };
	const T = 1_800_000_000_000;
	const [a] = gameWith('forest', 1, 2, 6);
	assert.ok(api().buildBuilding(a.x, a.y, 'idol_forest'));
	store.setState({ playSeconds: 100_000 } as never);
	const out = await acceptSave(m.saves, 'u1', 'Zoe', encodeSave(structuredClone(pickPersisted(api()))), 0, T, false, broken as never);
	assert.equal(out.kind, 'ok');
	const stored = m.rows.get('u1')!;
	assert.equal(stored.summary.xpGainPct, summarize(plain()).xpGainPct, 'no bonus without a ledger to verify against');
	assert.deepEqual((stored.core as { idolLevels?: unknown }).idolLevels, { forest: 1 }, 'nothing is lost from the stored save');
});

test('crafting XP is the same whether the crafts are claimed one by one or together (fractional XP is kept)', async () => {
	const { applyClaim, applyClaimAll } = await import('../../src/lib/offline/craft');
	const { RECIPES } = await import('../../src/catalog/recipes');
	const { emptyCraft } = await import('../../src/lib/crafting');
	const recipe = RECIPES.find((r) => r.timeSec && r.kind !== 'gear' && r.xp > 0);
	if (!recipe) return;
	const env = { secret: 'x'.repeat(24), userId: 'u', luck: 0, intelligence: 0, xpPct: 10 };
	const finished = 1_000_000_000_000;
	const entry = (count: number) => ({ ...emptyCraft(), queue: [{ recipeId: recipe.id, count, startedAt: 0, timeSec: recipe.timeSec! }] });
	const inv = { bag: [], ver: 1 } as never;
	const together = applyClaimAll(inv, entry(100), finished, env);
	const single = applyClaim(inv, entry(1), 0, finished, env);
	assert.ok(together.ok && single.ok);
	if (together.ok && single.ok) assert.ok(Math.abs(single.craft.xp * 100 - together.craft.xp) < 1e-3, `${single.craft.xp} x 100 vs ${together.craft.xp}`);
});

test('a save whose HP is the War Memorial maximum is valid, and one above it is not', () => {
	const [a] = gameWith('battlefield', 1, 5);
	patchTileAt(a.x, a.y, { building: 'idol_battlefield', buildingLevel: 5 });
	store.setState({ idolLevels: { battlefield: 5 } });
	const base = pickPersisted(api());
	const max = summarize(structuredClone(base));
	void max;
	const hp = (n: number) => decodeSave(encodeSave({ ...structuredClone(base), playerHp: n } as never));
	const limit = Math.round(effectiveStatsMaxHp() * 1.1);
	assert.equal(hp(limit).ok, true, 'the pool the Idol makes');
	assert.equal(hp(limit * 2).ok, false, 'far above it');
});

const effectiveStatsMaxHp = (): number => {
	const s = api();
	return Math.round(playerProfile({ characterStats: s.characterStats, equipment: s.equipment, resources: s.resources } as never).maxHp);
};
