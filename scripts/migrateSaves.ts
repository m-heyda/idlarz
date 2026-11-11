/**
 * The pure part of `scripts/migrate-saves.ts`: judges one stored save row and one ledger row with the CURRENT code, says what a migration would do to it and counts the verdicts. No database in here: the script
 * feeds it rows, the tests feed it fixtures. The counts and the fixed reason texts of the code are all that is ever printed: no name, no id, no number out of a player's game.
 */
import { isDeepStrictEqual } from 'node:util';
import { SAVE_SCHEMA, decodeSave, sealWire, unpackBody } from '../src/lib/saveFormat';
import { SAVE_UPGRADES, upgradeBody, type BodyUpgrade } from '../src/lib/saveUpgrade';
import { sanitizeSave } from '../src/lib/sanitizeSave';
import { LEDGER_ROW_UPGRADES, upgradeLedgerRow, type LedgerRowUpgrade } from '../src/lib/offline/ledgerUpgrade';
import { ledgerFromRow, ledgerToRow, type LedgerRow } from '../src/lib/offline/supabaseLedger';

/** What a migration does to one row. `skipped` rows are never written. */
export type RowOutcome =
	/** Already in the current shape: nothing to do (a second run lands here for every row: the migration is idempotent) */
	| 'current'
	/** An older shape, brought up to date by the chain: written with `--yes` */
	| 'upgraded'
	/** A ledger row whose columns held something the tolerant readers had to drop or default: written back clean with `--yes` */
	| 'repaired'
	/** Newer than this code (a deploy rolled back): never touched */
	| 'newer'
	/** Cannot be read by today's rules even after the chain: never touched, reported with the code's fixed reason */
	| 'unreadable';

export interface SaveMigration {
	outcome: RowOutcome;
	reason?: string;
	/** The body to store (`core` + `land` + `extra`) and its schema, for `upgraded` */
	body?: Record<string, unknown>;
	schema?: number;
}

/**
 * One `player_saves` row (its `core` and the map from `player_worlds`) through the upgrade chain. The stored body is upgraded, then checked with `unpackBody` and `sanitizeSave` exactly as a player's browser would read it:
 * a body that does not load is `unreadable` and is NEVER written. The body that is stored is the upgraded one, not the sanitized one: the migration moves a save to the new shape, it does not re-judge it.
 * `target` and `chain` are parameters so a test (or the release that adds the step) can run the chain before `SAVE_SCHEMA` is bumped.
 */
export const migrateSave = (
	row: { schema: number; core: Record<string, unknown> },
	world: { land: unknown; extra: unknown },
	target: number = SAVE_SCHEMA,
	chain: Readonly<Record<number, BodyUpgrade>> = SAVE_UPGRADES,
): SaveMigration => {
	if (!Number.isInteger(row.schema) || row.schema > target) return { outcome: 'newer' };
	const body = { ...row.core, land: world.land, extra: world.extra };
	const upgraded = upgradeBody(body, row.schema, target, chain);
	if (!upgraded.ok) return { outcome: 'unreadable', reason: upgraded.reason };
	const unpacked = unpackBody(upgraded.body);
	if ('error' in unpacked) return { outcome: 'unreadable', reason: unpacked.error };
	// the same read the browser does: for a body of the current schema the whole of decodeSave, for a newer target the sanitizer alone (decodeSave only knows SAVE_SCHEMA)
	const read = target === SAVE_SCHEMA ? decodeSave(sealWire({ v: target, t: 0, s: upgraded.body })) : sanitizeSave(unpacked.raw);
	if (!read.ok) return { outcome: 'unreadable', reason: 'reason' in read ? read.reason : 'rejected' };
	if (upgraded.steps === 0) return { outcome: 'current' };
	return { outcome: 'upgraded', body: upgraded.body, schema: target };
};

export interface LedgerMigration {
	outcome: 'current' | 'upgraded' | 'repaired';
	/** The row to store, for anything but `current` */
	row?: LedgerRow;
}

const DATE_COLUMNS = ['anchor_at', 'reset_at'] as const;

