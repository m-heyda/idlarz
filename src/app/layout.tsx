import type { Metadata } from 'next';
// Mozilla Headline (Google Fonts, OFL) - self-hosted via the fontsource package; exposes the
// "Mozilla Headline Variable" family used by --font-pixel in globals.css
import '@fontsource-variable/mozilla-headline';
// Titan One (Google Fonts, OFL) for the floating damage numbers of the combat window; only the latin subset is loaded
import '@fontsource/titan-one/latin-400.css';
import './globals.css';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { GAME_TAGLINE, GAME_TITLE } from '@/config/branding';

export const metadata: Metadata = {
	title: GAME_TITLE,
	description: GAME_TAGLINE,
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang='en'>
			<body>
				{children}
				<Analytics />
				<SpeedInsights />
			</body>
		</html>
	);
}
