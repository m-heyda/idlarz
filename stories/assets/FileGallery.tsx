import React, { useState } from 'react';
import { useTrashMarks } from './trashMarks';

export interface FileEntry {
	/** URL the picture is served from */
	src: string;
	/** Stable repo path, shown on the card and used as the trash mark (`/pixel/bg/x.png`, `art_style_reference/farm/y.png`) */
	id: string;
	/** Group to filter by (the sub-folder) */
	group: string;
}

const field = { background: '#241e1a', color: '#f1e6c8', border: '1px solid #4a3f36', padding: '4px 8px', borderRadius: 4 } as const;

/**
 * Review gallery for picture folders the asset manifest leaves out on purpose (map ground, backdrops, the art style references). Same trash marks as the
 * manifest galleries (see trashMarks.ts). Pictures are shown pixelated and fit the card.
 */
export const FileGallery: React.FC<{ files: FileEntry[]; minCard?: number }> = ({ files, minCard = 150 }) => {
	const [group, setGroup] = useState('all');
	const [query, setQuery] = useState('');
	const [onlyTrash, setOnlyTrash] = useState(false);
	const trash = useTrashMarks();
	const groups = [...new Set(files.map((f) => f.group))].sort();
	const shown = files.filter(
		(f) => (group === 'all' || f.group === group) && (!query || f.id.toLowerCase().includes(query.toLowerCase())) && (!onlyTrash || trash.marks[f.id]),
	);
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
					zIndex: 2,
				}}
			>
				<input placeholder='search path' value={query} onChange={(e) => setQuery(e.target.value)} style={{ ...field, width: 220 }} />
				<select value={group} onChange={(e) => setGroup(e.target.value)} style={field}>
					<option value='all'>all folders</option>
					{groups.map((g) => (
						<option key={g}>{g}</option>
					))}
				</select>
				<label style={{ fontSize: 13 }}>
					<input type='checkbox' checked={onlyTrash} onChange={(e) => setOnlyTrash(e.target.checked)} /> marked trash only
				</label>
				<button type='button' onClick={trash.copyList} style={field} title='Copy every trash mark from every gallery'>
					{trash.status || `copy trash list (${trash.list.length})`}
				</button>
				<span style={{ opacity: 0.7 }}>
					{shown.length} / {files.length}
				</span>
			</div>
			<div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${minCard}px, 1fr))`, gap: 10 }}>
				{shown.map((f) => (
					<div
						key={f.id}
						style={{
							background: '#1d1814',
							border: `1px solid ${trash.marks[f.id] ? '#c04a4a' : '#3a3029'}`,
							opacity: trash.marks[f.id] ? 0.55 : 1,
							borderRadius: 6,
							padding: 8,
						}}
					>
						<div style={{ height: 168, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img src={f.src} alt={f.id} loading='lazy' style={{ imageRendering: 'pixelated', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
						</div>
						<div style={{ fontSize: 11, marginTop: 6, wordBreak: 'break-all' }}>{f.id}</div>
						<button type='button' onClick={() => trash.toggle(f.id)} style={{ ...field, marginTop: 4, background: trash.marks[f.id] ? '#8a2f2f' : '#241e1a' }}>
							{trash.marks[f.id] ? 'marked trash (undo)' : '🗑 mark trash'}
						</button>
					</div>
				))}
			</div>
		</div>
	);
};
