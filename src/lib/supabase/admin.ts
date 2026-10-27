import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The service-role client: bypasses row security, so it exists only for the server routes that must write tables
 * players may not write themselves (the cloud save). The key is a server-only env var, never NEXT_PUBLIC_.
 */
export const adminConfigured = (): boolean => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

let client: SupabaseClient | null = null;

export const createSupabaseAdmin = (): SupabaseClient => {
	const url = process.env.SUPABASE_URL;
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !key) throw new Error('Supabase service role is not configured');
	client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
	return client;
};
