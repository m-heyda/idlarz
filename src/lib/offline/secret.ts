import { createHash } from 'node:crypto';

/**
 * SHA-256 of the `LOOT_SECRET` that used to be committed in `.env.example`. The repo is public, so that value is known to everyone and must never seal anything:
 * a deployment that still uses it is told so in the log (see {@link lootSecretProblem}). Only the hash is kept here, not the value.
 */
const PUBLIC_DEFAULT_SHA256 = '0664763b7ddad05c8951fdf9bdce1cca9180e910e85334a813b3119797a2c387';

/** Why a secret is not fit to seal rolls, or null when it is fine. Pure, so it is tested without the environment. */
export const lootSecretProblem = (secret: string): 'missing' | 'too_short' | 'public_default' | null => {
	if (secret === '') return 'missing';
	if (secret.length < 16) return 'too_short';
	if (createHash('sha256').update(secret).digest('hex') === PUBLIC_DEFAULT_SHA256) return 'public_default';
	return null;
};

let warned = false;

/**
 * The server-only secret that seals rolls (the LOOT_SECRET variable). Empty when it is not set up: the offline and reward routes then answer 503.
 * Every deployment must have its own value (`.env.example` holds a placeholder only); a missing, short or publicly known value is logged once per server process, never the value itself.
 */
export const lootSecret = (): string => {
	const secret = process.env.LOOT_SECRET ?? '';
	const problem = lootSecretProblem(secret);
	if (problem && problem !== 'missing' && !warned) {
		warned = true;
		console.warn(
			`LOOT_SECRET is ${problem === 'public_default' ? 'the value that used to be committed in .env.example (public): set a new one for this deployment' : 'shorter than 16 characters'}.`,
		);
	}
	return secret;
};

export const lootConfigured = (): boolean => lootSecret().length >= 16;
