// The changelog window on the landing page (`/`). Newest first; add an entry here with every update worth telling players about.

export interface ChangelogEntry {
	/** ISO date, shown as written. */
	date: string;
	title: string;
	/** One short line each. */
	items: readonly string[];
}

export const CHANGELOG: readonly ChangelogEntry[] = [
	{
		date: '2026-11-10',
		title: 'A new front door',
		items: [
			'The game has a landing page and lives at /play now.',
			'Sign in from the landing: it shows your hero and level, and Enter takes you in.',
			'This window will carry the news of every update.',
		],
	},
];
