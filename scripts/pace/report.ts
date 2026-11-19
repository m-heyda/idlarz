/**
 * What pace the economy is tuned for, why, and how to check it. The measured numbers are **not** copied here: they live in `docs/generated/pace-milestones.md` (`npm run pace`, refreshed by `npm run docs:gen`) and `docs/generated/balance-tables.md`.
 * Open balance questions are in `docs/plan/ROADMAP.md`.
 *
 * | Stage | Target |
 * | --- | --- |
 * | First ~100 tiles | easy: hours for an active bot, between a day and a half and two days for the `human` profile (the four free start tiles make the first hours a little slower than the old 3x3 start) |
 * | 200-300 tiles | a 2-3 day project |
 * | After 300 tiles | clearly steeper (the `(n/300)^3.5` tail, {@link tilePrice}); a map of tens of thousands of tiles stays buyable |
 * | First Rebirth (castle 6 + 400 tiles) | around day 5-7 for a person who checks in a few times a day (to become about day 4-6 when the shorter castle timers and cheaper early castle costs of `docs/plan/19-first-build-steps.md` ship) |
 * | Every later run | faster than the run before it (castle 6 again in roughly 60-70 % of the first run), flattening after the third run because the castle timers bound it |
 * | Level 80 / 100 | about the 3rd / 10th rebirth (the level curve is lifetime and carries over a rebirth, {@link LEVELING}) |
 * | First 10 minutes | first tile at about a minute, first animal before the first castle upgrade |
 *
 * **What the pace rests on**
 *
 * - **Castle timers are the floor of the first run.** Levels 2-6 take 30 min, 2 h, 6 h, 12 h and 24 h (1 d 20 h 30 min in all), levels 7-10 another 1.5, 2, 2.5 and 3.5 days (11 d 8 h 30 min to castle 10); Master Builders shortens them, a second builder (Gem shop Builder #2) runs a building next to the castle.
 *   The cost of 5 to 6 is what a player who plays a few times a day must be able to pay while the 4 to 5 timer runs, so a player who hoards instead of selling must not be locked out of it (the sim's `human` never sells surplus on purpose).
 * - **Tile price in materials** ({@link TILE_RESOURCE_COST}). The sim prints, per tile count, the minutes the income needs to cover what is missing of each part of the next tile (table at the end of `pace-milestones.md`).
 *   Gold must stay the biggest number; if hide or stone becomes the limiter, adjust the farm (pigs make hide, Tannery +25 %, Pasture +8 %) rather than the share.
 * - **Tile XP is small on purpose** (`BASE_XP_PER_TILE` 45) and the level curve is slow and lifetime, so levels come from passive XP, kills and rebirth-paced play, not from buying tiles.
 * - **Combat is in the sim**: the `human*` profiles fight a normal monster every 900 s and the plain boss every 3 h with a gear schedule (starter kit, knight gear from day 1.5, obsidian from day 5; an assumption taken from `docs/generated/fight-sim.md`), paying the real kill income.
 * - **Away time is in the sim for the `human*` profiles**: outside the playing hours the kingdom pays half its income for at most 8 hours of a gap (the server's rule, {@link computeOfflineGrant}); the reference bots keep the game open all day.
 *
 * **Caveats.** The `human` is one calibration point, not a measurement of players; the bots still beat it by 2-3x. The `human*` profiles were calibrated (about 185 tiles after 3.3 days) before the away rule was in the sim, so their pace is now slower than the owner's measured run
 * until the knobs `PACE_DECISION`, `PACE_TILES` and `PACE_HOARD` are fitted again. Luck is 0 everywhere. "Max the rebirth shop" is a later design (ROADMAP); the `human-rebirth6-economy` and `-full` profiles show what the shop plans are worth.
 * If the first run must be longer once more content exists, lengthen `CASTLE_UPGRADE.durationsSec` and keep an eye on the minutes-to-cover table.
 *
 * @title Pacing targets
 * @category Pacing/Targets
 * @order 1
 * @see MAGNITUDE_BANDS, CASTLE_UPGRADE
 */
import type { Milestones, RunResult } from './run';

