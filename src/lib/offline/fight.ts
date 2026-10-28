import { SKILLS, type SkillId } from '@/catalog/skills';
import { COMBAT } from '@/config/combatConfig';
import { ITEM_CATALOG } from '@/config/itemCatalog';
import type { StoredSave } from '@/lib/cloudSave/pipeline';
import { armorReduction, mitigate, swing } from '@/lib/combat';
import { isBoss, levelAtAge, monsterDef, monsterStats } from '@/lib/monsters';
import {
	COSMETIC_EVENTS,
	LOG_HARD_CAP,
	LOG_KEEP,
	freshCombat,
	freshCooldowns,
	type CombatCommand,
	type CombatState,
	type CombatView,
	type FightEvent,
	type FightRecord,
	type PlayerProfile,
} from '@/lib/offline/fightTypes';
import type { Ledger } from '@/lib/offline/ledger';
import { isPlaced } from '@/lib/offline/placement';
import { bagCount, playerProfile, savedVitals } from '@/lib/offline/profile';
import { payKill } from '@/lib/offline/reward';
import { sealedRng } from '@/lib/offline/seal';
import { takeMonster, type MonsterTicket } from '@/lib/offline/tickets';
import type { Rng } from '@/lib/rng';

// SERVER ONLY. The fight engine. Combat is a pure function of the player's saved strength, the monster's ticket and a sealed random
// stream, stepped in fixed ticks (COMBAT.tickSec): the player swings at the weapon's attack speed, the monster at its own, and
// cooldowns, mana and stun run on the same clock. There is no server process ticking in the background: every request fast-forwards
// the player's combat from where it stopped to the server clock (at most COMBAT.maxCatchUpSec of fighting), so a missed poll loses nothing
// and nobody can speed a fight up by asking more often.

export interface CombatEnv {
	secret: string;
	userId: string;
	stored: StoredSave;
	/** Server clock, epoch seconds */
	nowSec: number;
}

const EPS = 1e-9;
const round1 = (value: number): number => Math.round(value * 10) / 10;

/** The combat record of a ledger, seeded from the saved HP and mana the first time. */
export const combatOf = (ledger: Ledger, env: CombatEnv): CombatState => {
	if (ledger.combat) return ledger.combat;
	const vitals = savedVitals(env.stored.core);
	return freshCombat(env.nowSec, vitals.hp, vitals.mp);
};

/**
 * The next monster to engage: placed normal monsters first (the weakest, or the oldest: COMBAT.auto.engageOrder), then the King. One that
 * beat the player is left alone until its retry time has passed, so an unbeatable monster never blocks the easy ones.
 */
const pickTarget = (ledger: Ledger, combat: CombatState, tSec: number): { ticket: MonsterTicket; type: 'rat' | 'ratKing' } | null => {
	const ready = (ticket: MonsterTicket) => isPlaced(ticket) && tSec >= (combat.retryAt[ticket.n] ?? 0);
	const levelOf = (ticket: MonsterTicket) => levelAtAge(ticket.spawnLevel ?? 1, tSec - ticket.at);
	const rats = ledger.bank.rats.filter(ready).sort((a, b) => (COMBAT.auto.engageOrder === 'weakest' ? levelOf(a) - levelOf(b) : 0) || a.n - b.n);
	if (rats[0]) return { ticket: rats[0], type: 'rat' };
	const king = ledger.bank.king;
	if (king && ready(king)) return { ticket: king, type: 'ratKing' };
	return null;
};

/** The soonest time a monster that is waiting out its retry cooldown becomes a target again (Infinity: none). */
const nextRetry = (ledger: Ledger, combat: CombatState, tSec: number): number => {
	let soonest = Infinity;
	for (const ticket of [...ledger.bank.rats, ...(ledger.bank.king ? [ledger.bank.king] : [])]) {
		const at = combat.retryAt[ticket.n] ?? 0;
		if (isPlaced(ticket) && at > tSec) soonest = Math.min(soonest, at);
	}
	return soonest;
};

export interface CombatTotals {
	ledger: Ledger;
	behind: boolean;
}

/**
 * Brings the player's combat up to `env.nowSec`, then applies what the player asked for (switches, hotkeys) and starts the next fight when
 * auto-battle allows. Returns the new ledger. All events are in `ledger.combat.log`.
 */
