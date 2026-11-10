/**
 * The sound library: every audio file under `public/` (the game's own mp3s and the CC0 Kenney packs in `public/sfx/`) under one stable name, with its
 * duration and what it is used for. `npm run assets:catalog` renders it to `docs/assets/sounds.json` and `sounds.md`; Storybook's Sounds page plays them.
 * Names are `<pack>_<file>` (`uiaudio_click1`, `interface_confirmation_001`, `game_click`); rename one in `scripts/assets/names.json` by its `src`.
 * The game plays only the four `game_*` files (src/utils/audioManager.ts). Three Kenney Interface Sounds were picked for later (kept in `public/sfx/`, the rest of the pack was deleted); what each is for is in `scripts/assets/sound-notes.json`, and they stay `reuse` until wired.
 *
 * @title Sound library
 * @category Architecture/Art
 * @order 4
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { ROOT } from './manifest';

export interface SoundEntry {
	/** The stable name to refer to this sound by */
	name: string;
	/** Served URL, relative to public/ */
	src: string;
	/** Kind of sound: the file name without its number (`click`, `switch`, `confirmation` ...) */
	group: string;
	pack: string;
	/** used = the game plays it now; reuse = unused library sound */
	status: 'used' | 'reuse';
	usedBy: string[];
	durationMs: number;
	/** What it is meant for (scripts/assets/sound-notes.json, keyed by `src`); empty until someone decides */
	use: string;
}

const PUBLIC = join(ROOT, 'public');
const PACKS: Record<string, { prefix: string; label: string }> = {
	'sfx/kenney-interface-sounds': { prefix: 'interface', label: 'Kenney Interface Sounds (CC0)' },
};
const GAME_SOUNDS: Record<string, string> = { 'click.mp3': 'click', 'purchase.mp3': 'purchase', 'wrong.mp3': 'wrong', 'fanfare.mp3': 'fanfare' };

/** Length of a PCM wav from its header; 0 when it is not a plain wav (the mp3s) */
const wavMs = (file: string): number => {
	const b = readFileSync(file);
	if (b.toString('ascii', 0, 4) !== 'RIFF') return 0;
	let rate = 0;
	let bytesPerSec = 0;
	for (let p = 12; p + 8 <= b.length; ) {
		const id = b.toString('ascii', p, p + 4);
		const len = b.readUInt32LE(p + 4);
		if (id === 'fmt ') {
			rate = b.readUInt32LE(p + 12);
			bytesPerSec = rate ? b.readUInt32LE(p + 16) : 0;
		}
		if (id === 'data') return bytesPerSec ? Math.round((len / bytesPerSec) * 1000) : 0;
		p += 8 + len + (len % 2);
	}
	return 0;
};

export const buildSounds = (names: Record<string, string> = {}, notes: Record<string, string> = {}): SoundEntry[] => {
	const out: SoundEntry[] = [];
	for (const [file, key] of Object.entries(GAME_SOUNDS)) {
		const full = join(PUBLIC, file);
		if (existsSync(full))
			out.push({
				name: `game_${key}`,
				src: `/${file}`,
				group: key,
				pack: 'The game (src/utils/audioManager.ts)',
				status: 'used',
				usedBy: [key],
				durationMs: 0,
				use: '',
			});
	}
	for (const [dir, pack] of Object.entries(PACKS)) {
		const root = join(PUBLIC, dir);
		if (!existsSync(root)) continue;
		for (const f of readdirSync(root).sort()) {
			if (!f.endsWith('.wav') || !statSync(join(root, f)).isFile()) continue;
			const id = basename(f, '.wav').toLowerCase();
			const src = '/' + relative(PUBLIC, join(root, f)).split(sep).join('/');
			out.push({
				name: `${pack.prefix}_${id}`,
				src,
				group: id.replace(/_?\d+$/, ''),
				pack: pack.label,
				status: 'reuse',
				usedBy: [],
				durationMs: wavMs(join(root, f)),
				use: '',
			});
		}
	}
	for (const e of out) {
		if (names[e.src]) e.name = names[e.src];
		e.use = notes[e.src] ?? '';
	}
	return out.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name, undefined, { numeric: true }));
};
