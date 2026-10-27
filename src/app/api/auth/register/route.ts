import { createSupabaseServer } from '@/lib/supabase/server';
import { checkCredentials, checkProfile } from '@/lib/authValidation';
import { fail, guardConfigured, isOutage, json, readBody, unavailable } from '@/lib/authRoute';

export const dynamic = 'force-dynamic';

/**
 * Creates the account, signs the player in (Confirm email must be off in Supabase, otherwise there is no session)
 * and writes their profile row. If only the profile write fails the account still exists: the response carries
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
	try {
		const supabase = await createSupabaseServer();
		const { data, error } = await supabase.auth.signUp(credentials.value);
		if (isOutage(error)) return unavailable();
		if (error) return fail(/registered|exists/i.test(error.message) ? 'That email already has an account. Log in instead.' : error.message, error.status === 429 ? 429 : 400);
		if (!data.user || !data.session) return fail('Sign-up needs email confirmation, which this game does not use yet.', 500);

		const { characterName, playerClass } = profileInput.value;
		const { error: profileError } = await supabase.from('profiles').insert({ id: data.user.id, character_name: characterName, player_class: playerClass });
		const user = { id: data.user.id, email: data.user.email ?? null };
		return json({ user, profile: profileError ? null : { characterName, playerClass } }, 201);
	} catch {
		return unavailable();
	}
}