export const runCombat = (input: Ledger, env: CombatEnv, ask: { commands?: CombatCommand[]; autoBattle?: boolean; autoUse?: boolean; ack?: number } = {}): CombatTotals => {
	let ledger = input;
	const base = combatOf(ledger, env);
	// what the browser has told us it applied (its `since`) is not kept: only cosmetic events are ever dropped unacknowledged
	const log = ask.ack === undefined ? [...base.log] : base.log.filter((event) => COSMETIC_EVENTS.has(event.kind) || event.no > ask.ack!);
	const c: CombatState = { ...base, cd: { ...base.cd }, consumed: { ...base.consumed }, log, fight: base.fight ? { ...base.fight } : null };
	const profileNow = playerProfile(env.stored.core);
	const potionIds = Object.keys(ITEM_CATALOG).filter((id) => ITEM_CATALOG[id].consumable?.healHp);

	const push = (t: number, kind: FightEvent['kind'], extra: Partial<FightEvent> = {}) => {
		c.eventNo++;
		c.log.push({ no: c.eventNo, t, kind, ...extra });
		if (c.log.length > LOG_KEEP) {
			let drop = c.log.length - LOG_KEEP;
			c.log = c.log.filter((event) => !(drop > 0 && COSMETIC_EVENTS.has(event.kind) && drop-- > 0));
		}
		if (c.log.length > LOG_HARD_CAP) c.log.splice(0, c.log.length - LOG_HARD_CAP);
	};
	const maxHpNow = () => (c.fight ? c.fight.profile.maxHp : profileNow.maxHp);
	const levelNow = () => (c.fight ? c.fight.profile.level : profileNow.level);
	const rngFor = (f: FightRecord): Rng => sealedRng(env.secret, env.userId, ledger.runId, 'fight', f.ord * 100000 + (f.seq++ % 100000));

	const tickCooldowns = (dt: number) => {
		c.cd = { heal: Math.max(0, c.cd.heal - dt), stun: Math.max(0, c.cd.stun - dt), potion: Math.max(0, c.cd.potion - dt) };
	};
	const stock = (id: string): number => Math.max(0, bagCount(env.stored.core, id) - Math.max(0, (c.consumed[id] ?? 0) - (c.consumedSeen[id] ?? 0)));

	const drink = (t: number, id: string): boolean => {
		const healHp = ITEM_CATALOG[id]?.consumable?.healHp;
		if (!healHp || stock(id) < 1 || c.hp >= maxHpNow() - EPS) return false;
		if (c.fight && c.cd.potion > 0) return false;
		const healed = Math.min(healHp, maxHpNow() - c.hp);
		c.hp += healed;
		c.consumed[id] = (c.consumed[id] ?? 0) + 1;
		if (c.fight) c.cd.potion = COMBAT.potionCooldownSec;
		push(t, 'potion', { id, amount: Math.round(healed) });
		return true;
	};

	const cast = (t: number, id: SkillId): boolean => {
		const skill = SKILLS[id];
		if (!skill || levelNow() < skill.unlockLevel || c.cd[id] > 0 || c.mp < skill.manaCost) return false;
		if (skill.fightOnly && !c.fight) return false;
		if (id === 'heal') {
			const profile = c.fight ? c.fight.profile : profileNow;
			if (c.hp >= maxHpNow() - EPS) return false;
			const healed = Math.min(profile.heal, maxHpNow() - c.hp);
			c.hp += healed;
			push(t, 'heal', { amount: Math.round(healed) });
		} else if (c.fight) {
			const stats = monsterStats(c.fight.type, c.fight.level);
			if (stats.stunResist > 0 && rngFor(c.fight)() * 100 < stats.stunResist) push(t, 'resist');
			else {
				c.fight.stunLeft = skill.stunSec ?? 0;
				push(t, 'stun', { amount: skill.stunSec ?? 0 });
			}
		}
		c.mp -= skill.manaCost;
		c.cd[id] = skill.cooldownSec;
		return true;
	};

	const autoUse = (t: number) => {
		const hpPct = (c.hp / maxHpNow()) * 100;
		if (c.cd.potion <= 0 && hpPct < COMBAT.auto.potionBelowHpPct) {
			const missing = maxHpNow() - c.hp;
			const options = potionIds.filter((id) => stock(id) > 0).sort((a, b) => ITEM_CATALOG[a].consumable!.healHp! - ITEM_CATALOG[b].consumable!.healHp!);
			const fit = options.find((id) => ITEM_CATALOG[id].consumable!.healHp! >= missing) ?? options[options.length - 1];
			if (fit) drink(t, fit);
		}
		if (hpPct < COMBAT.auto.healBelowHpPct) cast(t, 'heal');
		if (COMBAT.auto.stunWhenReady && c.fight && c.fight.stunLeft <= 0) cast(t, 'stun');
	};

	/** Opens the fight against a monster: the start of both an automatic and a chosen fight. */
	const start = (t: number, target: { ticket: MonsterTicket; type: 'rat' | 'ratKing' }): boolean => {
		const level = levelAtAge(target.ticket.spawnLevel ?? 1, t - target.ticket.at);
		const stats = monsterStats(target.type, level);
		const profile: PlayerProfile = profileNow;
		c.hp = Math.min(c.hp, profile.maxHp);
		c.mp = Math.min(c.mp, profile.maxMp);
		c.ord++;
		c.fight = {
			n: target.ticket.n,
			type: target.type,
			level,
			lucky: target.ticket.lucky,
			monsterHp: stats.maxHp,
			monsterMaxHp: stats.maxHp,
			playerTimer: 0,
			monsterTimer: 0,
			stunLeft: 0,
			elapsed: 0,
			timeLeftSec: monsterDef(target.type).timeLimitSec ?? null,
			ord: c.ord,
			seq: 0,
			profile,
			x: target.ticket.x ?? 0,
			y: target.ticket.y ?? 0,
		};
		push(t, 'engage', { n: target.ticket.n, type: target.type, level });
		return true;
	};

	/** Auto-battle's pick: only with the switch on and enough HP. */
	const engage = (t: number): boolean => {
		if (!c.autoBattle || c.hp < (profileNow.maxHp * COMBAT.auto.resumeHpPct) / 100) return false;
		const target = pickTarget(ledger, c, t);
		return target ? start(t, target) : false;
	};

	/** The player's pick (a click on a monster): works with auto-battle off, needs no HP threshold and ignores a monster's retry time. */
	const engageTicket = (t: number, n: number): boolean => {
		if (c.fight || c.hp <= 0) return false;
		const rat = ledger.bank.rats.find((ticket) => ticket.n === n && isPlaced(ticket));
		const king = ledger.bank.king && ledger.bank.king.n === n && isPlaced(ledger.bank.king) ? ledger.bank.king : undefined;
		if (rat) return start(t, { ticket: rat, type: 'rat' });
		return king ? start(t, { ticket: king, type: 'ratKing' }) : false;
	};

	const endFight = (t: number, kind: 'defeated' | 'timeout' | 'retreat') => {
		const f = c.fight!;
		push(t, kind, { n: f.n, type: f.type, level: f.level });
		if (kind !== 'retreat') {
			if (kind === 'defeated') c.hp = Math.round(f.profile.maxHp * COMBAT.knockoutHpFraction);
			c.retryAt[f.n] = t + (isBoss(f.type) ? COMBAT.auto.bossRetryCooldownSec : COMBAT.auto.retryCooldownSec);
		}
		c.fight = null;
	};

	/** One tick of the open fight. Returns when the fight ended. */
	const step = (t: number, dt: number) => {
		const f = c.fight!;
		const p = f.profile;
		const monster = monsterStats(f.type, f.level);
		f.elapsed += dt;
		c.hp = Math.min(p.maxHp, c.hp + p.hpRegen * dt);
		c.mp = Math.min(p.maxMp, c.mp + p.mpRegen * dt);
		tickCooldowns(dt);
		if (f.timeLeftSec !== null) f.timeLeftSec = Math.max(0, f.timeLeftSec - dt);
		if (c.autoUse) autoUse(t);

		const stunned = Math.min(f.stunLeft, dt);
		f.stunLeft -= stunned;

		// the player's swings
		f.playerTimer += dt;
		const period = 1 / Math.max(0.05, p.attacksPerSec);
		while (f.playerTimer >= period - EPS && f.monsterHp > 0) {
			f.playerTimer -= period;
			const rolled = swing(p.hit, { crit: p.crit, superCrit: p.superCrit }, p.critExtra, rngFor(f));
			const kind = rolled.crit === 'none' ? 'hit' : rolled.crit;
			const raw = rolled.damage;
			const damage = monster.armor > 0 ? Math.max(1, round1(raw * (1 - armorReduction(monster.armor)))) : raw;
			f.monsterHp = Math.max(0, f.monsterHp - damage);
			if (p.leechPct > 0) c.hp = Math.min(p.maxHp, c.hp + (damage * p.leechPct) / 100);
			push(t, kind, { amount: damage });
		}
		if (f.monsterHp <= 0) {
			const paid = payKill(env.secret, env.userId, ledger, env.stored, f.n, t);
			if (!paid) return endFight(t, 'retreat');
			ledger = paid.ledger;
			push(t, 'won', { n: f.n, type: f.type, level: paid.payout.level, reward: { gold: paid.payout.gold, xp: paid.payout.xp, hide: paid.payout.hide, items: paid.payout.items, pity: paid.payout.pity, lucky: paid.payout.lucky } });
			c.fight = null;
			return;
		}

		// the monster's swings (a stunned monster does not wind up)
		f.monsterTimer += dt - stunned;
		const every = 1 / Math.max(0.01, monster.attackSpeed);
		while (f.monsterTimer >= every - EPS && c.hp > 0) {
			f.monsterTimer -= every;
			const rng = rngFor(f);
			if (p.dodge > 0 && rng() >= 1 - p.dodge) {
				push(t, 'dodged');
				continue;
			}
			const crit = monster.critChance > 0 && rng() >= 1 - monster.critChance / 100;
			const amount = mitigate(crit ? Math.round(monster.attack * monster.critMult) : monster.attack, p.armor);
			c.hp = Math.max(0, c.hp - amount);
			push(t, 'hurt', { amount, crit });
		}
		if (c.hp <= 0) endFight(t, 'defeated');
		else if (f.timeLeftSec === 0 || f.elapsed >= COMBAT.maxFightSec) endFight(t, 'timeout');
	};

	// ---- fast-forward to now ----
	const now = env.nowSec;
	let t = Math.min(c.at, now);
	let budget = COMBAT.maxCatchUpSec;
	let behind = false;
	const idleRegen = COMBAT.regenPerSec + profileNow.hpRegen;
	for (let guard = 0; t < now - EPS && guard < 200000; guard++) {
		if (!c.fight) {
			if (engage(t)) continue;
			// nothing to fight yet: rest until something can change (HP back above the resume line, the King's retry time, or now)
			let until = now;
			if (c.autoBattle) {
				if (pickTarget(ledger, c, t)) {
					const need = (profileNow.maxHp * COMBAT.auto.resumeHpPct) / 100 - c.hp;
					if (need > 0 && idleRegen > 0) until = Math.min(until, t + need / idleRegen + EPS);
				} else {
					until = Math.min(until, nextRetry(ledger, c, t));
				}
			}
			const dt = Math.max(until - t, Math.min(COMBAT.tickSec, now - t));
			c.hp = Math.min(profileNow.maxHp, c.hp + idleRegen * dt);
			c.mp = Math.min(profileNow.maxMp, c.mp + profileNow.mpRegen * dt);
			tickCooldowns(dt);
			t += dt;
			continue;
		}
		const dt = Math.min(COMBAT.tickSec, now - t);
		t += dt;
		step(t, dt);
		budget -= dt;
		if (budget <= 0 && t < now - EPS) {
			behind = true;
			break;
		}
	}
	c.at = t;

	// ---- what the player asked for, at the clock's time ----
	if (ask.autoUse !== undefined) c.autoUse = ask.autoUse;
	if (ask.autoBattle !== undefined) {
		c.autoBattle = ask.autoBattle;
		if (!ask.autoBattle && c.fight) endFight(t, 'retreat');
	}
	for (const command of ask.commands ?? []) {
		if (command.kind === 'potion') drink(t, command.id);
		else if (command.kind === 'fight') {
			if (!behind) engageTicket(t, command.n);
		} else cast(t, command.id);
	}
	if (!behind && !c.fight) engage(t);

	// a retry time only matters for a monster that is still there
	const standing = new Set([...ledger.bank.rats.map((ticket) => ticket.n), ...(ledger.bank.king ? [ledger.bank.king.n] : [])].map(String));
	c.retryAt = Object.fromEntries(Object.entries(c.retryAt).filter(([n]) => standing.has(n)));

	return { ledger: { ...ledger, combat: c }, behind };
};

