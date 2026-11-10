import type { NextConfig } from 'next';
import path from 'node:path';

const root = path.resolve(__dirname);

const nextConfig: NextConfig = {
	// The repo may sit below another lockfile (e.g. a parent folder); pin the workspace root explicitly
	turbopack: { root },
	outputFileTracingRoot: root,
	// Lets the browser bundle know which Vercel environment it was built for (the tutorial guide shows on previews, see src/lib/tutorial/live.ts)
	env: { NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? '' },
};

export default nextConfig;
