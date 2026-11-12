import type { Metadata } from 'next';
import LandingPage from '@/components/landing/LandingPage';
import { GAME_TAGLINE, GAME_TITLE } from '@/config/branding';
import { loadChangelog } from '@/lib/changelogFiles';

export const metadata: Metadata = {
	title: GAME_TITLE,
	description: GAME_TAGLINE,
	robots: { index: true, follow: true },
	openGraph: { title: GAME_TITLE, description: GAME_TAGLINE, type: 'website' },
};

/** The public landing page (`/`): the realm picture, the release notes (read from `content/changelog/` while the page is built), and a login / register window. The game itself is at `/play`. */
export default function Page() {
	return <LandingPage changelog={loadChangelog()} />;
}
