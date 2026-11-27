import { NextResponse } from 'next/server';
import { loadChangelog } from '@/lib/changelogFiles';

export const dynamic = 'force-static';

/**
 * The release notes for the game's Changelog window: `GET /api/changelog` answers every note in `content/changelog/` as a `ChangelogEntry[]`, newest version first. Public (the same notes the landing page shows) and
 * read once while the app is built, so it costs nothing per request; a new note appears with the next deploy.
 *
 * @category Saves & Server/Endpoints
 * @title GET /api/changelog
 */
export function GET() {
	return NextResponse.json(loadChangelog());
}