/** A row with its timestamps in one format and no bookkeeping column, so two rows can be compared field by field (Postgres writes timestamps differently from `toISOString`, and jsonb reorders keys: the comparison is deep, not textual). */
const comparable = (row: Record<string, unknown>): Record<string, unknown> => {
	const { updated_at: _updatedAt, user_id: _userId, ...rest } = row;
	void _updatedAt;
	void _userId;
	// a column that is null or absent is the same thing (the reader defaults it): a row written before a column existed is not a different row
	const out: Record<string, unknown> = Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== null && value !== undefined));
	for (const column of DATE_COLUMNS) if (typeof out[column] === 'string') out[column] = new Date(out[column] as string).toISOString();
	return out;
};

/**
 * One `player_ledger` row through the ledger's row upgrades and then the tolerant readers and the writer: the row that comes out is what the CURRENT code would store for that player. It is `upgraded` when a row upgrade
 * changed something, `repaired` when only the reading (a dropped id, a default for a missing column, a normalised value) changed it, `current` when the stored row is already exactly that. `ver` is the caller's compare-and-swap.
 */
export const migrateLedger = (row: LedgerRow, steps: readonly LedgerRowUpgrade[] = LEDGER_ROW_UPGRADES): LedgerMigration => {
	const upgradedRow = upgradeLedgerRow(row, steps);
	const stepped = !isDeepStrictEqual(comparable(upgradedRow as unknown as Record<string, unknown>), comparable(row as unknown as Record<string, unknown>));
	const normalised = ledgerToRow(ledgerFromRow(upgradedRow)) as unknown as LedgerRow;
	const changed = !isDeepStrictEqual(
		comparable(normalised as unknown as Record<string, unknown>),
		comparable(upgradedRow as unknown as Record<string, unknown>),
	);
	if (!stepped && !changed) return { outcome: 'current' };
	return { outcome: stepped ? 'upgraded' : 'repaired', row: { ...normalised, ver: row.ver } };
};

/** Counts per outcome and the fixed reasons of the unreadable rows. Nothing else is kept: this object is what gets printed. */
export interface MigrationCounts {
	saves: Record<RowOutcome, number>;
	ledgers: Record<'current' | 'upgraded' | 'repaired' | 'unreadable', number>;
	reasons: Record<string, number>;
}

export const newCounts = (): MigrationCounts => ({
	saves: { current: 0, upgraded: 0, repaired: 0, newer: 0, unreadable: 0 },
	ledgers: { current: 0, upgraded: 0, repaired: 0, unreadable: 0 },
	reasons: {},
});

export const countSave = (counts: MigrationCounts, result: SaveMigration): void => {
	counts.saves[result.outcome]++;
	if (result.reason) counts.reasons[result.reason] = (counts.reasons[result.reason] ?? 0) + 1;
};

export const countLedger = (counts: MigrationCounts, result: LedgerMigration | 'unreadable'): void => {
	counts.ledgers[typeof result === 'string' ? result : result.outcome]++;
};

/** The text the script prints: counts and the code's own reasons only. `execute` says whether the writes happened or would. */
export const formatCounts = (counts: MigrationCounts, execute: boolean): string => {
	const verb = execute ? 'written' : 'would be written';
	const lines = [
		`saves:   ${counts.saves.current} current, ${counts.saves.upgraded} upgraded (${verb}), ${counts.saves.newer} newer than this code (left alone), ${counts.saves.unreadable} unreadable (left alone)`,
		`ledgers: ${counts.ledgers.current} current, ${counts.ledgers.upgraded} upgraded and ${counts.ledgers.repaired} repaired (${verb}), ${counts.ledgers.unreadable} unreadable (left alone)`,
	];
	const reasons = Object.entries(counts.reasons).sort((a, b) => b[1] - a[1]);
	if (reasons.length) lines.push('unreadable because:', ...reasons.map(([reason, n]) => `  ${n} x ${reason}`));
	return lines.join('\n');
};

/** The number of rows a run would write (or wrote). */
export const writes = (counts: MigrationCounts): number => counts.saves.upgraded + counts.ledgers.upgraded + counts.ledgers.repaired;
