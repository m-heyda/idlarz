import { KEY, onlineRoute } from '@/lib/offlineRoute';
import { tutorialStep } from '@/lib/offline/online';
import type { TutorialRequest } from '@/lib/offline/tutorial';

export const dynamic = 'force-dynamic';

const ID = /^[A-Za-z0-9_-]{1,40}$/;

/**
 * The guided tutorial: `{ action: 'sync' }` reads the account's progress; `{ key, action: 'done' | 'lesson', id }` and `{ key, action: 'skip' }` record it. A finished step may pay its
 * starter bundle, once per account (a repeated request pays nothing); the body names no amount.
 */
export async function POST(request: Request) {
	return onlineRoute(
		request,
		(body) => {
			const { key, action, id, invVer } = body as { key?: unknown; action?: unknown; id?: unknown; invVer?: unknown };
			const version = Number.isInteger(invVer) && (invVer as number) >= 0 ? (invVer as number) : undefined;
			if (action === 'sync') return { key: null, request: { action: 'sync' } as TutorialRequest, invVer: version };
			if (typeof key !== 'string' || !KEY.test(key)) return null;
			if (action === 'skip') return { key, request: { action: 'skip' } as TutorialRequest, invVer: version };
			if ((action === 'done' || action === 'lesson') && typeof id === 'string' && ID.test(id))
				return { key, request: { action, id } as TutorialRequest, invVer: version };
			return null;
		},
		(deps, userId, body, nowMs) => tutorialStep(deps, userId, body.key, body.request, nowMs, body.invVer),
	);
}