/** Takes a monster off the map without a fight (a monster that cannot be beaten, or that is in the way). Ends the fight against it. */
export const dismissTicket = (ledger: Ledger, env: CombatEnv, n: number): { ledger: Ledger; ok: boolean } => {
	const taken = takeMonster(ledger.bank, n);
	if (!taken) return { ledger, ok: false };
	const base = combatOf(ledger, env);
	const combat = base.fight?.n === n ? { ...base, fight: null } : base;
	return { ledger: { ...ledger, bank: taken.bank, combat }, ok: true };
};

/** A save that came in: the potions it already knows about are no longer "unsaved". */
export const markConsumedSeen = (combat: CombatState): CombatState => ({ ...combat, consumedSeen: { ...combat.consumed } });

/** After an absence the player is back on their feet: HP and mana refilled by resting for `gapSec`, no fight open, cooldowns over. */
export const restThrough = (ledger: Ledger, env: CombatEnv, gapSec: number): Ledger => {
	const base = combatOf(ledger, env);
	const p = playerProfile(env.stored.core);
	const rest = Math.max(0, gapSec);
	const combat: CombatState = {
		...base,
		at: env.nowSec,
		hp: Math.min(p.maxHp, base.hp + (COMBAT.regenPerSec + p.hpRegen) * rest),
		mp: Math.min(p.maxMp, base.mp + p.mpRegen * rest),
		cd: freshCooldowns(),
		fight: null,
	};
	return { ...ledger, combat };
};

