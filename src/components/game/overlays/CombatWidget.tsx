import React, { useCallback, useEffect, useRef, useState } from 'react';
import { formatCompact } from '@/utils/formatters';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { useRewardPendingStore } from '@/stores/rewardPendingStore';
import { COMBAT } from '@/config/combatConfig';
import { SKILL_IDS } from '@/catalog/skills';
import { ITEM_CATALOG } from '@/catalog';
import { healHpOf } from '@/catalog/buffs';
import { autoBattleUnlocked } from '@/lib/combat';
import { monsterDef, monsterStats } from '@/lib/monsters';
import { slashFor, SLASH_SHEETS, type SlashFx } from '@/config/slashFx';
import { COMBAT_EVENT, hitNumberText, type CombatFx } from '@/lib/combatFx';
import audioManager from '@/utils/audioManager';
import { formatRest, useRestCountdown } from '@/hooks/useRestCountdown';
import MonsterArt from '../MonsterArt';
import NotifyDot from '../NotifyDot';
import CombatPanel, { drainMs, type FloatNumber } from './CombatPanel';
import PixelIcon from '../PixelIcon';
import type { FightView } from '@/lib/offline/fightTypes';
import type { MonsterType } from '@/types/game';

/** "1 min 12 s" or "45 s" */

const typingInField = (target: EventTarget | null): boolean => {
	const el = target as HTMLElement | null;
	return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
};

/**
 * The combat window. It opens the moment a monster is clicked (a loading state until the server answers), shows the fight (HP bars that
 * drain smoothly between the server's answers), and when the fight is over it is the same window with the result in it: the bars finish
 * draining, then the monster lies dead (a skull and crossbones) with its loot under it, until the window is closed (or after a while). A click on a
 * monster starts the fight (or Auto-battle does, one monster after the other); the server swings both ways at each side's attack speed
 * (see src/lib/offline/fight.ts), so this only shows what it says. Flee leaves a fight (and switches Auto-battle off).
 * Potions and skills are used with the number keys (their slots are not buttons); the switches (also in the right-click menu) are
 * Auto-battle and Auto-use (it drinks, heals and stuns with fixed rules).
 * The window shrinks to an icon (a click on a monster opens it again).
 */
/** The queue under the minimized icon: the next monsters in order (the first is the next fight), and how many more wait. */
const QueueChips: React.FC<{ queue: { n: number; type: MonsterType; level: number }[]; max: number }> = ({ queue, max }) => {
	if (queue.length === 0) return null;
	const shown = queue.slice(0, 4);
	return (
		<span
			className='combat-queue-chips'
			title={`Next in line (${queue.length}/${max}): ${queue.map((q) => monsterDef(q.type).label).join(', ')}`}
			aria-label={`${queue.length} monsters queued`}
		>
			{shown.map((q, i) => (
				<span key={q.n} className='combat-queue-chip' data-next={i === 0}>
					<MonsterArt type={q.type} scale={1} />
				</span>
			))}
			{queue.length > shown.length && <span className='combat-queue-more'>+{queue.length - shown.length}</span>}
		</span>
	);
};

