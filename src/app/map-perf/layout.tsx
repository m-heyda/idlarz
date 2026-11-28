import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
	title: 'Map perf',
	robots: { index: false, follow: false },
};

/** The page does not exist in a production build, unless it is built for measuring (`NEXT_PUBLIC_MAP_PERF=1 npm run build`). */
export default function MapPerfLayout({ children }: { children: React.ReactNode }) {
	if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_MAP_PERF !== '1') notFound();
	return children;
}
