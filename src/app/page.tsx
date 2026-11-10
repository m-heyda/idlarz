import type { Metadata } from 'next';
import LandingPage from '@/components/landing/LandingPage';
import { GAME_TAGLINE, GAME_TITLE } from '@/config/branding';
import { LANDING_DESIGN } from '@/config/landing';
import { loadChangelog } from '@/lib/changelogFiles';

export const metadata: Metadata = {
	title: GAME_TITLE,
	description: GAME_TAGLINE,
	robots: { index: true, follow: true },
	openGraph: { title: GAME_TITLE, description: GAME_TAGLINE, type: 'website' },
};

/** Sets the page scale before the first paint (the same formula as `fitZoom`), so the layout does not jump when the page wakes up. */
const FIT_SCRIPT = `(function(){var z=Math.min(1.5,Math.max(0.5,Math.min(innerWidth/${LANDING_DESIGN.width},innerHeight/${LANDING_DESIGN.height})));document.documentElement.style.setProperty('--ld-zoom',String(z))})()`;

/** The public landing page (`/`): the title, the release notes (read from `content/changelog/` while the page is built), a login / register window and what the game offers. The game itself is at `/play`. */
export default function Page() {
	return (
		<>
			<script dangerouslySetInnerHTML={{ __html: FIT_SCRIPT }} />
			<LandingPage changelog={loadChangelog()} />
		</>
	);
}
