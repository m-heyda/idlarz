import type { Metadata } from 'next';

export const metadata: Metadata = {
	title: 'Map lab',
	robots: { index: false, follow: false },
};

export default function MapLabLayout({ children }: { children: React.ReactNode }) {
	return children;
}
