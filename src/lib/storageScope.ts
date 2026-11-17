// Local development keeps its own browser storage: on localhost (any port, 127.0.0.1, [::1], *.localhost) every key this game writes
// gets a ".dev" suffix, so a dev session starts from a fresh game and can never read, overwrite or "adopt" a save that belongs to an
// older dev build or to the real game served from the same browser. Everywhere else the keys are unchanged. Nothing here touches the
// account (cloud) save: it is the account's, wherever you play.

import { BASELINE_EPOCH, GAME_EPOCH } from '@/config/epoch';

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|.+\.localhost)$/;

/** True when the page is served from a local development host. Always false on the server and in the node tests. */
export const isLocalDev = (): boolean => typeof window !== 'undefined' && LOCAL_HOST.test(window.location.hostname);

/**
 * True on the guest game (`/guest`, see `src/lib/guest`). That page is always reached by a full page load, so the answer is the same for every module that reads it at import.
 * Every key carries the `.guest` suffix there: a guest's browser-only game can never read, overwrite or be mistaken for a signed-in player's save.
 */
export const isGuestPage = (): boolean => typeof window !== 'undefined' && /^\/guest(\/|$)/.test(window.location.pathname);

/** The storage key to use for `key`: the same on a real site, `${key}.dev` on localhost, and `.guest` added on the guest game. */
export const scoped = (key: string): string => `${key}${isGuestPage() ? '.guest' : ''}${isLocalDev() ? '.dev' : ''}`;

/** The key suffix of a data epoch: none at `BASELINE_EPOCH` (every key name stays exactly as it is today), `.e<epoch>` from the next epoch on. */
export const epochSuffix = (epoch: number = GAME_EPOCH): string => (epoch > BASELINE_EPOCH ? `.e${epoch}` : '');

/** `scoped` plus the epoch suffix: the local game of an older epoch lives under another name and can never be read as this epoch's game. */
export const epochScoped = (key: string, epoch: number = GAME_EPOCH): string => `${scoped(key)}${epochSuffix(epoch)}`;