const CombatWidget: React.FC = () => {
	const combat = useGameStore((state) => state.combat);
	const playerHp = useGameStore((state) => state.playerHp);
	const playerMp = useGameStore((state) => state.playerMp);
	const bag = useGameStore((state) => state.bag);
	const level = useGameStore((state) => state.level.level);
	const autoLocked = useGameStore((state) => !autoBattleUnlocked(state.prestige.rebirths));
	const requestPotion = useGameStore((state) => state.requestPotion);
	const requestSkill = useGameStore((state) => state.requestSkill);
	const setAutoBattle = useGameStore((state) => state.setAutoBattle);
	const setAutoUse = useGameStore((state) => state.setAutoUse);
	const flee = useGameStore((state) => state.flee);
	const unqueueMonster = useGameStore((state) => state.unqueueMonster);
	const clearNotice = useGameStore((state) => state.clearCombatNotice);
	const minimized = useUiStore((state) => state.combatMinimized);
	const setPref = useUiStore((state) => state.setPref);

	const [numbers, setNumbers] = useState<FloatNumber[]>([]);
	const [slashes, setSlashes] = useState<SlashFx[]>([]);
	const [hitTick, setHitTick] = useState(0);
	const [shake, setShake] = useState(false);
	const nextId = useRef(1);
	const shakeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

	const fight = combat.fight;
	const pending = combat.pending;
	const notice = combat.notice;
	// the rest before the queue's next fight, counted down here between the server's answers (it says how long, not every second)
	const restLeft = useRestCountdown(combat.resting && combat.queue.length > 0 ? combat.restEndsAt : null);
	const pushNumber = useCallback((text: string, kind: FloatNumber['kind']) => {
		const id = nextId.current++;
		setNumbers((prev) => [...prev.slice(-8), { id, text, kind, x: 20 + Math.random() * 60 }]);
		setTimeout(() => setNumbers((prev) => prev.filter((n) => n.id !== id)), 900);
	}, []);

	const pushSlash = useCallback((kind: Parameters<typeof slashFor>[0], onHero: boolean) => {
		const id = nextId.current++;
		const name = slashFor(kind, id);
		setSlashes((prev) => [...prev.slice(-3), { id, name, onHero, mirror: id % 2 === 0 }]);
		setTimeout(() => setSlashes((prev) => prev.filter((s) => s.id !== id)), SLASH_SHEETS[name].ms + 40);
	}, []);

	// The picture is driven by the events the server reported (see the store's playFx). Being hit makes the window shake and flash, with no
	// sound: a sound on every bite was confusing next to the sounds of the rest of the game.
	useEffect(() => {
		const onFx = (e: Event) => {
			const fx = (e as CustomEvent<CombatFx>).detail;
			if (fx.kind === 'hit') {
				setHitTick((t) => t + 1);
				pushSlash(fx.crit === 'none' ? 'hit' : fx.crit, false);
				pushNumber(hitNumberText(fx.damage, fx.crit), fx.crit === 'none' ? 'dmg' : fx.crit);
			} else if (fx.kind === 'hurt') {
				pushSlash('hurt', true);
				setShake(true);
				clearTimeout(shakeTimer.current);
				shakeTimer.current = setTimeout(() => setShake(false), 320);
				pushNumber(fx.crit ? `-${formatCompact(fx.amount)}!` : `-${formatCompact(fx.amount)}`, 'hurt');
			} else if (fx.kind === 'heal') {
				pushNumber(`+${formatCompact(fx.amount)}`, 'heal');
				audioManager.playSound('purchase');
			} else if (fx.kind === 'resist') pushNumber('Resisted!', 'resist');
			else if (fx.kind === 'stun') {
				pushNumber('Stunned!', 'stun');
				pushSlash('stun', false);
			}
		};
		window.addEventListener(COMBAT_EVENT, onFx);
		return () => {
			window.removeEventListener(COMBAT_EVENT, onFx);
			clearTimeout(shakeTimer.current);
		};
	}, [pushNumber, pushSlash]);

	// The last fight the server reported stays in hand after it ends: the window keeps showing it while its bars finish draining
	const lastFight = useRef<{ fight: FightView; at: number } | null>(null);
	useEffect(() => {
		if (fight) lastFight.current = { fight, at: performance.now() };
		else if (!notice && !pending) lastFight.current = null;
	}, [fight, notice, pending]);

	// The result takes the place of the fight once the bars have run to their last numbers (about the time since the server's last
	// answer, as the bars themselves take): the window never goes away in between. Without a fight to finish (the kill happened while
	// away) there is nothing to wait for.
	const noticeId = notice?.id;
	const noticeKind = notice?.kind;
	const [revealedId, setRevealedId] = useState<number>();
	const showResult = !!notice && !fight && !pending && (revealedId === noticeId || !lastFight.current);
	useEffect(() => {
		if (noticeId === undefined || fight || pending || revealedId === noticeId) return;
		const last = lastFight.current;
		const wait = last ? (drainMs(performance.now() - last.at) ?? 0) : 0;
		const timer = setTimeout(() => setRevealedId(noticeId), wait);
		return () => clearTimeout(timer);
	}, [noticeId, fight, pending, revealedId]);

	// A win whose result is not shown yet (the bars are still draining): the little chest covers the wait for the loot
	const awaitingLoot = noticeKind === 'won' && !fight && !pending && !showResult;
	useEffect(() => {
		if (!awaitingLoot) return;
		const { begin, end } = useRewardPendingStore.getState();
		begin();
		return end;
	}, [awaitingLoot]);

	// A won fight is announced with the fanfare as the result appears; the result closes itself after a while (hover keeps it open)
	const armClose = useCallback(() => {
		clearTimeout(closeTimer.current);
		closeTimer.current = setTimeout(clearNotice, COMBAT.victoryToastSec * 1000);
	}, [clearNotice]);
	useEffect(() => {
		if (!showResult) return;
		if (noticeKind === 'won') audioManager.playSound('fanfare');
		armClose();
		return () => clearTimeout(closeTimer.current);
	}, [showResult, noticeId, noticeKind, armClose]);

	// Up to three potion stacks from the bag, with hotkeys 1-3
	const potions = bag
		.map((slot, index) => ({ slot, index }))
		.filter(({ slot }) => slot && 'id' in slot && healHpOf(ITEM_CATALOG[slot.id]) > 0)
		.slice(0, 3);

	// Hotkeys: 1-3 drink the potions, 4 and 5 cast the skills (the server decides whether it goes through)
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (typingInField(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
			const n = Number(e.key);
			if (!Number.isInteger(n) || n < 1) return;
			const potion = potions[n - 1]?.slot;
			if (n <= 3 && potion && 'id' in potion) requestPotion(potion.id);
			else if (n >= 4 && n < 4 + SKILL_IDS.length) requestSkill(SKILL_IDS[n - 4]);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [potions, requestPotion, requestSkill]);

	// The hero rests before the queue's next monster (it starts by itself): the queue and the rest stay on screen, as a small icon in either mode
	if (combat.maxHp > 0 && !fight && !pending && !notice && combat.resting && combat.queue.length > 0) {
		const next = combat.queue[0];
		const left = restLeft ?? combat.restSec;
		const wait = formatRest(left);
		return (
			<div className='combat-icon-wrap'>
				<button
					className='combat-icon'
					data-resting='true'
					onClick={() => useUiStore.getState().showToast(`Resting before the next fight (${monsterDef(next.type).label}), about ${wait}. It starts by itself.`)}
					title={`Resting before the next fight against the ${monsterDef(next.type).label} (about ${wait})`}
					aria-label='Resting before the next queued fight'
				>
					<span className='combat-icon-art' aria-hidden>
						<MonsterArt type={next.type} scale={2} />
					</span>
					<span className='combat-icon-hp' aria-hidden>
						<i style={{ width: `${Math.max(0, Math.min(100, (playerHp / combat.maxHp) * 100))}%` }} />
					</span>
					<span className='combat-icon-rest' aria-hidden>
						Rest {left}s
					</span>
				</button>
				<QueueChips queue={combat.queue} max={combat.queueMax} />
			</div>
		);
	}

	// nothing to show: the server has not said anything yet, or there is no fight, no click waiting for the server and no result to read
	if (combat.maxHp <= 0 || (!fight && !pending && !notice)) return null;

	const hpPct = Math.max(0, Math.min(100, (playerHp / combat.maxHp) * 100));

	// what the window is about: the open fight, the monster that was just clicked (the server has not answered yet), or the last result
	const type = fight?.type ?? pending?.type ?? notice!.type;
	const monsterLevel = fight?.level ?? pending?.level ?? notice!.level;
	const def = monsterDef(type);

	// a click on a monster opens the window at once, minimized or not
	if (minimized && !pending) {
		// a won fight leaves the monster dead: grey, with a skull over it (the loot dot stays)
		const slain = !fight && notice?.kind === 'won';
		const monsterPct = fight && fight.monsterMaxHp > 0 ? Math.max(0, Math.min(100, (fight.monsterHp / fight.monsterMaxHp) * 100)) : null;
		return (
			<div className='combat-icon-wrap'>
				<button
					className='combat-icon'
					data-fighting={!!fight}
					data-slain={slain}
					onClick={() => setPref('combatMinimized', false)}
					title={
						fight
							? `Fighting a ${def.label} (level ${monsterLevel})${combat.queue.length ? `, ${combat.queue.length} waiting` : ''} - click to open`
							: `The fight against the ${def.label} is over - click to see the result`
					}
					aria-label='Open the combat panel'
				>
					<span className='combat-icon-art' aria-hidden>
						<MonsterArt type={type} scale={2} />
						{slain && <PixelIcon name='skull' scale={0.5} className='combat-icon-skull' />}
						{fight && <span className='combat-icon-level'>{monsterLevel}</span>}
					</span>
					{monsterPct !== null && (
						<span className='combat-icon-hp combat-icon-hp-monster' aria-hidden>
							<i style={{ width: `${monsterPct}%` }} />
						</span>
					)}
					<span className='combat-icon-hp' aria-hidden>
						<i style={{ width: `${hpPct}%` }} />
					</span>
					<NotifyDot show={!fight && !!notice} label='Fight result waiting' />
				</button>
				<QueueChips queue={combat.queue} max={combat.queueMax} />
			</div>
		);
	}

	// the same window for the fight and its result: the bars stay, the stage shows the monster dead after a win, the loot comes under it
	const over = showResult ? notice! : null;
	const dead = over?.kind === 'won';
	const shownFight = fight ?? lastFight.current?.fight ?? null;
	const traits = monsterStats(type, monsterLevel);
	const monsterHp = dead ? 0 : (shownFight?.monsterHp ?? traits.maxHp);
	const monsterMaxHp = shownFight?.monsterMaxHp ?? traits.maxHp;
	const snapKey = shownFight ? `fight-${shownFight.n}` : pending ? 'pending' : `notice-${noticeId}`;

	return (
		<CombatPanel
			monster={{ type, level: monsterLevel, lucky: !!(fight?.lucky ?? lastFight.current?.fight.lucky ?? over?.summary?.lucky) }}
			fight={fight}
			loading={!fight && !notice}
			over={over}
			monsterHp={monsterHp}
			monsterMaxHp={monsterMaxHp}
			snapKey={snapKey}
			player={{ hp: playerHp, maxHp: combat.maxHp, mp: playerMp, maxMp: combat.maxMp, level }}
			cd={combat.cd}
			potions={potions}
			autoBattle={combat.autoBattle}
			autoLocked={autoLocked}
			autoUse={combat.autoUse}
			autoNote={combat.autoNote}
			numbers={numbers}
			slashes={slashes}
			hitTick={hitTick}
			shake={shake}
			queue={combat.queue}
			queueMax={combat.queueMax}
			restSec={!fight && restLeft !== null && combat.queue.length > 0 ? restLeft : null}
			restLabel={combat.queue[0] ? monsterDef(combat.queue[0].type).label : undefined}
			onUnqueue={unqueueMonster}
			onFlee={flee}
			onCloseResult={clearNotice}
			onMinimize={() => setPref('combatMinimized', true)}
			onAutoBattle={setAutoBattle}
			onAutoUse={setAutoUse}
			onMouseEnter={() => clearTimeout(closeTimer.current)}
			onMouseLeave={() => showResult && armClose()}
		/>
	);
};

export default CombatWidget;
