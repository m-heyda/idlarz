// Local development keeps its own browser storage: on localhost (any port, 127.0.0.1, [::1], *.localhost) every key this game writes
// gets a ".dev" suffix, so a dev session starts from a fresh game and can never read, overwrite or "adopt" a save that belongs to an
// older dev build or to the real game served from the same browser. Everywhere else the keys are unchanged. Nothing here touches the
// account (cloud) save: it is the account's, wherever you play.

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|.+\.localhost)$/;

/** True when the page is served from a local development host. Always false on the server and in the node tests. */
export const isLocalDev = (): boolean => typeof window !== 'undefined' && LOCAL_HOST.test(window.location.hostname);

/** The storage key to use for `key`: the same on a real site, `${key}.dev` on localhost. */
export const scoped = (key: string): string => (isLocalDev() ? `${key}.dev` : key);
