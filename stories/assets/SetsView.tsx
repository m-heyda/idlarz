import React, { useMemo, useState } from 'react';
import manifest from '../../docs/assets/manifest.json';
import type { ManifestEntry } from './AssetGallery';

const STATUS_COLOR: Record<string, string> = { used: '#5fbf6a', planned: '#e0b04a', unused: '#e05a5a' };
const GROUPS = ['armor', 'weapons', 'accessories'] as const;

/** One matching set per row: its armor pieces, weapons and accessories side by side, each piece tagged used / planned / unused. Armor and weapons are kept apart from accessories, so a set can be built from fewer pieces. */
export const SetsView: React.FC = () => {
	const [theme, setTheme] = useState('all');
	const [query, setQuery] = useState('');
	const sets = useMemo(() => {
		const by = new Map<string, { source: string; title: string; theme: string; pieces: Record<string, ManifestEntry[]> }>();
		for (const e of (manifest as ManifestEntry[]).filter((x) => x.category === 'sets')) {
			const m = /^(\w+): (.+) \((\w+)\)$/.exec(e.subcategory);
			if (!m) continue;
			const s = by.get(e.source) ?? { source: e.source, title: m[2], theme: m[1], pieces: {} };
			(s.pieces[m[3]] ??= []).push(e);
			by.set(e.source, s);
		}
		return [...by.values()];
	}, []);
	const themes = [...new Set(sets.map((s) => s.theme))];
	const shown = sets.filter((s) => (theme === 'all' || s.theme === theme) && s.title.toLowerCase().includes(query.toLowerCase()));
	const field: React.CSSProperties = { background: '#241e1a', color: '#e8dcc4', border: '1px solid #3a3029', borderRadius: 4, padding: '4px 8px' };
	return (
		<div style={{ padding: 16, color: '#e8dcc4', fontFamily: 'system-ui, sans-serif' }}>
			<div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
				<input placeholder='search set name' value={query} onChange={(e) => setQuery(e.target.value)} style={field} />
				<select value={theme} onChange={(e) => setTheme(e.target.value)} style={field}>
					<option value='all'>all themes</option>
					{themes.map((t) => (
						<option key={t}>{t}</option>
					))}
				</select>
				<span style={{ opacity: 0.7 }}>
					{shown.length} / {sets.length} sets
				</span>
			</div>
			{shown.map((s) => (
				<div key={s.source} style={{ background: '#1d1814', border: '1px solid #3a3029', borderRadius: 6, padding: 10, marginBottom: 10 }}>
					<div style={{ fontWeight: 600, marginBottom: 6 }}>
						{s.title}{' '}
						<span style={{ opacity: 0.6, fontWeight: 400 }}>
							· {s.theme} · {s.source}
						</span>
					</div>
					{GROUPS.filter((g) => s.pieces[g]?.length).map((g) => (
						<div key={g} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
							<span style={{ width: 86, fontSize: 12, opacity: 0.7 }}>{g}</span>
							{s.pieces[g].map((e) => (
								<div
									key={e.name}
									title={`${e.name}\n${e.src}\n${e.status}${e.usedBy.length ? ` (${e.usedBy.join(', ')})` : ''}`}
									style={{ textAlign: 'center' }}
								>
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img
										src={e.src}
										alt={e.name}
										width={64}
										height={64}
										style={{ imageRendering: 'pixelated', display: 'block', background: '#2a231e', borderRadius: 4 }}
									/>
									<span style={{ fontSize: 10, color: STATUS_COLOR[e.status] }}>{e.name.split('_').slice(-(e.name.endsWith('_guards') ? 2 : 1))[0]}</span>
								</div>
							))}
						</div>
					))}
				</div>
			))}
		</div>
	);
};
