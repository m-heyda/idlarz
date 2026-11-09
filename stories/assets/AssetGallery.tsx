import React, { useMemo, useState } from 'react';
import manifest from '../../docs/assets/manifest.json';

export interface ManifestEntry {
	name: string;
	category: string;
	subcategory: string;
	src: string;
	size: [number, number];
	status: string;
	usedBy: string[];
	source: string;
	variants?: Record<string, string>;
}

const ALL = manifest as ManifestEntry[];
const STATUS_COLOR: Record<string, string> = { used: '#5fbf6a', reserve: '#e0b04a', placeholder: '#8a8a8a', spare: '#6a9fd8', reuse: '#c07ad8' };

/** Card grid of one manifest category: search by name, filter by status/subcategory/variant, click a card to copy its name. */
export const AssetGallery: React.FC<{ category: string; scale?: number }> = ({ category, scale = 2 }) => {
	const rows = useMemo(() => ALL.filter((e) => e.category === category), [category]);
	const [query, setQuery] = useState('');
	const [status, setStatus] = useState('all');
	const [sub, setSub] = useState('all');
	const [variant, setVariant] = useState('default');
	const [copied, setCopied] = useState('');
	const statuses = [...new Set(rows.map((e) => e.status))];
	const subs = [...new Set(rows.map((e) => e.subcategory))];
	const hasVariants = rows.some((e) => e.variants);
	const shown = rows.filter(
		(e) =>
			(status === 'all' || e.status === status) &&
			(sub === 'all' || e.subcategory === sub) &&
			(!query || e.name.includes(query.toLowerCase()) || e.usedBy.some((u) => u.includes(query))),
	);
	const srcOf = (e: ManifestEntry) => (variant !== 'default' && e.variants?.[variant]) || e.src;
	const copy = (name: string) => {
		navigator.clipboard?.writeText(name).catch(() => {});
		setCopied(name);
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
				{hasVariants && (
					<select value={variant} onChange={(e) => setVariant(e.target.value)} style={field}>
						{['default', 'none', 'shadow', 'texture', 'texture-dark'].map((v) => (
							<option key={v}>{v}</option>
						))}
					</select>
				)}
				<span style={{ opacity: 0.7 }}>
					{shown.length} / {rows.length}
					{copied && ` · copied ${copied}`}
				</span>
			</div>
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
				{shown.map((e) => (
					<button
						key={e.name}
						type='button'
						onClick={() => copy(e.name)}
						title={`${e.src}\n${e.source}`}
						style={{ textAlign: 'left', background: '#1d1814', border: '1px solid #3a3029', borderRadius: 6, padding: 8, color: 'inherit', cursor: 'pointer' }}
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
					</button>
				))}
			</div>
		</div>
	);
};
