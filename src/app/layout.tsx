import type { Metadata } from 'next';
// Mozilla Headline (Google Fonts, OFL) - self-hosted via the fontsource package; exposes the
// "Mozilla Headline Variable" family used by --font-pixel in globals.css
import '@fontsource-variable/mozilla-headline';
// Titan One (Google Fonts, OFL) for the floating damage numbers of the combat window; only the latin subset is loaded
import '@fontsource/titan-one/latin-400.css';
import './globals.css';
import { Analytics } from '@vercel/analytics/next';

export const metadata: Metadata = {
	title: 'Idle Explorer',
	description: 'An idle territory-expansion game: buy tiles, grow your castle, farm and trade.',
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
			</body>
		</html>
	);
}
