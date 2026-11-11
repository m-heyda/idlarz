/** What the server said to an avatar change: the id it stored (it may differ from the one asked for) or the reason it refused. */
export type AvatarSendResult = { ok: true; avatarId?: string | null } | { ok: false; message: string };

/** What a pick came to: `ignored` (already the shown avatar), `saved`, `reverted` (the server refused or was unreachable; `message` says why) or `stale` (a newer pick owns the outcome). */
export type AvatarPickOutcome = { status: 'ignored' | 'saved' | 'stale' } | { status: 'reverted'; message: string };

/** What the avatar picker needs from the outside: the avatar the client shows, a way to change it, and the request to the server. */
export interface AvatarPickDeps {
	get: () => string | null;
	set: (id: string | null) => void;
	send: (id: string) => Promise<AvatarSendResult>;
}

/**
 * Optimistic avatar change (the picker used to wait 2-3 s for the server before the new face showed). `pick(id)` shows `id` everywhere at once, then asks the server; the server stays the judge.
 * - The avatar shown right now counts as the request in flight, so picking it again sends nothing.
 * - Only the latest pick may write the final state: a late answer of an earlier pick is `stale` (it only moves the last confirmed avatar forward when it succeeded).
 * - A refused or failed latest pick goes back to the last avatar the server confirmed (not to an earlier optimistic one), and returns the reason to show.
 * - When the server stores another avatar than the one asked for, the server's value is shown.
 * Nothing is stored by the client; saves and ledgers are untouched.
 * @category Progression/Avatars
 */
export const createAvatarPicker = (deps: AvatarPickDeps) => {
	let latest = 0;
	let pending = 0;
	let confirmed: string | null = null;
	let latestSettled = true;
	const pick = async (id: string): Promise<AvatarPickOutcome> => {
		if (id === deps.get()) return { status: 'ignored' };
		if (pending === 0) confirmed = deps.get();
		const ticket = ++latest;
		pending += 1;
		latestSettled = false;
		deps.set(id);
		let result: AvatarSendResult;
		try {
			result = await deps.send(id);
		} catch {
			result = { ok: false, message: 'Something went wrong.' };
		}
		pending -= 1;
		if (result.ok) confirmed = result.avatarId || id;
		if (ticket !== latest) {
			// an earlier pick the server did accept after the latest one already went back: show what the server holds
			if (result.ok && latestSettled && deps.get() !== confirmed) deps.set(confirmed);
			return { status: 'stale' };
		}
		latestSettled = true;
		if (result.ok) {
			if (confirmed !== deps.get()) deps.set(confirmed);
			return { status: 'saved' };
		}
		deps.set(confirmed);
		return { status: 'reverted', message: result.message };
	};
	return { pick };
};