/** What one CI shard saves for `--merge`: the raw per-profile results and the two side tables the markdown renders. */
export interface PaceDump {
	results: Record<string, Milestones>;
	spreads: Record<string, Record<string, [number, number]>>;
	magnitudes: Record<string, Record<string, number | string>>;
	tileWaits: Record<string, Record<string, Record<string, number>>>;
}

/** Everything a set of profiles measured: what `renderMarkdown` and the pacing baseline are made from. */
export type PaceResults = PaceDump;

/** The median of the seeds per milestone, plus the min-max over seeds; a milestone reached by less than half of the seeds is null. The magnitudes and tile waits are the last seed's. */
export const mergeSeeds = (runs: RunResult[]): { milestones: Milestones; spread: Record<string, [number, number]> } => {
	const milestones: Milestones = {};
	const spread: Record<string, [number, number]> = {};
	const keys = new Set(runs.flatMap((r) => Object.keys(r.milestones)));
	keys.forEach((key) => {
		const values = runs
			.map((r) => r.milestones[key])
			.filter((v): v is number => v != null)
			.sort((a, b) => a - b);
		if (values.length < Math.ceil(runs.length / 2)) {
			milestones[key] = null;
			return;
		}
		milestones[key] = values[Math.floor((values.length - 1) / 2)];
		spread[key] = [values[0], values[values.length - 1]];
	});
	return { milestones, spread };
};

export const ORDER = [
	'tiles10',
	'tiles16',
	'tiles20',
	'castle2',
	'click1',
	'castle3',
	'tiles25',
	'chicken1',
	'cow1',
	'tiles30',
	'click2',
	'castle4',
	'tiles35',
	'click3',
	'castle5',
	'tiles40',
	'tiles50',
	'tiles75',
	'tiles100',
	'tiles150',
	'tiles200',
	'tiles300',
	'tiles400',
	'castle6',
	'rebirthPossible',
	'castle7',
	'castle8',
	'castle9',
	'castle10',
	'level10',
	'level20',
	'level30',
	'level50',
	'level80',
	'level90',
	'level100',
	'builder2',
	'finished',
];

/**
 * The bands of the magnitude targets (IDL-128): the table below is their one copy, the sim prints them next to the measured value.
 *
 * Magnitude targets (decided 2026-11-07, IDL-128): measured with the real store (`casual`, trace to day 16; `human-rebirth8`, `hardcore-rebirth6-x10`) and set as the design ceiling every cap decision is checked against.
 * "Income multiplier" is total income at castle 10 relative to run 1 at castle 10, all sources together (Embers, gear, Idols, Monument, Paragon). The bands are the constants below: they are the only copy, the sim prints them next to the measured value
 * with a status (lines outside a band are also printed as `WARNING` on stderr, the run does not fail).
 *
 * | Checkpoint | Gold per second | Income multiplier | Lifetime Embers | Unspent gold |
 * | --- | --- | --- | --- | --- |
 * | Run 1, castle 10 (day ~13, ~850 tiles) | 3,000 to 6,000 (was 2,500 to 5,000 before the gentler tile tail, IDL-181) | x1 | 0 | <= 4 h |
 * | Rebirth 5 (run 6 at castle 10) | x3 to x6 of run 1 | **x4** | about 90 to 140 with rebirths at castle 6, 350 to 500 at castle 8 | <= 4 h |
 * | Rebirth 10 (run 11 at castle 10) | x7 to x15 of run 1 | **x10** | about 190 to 300 with rebirths at castle 6 | <= 4 h |
 *
 * - **Embers per rebirth** (fits the decided formula, IDL-183, with the +50 tiles per rebirth of IDL-181): castle 6 about 18 to 28 (400 to 460 tiles), castle 8 about 70 to 100 (450 tiles), castle 10 about 400 to 650 (850 to 1,000 tiles). See {@link emberGain}.
 * - **Stocks**: any non-gold resource at most 24 hours of its production rate at castle 10; above it the sim warns. The merchant, auto-sell and the Monument are the sinks.
 * - **Ember path alone** (`1 + 0.1 x E^0.6`): x4 to x6 at 300 to 600 lifetime Embers; capped gear, Idols and the Monument add about x2.5 on top, which is how x10 at rebirth 10 is reached without Paragon doing the heavy lifting.
 * - **Finding to keep in mind**: `human-rebirth8` finishes run 2 in 99 % of run 1's time (castle timers set the pace), while hardcore falls to 48 to 72 %. The run-2 ratio of 60 to 70 % is therefore a hardcore-profile target;
 *   humans feel the Ember gain as bigger numbers and a larger map, not as shorter runs.
 * - The multiplier compares the same castle level in two runs because the bots rebirth before castle 10, so it is an indication. The existing +-15 % pacing guard (IDL-17) is separate.
 *
 * @category Pacing/Magnitude targets
 * @order 1
 */
