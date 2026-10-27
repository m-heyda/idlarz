import { createSupabaseServer } from '@/lib/supabase/server';
import { checkProfile } from '@/lib/authValidation';
import { fail, guardConfigured, isOutage, json, readBody, unavailable } from '@/lib/authRoute';

export const dynamic = 'force-dynamic';

/** Creates or replaces the signed-in player's own profile row (the id is always the cookie's user, never from the body). */
export async function POST(request: Request) {
	const off = guardConfigured();
	if (off) return off;
	const input = checkProfile(await readBody(request));
	if (!input.ok) return fail(input.error, 400);
	try {
		const supabase = await createSupabaseServer();
		const { data, error } = await supabase.auth.getUser();
		if (isOutage(error)) return unavailable();
		if (error || !data.user) return fail('Not signed in.', 401);
		const { characterName, playerClass } = input.value;
		const { error: writeError } = await supabase.from('profiles').upsert({ id: data.user.id, character_name: characterName, player_class: playerClass });
		if (writeError) return unavailable();
		return json({ user: { id: data.user.id, email: data.user.email ?? null }, profile: { characterName, playerClass } });
	} catch {
		return unavailable();
	}
}
