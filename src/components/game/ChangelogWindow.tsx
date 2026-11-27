import React, { useEffect, useState } from 'react';
import { Panel } from '../../../packages/design-system/src/components/primitives';
import ChangelogList from '@/components/ChangelogList';
import type { ChangelogEntry } from '@/config/changelog';
import GameWindow from './GameWindow';

type Notes = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; entries: ChangelogEntry[] };

/**
 * The Changelog window (the scroll button in the top bar, next to the Kingdom overview): the same release notes as the landing page's Changelog, newest version first with the newest open. The notes are read from `GET /api/changelog`
 * each time the window opens (the answer is static, so the browser keeps it); while it loads or when it cannot be reached the window says so instead of staying empty.
 */
const ChangelogWindow: React.FC = () => {
	const [notes, setNotes] = useState<Notes>({ state: 'loading' });

	useEffect(() => {
		let alive = true;
		fetch('/api/changelog')
			.then((response) => (response.ok ? (response.json() as Promise<ChangelogEntry[]>) : Promise.reject(new Error(String(response.status)))))
			.then((entries) => alive && setNotes({ state: 'ready', entries }))
			.catch(() => alive && setNotes({ state: 'failed' }));
		return () => {
			alive = false;
		};
	}, []);

	return (
		<GameWindow id='changelog' title='Changelog' width={560} height={560} flush>
			<Panel parchment className='cl-paper' style={{ height: '100%' }}>
				{notes.state === 'ready' ? (
					notes.entries.length ? (
						<ChangelogList entries={notes.entries} />
					) : (
						<p>No release notes yet.</p>
					)
				) : (
					<p>{notes.state === 'loading' ? 'Reading the notes…' : 'The release notes could not be loaded. Try opening this window again.'}</p>
				)}
			</Panel>
		</GameWindow>
	);
};

export default ChangelogWindow;
