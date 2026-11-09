import type { ActiveBuff } from '@/lib/buffs';
import type { SkillId } from '@/catalog/skills';
import type { Drop, MonsterType } from '@/types/game';

// The shapes of server-run combat: what the ledger keeps (CombatState), what the engine says happened (FightEvent) and what the browser
// is shown (CombatView). Plain data, no node imports, so the client can import it.

/** What the player brings to a fight, worked out from the last accepted save when the fight starts and then frozen for that fight. */
export interface PlayerProfile {
	level: number;
	maxHp: number;
	maxMp: number;
	/** Damage of one swing before crits (gear damage times the attribute bonus of the weapon type) */
	hit: number;
	/** Crit chance and the share of crits that become super crits (0-1), and the extra damage the attributes put on crits (1 = none) */
	crit: number;
	superCrit: number;
	critExtra: number;
	/** Swings per second (the weapon's attack speed and Dexterity) */
	attacksPerSec: number;
	armor: number;
	/** Chance (0-1) that a monster's hit misses */
	dodge: number;
	/** Life Leech in % of the damage dealt */
	leechPct: number;
	/** Gear regeneration per second (works in fights too) and mana regeneration per second */
	hpRegen: number;
	mpRegen: number;
	/** What a Heal restores */
	heal: number;
}

/** The one fight a player has open. The monster stands on its ticket; the player's numbers are frozen in `profile`. */
export interface FightRecord {
	/** Ticket number of the monster, and what it is */
	n: number;
	type: MonsterType;
	/** Its level when the fight began (its HP, attack and armor stay what that level gave) */
	level: number;
	lucky: boolean;
	monsterHp: number;
	monsterMaxHp: number;
	/** Seconds of winding up towards the next swing of the player and of the monster */
	playerTimer: number;
	monsterTimer: number;
	/** Seconds the monster stays stunned: its timer does not run */
	stunLeft: number;
	/** Seconds the fight has lasted, and what is left of a boss's clock (null: no clock) */
	elapsed: number;
	timeLeftSec: number | null;
	/** Ordinal of the fight in this run (its random numbers are sealed on it) and how many have been drawn */
	ord: number;
	seq: number;
	profile: PlayerProfile;
	/** The place on the map, for the picture */
	x: number;
	y: number;
}

export interface Cooldowns {
	heal: number;
	stun: number;
	potion: number;
}

/** One thing that happened, numbered so a browser that asks "since 41" gets each one exactly once. */
export interface FightEvent {
	no: number;
	/** Server clock (epoch seconds) */
	t: number;
	kind: 'engage' | 'hit' | 'crit' | 'super' | 'hurt' | 'dodged' | 'heal' | 'potion' | 'stun' | 'resist' | 'won' | 'defeated' | 'timeout' | 'retreat';
	/** Damage dealt/taken or HP healed */
	amount?: number;
	/** `hurt` by a crit */
	crit?: boolean;
	/** The potion that was drunk */
	id?: string;
	/** The monster's ticket and name (`engage`, `won`, `defeated`, `timeout`, `retreat`) */
	n?: number;
	type?: MonsterType;
	level?: number;
	/**
	 * What a kill paid (`won`). The server has already put the drops where they go: `stored` is what went into the bag, `convertedGold` what
	 * the ones that did not fit were worth and `autoSold` what the auto-sell filter sold; the gold the player gets is `gold` plus those two.
	 */
	reward?: {
		gold: number;
		xp: number;
		hide?: number;
		items: Drop[];
		stored?: Drop[];
		convertedGold?: number;
		autoSold?: { count: number; gold: number };
		pity: Record<string, number>;
		lucky: boolean;
	};
}

/** The server's record of a player's combat: vitals, cooldowns, the open fight and the switches. Lives in the ledger. */
export interface CombatState {
	/** Server clock (epoch seconds) the vitals, cooldowns and the fight are simulated up to */
	at: number;
	hp: number;
	mp: number;
	cd: Cooldowns;
	fight: FightRecord | null;
	autoBattle: boolean;
	autoUse: boolean;
	/** Fights started this run */
	ord: number;
	/** Monsters that beat the player (or ran out the clock) by ticket number: not tried again before this (epoch seconds) */
	retryAt: Record<string, number>;
	/** Potions drunk this run by id, and how many of those the last accepted save already knew about */
	/** Ticket numbers of the monsters waiting to be fought after the open fight, in the order clicked (docs/reference/combat.md). Rows from before have none: read it as empty. */
	queue: number[];
	/** A heal over time from a potion (`regen` effect): HP per second until the second `untilSec` (absent: none) */
	regen?: { hpPerSec: number; untilSec: number };
	/** Number of the last event, and the most recent ones */
	eventNo: number;
	log: FightEvent[];
}

