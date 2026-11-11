import { createSupabaseServer } from '@/lib/supabase/server';
import { checkAvatar, checkCredentials, checkProfile } from '@/lib/authValidation';
import { GAME_EPOCH } from '@/config/epoch';
import { adminConfigured, createSupabaseAdmin } from '@/lib/supabase/admin';
import { fail, guardConfigured, isOutage, json, readBody, unavailable } from '@/lib/authRoute';

export const dynamic = 'force-dynamic';

/** Whether another account already holds this name (case-insensitive, like the unique index `profiles_character_name_ci`). Throws on a failed read. */
const nameTaken = async (name: string): Promise<boolean> => {
	const { data, error } = await createSupabaseAdmin()
		.from('profiles')
		.select('id')
		.ilike('character_name', name.replace(/[\\%_]/g, '\\$&'))
		.limit(1);
	if (error) throw new Error(error.message);
	return (data?.length ?? 0) > 0;
};

/**
 * Creates the account, signs the player in (Confirm email must be off in Supabase, otherwise there is no session)
 * and writes their profile row: reserved name, class and avatar, so a new player skips the "new chapter" screen (IDL-77). The name is checked for a holder
 * BEFORE the account is created (409 `nameTaken`, nothing made), and the avatar has to be one of the two starters of the chosen class (a new account has earned nothing yet; `checkAvatar`). If only the profile write fails the account still exists: the response carries
 * `profile: null` and the client asks for name and hero again through /api/auth/profile.
 */
export async function POST(request: Request) {
	const off = guardConfigured();
	if (off) return off;
	const body = await readBody(request);
	const credentials = checkCredentials(body);
	if (!credentials.ok) return fail(credentials.error, 400);
	const profileInput = checkProfile(body);
	if (!profileInput.ok) return fail(profileInput.error, 400);
	const avatar = checkAvatar(profileInput.value.avatarId, profileInput.value.playerClass, []);
	if (!avatar.ok) return fail(avatar.error, 400);
	try {
		if (adminConfigured() && (await nameTaken(profileInput.value.characterName)))
			return json({ error: 'That name is taken. Pick another.', nameTaken: true }, 409);
		const supabase = await createSupabaseServer();
		const { data, error } = await supabase.auth.signUp(credentials.value);
		if (isOutage(error)) return unavailable();
		if (error)
			return fail(
				/registered|exists/i.test(error.message) ? 'That email already has an account. Log in instead.' : error.message,
				error.status === 429 ? 429 : 400,
			);
		if (!data.user || !data.session) return fail('Sign-up needs email confirmation, which this game does not use yet.', 500);

		const { characterName, playerClass } = profileInput.value;
		const { error: profileError } = await supabase.from('profiles').insert({ id: data.user.id, character_name: characterName, player_class: playerClass });
		// a new account starts on the current data epoch (the epoch column is the server's to write, not the player's)
		if (!profileError && adminConfigured()) {
			await createSupabaseAdmin()
				.from('profiles')
				.update({ epoch: GAME_EPOCH, ...(avatar.value ? { avatar_id: avatar.value } : {}) })
				.eq('id', data.user.id);
		}
		const user = { id: data.user.id, email: data.user.email ?? null };
		return json({ user, profile: profileError ? null : { characterName, playerClass, avatarId: avatar.value } }, 201);
	} catch {
		return unavailable();
	}
}
