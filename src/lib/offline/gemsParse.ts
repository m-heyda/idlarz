import { KEY } from '@/lib/idempotencyKey';
import type { GemsRequest } from '@/lib/offline/gemTypes';

export type GemsBody = { key: string | null; request: GemsRequest };

const text = (value: unknown): string | undefined => (typeof value === 'string' && value.length <= 40 ? value : undefined);

/**
 * The body of `POST /api/gems` as a typed request, or null when it is not one (the route answers 400). `status` needs no key; `daily`, `claim`, `claimAll` and `spend` need the idempotency key.
 * `claim` names one achievement id (the Achievements window's Claim button); the id is checked against the catalog by the server, not here.
 */
export const parseGemsBody = (body: Record<string, unknown>): GemsBody | null => {
	if (body.action === 'status') return { key: null, request: { action: 'status' } };
	if (typeof body.key !== 'string' || !KEY.test(body.key)) return null;
	if (body.action === 'daily') return { key: body.key, request: { action: 'daily' } };
	if (body.action === 'claimAll') return { key: body.key, request: { action: 'claimAll' } };
	if (body.action === 'visit' && typeof body.id === 'string' && body.id.length > 0 && body.id.length <= 40)
		return { key: body.key, request: { action: 'visit', id: body.id } };
	if (body.action === 'claim' && typeof body.id === 'string' && body.id.length > 0 && body.id.length <= 60)
		return { key: body.key, request: { action: 'claim', id: body.id } };
	if (body.action === 'spend' && typeof body.itemId === 'string' && body.itemId.length <= 40)
		return { key: body.key, request: { action: 'spend', itemId: body.itemId, value: text(body.value) } };
	return null;
};