/** The log keeps this many events, dropping the cosmetic ones (swings) first: a result (a win with its loot, a potion drunk) stays until the browser has acknowledged it, up to the hard cap. */
export const LOG_KEEP = 40;
export const LOG_HARD_CAP = 100;
export const COSMETIC_EVENTS: ReadonlySet<FightEvent['kind']> = new Set(['hit', 'crit', 'super', 'hurt', 'dodged']);

export const freshCooldowns = (): Cooldowns => ({ heal: 0, stun: 0, potion: 0 });

export const freshCombat = (nowSec: number, hp: number, mp: number): CombatState => ({
	at: nowSec,
	hp,
	mp,
	cd: freshCooldowns(),
	fight: null,
	autoBattle: false,
	autoUse: true,
	ord: 0,
	retryAt: {},
	queue: [],
	eventNo: 0,
	log: [],
});

/** What the player asks for by hand: a hotkey, or a click on a monster (`n` is its ticket number). */
export type CombatCommand = { kind: 'potion'; id: string } | { kind: 'skill'; id: SkillId } | { kind: 'fight'; n: number } | { kind: 'unqueue'; n: number };

/** What a click on a monster did while a fight was open: it joined the queue, left it again (a second click), or was refused. */
export type QueueResult = 'queued' | 'removed' | 'full' | 'refused';

/** The fight as the browser sees it (the numbers it needs to draw the panel and the map). */
export interface FightView {
	n: number;
	type: MonsterType;
	level: number;
	lucky: boolean;
	monsterHp: number;
	monsterMaxHp: number;
	stunLeft: number;
	timeLeftSec: number | null;
	x: number;
	y: number;
}

/** The kinds of animated event a plan carries, by the index its `fx` rows use. */
export const PLAN_FX_KINDS = ['hit', 'crit', 'super', 'hurt', 'hurtCrit', 'heal', 'stun', 'resist'] as const;

/**
 * Where an open fight is going, so the browser can animate it and ask again only when it is over: the server runs the fight to its end on a copy.
 * `samples` are `[seconds from the view's `at`, hero HP, monster HP, hero mana]` (first row at 0, last at the end, linear in between; the mana
 * column may be missing on a plan from an older server); `fx` are the swings and spells to fly, `[seconds from the view, index into PLAN_FX_KINDS,
 * amount]`. A hotkey, a click or any other command makes a new plan.
 */
export interface FightPlan {
	endsInSec: number;
	outcome: 'won' | 'defeated' | 'timeout' | 'retreat';
	samples: [number, number, number, number?][];
	fx: [number, number, number][];
}

export interface CombatView {
	hp: number;
	mp: number;
	maxHp: number;
	maxMp: number;
	cd: Cooldowns;
	fight: FightView | null;
	/** The open fight run to its end (left out when there is none, or the server is `behind`): the browser polls again when it is over */
	plan?: FightPlan;
	autoBattle: boolean;
	autoUse: boolean;
	/** Seconds until the soonest monster that beat the player may be tried again (0: none is waiting out) */
	retrySec: number;
	/** The monsters waiting for their turn, first to fight first (derived from the tickets: one that is gone is not listed) */
	queue?: { n: number; type: MonsterType; level: number; lucky?: boolean }[];
	/** How many the queue can hold */
	queueMax?: number;
	/** Server clock (epoch seconds) of this picture */
	at: number;
	eventNo: number;
	/** Events newer than the `since` the browser sent */
	events: FightEvent[];
	/** The server stopped simulating at its per-request limit: ask again soon */
	behind: boolean;
	/** Seconds until the browser should ask again */
	nextPollSec: number;
	/** No fight is open and the hero is resting before the queue's next monster (it starts by itself once the HP is back above the resume line) */
	resting?: boolean;
	/** Seconds until that rest is over (only while `resting`) */
	restSec?: number;
	/** Why auto-battle is idle although monsters wait: none of them looks winnable (see offline/winChance.ts); a click fights one anyway */
	autoNote?: 'no_winnable' | null;
	/** The potion buffs running at `at` (left out when none) */
	buffs?: ActiveBuff[];
}
