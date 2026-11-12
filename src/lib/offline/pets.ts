import { isPetId } from '@/catalog/pets';
import type { Ledger } from '@/lib/offline/ledger';
import { PET_LETTERS, type PetLetter } from '@/lib/offline/petLetters';

// SERVER ONLY. Cosmetic pets: who owns which (the ledger's `legacy.pets`) and the one-time welcome letter of a special pet. The browser says "sync" or "I closed the letter"; the server decides who is granted what,
// by the account's user id from its own configuration (never by a name, never by anything the browser sends).

export type PetsRequest = { action: 'sync' } | { action: 'ack'; id: string };

export interface PetsReply {
	/** The pets this account owns (ids of the catalog) */
	owned: string[];
	/** The letter still to show (the pet it came with and its texts), or null. Only the account it was granted to ever gets one. */
	letter: ({ petId: string } & PetLetter) | null;
}

/** Which pet the account with `GRANT_USER_ID` is given. One special pet, one account: add a row for the next one. */
export const PET_GRANTS: readonly { petId: string }[] = [{ petId: 'yuki' }];

/**
 * Applies one pets request to the ledger. `sync` grants the special pet to the one account the server is configured for (`grantUserId`, the `YUKI_GRANT_USER_ID` variable; nobody is granted anything while it is empty or the user id differs) and
 * answers what the account owns and which letter is still to be shown. `ack` records that the player closed a letter, so it never comes again. Idempotent: running either again changes nothing. A pet is not in any drop table, shop or chest.
 * The id of an account that is not the configured one gets no pet, no letter and no trace in its ledger.
 *
 * @category Progression/Pets
 * @order 4
 */
export const applyPets = (ledger: Ledger, userId: string, request: PetsRequest, grantUserId: string): { ledger: Ledger; reply: PetsReply } => {
	let { legacy } = ledger;
	const owns = (id: string) => legacy.pets?.includes(id) ?? false;
	const saw = (id: string) => legacy.letters?.includes(id) ?? false;

	if (grantUserId !== '' && userId === grantUserId)
		for (const grant of PET_GRANTS) if (isPetId(grant.petId) && !owns(grant.petId)) legacy = { ...legacy, pets: [...(legacy.pets ?? []), grant.petId] };

	if (request.action === 'ack' && owns(request.id) && !saw(request.id) && PET_LETTERS[request.id])
		legacy = { ...legacy, letters: [...(legacy.letters ?? []), request.id] };

	const next = legacy === ledger.legacy ? ledger : { ...ledger, legacy };
	const owned = (next.legacy.pets ?? []).filter(isPetId);
	const due = owned.find((id) => PET_LETTERS[id] && !(next.legacy.letters ?? []).includes(id));
	return { ledger: next, reply: { owned, letter: due ? { petId: due, ...PET_LETTERS[due] } : null } };
};
