import { KEY, onlineRoute } from '@/lib/offlineRoute';
import { craftStep } from '@/lib/offline/online';
import { parseEnchant } from '@/lib/offline/craft';

export const dynamic = 'force-dynamic';

/**
 * The enchant craft (IDL-120): `{ key, index, mode, affix? }` (an idempotency key, the bag slot of a piece of gear, `reroll` or `add`, and for a reroll the index of the affix to replace). Costs Ichor from the crafting stash; the piece in the bag gets the new affix.
 * The answer is the bag and the crafting state. At most one request per second per player.
 */
export async function POST(request: Request) {
	return onlineRoute(
		request,
		(body) => {
			const enchant = parseEnchant(body);
			return typeof body.key === 'string' && KEY.test(body.key) && enchant ? { key: body.key, ...enchant } : null;
		},
		(deps, userId, body, nowMs) => craftStep(deps, userId, body.key, { action: 'enchant', index: body.index, mode: body.mode, affix: body.affix }, nowMs),
	);
}
