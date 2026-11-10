import { copyText } from './clipboard';
import React, { useMemo, useState } from 'react';
import manifest from '../../docs/assets/manifest.json';
import { useTrashMarks } from './trashMarks';

export interface ManifestEntry {
	name: string;
	category: string;
	subcategory: string;
	src: string;
	size: [number, number];
	status: string;
	usedBy: string[];
	slot?: string;
	weaponType?: string;
	grade?: string;
	source: string;
	variants?: Record<string, string>;
}

const ALL = manifest as ManifestEntry[];
const STATUS_COLOR: Record<string, string> = {
	used: '#5fbf6a',
	planned: '#e0b04a',
	retired: '#d8806a',
	unused: '#e05a5a',
	placeholder: '#8a8a8a',
	spare: '#6a9fd8',
	reuse: '#c07ad8',
};

/** Card grid of one manifest category: search by name, filter by status/subcategory/variant, click a card to copy its name. */
export const AssetGallery: React.FC<{ category: string; scale?: number }> = ({ category, scale = 2 }) => {
	const rows = useMemo(() => ALL.filter((e) => e.category === category), [category]);
	const [query, setQuery] = useState('');
	const [status, setStatus] = useState('all');
	const [sub, setSub] = useState('all');
	const [slot, setSlot] = useState('all');
	const [sort, setSort] = useState('default');
	const [variant, setVariant] = useState('default');
	const [copied, setCopied] = useState('');
	const [onlyTrash, setOnlyTrash] = useState(false);
	const trash = useTrashMarks();
	const statuses = [...new Set(rows.map((e) => e.status))];
	const subs = [...new Set(rows.map((e) => e.subcategory))];
	const hasVariants = rows.some((e) => e.variants);
	const slots = [...new Set(rows.flatMap((e) => (e.slot ? [e.slot] : [])))];
	const keyOf = (e: ManifestEntry) =>
		sort === 'slot'
			? `${e.slot ?? ''} ${e.weaponType ?? ''} ${e.grade ?? ''} ${e.name}`
			: sort === 'grade'
				? `${e.grade ?? 'zz'} ${e.slot ?? ''} ${e.name}`
				: sort === 'status'
					? `${e.status} ${e.name}`
					: '';
	const shown = rows.filter(
		(e) =>
			(status === 'all' || e.status === status) &&
			(sub === 'all' || e.subcategory === sub) &&
			(slot === 'all' || e.slot === slot) &&
			(!onlyTrash || trash.marks[e.src]) &&
			(!query || e.name.includes(query.toLowerCase()) || e.usedBy.some((u) => u.includes(query))),
	);
	if (sort !== 'default') shown.sort((a, b) => keyOf(a).localeCompare(keyOf(b), undefined, { numeric: true }));
	const srcOf = (e: ManifestEntry) => (variant !== 'default' && e.variants?.[variant]) || e.src;
	/** repo path of the picture shown (variant aware), as an agent finds it in the checkout */
	const pathOf = (e: ManifestEntry) => `public${srcOf(e)}`;
	const copy = (text: string, label = text) => {
		copyText(text).then((ok) => setCopied(ok ? label : `copy failed (${label})`));
	};
	const field = { background: '#241e1a', color: '#f1e6c8', border: '1px solid #4a3f36', padding: '4px 8px', borderRadius: 4 } as const;
	return (
		<div style={{ padding: 16, fontFamily: 'system-ui, sans-serif', color: '#f1e6c8', minHeight: '100vh', background: '#14110f' }}>
			<div
				style={{
					display: 'flex',
					gap: 8,
					flexWrap: 'wrap',
					marginBottom: 12,
					alignItems: 'center',
					position: 'sticky',
					top: 0,
					background: '#14110f',
					padding: '8px 0',
					zIndex: 1,
				}}
			>
				<input placeholder='search name or used-by' value={query} onChange={(e) => setQuery(e.target.value)} style={{ ...field, width: 220 }} />
				<select value={status} onChange={(e) => setStatus(e.target.value)} style={field}>
					<option value='all'>all statuses</option>
					{statuses.map((s) => (
						<option key={s}>{s}</option>
					))}
				</select>
				<select value={sub} onChange={(e) => setSub(e.target.value)} style={field}>
					<option value='all'>all groups</option>
					{subs.map((s) => (
						<option key={s}>{s}</option>
					))}
				</select>
				{slots.length > 0 && (
					<select value={slot} onChange={(e) => setSlot(e.target.value)} style={field}>
						<option value='all'>all slots</option>
						{slots.map((s) => (
							<option key={s}>{s}</option>
						))}
					</select>
				)}
				<select value={sort} onChange={(e) => setSort(e.target.value)} style={field}>
					{['default', 'slot', 'grade', 'status'].map((v) => (
						<option key={v} value={v}>
							{v === 'default' ? 'sort: group' : `sort: ${v}`}
						</option>
					))}
				</select>
				{hasVariants && (
					<select value={variant} onChange={(e) => setVariant(e.target.value)} style={field}>
						{['default', 'none', 'shadow', 'texture', 'texture-dark'].map((v) => (
							<option key={v}>{v}</option>
						))}
					</select>
				)}
				<label style={{ fontSize: 13 }}>
					<input type='checkbox' checked={onlyTrash} onChange={(e) => setOnlyTrash(e.target.checked)} /> marked trash only
				</label>
				<button
					type='button'
					onClick={() => copy(shown.map(pathOf).join('\n'), `${shown.length} paths`)}
					style={field}
					title='Copy the repo path of every card shown (respects the filters)'
				>
					copy shown paths
				</button>
				<button type='button' onClick={trash.copyList} style={field} title='Copy every trash mark from every gallery'>
					{trash.status || `copy trash list (${trash.list.length})`}
				</button>
				<span style={{ opacity: 0.7 }}>
					{shown.length} / {rows.length}
					{copied && ` · copied ${copied}`}
				</span>
			</div>
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
				{shown.map((e) => (
					<div key={e.name} style={{ position: 'relative' }}>
						<button
							type='button'
							onClick={() => trash.toggle(e.src)}
							title={trash.marks[e.src] ? 'marked as trash: click to unmark' : 'mark as trash'}
							style={{ position: 'absolute', top: 4, right: 4, zIndex: 1, ...field, padding: '0 6px', background: trash.marks[e.src] ? '#8a2f2f' : '#241e1a' }}
						>
							{trash.marks[e.src] ? 'trash' : '🗑'}
						</button>
						<div
							style={{
								textAlign: 'left',
								width: '100%',
								background: '#1d1814',
								border: `1px solid ${trash.marks[e.src] ? '#c04a4a' : '#3a3029'}`,
								opacity: trash.marks[e.src] ? 0.55 : 1,
								borderRadius: 6,
								padding: 8,
								color: 'inherit',
							}}
						>
							<div
								style={{
									height: 112,
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									background: 'repeating-conic-gradient(#2a231e 0% 25%, #211b17 0% 50%) 0 / 16px 16px',
									borderRadius: 4,
									overflow: 'hidden',
								}}
							>
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img
									src={srcOf(e)}
									alt={e.name}
									style={{
										imageRendering: 'pixelated',
										width: e.size[0] * scale,
										height: e.size[1] * scale,
										maxWidth: '100%',
										maxHeight: '100%',
										objectFit: 'contain',
									}}
								/>
							</div>
							<div style={{ fontSize: 12, marginTop: 6, wordBreak: 'break-all', fontWeight: 600 }}>{e.name}</div>
							<div style={{ fontSize: 11, opacity: 0.7 }}>
								{e.size.join('x')} · <span style={{ color: STATUS_COLOR[e.status] }}>{e.status}</span>
							</div>
							{e.usedBy.length > 0 && <div style={{ fontSize: 11, opacity: 0.7, wordBreak: 'break-all' }}>{e.usedBy.join(', ')}</div>}
							<div style={{ fontSize: 10, marginTop: 4, color: '#c9b98f', wordBreak: 'break-all', fontFamily: 'ui-monospace, monospace', userSelect: 'all' }}>
								{pathOf(e)}
							</div>
							<div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
								<button
									type='button'
									onClick={() => copy(pathOf(e), `path of ${e.name}`)}
									style={{ ...field, padding: '1px 6px', fontSize: 11 }}
									title={pathOf(e)}
								>
									copy path
								</button>
								<button type='button' onClick={() => copy(e.name)} style={{ ...field, padding: '1px 6px', fontSize: 11 }} title='Copy the asset name'>
									copy name
								</button>
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
};
