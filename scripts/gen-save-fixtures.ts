/**
 * Writes the frozen save fixtures of `tests/fixtures/saves/` from the CURRENT code. Run it once per released shape (a release that bumps `SAVE_SCHEMA`, or adds a ledger column); never to refresh an old fixture:
 * an existing file is left alone (`--force` overwrites it, which defeats its purpose: it is the guard that today's code still reads what yesterday's wrote).
 *
 *   npm run gen-save-fixtures            writes the fixtures that do not exist yet (the shape of THIS release)
 *   npm run gen-save-fixtures -- --ids   also adds the ids the code has now to `released-ids.json` (append-only: nothing already in it is ever removed)
 *
 * The data is made up (a test hero, fixed time `FIXTURE_NOW`), never a real player's. See `tests/fixtures/saves/README.md` and `docs/plan/save-compatibility.md`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { api, growTo, rebirthReadyGame, store } from '../tests/helpers';
import { ACHIEVEMENTS } from '../src/catalog/achievements';
import { COMPONENTS, RECIPES } from '../src/catalog/recipes';
import { STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import { emptyBag } from '../src/lib/inventory';
import { plainItem } from '../src/lib/itemInstance';
import { freshCombat } from '../src/lib/offline/fightTypes';
import { inventoryFromCore } from '../src/lib/offline/inventory';
import { addTotals, newLedger, zeroTotals } from '../src/lib/offline/ledger';
import { emptyStats, recordKill } from '../src/lib/offline/stats';
import { ledgerToRow } from '../src/lib/offline/supabaseLedger';
import { pickPersisted } from '../src/lib/sanitizeSave';
import { SAVE_SCHEMA, decodeSave, encodeSave, packBody } from '../src/lib/saveFormat';
import { currentIds, mergeReleased, type SavedIds } from './lib/savedIds';

/** The clock of every fixture (ms): fixed, so a regenerated file differs only where the code does. */
export const FIXTURE_NOW = 1_800_000_000_000;

/**
 * The shape number of the ledger row fixtures (`ledger-v<n>-*.json`). Raise it when the ledger gains or changes a column, in the same release: the new files are written next to the old ones, which stay as they are
 * (1: the first released columns, 2: with `legacy`). Save fixtures are named from `SAVE_SCHEMA` by themselves.
 */
const LEDGER_SHAPE = 2;

const dir = resolve(process.cwd(), 'tests/fixtures/saves');
const force = process.argv.includes('--force');
const writeIds = process.argv.includes('--ids');

const write = (name: string, value: unknown) => {
	const file = resolve(dir, name);
	if (existsSync(file) && !force) {
		console.log(`kept     ${name}`);
		return;
	}
	writeFileSync(file, JSON.stringify(value, null, '\t') + '\n');
	console.log(`written  ${name}`);
};

const checked = (text: string) => {
	const decoded = decodeSave(text);
	if (!decoded.ok) throw new Error(`the fixture does not load: ${decoded.reason}`);
	return text;
};

const saveFixture = (name: string, note: string, text: string) => write(`${name}.json`, { schema: SAVE_SCHEMA, note, text: checked(text) });

/** ---- saves: made through the real store, then written by the real encoder ---- */
const newGame = () => {
	api().resetGame();
	return encodeSave(pickPersisted(api()), FIXTURE_NOW);
};

const midGame = () => {
	api().resetGame();
	growTo(40);
	const bag = emptyBag();
	bag[0] = { id: 'potion_minor', qty: 12 };
	bag[3] = { item: plainItem('obsidian_cuirass') };
	store.setState({
		equipment: { ...STARTER_EQUIPMENT, head: plainItem('obsidian_helm') },
		bag,
		farmLevels: { chicken: 5, sheep: 2 },
		merchantUpgrades: { haggler: 3, packrat: 2 },
		clickLevel: 2,
		castleUpgrade: { toLevel: 2, remainingSec: 120 },
		playerName: 'Fixture',
	} as never);
	api().tick(60_000);
	return { text: encodeSave(pickPersisted(api()), FIXTURE_NOW), core: packBody(pickPersisted(api())) as Record<string, unknown> };
};

const rebirthed = () => {
	rebirthReadyGame();
	store.setState({ prestige: { rebirths: 2, legacyPoints: 30, legacyEarned: 30, upgrades: {} }, playerName: 'Fixture' } as never);
	return encodeSave(pickPersisted(api()), FIXTURE_NOW);
};

