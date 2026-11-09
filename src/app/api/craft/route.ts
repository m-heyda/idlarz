import { KEY, onlineRoute } from '@/lib/offlineRoute';
import { craftStep } from '@/lib/offline/online';
import { parseCraft } from '@/lib/offline/craft';

export const dynamic = 'force-dynamic';

/**
 * Crafts: `{ key, recipeId, count }` (an idempotency key, a recipe of the catalog, 1 to 10 crafts). The server checks the recipe, the crafting
 * level and the components it holds and queues the batch (a recipe without a time is done at once). Gear recipes (IDL-241) are queued like any timed recipe; the pieces are rolled by the server when the batch is claimed (`/api/craft/claim`) and go to the bag. The
 * answer is the bag and the crafting state. At most one request per second per player.
 */
export async function POST(request: Request) {
	return onlineRoute(
		request,
		(body) => {
			const craft = parseCraft(body);
			return typeof body.key === 'string' && KEY.test(body.key) && craft ? { key: body.key, ...craft } : null;
		},
		(deps, userId, body, nowMs) => craftStep(deps, userId, body.key, { recipeId: body.recipeId, count: body.count }, nowMs),
	);
}
