/**
 * A pet of the catalog (pure config). Pets are cosmetic: they give no stat, drop from nothing and are never sold; a pet exists in an account only when the server granted it (`applyPets`).
 * Ids are append-only (a save or ledger may name one forever); retire a pet with a flag, never by removing or renaming its id.
 *
 * The letter that comes with a special pet is **not** here: this file is in the browser bundle for everyone, so the letter lives in `src/lib/offline/petLetters.ts` (server only) and reaches only the account it is for.
 *
 * @category Progression/Pets
 * @order 1
 */
export interface PetDef {
	id: string;
	name: string;
	/** Path of the pixel icon under `public/` (reuse pool, `public/pixel/reuse/pets/`) */
	icon: string;
	/** Which way the artwork faces by default; the sprite is mirrored when the pet walks the other way */
	facing: 'left' | 'right';
	/** What the pet says now and then while it walks on the map (a speech bubble, every few minutes, never the same phrase twice in a row) */
	speech: readonly string[];
}

/** Every pet. Append only. */
export const PETS: readonly PetDef[] = [
	{
		id: 'yuki',
		name: 'Yuki',
		icon: '/pixel/reuse/pets/kaczkawu_dog.png',
		facing: 'right',
		speech: [
			"Woow! We're getting a bigger kingdom! Nie!",
			'Woof! Is it dinner time? It is always dinner time.',
			'I guarded the castle. Mostly from a butterfly.',
			'Did you see that slime? I barked at it. It did not care.',
			'Pet me! ...Now! ...Okay, now again!',
			"I buried your old sword. You're welcome.",
			'New loot?! Is any of it a bone?',
			'Big numbers! I like big numbers! Woof!',
			'Your offline gains are my favourite smell.',
			'I would help you fight, but I am a very good boy, and good boys supervise.',
			"Is the king asleep? I'll just sit on the throne for a bit.",
			'Sniff sniff... that tile has treasure. Probably. Maybe a sock.',
			'You work so hard! Have a tail wag!',
			'Level up?! Zoomies time!',
			'One more upgrade and then we walk, right? RIGHT?',
		],
	},
];

/** The pet with this id, or undefined (an id a newer server knows and this build does not). */
export const petById = (id: string): PetDef | undefined => PETS.find((pet) => pet.id === id);

/** Whether `id` names a pet of the catalog. */
export const isPetId = (id: unknown): id is string => typeof id === 'string' && PETS.some((pet) => pet.id === id);
