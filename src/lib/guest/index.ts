import { useGameStore } from '@/stores/gameStore';
import { guestWiped, setGuestTransport } from '@/lib/guestMode';
import { createGuestTransport } from '@/lib/guest/dispatch';
import { writeSeenAt } from '@/lib/guest/localRepos';

let installed = false;

/** Starts the guest engine: from now on the game's /api calls on this page are answered in the browser (see `dispatch.ts`). Call on `/guest`, before the game mounts. */
export const installGuest = (): void => {
	if (installed) return;
	installed = true;
	setGuestTransport(createGuestTransport(() => useGameStore.getState()));
	// the next absence is measured from the moment the tab went away (unless the guest was just discarded: nothing may be written again)
	window.addEventListener('pagehide', () => {
		if (!guestWiped()) writeSeenAt(Date.now());
	});
};
