import type { LedgerRow } from '@/lib/offline/supabaseLedger';

/**
 * The upgrade path of a `player_ledger` row. A ledger row has no schema number: its columns are read tolerantly (`ledgerFromRow`: every column through a reader that drops what it does not know, a missing column
 * reads as empty), so ADDING a column or a key never needs a step (the migration adds the column nullable, the reader defaults it: SQL first, code second).
 * A step exists for the rare change a reader cannot absorb: a key that is renamed, a value that changes meaning, a list that changes shape. Because there is no version to branch on, **every step recognises the OLD
 * shape by itself and leaves a new row alone** (idempotent, like `upgradeStoredBank` in `tickets.ts`), is pure, and is never edited or deleted after it shipped.
 *
 * It runs on read (`ledgerFromRow` could call it) and, for a release that wants every row moved at once, over every row in `npm run migrate-saves`. Worked example: a release renames `combat.autoUse` to `combat.autoPotion`:
 *
 * ```ts
 * export const LEDGER_ROW_UPGRADES: readonly LedgerRowUpgrade[] = [
 *   (row) => {
 *     const combat = row.combat as Record<string, unknown> | null;
 *     if (!combat || !('autoUse' in combat)) return row;          // already new (or no combat yet): leave it alone
 *     const { autoUse, ...rest } = combat;
 *     return { ...row, combat: { ...rest, autoPotion: autoUse } } as LedgerRow;
 *   },
 * ];
 * ```
 *
 * @category Saves & Server/The ledger
 * @order 6
 * @see ledgerFromRow, upgradeBody
 */
export type LedgerRowUpgrade = (row: LedgerRow) => LedgerRow;

/** The steps, oldest first. Empty today: every shape the ledger has had is read by the tolerant readers. */
export const LEDGER_ROW_UPGRADES: readonly LedgerRowUpgrade[] = [];

/** Runs every step over a copy of `row` (the input is never changed). `steps` is a parameter so a test can run a step before it is registered. */
export const upgradeLedgerRow = (row: LedgerRow, steps: readonly LedgerRowUpgrade[] = LEDGER_ROW_UPGRADES): LedgerRow =>
	steps.reduce((current, step) => step(structuredClone(current)), structuredClone(row));
