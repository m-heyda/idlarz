import { BASELINE_EPOCH, EPOCH_HEADER } from '@/config/epoch';
import { readSeenEpoch } from '@/lib/seenEpoch';

/**
 * `fetch` for the game's own /api routes: it adds the `x-game-epoch` header with the data epoch this browser last saw (`readSeenEpoch`, the baseline when it never recorded one),
 * so the server can refuse a tab that was left open across the new chapter flip (412 `staleEpoch`). On that answer the page reloads once into the epoch guard, which wipes the old
 * game's browser state and shows the new chapter screen; a second stale answer within a minute does not reload again (no loop). See `config/epoch.ts`.
 */
const RELOAD_KEY = 'idlarz.epochReloadAt';

const reloadOnce = (): void => {
	try {
		const last = Number(window.sessionStorage.getItem(RELOAD_KEY));
		if (Number.isFinite(last) && Date.now() - last < 60_000) return;
		window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
	} catch {
		/* no session storage: reload anyway, the guard settles it */
	}
	window.location.reload();
};

export const epochFetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
	const headers = new Headers(init.headers);
	headers.set(EPOCH_HEADER, String(readSeenEpoch() ?? BASELINE_EPOCH));
	const response = await fetch(input, { ...init, headers });
	if (response.status === 412) {
		const body = (await response
			.clone()
			.json()
			.catch(() => null)) as { staleEpoch?: boolean } | null;
		if (body?.staleEpoch) reloadOnce();
	}
	return response;
};
