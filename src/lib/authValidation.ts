import { PLAYER_CLASSES, PLAYER_CLASS_ORDER, type PlayerClassId } from '@/config/playerClasses';
import { avatarById, avatarFitsClass, unlockedAvatarIds } from '@/catalog/avatars';

/** Same limit as the in-game name (applyProfileToFreshGame) and the `profiles.character_name` check constraint. */
export const CHARACTER_NAME_MAX = 9;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72; // bcrypt (what Supabase uses) ignores anything beyond 72 bytes
const EMAIL_MAX = 254;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface Credentials {
	email: string;
	password: string;
}
export interface ProfileInput {
	characterName: string;
	playerClass: PlayerClassId;
	/** The raw avatar id from the body, `null` when none was sent. NOT yet checked: it needs the account's earned achievements, see `checkAvatar`. */
	avatarId: string | null;
}

type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

const asRecord = (body: unknown): Record<string, unknown> =>
	body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

const checkEmail = (raw: unknown): Checked<string> => {
	const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
	if (!email || email.length > EMAIL_MAX || !EMAIL_SHAPE.test(email)) return { ok: false, error: 'Enter a valid email address.' };
	return { ok: true, value: email };
};

const checkPassword = (raw: unknown): Checked<string> => {
	if (typeof raw !== 'string' || raw.length < PASSWORD_MIN) return { ok: false, error: `Password needs at least ${PASSWORD_MIN} characters.` };
	if (new TextEncoder().encode(raw).length > PASSWORD_MAX) return { ok: false, error: `Password can be at most ${PASSWORD_MAX} bytes.` };
	return { ok: true, value: raw };
};

const checkCharacterName = (raw: unknown): Checked<string> => {
	const name = typeof raw === 'string' ? raw.trim() : '';
	if (!name || name.length > CHARACTER_NAME_MAX) return { ok: false, error: `Character name needs 1 to ${CHARACTER_NAME_MAX} characters.` };
	return { ok: true, value: name };
};

const checkPlayerClass = (raw: unknown): Checked<PlayerClassId> => {
	if (typeof raw !== 'string' || !(PLAYER_CLASS_ORDER as string[]).includes(raw) || !PLAYER_CLASSES[raw as PlayerClassId]) {
		return { ok: false, error: 'Pick one of the four heroes.' };
	}
	return { ok: true, value: raw as PlayerClassId };
};

export const checkCredentials = (body: unknown): Checked<Credentials> => {
	const input = asRecord(body);
	const email = checkEmail(input.email);
	if (!email.ok) return email;
	const password = checkPassword(input.password);
	if (!password.ok) return password;
	return { ok: true, value: { email: email.value, password: password.value } };
};

/**
 * The server's rule for an avatar (IDL-71, class lock IDL-269), the one place that decides: the id must be a string in the avatar catalog, a starter must belong to `playerClass` (a Mage cannot wear the Knight), and an unlockable
 * one needs its achievement among `earned` (the account's `player_achievements`); an earned reward is classless and passes with every class. A forged, unknown, locked or other-class id is refused; `null`/`undefined` means "none chosen" and passes.
 * Used by register, `POST /api/auth/profile`, `POST /api/auth/avatar` and the new-chapter reset. The client's own idea of what is unlocked is never trusted.
 *
 * @category Progression/Avatars
 * @order 2
 */
export const checkAvatar = (raw: unknown, playerClass: PlayerClassId, earned: Iterable<string>): Checked<string | null> => {
	if (raw === undefined || raw === null) return { ok: true, value: null };
	const avatar = typeof raw === 'string' ? avatarById(raw) : undefined;
	if (!avatar) return { ok: false, error: 'Pick one of the avatars.' };
	if (!avatarFitsClass(avatar, playerClass)) return { ok: false, error: 'That avatar belongs to another hero.' };
	if (!unlockedAvatarIds(earned).includes(avatar.id)) return { ok: false, error: 'That avatar is still locked.' };
	return { ok: true, value: avatar.id };
};

export const checkProfile = (body: unknown): Checked<ProfileInput> => {
	const input = asRecord(body);
	const characterName = checkCharacterName(input.characterName);
	if (!characterName.ok) return characterName;
	const playerClass = checkPlayerClass(input.playerClass);
	if (!playerClass.ok) return playerClass;
	const avatar = input.avatarId;
	if (avatar !== undefined && avatar !== null && (typeof avatar !== 'string' || avatar.length > 40)) return { ok: false, error: 'Pick one of the avatars.' };
	return { ok: true, value: { characterName: characterName.value, playerClass: playerClass.value, avatarId: avatar ?? null } };
};
