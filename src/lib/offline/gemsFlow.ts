import { checkCharacterName } from '@/lib/authValidation';
import type { GemsReply, GemsRequest } from '@/lib/offline/gemTypes';
import type { IdentityRepo } from '@/lib/offline/identity';
import { gemsStep, resolvePendingIdentity, type Online } from '@/lib/offline/online';
import type { ServiceDeps } from '@/lib/offline/service';

/**
 * One request to the gem shop, start to finish. The name rules and the "another account has it" check come first (a refused change never costs a gem), then the purchase is decided on the ledger (`gemsStep`), and an identity change
 * the purchase left pending is written on the profile right after (`resolvePendingIdentity`); if the name was taken in the meantime the gems are given back. A request that finds an older change still pending (a crash between the charge and the write) finishes it first.
 */
export const runGems = async (
	deps: ServiceDeps,
	identity: IdentityRepo,
	userId: string,
	key: string | null,
	request: GemsRequest,
	nowMs: number,
): Promise<Online<GemsReply>> => {
	const info = await identity.load(userId);
	let blocked: { reason: NonNullable<GemsReply['reason']>; message: string } | null = null;
	let spend = request;
	if (request.action === 'spend' && request.itemId === 'name_change') {
		const name = checkCharacterName(request.value);
		if (!name.ok) blocked = { reason: 'bad_value', message: name.error };
		else {
			spend = { ...request, value: name.value };
			if (info && info.characterName.toLowerCase() === name.value.toLowerCase()) blocked = { reason: 'bad_value', message: 'That is already your name.' };
			else if (await identity.nameTaken(userId, name.value)) blocked = { reason: 'name_taken', message: 'That name is taken. Pick another.' };
		}
	}
	const out = await gemsStep(deps, userId, key, spend, nowMs, info, blocked);
	if (out.kind !== 'ok') return out;
	let reply = out.value;
	const changesIdentity = spend.action === 'spend' && (spend.itemId === 'class_change' || spend.itemId === 'name_change');
	if (!((changesIdentity && reply.ok) || reply.reason === 'pending')) return out;
	const resolved = await resolvePendingIdentity(deps, identity, userId, nowMs);
	if (resolved.kind === 'refunded') {
		reply = { ...reply, ok: false, reason: 'name_taken', message: 'That name was just taken. Your gems are back.', gems: resolved.gems, paid: 0 };
	} else if (resolved.kind === 'applied') {
		const nowSec = nowMs / 1000;
		reply =
			resolved.pending.kind === 'class'
				? { ...reply, playerClass: resolved.pending.value, gems: resolved.gems }
				: { ...reply, characterName: resolved.pending.value, nameChangedAt: Math.floor(nowSec), gems: resolved.gems };
	}
	return { kind: 'ok', value: reply };
};
