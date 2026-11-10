import type { Metadata } from 'next';
import LandingPage from '@/components/landing/LandingPage';
import { GAME_TAGLINE, GAME_TITLE } from '@/config/branding';

export const metadata: Metadata = {
	title: GAME_TITLE,
	description: GAME_TAGLINE,
	robots: { index: true, follow: true },
	openGraph: { title: GAME_TITLE, description: GAME_TAGLINE, type: 'website' },
};

/** The public landing page (`/`): the title, a login / register window and what the game offers. The game itself is at `/play`. */
export default function Page() {
	return <LandingPage />;
}
