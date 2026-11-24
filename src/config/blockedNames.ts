/**
 * Names a new account or a rename may not take (IDL-301): strong profanity and a few names that pass for the game's own voice. Applied by `checkCharacterName` (register, profile, new chapter, guest hero, the gem shop's rename);
 * a name that is already taken is a different check. Nobody is renamed retroactively: the list is read only when a name is written.
 *
 * How a name is compared (`isBlockedName`): lower-cased, accents removed, the usual look-alike digits and symbols read as letters (0 o, 1 i, 3 e, 4 a, 5 s, 7 t, @ a, $ s), everything that is not a letter dropped, repeated letters
 * folded. A **fragment** blocks any name that contains it (long, unmistakable words only, so "class" or "assassin" stay free); a **reserved** word blocks only the whole name (impersonation).
 * Extend the lists here; a test pins that ordinary names such as the starter names and the four hero classes pass.
 *
 * @category Saves & Server
 * @title Blocked character names
 */
export const BLOCKED_FRAGMENTS: readonly string[] = [
	'fuck',
	'shit',
	'bitch',
	'cunt',
	'nigger',
	'nigga',
	'faggot',
	'whore',
	'slut',
	'rapist',
	'nazi',
	'hitler',
	'kurwa',
	'chuj',
	'pizda',
	'jebac',
	'pierdol',
	'cwel',
	'spierdal',
];

/** Names that are only blocked as a whole: "Admin" and "4dm1n" are blocked, "Adminton" is not */
export const RESERVED_NAMES: readonly string[] = [
	'admin',
	'administrator',
	'moderator',
	'mod',
	'system',
	'support',
	'staff',
	'idlarz',
	'gamemaster',
	'owner',
	'dev',
	'developer',
];

const LOOK_ALIKES: Readonly<Record<string, string>> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i' };

/** The comparison form of a name: see the file comment. */
export const normalizeName = (name: string): string =>
	name
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/ł/g, 'l')
		.replace(/[0134577@$!]/g, (c) => LOOK_ALIKES[c] ?? c)
		.replace(/[^a-z]/g, '')
		.replace(/(.)\1+/g, '$1');

/** Whether a name may not be taken: it contains a blocked fragment, or it is a reserved word as a whole. */
export const isBlockedName = (name: string): boolean => {
	const normal = normalizeName(name);
	if (!normal) return false;
	const fold = (word: string) => normalizeName(word);
	return BLOCKED_FRAGMENTS.some((word) => normal.includes(fold(word))) || RESERVED_NAMES.some((word) => normal === fold(word));
};