mkdirSync(dir, { recursive: true });
saveFixture(`save-v${SAVE_SCHEMA}-new-game`, 'A new game: the castle and its four free tiles, nothing bought.', newGame());
const mid = midGame();
saveFixture(
	`save-v${SAVE_SCHEMA}-mid-game`,
	'A played game: 40 tiles, a farm, merchant levels, a click level, gear and potions, a castle upgrade running.',
	mid.text,
);
saveFixture(`save-v${SAVE_SCHEMA}-rebirthed`, 'A game after two rebirths (castle 6, 400 tiles), with unspent Embers.', rebirthed());

/** ---- ledger rows: the columns of `player_ledger` as the code writes them today ---- */
const nowSec = FIXTURE_NOW / 1000;
const ledgerRow = (ledger: ReturnType<typeof newLedger>) => {
	const { updated_at: _updatedAt, ...row } = ledgerToRow(ledger);
	void _updatedAt;
	return JSON.parse(JSON.stringify(row));
};
const fresh = newLedger(FIXTURE_NOW);
write(`ledger-v${LEDGER_SHAPE}-new.json`, {
	note: 'The row of an account that has just started: empty bank, no inventory yet.',
	row: ledgerRow({ ...fresh, ver: 1 }),
});

const played = newLedger(FIXTURE_NOW, 0);
played.ver = 7;
played.runId = 2;
played.bank = {
	...played.bank,
	chests: [{ n: 1, at: nowSec - 600 }],
	monsters: [{ n: 2, at: nowSec - 300, kind: 'normal', lucky: false, type: 'thistleBoar', x: 3, y: 4, spawnLevel: 1 }],
	nextN: 3,
	monstersMinted: 1,
	chestAcc: 12,
};
played.ordChest = 4;
played.ordKill = 9;
played.granted = addTotals(zeroTotals(), { gold: 1234, wood: 50, gems: 10 });
played.grantedSeen = addTotals(zeroTotals(), { gold: 1000 });
played.gems = 1010;
played.inv = inventoryFromCore(mid.core);
played.combat = {
	...freshCombat(nowSec, 90, 30),
	queue: [2],
	retryAt: { '5': nowSec + 30 },
	ord: 9,
	eventNo: 3,
	fight: {
		n: 2,
		type: 'thistleBoar',
		level: 1,
		lucky: false,
		monsterHp: 8,
		monsterMaxHp: 10,
		playerTimer: 0.2,
		monsterTimer: 0.4,
		stunLeft: 0,
		elapsed: 3,
		timeLeftSec: null,
		ord: 9,
		seq: 4,
		profile: {
			level: 3,
			maxHp: 120,
			maxMp: 40,
			hit: 8,
			crit: 0.05,
			superCrit: 0.1,
			critExtra: 1,
			attacksPerSec: 1,
			armor: 2,
			dodge: 0.02,
			leechPct: 0,
			hpRegen: 0.1,
			mpRegen: 0.2,
			heal: 20,
		},
		x: 3,
		y: 4,
	},
};
played.legacy = { idols: { battlefield: 3 } };
played.craft = {
	xp: 40,
	ord: 3,
	stock: { [Object.keys(COMPONENTS)[0]]: 5 },
	pity: {},
	spent: 10,
	last: nowSec,
	queue: [{ recipeId: RECIPES[0].id, count: 2, startedAt: nowSec - 30, timeSec: 60 }],
};
played.buffs = [{ family: 'might', stat: 'damagePct', amount: 10, untilSec: nowSec + 600 }];
played.stats = {
	...recordKill(emptyStats(), { type: 'thistleBoar', lucky: false, boss: false }),
	chests: 2,
	tiles: 35,
	at: FIXTURE_NOW,
	playAt: 60,
	tilesAt: 40,
	achievements: [ACHIEVEMENTS[0].id],
	seen: { thistleBoar: FIXTURE_NOW - 1000 },
	income: { gold: 500 },
};
write(`ledger-v${LEDGER_SHAPE}-played.json`, {
	note: 'The row of an account mid-game: tickets, bag and gear, an open fight, crafting, a buff, counters, an achievement, an Idol level (legacy).',
	row: ledgerRow(played),
});

/** ---- the shipped ids: only ever appended to ---- */
const idsFile = resolve(dir, 'released-ids.json');
const shipped: SavedIds | null = existsSync(idsFile) ? (JSON.parse(readFileSync(idsFile, 'utf-8')) as SavedIds) : null;
if (!shipped || writeIds) {
	writeFileSync(idsFile, JSON.stringify(mergeReleased(shipped, currentIds()), null, '\t') + '\n');
	console.log(shipped ? 'updated  released-ids.json (appended)' : 'written  released-ids.json');
} else console.log('kept     released-ids.json (--ids adds the new ids)');
