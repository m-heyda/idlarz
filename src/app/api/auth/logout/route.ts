import { createSupabaseServer } from '@/lib/supabase/server';
import { guardConfigured, json } from '@/lib/authRoute';

export const dynamic = 'force-dynamic';

export async function POST() {
	const off = guardConfigured();
	if (off) return off;
	try {
		const supabase = await createSupabaseServer();
		await supabase.auth.signOut();
	} catch {
		/* nothing to sign out of */
	}
	return json({ ok: true });
}