/** The picture the browser is given: vitals, cooldowns, the open fight and the events it has not seen. */
export const combatView = (ledger: Ledger, env: CombatEnv, since: number, behind: boolean, nextSpawnSec: number | null): CombatView => {
	const c = combatOf(ledger, env);
	const p = c.fight ? c.fight.profile : playerProfile(env.stored.core);
	const f = c.fight;
	let nextPollSec: number = COMBAT.poll.minimizedSec;
	if (behind) nextPollSec = 0.5;
	else if (f) nextPollSec = COMBAT.poll.fightSec;
	else {
		// idle: ask again when something can change
		const waiting = pickTarget(ledger, c, c.at) !== null;
		const resume = (p.maxHp * COMBAT.auto.resumeHpPct) / 100;
		const retry = nextRetry(ledger, c, c.at);
		if (!c.autoBattle) nextPollSec = 600;
		else if (waiting && c.hp < resume) nextPollSec = Math.min(600, Math.ceil((resume - c.hp) / Math.max(0.1, COMBAT.regenPerSec + p.hpRegen)) + 1);
		else if (!waiting && Number.isFinite(retry)) nextPollSec = Math.min(nextSpawnSec ?? 600, Math.min(600, Math.ceil(retry - c.at) + 1));
		else if (!waiting) nextPollSec = Math.min(600, Math.max(COMBAT.poll.minimizedSec, Math.ceil(nextSpawnSec ?? 600) + 1));
	}
	return {
		hp: c.hp,
		mp: c.mp,
		maxHp: p.maxHp,
		maxMp: p.maxMp,
		cd: c.cd,
		fight: f ? { n: f.n, type: f.type, level: f.level, lucky: f.lucky, monsterHp: f.monsterHp, monsterMaxHp: f.monsterMaxHp, stunLeft: f.stunLeft, timeLeftSec: f.timeLeftSec, x: f.x, y: f.y } : null,
		autoBattle: c.autoBattle,
		autoUse: c.autoUse,
		retrySec: Number.isFinite(nextRetry(ledger, c, c.at)) ? Math.max(0, Math.ceil(nextRetry(ledger, c, c.at) - c.at)) : 0,
		at: c.at,
		eventNo: c.eventNo,
		events: c.log.filter((event) => event.no > since),
		behind,
		nextPollSec,
	};
};
