/**
 * Is this server a production server? Decided from the server's own environment only; nothing the client sends can
 * influence it, so a player cannot claim to be a tester (or a tester claim to be a player).
 *
 * Non-production = `next dev` on a developer's machine (NODE_ENV is "development") or a Vercel preview / development
 * deployment (VERCEL_ENV). Everything else counts as production, including a missing VERCEL_ENV: if the platform
 * variables were not exposed, real players must stay in the checks, not slip out of them.
 */
export const isNonProduction = (env: { NODE_ENV?: string; VERCEL_ENV?: string } = process.env): boolean =>
	env.NODE_ENV !== 'production' || env.VERCEL_ENV === 'preview' || env.VERCEL_ENV === 'development';
