/**
 * **The one way to change what a save means: bump the schema and write an upgrade step.** Everything else is additive and needs no version (a new optional field with a default, a new id in a catalog, a new
 * resource, a new building, a changed number: see `docs/plan/save-compatibility.md`). A step is only for what additive changes cannot do: a field that is renamed, moved, split or reinterpreted, or an id that must
 * be turned into another one.
 *
 * **How it runs.** `decodeSave` reads the `v` of the save text. A save of an OLDER schema goes through `upgradeBody`: every step from its `v` up to `SAVE_SCHEMA`, one after the other, each a pure
 * function `(body) => body` that turns a version N body into a version N + 1 body (the body is the packed form of `wire.s`: `land`, `extra` and the core keys). The result is then read by `sanitizeSave` like any save,
 * so a step only has to make the OLD shape readable as the NEW one; validation, clamping and derived values stay where they are. A save with no path up (a gap in the chain, or a schema older than the first step)
 * is refused with the "older season" message, as before. A save of a NEWER schema is refused ("update the game"): the old code cannot read what it does not know.
 * The upgraded game is written back in the new schema by the next save, so a player is upgraded once. The same chain runs over every stored row in `npm run migrate-saves` (a release that wants every row moved at once).
 *
 * **Rules for a step.** Pure (no clock, no randomness, no network, never mutates its input; `upgradeBody` hands it a copy anyway), total (any body in, a body out: a field it cannot make sense of is dropped or defaulted,
 * never thrown on), and idempotent on a body that is already new. A step is never edited after it shipped and never deleted: players on that version still exist. It comes with a fixture of the old version in
 * `tests/fixtures/saves/` and a test that loads it (`tests/saves/saveFixtures.test.ts`).
 *
 * **Worked example.** A release renames the stored `playerName` to `heroName` and moves `gems` out of the core into the ledger. Bump `SAVE_SCHEMA` from 7 to 8 in `saveFormat.ts` and register the step that upgrades FROM 7:
 *
 * ```ts
 * export const SAVE_UPGRADES: Record<number, BodyUpgrade> = {
 *   7: (body) => {
 *     const { playerName, gems, ...rest } = body;
 *     return { ...rest, heroName: playerName };   // gems are the ledger's now: the old value is simply not carried
 *   },
 * };
 * ```
 *
 * `sanitizeSave` then reads `heroName`. A v7 save in a browser or in `player_saves.core` is upgraded when it is read; nothing else changes. If the release also changes a database column, the SQL migration goes first (nullable
 * additive, with a rollback file) and the code that reads the new column second; see the recipe in `docs/plan/save-compatibility.md`.
 *
 * @category Saves & Server/The save
 * @order 6
 * @see SAVE_SCHEMA, decodeSave, upgradeBody
 */
export type BodyUpgrade = (body: Record<string, unknown>) => Record<string, unknown>;

/**
 * The upgrade steps, keyed by the schema they upgrade FROM: `SAVE_UPGRADES[7]` turns a version 7 body into a version 8 one. Empty today: schema 7 is the first schema that stays compatible for good, so
 * every older save is refused as "from an older season" (the new chapter reset removes them anyway).
 */
export const SAVE_UPGRADES: Readonly<Record<number, BodyUpgrade>> = {};

export type UpgradeResult = { ok: true; body: Record<string, unknown>; steps: number } | { ok: false; reason: string };

/**
 * Brings a save body of schema `from` up to schema `to` by running the steps `from`, `from + 1`, ... `to - 1` of `chain`. Pure: the input is never changed. `from === to` returns a copy untouched.
 * `chain` is a parameter so a test (or a release script) can run a step before it is registered.
 *
 * @category Saves & Server/The save
 * @order 7
 */
export const upgradeBody = (
	body: Record<string, unknown>,
	from: number,
	to: number,
	chain: Readonly<Record<number, BodyUpgrade>> = SAVE_UPGRADES,
): UpgradeResult => {
	if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1) return { ok: false, reason: 'unknown schema' };
	if (from > to) return { ok: false, reason: 'newer schema' };
	let current = structuredClone(body);
	for (let version = from; version < to; version++) {
		const step = chain[version];
		if (!step) return { ok: false, reason: `no upgrade from schema ${version}` };
		current = step(structuredClone(current));
	}
	return { ok: true, body: current, steps: to - from };
};
