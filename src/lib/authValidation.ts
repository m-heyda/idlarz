import { PLAYER_CLASSES, PLAYER_CLASS_ORDER, type PlayerClassId } from '@/config/playerClasses';

/** Same limit as the in-game name (setPlayerName) and the `profiles.character_name` check constraint. */
export const CHARACTER_NAME_MAX = 9;
export const PASSWORD_MIN = 8;
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
}

type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

const asRecord = (body: unknown): Record<string, unknown> => (body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {});

export const checkEmail = (raw: unknown): Checked<string> => {
	const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
	if (!email || email.length > EMAIL_MAX || !EMAIL_SHAPE.test(email)) return { ok: false, error: 'Enter a valid email address.' };
	return { ok: true, value: email };
};

export const checkPassword = (raw: unknown): Checked<string> => {
	if (typeof raw !== 'string' || raw.length < PASSWORD_MIN) return { ok: false, error: `Password needs at least ${PASSWORD_MIN} characters.` };
	if (new TextEncoder().encode(raw).length > PASSWORD_MAX) return { ok: false, error: `Password can be at most ${PASSWORD_MAX} bytes.` };
	return { ok: true, value: raw };
};

export const checkCharacterName = (raw: unknown): Checked<string> => {
	const name = typeof raw === 'string' ? raw.trim() : '';
	if (!name || name.length > CHARACTER_NAME_MAX) return { ok: false, error: `Character name needs 1 to ${CHARACTER_NAME_MAX} characters.` };
	return { ok: true, value: name };
};

export const checkPlayerClass = (raw: unknown): Checked<PlayerClassId> => {
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

export const checkProfile = (body: unknown): Checked<ProfileInput> => {
	const input = asRecord(body);
	const characterName = checkCharacterName(input.characterName);
	if (!characterName.ok) return characterName;
	const playerClass = checkPlayerClass(input.playerClass);
	if (!playerClass.ok) return playerClass;
	return { ok: true, value: { characterName: characterName.value, playerClass: playerClass.value } };
};
