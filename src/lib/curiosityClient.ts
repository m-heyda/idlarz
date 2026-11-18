import { newClaimId } from '@/lib/offlineClient';
import { requestGems } from '@/lib/rewardsClient';

// The browser side of the secret deeds: tells the server once per page load that something happened (a window dragged to its smallest, the map at its largest zoom, a look into the World boss window, a skin put on the
// castle). The server keeps a short allowlist (`lib/offline/curiosity.ts`) and records each id once, so a made-up id earns nothing; a report the server did not take is tried again the next time.

const sent = new Set<string>();

/** Reports a one-off event for a deed. Fire and forget; the same id is sent at most once per page load. */
export const reportCuriosity = (id: string): void => {
	if (sent.has(id)) return;
	sent.add(id);
	void requestGems(newClaimId(), { action: 'visit', id })
		.then((reply) => {
			if (reply.status !== 'ok') sent.delete(id);
		})
		.catch(() => sent.delete(id));
};
