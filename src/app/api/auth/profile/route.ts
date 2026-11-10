import { createSupabaseServer } from '@/lib/supabase/server';
import { checkCreationAvatar, checkProfile } from '@/lib/authValidation';
import { adminConfigured, createSupabaseAdmin } from '@/lib/supabase/admin';
import { writeAvatar } from '@/lib/avatarServer';
import { fail, guardConfigured, isOutage, json, readBody, unavailable } from '@/lib/authRoute';

export const dynamic = 'force-dynamic';

/** Creates or replaces the signed-in player's own profile row (the id is always the cookie's user, never from the body). The avatar, when sent, is checked against the class and stored by the service role. */
export async function POST(request: Request) {
	const off = guardConfigured();
	if (off) return off;
	const input = checkProfile(await readBody(request));
	if (!input.ok) return fail(input.error, 400);
	// the hero's avatar: one of the two starters of the class (a profile being finished has earned nothing yet)
	const avatar = checkCreationAvatar(input.value.avatarId, input.value.playerClass, []);
	if (!avatar.ok) return fail(avatar.error, 400);
	try {
		const supabase = await createSupabaseServer();
		const { data, error } = await supabase.auth.getUser();
		if (isOutage(error)) return unavailable();
		if (error || !data.user) return fail('Not signed in.', 401);
		const { characterName, playerClass } = input.value;
		const { error: writeError } = await supabase.from('profiles').upsert({ id: data.user.id, character_name: characterName, player_class: playerClass });
		if (writeError?.code === '23505') return json({ error: 'That name is taken. Pick another.', nameTaken: true }, 409);
		if (writeError) return unavailable();
		// `avatar_id` is a service-role column: written after the upsert, like the register route does
		if (avatar.value && adminConfigured()) await writeAvatar(createSupabaseAdmin(), data.user.id, avatar.value);
		return json({ user: { id: data.user.id, email: data.user.email ?? null }, profile: { characterName, playerClass, avatarId: avatar.value } });
	} catch {
		return unavailable();
	}
}
