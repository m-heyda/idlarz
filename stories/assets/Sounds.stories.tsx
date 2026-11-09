import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import sounds from '../../docs/assets/sounds.json';

interface Sound {
	name: string;
	src: string;
	group: string;
	pack: string;
	status: string;
	usedBy: string[];
	durationMs: number;
	use: string;
}

const ALL = sounds as Sound[];
const KEY = 'idlarz-sound-notes';
const field = { background: '#241e1a', color: '#f1e6c8', border: '1px solid #4a3f36', padding: '4px 8px', borderRadius: 4 } as const;

const load = (): Record<string, string> => {
	try {
		return JSON.parse(localStorage.getItem(KEY) ?? '{}');
	} catch {
		return {};
	}
};

/** Every sound with a play button and a notes box ("use for: ..."). Notes persist in this browser; filter to the ones with notes and screenshot the page. */
const SoundBoard: React.FC = () => {
	const [notes, setNotes] = useState<Record<string, string>>({});
	const [query, setQuery] = useState('');
	const [group, setGroup] = useState('all');
	const [onlyNoted, setOnlyNoted] = useState(false);
	const [playing, setPlaying] = useState('');
	const [copied, setCopied] = useState(false);
	const audio = useRef<HTMLAudioElement | null>(null);
	useEffect(() => setNotes(load()), []);
	const groups = useMemo(() => [...new Set(ALL.map((s) => s.group))], []);
	const setNote = (name: string, text: string) => {
		const next = { ...notes, [name]: text };
		if (!text.trim()) delete next[name];
		setNotes(next);
		try {
			localStorage.setItem(KEY, JSON.stringify(next));
		} catch {}
	};
	const play = (s: Sound) => {
		audio.current?.pause();
		const a = new Audio(s.src);
		a.volume = 0.6;
		audio.current = a;
		setPlaying(s.name);
		a.onended = () => setPlaying('');
		a.play().catch(() => setPlaying(''));
	};
	const shown = ALL.filter(
		(s) => (group === 'all' || s.group === group) && (!onlyNoted || notes[s.name] || s.use) && (!query || s.name.includes(query.toLowerCase())),
	);
	const noted = ALL.filter((s) => notes[s.name] || s.use);
	const copy = () => {
		const text = noted.map((s) => `- ${s.name} (${s.src.slice(1)}): ${notes[s.name].replace(/\n/g, ' ')}`).join('\n');
		navigator.clipboard?.writeText(text).catch(() => {});
		setCopied(true);
	};
	return (
		<div style={{ padding: 16, fontFamily: 'system-ui, sans-serif', color: '#f1e6c8', minHeight: '100vh', background: '#14110f' }}>
			<div
				style={{
					display: 'flex',
					gap: 8,
					flexWrap: 'wrap',
					alignItems: 'center',
					position: 'sticky',
					top: 0,
					background: '#14110f',
					padding: '8px 0',
					zIndex: 1,
				}}
			>
				<input placeholder='search name' value={query} onChange={(e) => setQuery(e.target.value)} style={{ ...field, width: 200 }} />
				<select value={group} onChange={(e) => setGroup(e.target.value)} style={field}>
					<option value='all'>all kinds</option>
					{groups.map((g) => (
						<option key={g}>{g}</option>
					))}
				</select>
				<label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
					<input type='checkbox' checked={onlyNoted} onChange={(e) => setOnlyNoted(e.target.checked)} /> only with notes ({noted.length})
				</label>
				<button type='button' onClick={copy} style={{ ...field, cursor: 'pointer' }}>
					{copied ? 'copied' : 'copy notes'}
				</button>
				<span style={{ opacity: 0.7 }}>
					{shown.length} / {ALL.length}
				</span>
			</div>
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
				{shown.map((s) => (
					<div
						key={s.name}
						style={{ background: '#1d1814', border: `1px solid ${notes[s.name] || s.use ? '#c9a24a' : '#3a3029'}`, borderRadius: 6, padding: 8 }}
						title={s.pack}
					>
						<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
							<button type='button' onClick={() => play(s)} style={{ ...field, cursor: 'pointer', minWidth: 36 }} aria-label={`play ${s.name}`}>
								{playing === s.name ? '■' : '▶'}
							</button>
							<div style={{ minWidth: 0 }}>
								<div style={{ fontSize: 12, fontWeight: 600, wordBreak: 'break-all' }}>{s.name}</div>
								<div style={{ fontSize: 11, opacity: 0.7 }}>
									{s.durationMs ? `${(s.durationMs / 1000).toFixed(2)} s · ` : ''}
									{s.status === 'used' ? 'in the game' : s.group}
								</div>
							</div>
						</div>
						<textarea
							value={notes[s.name] ?? s.use}
							onChange={(e) => setNote(s.name, e.target.value)}
							placeholder='use for: ...'
							rows={2}
							style={{ ...field, width: '100%', marginTop: 6, resize: 'vertical', boxSizing: 'border-box', fontSize: 12 }}
						/>
					</div>
				))}
			</div>
		</div>
	);
};

const meta = { title: 'Assets/Sounds', component: SoundBoard } satisfies Meta<typeof SoundBoard>;
export default meta;

export const Board: StoryObj<typeof meta> = {};