export const MAGNITUDE_BANDS = {
	gpsRun1Castle10: [3000, 6000], // was 2,500-5,000 before the gentler tile tail of IDL-181 (casual and hardcore measure 5,480)
	unspentGoldHours: 4,
	stockHours: 24,
	// from `REBIRTH.gain` = 3 x (castle - 5)^1.3 x ((tiles / 10)^0.65 + 0.03 x surplus) at the territory the bots rebirth with (400-460 tiles at castle 6 and 8, ~850-1,000 at castle 10)
	embersPerRebirth: { 6: [18, 28], 8: [70, 100], 10: [400, 650] } as Record<number, [number, number]>,
	// lifetime Embers after the 5th / 10th rebirth, by the castle level the bot rebirths at (about n x the per-rebirth band)
	lifetimeEmbers: { 5: { 6: [90, 140], 8: [350, 500] }, 10: { 6: [190, 300] } } as Record<number, Record<number, [number, number]>>,
	incomeMultiplier: { 5: [3, 6], 10: [7, 15] } as Record<number, [number, number]>,
};

type Magnitudes = Record<string, Record<string, number | string>>;

/** The magnitude table of @category Pacing, per profile, with a status per line; `warnings` lists the lines outside their band. */
export const renderMagnitudes = (names: string[], magnitudes: Magnitudes): { lines: string[]; warnings: string[] } => {
	const rows: string[] = [];
	const warnings: string[] = [];
	const num = (profile: string, key: string) => {
		const v = magnitudes[profile]?.[key];
		return typeof v === 'number' ? v : null;
	};
	const fmt = (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en') : String(Math.round(v * 10) / 10));
	const row = (profile: string, what: string, value: number, band: string, ok: boolean | null) => {
		// null: no band applies (shown as a plain number, never a warning)
		rows.push(`| ${profile} | ${what} | ${fmt(value)} | ${band} | ${ok == null ? 'n/a' : ok ? 'ok' : '**outside**'} |`);
		if (ok === false) warnings.push(`${profile}: ${what} = ${fmt(value)}, band ${band}`);
	};
	const inBand = (v: number, [lo, hi]: readonly [number, number]) => v >= lo && v <= hi;
	for (const p of names) {
		// run 1 at castle 10
		const gps = num(p, 'r1.c10.gps');
		if (gps != null) {
			const [lo, hi] = MAGNITUDE_BANDS.gpsRun1Castle10;
			row(p, 'run 1, castle 10: gold per second', gps, `${lo}-${hi}`, inBand(gps, [lo, hi]));
			const goldH = num(p, 'r1.c10.goldH') ?? 0;
			row(p, 'run 1, castle 10: unspent gold (hours of income)', goldH, `<= ${MAGNITUDE_BANDS.unspentGoldHours}`, goldH <= MAGNITUDE_BANDS.unspentGoldHours);
			const stockH = num(p, 'r1.c10.stockH') ?? 0;
			row(
				p,
				`run 1, castle 10: biggest stock (${magnitudes[p]['r1.c10.stockRes']}, hours of production)`,
				stockH,
				`<= ${MAGNITUDE_BANDS.stockHours}`,
				stockH <= MAGNITUDE_BANDS.stockHours,
			);
		}
		// Embers per rebirth, by the castle level it happened at
		for (let run = 1; num(p, `r${run}.gain`) != null; run++) {
			const castle = num(p, `r${run}.gainCastle`)!;
			const band = MAGNITUDE_BANDS.embersPerRebirth[castle];
			if (band)
				row(p, `rebirth ${run} at castle ${castle}: Embers gained`, num(p, `r${run}.gain`)!, `${band[0]}-${band[1]}`, inBand(num(p, `r${run}.gain`)!, band));
		}
		// lifetime Embers after the 5th and the 10th rebirth
		for (const [n, byCastle] of Object.entries(MAGNITUDE_BANDS.lifetimeEmbers)) {
			const v = num(p, `lifetime.${n}`);
			const castle = num(p, `r${n}.gainCastle`);
			const band = castle == null ? undefined : byCastle[castle];
			if (v != null && band) row(p, `after rebirth ${n} at castle ${castle}: lifetime Embers`, v, `${band[0]}-${band[1]}`, inBand(v, band));
		}
		// income multiplier: run N+1 against run 1 at the highest castle level both reached (@category Pacing defines it at castle 10; the sim bot rebirths earlier)
		for (const [n, band] of Object.entries(MAGNITUDE_BANDS.incomeMultiplier)) {
			const run = Number(n) + 1;
			for (const c of [10, 8, 6]) {
				const first = num(p, `r1.c${c}.gps`);
				const later = num(p, `r${run}.c${c}.gps`);
				if (first && later != null) {
					row(
						p,
						`after rebirth ${n}: income multiplier at castle ${c} (run ${run} over run 1)`,
						later / first,
						c === 10 ? `x${band[0]}-${band[1]}` : `(x${band[0]}-${band[1]} is for castle 10)`,
						c === 10 ? inBand(later / first, band) : null,
					);
					break;
				}
			}
		}
	}
	const lines = ['', '## Magnitude targets (@category Pacing, IDL-128)', ''];
	if (rows.length === 0) {
		lines.push('No selected profile reached a checkpoint (castle 10 in run 1, a rebirth, lifetime Embers at rebirth 5 or 10).', '');
		return { lines, warnings };
	}
	lines.push(
		'Measured with the real store at the checkpoints of @category Pacing; the last seed of each profile. The income multiplier compares the same castle level in two runs (the bots rebirth before castle 10), so below castle 10 it is an indication with no status.',
		'',
	);
	lines.push('| profile | checkpoint | measured | band | status |', '| --- | --- | --- | --- | --- |', ...rows, '');
	if (warnings.length) lines.push(`${warnings.length} line${warnings.length > 1 ? 's' : ''} outside the band.`, '');
	return { lines, warnings };
};

/**
 * The table of a local optimiser run (`max-*` profiles): per rebirth the castle level, the Embers gained, the days since the last rebirth and the Embers a day, and at the end the day of the last rebirth and
 * of castle 10 on the run after it. Printed instead of the milestone table; nothing is written to docs/generated.
 */
export const renderOptimiser = (results: Record<string, Milestones>, names: string[], magnitudes: Magnitudes): string => {
	const out: string[] = ['# Optimiser runs (local, nothing written)', ''];
	const num = (p: string, key: string) => {
		const v = results[p]?.[key];
		return typeof v === 'number' ? v : null;
	};
	for (const p of names) {
		out.push(
			`## ${p}`,
			'',
			'| rebirth | at castle | Embers | day | days since last | Embers a day | lifetime Embers | level | tiles | gold/s | building levels |',
			'| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
		);
		let lifetime = 0;
		let lastDay = 0;
		let rebirths = 0;
		for (let n = 1; num(p, `embers${n}`) != null; n++) {
			rebirths = n;
			const embers = num(p, `embers${n}`)!;
			const day = num(p, `rebirthDay${n}`)!;
			lifetime += embers;
			out.push(
				`| ${n} | ${magnitudes[p]?.[`r${n}.gainCastle`] ?? '?'} | ${Math.round(embers)} | ${day.toFixed(1)} | ${(day - lastDay).toFixed(1)} | ${(embers / (day - lastDay)).toFixed(1)} | ${Math.round(lifetime)} | ${num(p, `lvlAtRebirth${n}`) ?? '?'} | ${num(p, `tilesAtRebirth${n}`) ?? '?'} | ${Math.round(num(p, `gpsAtRebirth${n}`) ?? 0).toLocaleString('en')} | ${num(p, `buildingLevels${n}`) ?? '?'} |`,
			);
			lastDay = day;
		}
		const castle10 = num(p, rebirths === 0 ? 'castle10' : `r${rebirths + 1}.castle10`);
		out.push(
			'',
			rebirths === 0
				? `No rebirth; castle 10 ${castle10 == null ? 'not reached' : `on day ${castle10.toFixed(1)}`}.`
				: `Last rebirth on day ${lastDay.toFixed(1)}; castle 10 on the run after it ${castle10 == null ? 'not reached' : `${castle10.toFixed(1)} days later, on day ${(lastDay + castle10).toFixed(1)}`}.`,
			'',
		);
	}
	return out.join('\n');
};

/** The days each run of a profile took to rebirth and what it paid: how long a rebirth takes, and how much of it the shop saves (`human-rebirth6` against `-builder2`, `-economy`, `-full`). */
const renderRebirthPace = (names: string[], results: Record<string, Milestones>): string[] => {
	const rows: string[] = [];
	for (const n of names) {
		const r = results[n];
		if (r.embers1 == null) continue;
		let previous = 0;
		for (let run = 1; r[`embers${run}`] != null; run++) {
			const day = r[`rebirthDay${run}`];
			const length = day == null ? null : day - previous;
			const key = (k: string) => (run === 1 ? k : `r${run}.${k}`);
			const possible = r[key('rebirthPossible')];
			const castle6 = r[key('castle6')];
			rows.push(
				`| ${n} | ${run} | ${castle6 == null ? '—' : castle6.toFixed(1)} | ${possible == null ? '—' : possible.toFixed(1)} | ${length == null ? '—' : length.toFixed(1)} | ${r[`embers${run}`]} | ${length ? (Number(r[`embers${run}`]) / length).toFixed(1) : '—'} |`,
			);
			if (day != null) previous = day;
		}
	}
	if (rows.length === 0) return [];
	return [
		'',
		'## Rebirth pace',
		'',
		'Per run of every profile that rebirths: the days (counted from the start of the run) to castle 6 and to the first moment a rebirth was possible (castle 6 and the territory of that rebirth, 400 tiles + 50 for every rebirth done), the length of the run in days, the Embers it paid and the Embers a day.',
		'',
		'| profile | run | castle 6 (d) | rebirth possible (d) | run length (d) | Embers | Embers a day |',
		'| --- | --- | --- | --- | --- | --- | --- |',
		...rows,
		'',
	];
};

export const renderMarkdown = (
	results: Record<string, Milestones>,
	magnitudes: Magnitudes,
	tileWaits: PaceDump['tileWaits'],
	spreads?: PaceDump['spreads'],
): string => {
	const names = Object.keys(results);
	const fmt = (d: number | null | undefined) => (d == null ? '—' : d < 1 ? `${(d * 24).toFixed(1)} h` : `${d.toFixed(1)} d`);
	const lines: string[] = [];
	lines.push('# Pace milestones');
	lines.push('');
	lines.push(
		'> Generated by `npm run pace` (scripts/pace.ts): the real game store driven by a bot with a seeded RNG. ' +
			'Time to first reach each milestone, in game time. "finished" = castle 6 + max click power + the rebirth territory (REBIRTH.minTiles); the run continues to the last castle level. ' +
			"The `human*` profiles play by the server's away rules (half income for at most 8 h of a gap, no purchases while away); `-builder2`, `-gems`, `-economy` and `-full` add the Gem shop's Builder #2, the Ember shop plans and the merchant's gold upgrades; `-rocks` and `-full` mine the rocks.",
	);
	lines.push('');
	lines.push(
		'> Class picker (IDL-78): these profiles play with no class, the neutral baseline. `npm run pace:classes` plays `idle` and `casual` with each class and fails when a guarded milestone moves more than ±15 % (or 5 game days) from this baseline; the sim models the XP, tile-discount and fight passives, not offline efficiency or chest speed (both are server-side only).',
	);
	lines.push('');
	lines.push(`| milestone | ${names.join(' | ')} |`);
	lines.push(`| --- | ${names.map(() => '---').join(' | ')} |`);
	// after a rebirth only the headline milestones of each further run are listed
	const extraKeys = Array.from(
		new Set(
			names.flatMap((n) =>
				Object.keys(results[n]).filter(
					(k) =>
						!ORDER.includes(k) &&
						/^(embers[0-9]+|tilesAtRebirth[0-9]+|gpsAtRebirth[0-9]+|buildingLevels[0-9]+|kills.*|rocks.*|rebirth|rebirthDay[0-9]+|waitHcastle[0-9]+|lvlAtRebirth[0-9]+|xpAtRebirth[0-9]+|(lvl|xp)@[0-9.]+h|r[0-9]+[.](castle6|tiles100|finished|rebirthPossible|builder2))$/.test(
							k,
						),
				),
			),
		),
	).sort((x, y) => x.localeCompare(y, undefined, { numeric: true }));
	[...ORDER, ...extraKeys].forEach((key) => {
		if (!names.some((n) => results[n][key] != null) && !ORDER.includes(key)) return;
		if (!names.some((n) => results[n][key] != null)) return;
		const isCount = /^(embers|lvl|kills|rocks|waitH)/.test(key); // waitHcastleN = hours the castle idled waiting for resources before upgrade N -> N+1
		const isXp = /^xp/.test(key);
		const cell = (n: string) => {
			if (isCount) return String(results[n][key] ?? '—');
			if (isXp) return results[n][key] == null ? '—' : Number(results[n][key]).toExponential(2);
			const spread = spreads?.[n]?.[key];
			const base = fmt(results[n][key]);
			return spread && results[n][key] != null ? `${base} (${fmt(spread[0])} - ${fmt(spread[1])})` : base;
		};
		lines.push(`| ${key} | ${names.map(cell).join(' | ')} |`);
	});
	lines.push('');
	// How much faster each further run reaches "finished" than the first one (target band 60-70 %, @category Pacing; used to tune the Ember curve)
	const ratioRows = names.flatMap((n) => {
		const first = results[n].finished;
		if (first == null) return [];
		const cells: string[] = [];
		for (let run = 2; results[n][`r${run}.finished`] != null; run++)
			cells.push(`run ${run}: ${Math.round((Number(results[n][`r${run}.finished`]) / first) * 100)} %`);
		return cells.length ? [`| ${n} | ${cells.join(', ')} |`] : [];
	});
	if (ratioRows.length) {
		lines.push('Time to "finished" in each further run as a share of the first run:');
		lines.push('');
		lines.push('| profile | share of run 1 |');
		lines.push('| --- | --- |');
		lines.push(...ratioRows);
		lines.push('');
	}
	lines.push(...renderRebirthPace(names, results));
	const waitNames = names.filter((n) => tileWaits[n] && Object.keys(tileWaits[n]).length > 0);
	if (waitNames.length) {
		lines.push('');
		lines.push(
			'Minutes the income needs to cover what is still missing of each part of the next tile, right after the purchase that reached that tile count (first run; the biggest number holds the player back):',
		);
		lines.push('');
		lines.push('| profile | tiles | gold | wood | stone | coal | food | hide |');
		lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
		waitNames.forEach((n) =>
			Object.entries(tileWaits[n]).forEach(([tiles, w]) =>
				lines.push(`| ${n} | ${tiles} | ${['gold', 'wood', 'stone', 'coal', 'food', 'hide'].map((r) => (w[r] == null ? '—' : w[r])).join(' | ')} |`),
			),
		);
	}
	lines.push(...renderMagnitudes(names, magnitudes).lines);
	lines.push(
		'Profiles: idle = never clicks; casual = 1 click/s for 3 h/day; hardcore = 4 clicks/s for 8 h/day; ' +
			'autoclicker = 20 clicks/s 24 h/day (the limiter should keep it at roughly hardcore pace).',
	);
	return lines.join('\n');
};

/** The milestones of every profile as data (game days, rounded so a rerun on another machine writes the same bytes): `scripts/pacing-guard.ts` compares it against the base branch's copy. */
export const renderBaseline = (results: Record<string, Milestones>): string =>
	JSON.stringify(
		{
			note: 'Written by npm run pace (scripts/pace.ts); compared by scripts/pacing-guard.ts. Game days, rounded to 6 significant digits.',
			profiles: results,
		},
		(_key, value) => (typeof value === 'number' ? Number(value.toPrecision(6)) : value),
		1,
	) + '\n';
