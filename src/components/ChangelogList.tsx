'use client';

import React, { useState } from 'react';
import type { ChangelogEntry } from '@/config/changelog';
import '@/styles/Changelog.css';

/** Renders `**bold**` as <strong>; everything else is plain text (no html is ever injected). */
const Inline: React.FC<{ text: string }> = ({ text }) => <>{text.split('**').map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))}</>;

const ChangelogRow: React.FC<{ entry: ChangelogEntry; open: boolean; onToggle: () => void }> = ({ entry, open, onToggle }) => {
	const panelId = `cl-${entry.version}`;
	return (
		<article className='cl-entry'>
			<button type='button' className='cl-head' aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
				<span className='cl-caret' aria-hidden='true'>
					{open ? '▾' : '▸'}
				</span>
				<span className='cl-version'>{entry.version}</span>
				<span className='cl-title'>{entry.title}</span>
				<span className='cl-date'>{entry.date}</span>
			</button>
			<div id={panelId} className='cl-body' hidden={!open}>
				{entry.body.map((block, i) =>
					block.kind === 'p' ? (
						<p key={i}>
							<Inline text={block.text} />
						</p>
					) : (
						<ul key={i}>
							{block.items.map((item) => (
								<li key={item}>
									<Inline text={item} />
								</li>
							))}
						</ul>
					),
				)}
			</div>
		</article>
	);
};

/**
 * The release notes, one collapsible row per version (the newest starts open). Shared by the landing page's Changelog window and the game's Changelog window; the caller puts it on a `cl-paper` parchment sheet.
 */
const ChangelogList: React.FC<{ entries: readonly ChangelogEntry[] }> = ({ entries }) => {
	const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(entries.slice(0, 1).map((e) => e.version)));
	const toggle = (version: string) =>
		setOpen((prev) => {
			const next = new Set(prev);
			if (!next.delete(version)) next.add(version);
			return next;
		});
	return (
		<>
			{entries.map((entry) => (
				<ChangelogRow key={entry.version} entry={entry} open={open.has(entry.version)} onToggle={() => toggle(entry.version)} />
			))}
		</>
	);
};

export default ChangelogList;
