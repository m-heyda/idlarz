import { isSkillId } from '@/lib/skills';
import { KEY, onlineRoute } from '@/lib/offlineRoute';
import { fightStep, type FightRequest } from '@/lib/offline/online';

export const dynamic = 'force-dynamic';

const since = (value: unknown): number | undefined => (Number.isInteger(value) && (value as number) >= 0 ? (value as number) : undefined);

/** `{ key, action, ... }` with action `sync`, `use` (`{ kind: 'potion', id } | { kind: 'skill', id } | { kind: 'fight', n }`), `auto` (`autoBattle?`, `autoUse?`) or `dismiss` (`n`). */
const parse = (body: Record<string, unknown>): { key: string | null; request: FightRequest } | null => {
	const key = typeof body.key === 'string' && KEY.test(body.key) ? body.key : null;
	const common = since(body.since);
	switch (body.action) {
		case 'sync':
			return { key: null, request: { action: 'sync', since: common } };
		case 'use': {
			const command = body.command as { kind?: unknown; id?: unknown; n?: unknown } | undefined;
			if (key && command?.kind === 'fight' && Number.isInteger(command.n) && (command.n as number) > 0)
				return { key, request: { action: 'use', command: { kind: 'fight', n: command.n as number }, since: common } };
			if (!key || !command || typeof command.id !== 'string') return null;
			if (command.kind === 'potion') return { key, request: { action: 'use', command: { kind: 'potion', id: command.id }, since: common } };
			if (command.kind === 'skill' && isSkillId(command.id)) return { key, request: { action: 'use', command: { kind: 'skill', id: command.id }, since: common } };
			return null;
		}
		case 'auto': {
			const autoBattle = typeof body.autoBattle === 'boolean' ? body.autoBattle : undefined;
			const autoUse = typeof body.autoUse === 'boolean' ? body.autoUse : undefined;
			return autoBattle === undefined && autoUse === undefined ? null : { key: null, request: { action: 'auto', autoBattle, autoUse, since: common } };
		}
		case 'dismiss':
			return key && Number.isInteger(body.n) && (body.n as number) > 0 ? { key, request: { action: 'dismiss', n: body.n as number, since: common } } : null;
		default:
			return null;
	}
};

/** The one door for combat: no click ever hits anything, the browser only asks the server to carry the fight on, start one against a monster, press a hotkey, flip a switch or dismiss a monster. */
export async function POST(request: Request) {
	return onlineRoute(request, parse, (deps, userId, body, nowMs) => fightStep(deps, userId, body.key, body.request, nowMs));
}
