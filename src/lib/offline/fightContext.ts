import { ITEM_CATALOG } from '@/catalog';
import { quickHealOf } from '@/catalog/buffs';
import type { StoredSave } from '@/lib/cloudSave/pipeline';
import {
	COSMETIC_EVENTS,
	LOG_HARD_CAP,
	LOG_KEEP,
	freshCombat,
	type CombatState,
	type FightEvent,
	type FightRecord,
	type PlayerProfile,
} from '@/lib/offline/fightTypes';
import { bagCountOf } from '@/lib/offline/inventory';
import type { Ledger } from '@/lib/offline/ledger';
import { savedVitals } from '@/lib/offline/profile';
import { sealedRng } from '@/lib/offline/seal';
import type { Rng } from '@/lib/rng';

// SERVER ONLY. What every piece of the fight engine shares (fight.ts runs them): the request's environment, the working copy of one request's
// state (`FightCtx`) and the few helpers all of them need (the event log, the sealed random stream, the vitals the fight is judged on).
// The order of the engine's modules, each importing only the ones before it: fightContext, fightProfile, fightTargets, fightSteps, fight.

export interface CombatEnv {
	secret: string;
	userId: string;
	stored: StoredSave;
	/** Server clock, epoch seconds */
	nowSec: number;
}

/** Below this a difference is rounding, not game: a swing that is due "now" is due. */
export const EPS = 1e-9;

/**
 * One request's working state: the combat record being stepped (`c`, a copy of the ledger's), the ledger it will be written back to (a kill
 * pays into it, a potion leaves its bag: it is replaced, never mutated) and the numbers that do not change while the request runs.
 */
export interface FightCtx {
	env: CombatEnv;
	c: CombatState;
	ledger: Ledger;
	/** The player's strength as the last accepted save says (a fight freezes its own copy when it starts) */
	profileNow: PlayerProfile;
	/** Catalog ids of the potions that heal */
	potionIds: string[];
}

/** Catalog ids of the potions that heal. */
export const healingPotionIds = (): string[] => Object.keys(ITEM_CATALOG).filter((id) => quickHealOf(ITEM_CATALOG[id]) > 0);

/** The combat record of a ledger, seeded from the saved HP and mana the first time. */
export const combatOf = (ledger: Ledger, env: CombatEnv): CombatState => {
	if (ledger.combat) return ledger.combat;
	const vitals = savedVitals(env.stored.core);
	return freshCombat(env.nowSec, vitals.hp, vitals.mp);
};

/** The HP a potion's heal over time gives over the `dt` seconds that begin at `from` (0 when none runs). */
export const regenGain = (c: CombatState, from: number, dt: number): number =>
	c.regen ? c.regen.hpPerSec * Math.max(0, Math.min(dt, c.regen.untilSec - from)) : 0;

/** Adds an event to the log (numbered), dropping the cosmetic ones first when the log is over its size. */
export const pushEvent = (ctx: FightCtx, t: number, kind: FightEvent['kind'], extra: Partial<FightEvent> = {}): void => {
	const c = ctx.c;
	c.eventNo++;
	c.log.push({ no: c.eventNo, t, kind, ...extra });
	if (c.log.length > LOG_KEEP) {
		let drop = c.log.length - LOG_KEEP;
		c.log = c.log.filter((event) => !(drop > 0 && COSMETIC_EVENTS.has(event.kind) && drop-- > 0));
	}
	if (c.log.length > LOG_HARD_CAP) c.log.splice(0, c.log.length - LOG_HARD_CAP);
};

/**
 * The next random stream of a fight: sealed on the secret, the user, the run and the fight's ordinal, one draw per call.
 *
 * @category Combat/A fight
 * @order 11
 */
export const rngFor = (ctx: FightCtx, f: FightRecord): Rng =>
	sealedRng(ctx.env.secret, ctx.env.userId, ctx.ledger.runId, 'fight', f.ord * 100000 + (f.seq++ % 100000));

/** The max HP and level the hero is judged on: the open fight's frozen numbers, else the saved ones. */
export const maxHpNow = (ctx: FightCtx): number => (ctx.c.fight ? ctx.c.fight.profile.maxHp : ctx.profileNow.maxHp);
export const levelNow = (ctx: FightCtx): number => (ctx.c.fight ? ctx.c.fight.profile.level : ctx.profileNow.level);

/** Potions of a kind in the bag. */
export const stockOf = (ctx: FightCtx, id: string): number => bagCountOf(ctx.ledger.inv!, id);
