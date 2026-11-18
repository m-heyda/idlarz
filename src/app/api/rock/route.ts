import { ROCK } from '@/config/rocks';
import { KEY, onlineRoute } from '@/lib/offlineRoute';
import { hitRock } from '@/lib/offline/online';
import { COORD_LIMIT } from '@/utils/world';

export const dynamic = 'force-dynamic';

/**
 * Hits the rock on one tile: `{ key, x, y, clicks }` (an idempotency key, the tile the server put the rock on and how many clicks the browser counted since its last batch). The server lets in only the clicks a person could have made (`ROCK.maxCps`) and rolls the drops when the rock breaks;
 * the body names no amount of loot.
 */
export async function POST(request: Request) {
	return onlineRoute(
		request,
		(body) => {
			const { key, x, y, clicks, invVer } = body as { key?: unknown; x?: unknown; y?: unknown; clicks?: unknown; invVer?: unknown };
			const tile = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && Math.abs(v) <= COORD_LIMIT;
			const count = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= ROCK.maxBatch;
			return typeof key === 'string' && KEY.test(key) && tile(x) && tile(y) && count(clicks)
				? { key, x, y, clicks, invVer: Number.isInteger(invVer) && (invVer as number) >= 0 ? (invVer as number) : undefined }
				: null;
		},
		(deps, userId, body, nowMs) => hitRock(deps, userId, body.key, { x: body.x, y: body.y }, body.clicks, nowMs, body.invVer),
	);
}
