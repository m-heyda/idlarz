import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '@/lib/authClient';
import { supabaseConfigured } from '@/lib/supabase/server';

export interface SessionUser {
	id: string;
	email: string | null;
}

const BODY_MAX = 4096;

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export const fail = (error: string, status: number) => json({ error }, status);

/** The auth service cannot be reached or is not set up: the client treats this as "play without an account", never as "logged out". */
export const unavailable = () => json({ error: 'Accounts are unavailable right now.', unavailable: true }, 503);

export const guardConfigured = () => (supabaseConfigured() ? null : unavailable());

/** Reads a small JSON body; null when it is missing, too large or not JSON. */
export const readBody = async (request: Request, maxChars = BODY_MAX): Promise<unknown> => {
	try {
		const text = await request.text();
		if (text.length > maxChars) return null;
		return JSON.parse(text);
	} catch {
		return null;
	}
};

/** Network trouble or a Supabase outage is not the same as a bad login. */
export const isOutage = (error: { status?: number } | null | undefined): boolean => Boolean(error && (!error.status || error.status >= 500));

/** The signed-in player's own profile row (`id = userId`, never an id from the client). */
export const loadProfile = async (supabase: SupabaseClient, userId: string): Promise<{ profile: Profile | null; failed: boolean }> => {
	const { data, error } = await supabase.from('profiles').select('character_name, player_class').eq('id', userId).maybeSingle();
	if (error) return { profile: null, failed: true };
	if (!data) return { profile: null, failed: false };
	return { profile: { characterName: data.character_name, playerClass: data.player_class }, failed: false };
};
